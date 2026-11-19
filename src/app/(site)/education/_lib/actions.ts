'use server'

import { Prisma } from '@prisma/client'
import { action, ActionError, ForbiddenError } from '@/lib/action'
import { recordAudit } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { hasCompleteBasicProfile } from '@/lib/profile'
import { getAcademy, progressLessons } from './content'
import { getBasicProfile, getCertificate, getProgress } from './queries'
import { allLessons, findLesson, isCorrect, lessonKey, printableName, progressOf, QUIZ_LOCK_MS, QUIZ_TRIES, quizLock, quizVariant, visitsToSync, type QuizLock, type QuizResult } from './rules'
import { certificateIdSchema, courseRefSchema, lessonRefSchema, quizAnswerSchema, syncProgressSchema } from './schemas'

// ponytail: lesson visits and quiz passes are the user's own learning telemetry, not audited
// (one row per lesson opened would drown the audit log). Issuing a certificate is audited.

/** Called once when a signed-in user opens a lesson - moves the resume point. Returns true on the first visit (progress changed). */
export const recordLessonVisit = action({ schema: lessonRefSchema, permission: 'user' }, async (input, user) => {
  const academy = getAcademy(input.academy)
  const found = academy && findLesson(academy, input.course, input.module, input.lesson)
  if (!found) throw new ActionError('Unknown lesson')
  const key = { userId: user.id, academy: academy.slug, lesson: lessonKey(found) }
  const { count } = await prisma.lessonVisit.createMany({ data: key, skipDuplicates: true })
  if (!count) await prisma.lessonVisit.update({ where: { userId_academy_lesson: key }, data: { visitedAt: new Date() } })
  return count > 0
})

/**
 * Grades a quiz answer - the browser doesn't know the answers. A try is taken *before* grading with one conditional
 * update, so answers sent in parallel can't get more than QUIZ_TRIES guesses. The 3rd wrong answer locks the question
 * for QUIZ_LOCK_MS. A passed question can be practised freely (other variants): nothing is counted or locked.
 */
export const answerQuiz = action({ schema: quizAnswerSchema, permission: 'user' }, async (input, user): Promise<QuizResult> => {
  const academy = getAcademy(input.academy)
  // Own keys only - "constructor" or "toString" would otherwise resolve to Object.prototype members.
  if (!academy || !Object.hasOwn(academy.quizzes, input.quizId)) throw new ActionError('Unknown quiz')
  const v = quizVariant(academy.quizzes[input.quizId], input.attempt)
  const correct = isCorrect(input.selected, v.correctAnswers)
  const key = { userId: user.id, academy: academy.slug, quizId: input.quizId }
  const where = { userId_academy_quizId: key }
  const answered = (lock: QuizLock | null): QuizResult => (correct ? { correct, correctAnswers: v.correctAnswers, explanation: v.explanation } : { correct, hint: v.hint, lock })

  if (await prisma.quizPass.findUnique({ where, select: { quizId: true } })) return answered(null)

  const now = new Date()
  await prisma.quizAttempt.createMany({ data: key, skipDuplicates: true })
  await prisma.quizAttempt.updateMany({ where: { ...key, lockedUntil: { lte: now } }, data: { tries: 0, lockedUntil: null } }) // lock over → start again
  const took = await prisma.quizAttempt.updateMany({ where: { ...key, lockedUntil: null, tries: { lt: QUIZ_TRIES } }, data: { tries: { increment: 1 } } })
  if (!took.count) return { correct: false, hint: null, lock: quizLock(await prisma.quizAttempt.findUnique({ where }), now) } // locked: not graded

  if (correct) {
    await prisma.quizPass.createMany({ data: key, skipDuplicates: true })
    return answered(null)
  }
  await prisma.quizAttempt.updateMany({ where: { ...key, lockedUntil: null, tries: { gte: QUIZ_TRIES } }, data: { tries: 0, lockedUntil: new Date(now.getTime() + QUIZ_LOCK_MS) } })
  return answered(quizLock(await prisma.quizAttempt.findUnique({ where }), now))
})

/** Lesson visits made signed out on this device (localStorage), sent once after sign-in. Unknown lessons are skipped, not errors.
 *  Quiz answers are not synced: they only count when graded on the server while signed in (3-try lock). */
export const syncLocalProgress = action({ schema: syncProgressSchema, permission: 'user' }, async (input, user) => {
  const academy = getAcademy(input.academy)
  if (!academy) throw new ActionError('Unknown academy')
  const keys = Object.keys(input.visits)
  const existing = await prisma.lessonVisit.findMany({ where: { userId: user.id, academy: academy.slug, lesson: { in: keys } }, select: { lesson: true, visitedAt: true } })
  const visits = visitsToSync(input.visits, new Set(allLessons(academy).map(lessonKey)), new Map(existing.map((e) => [e.lesson, e.visitedAt])), Date.now())
  await prisma.$transaction(
    visits.map((v) => {
      const key = { userId: user.id, academy: academy.slug, lesson: v.lesson }
      return prisma.lessonVisit.upsert({ where: { userId_academy_lesson: key }, create: { ...key, visitedAt: v.visitedAt }, update: { visitedAt: v.visitedAt } })
    }),
  )
  return { lessons: visits.length }
})

/** Issues the course certificate once every lesson is done and every quiz passed. Returns its id. */
export const claimCertificate = action({ schema: courseRefSchema, permission: 'user' }, async (input, user) => {
  const academy = getAcademy(input.academy)
  const course = academy?.courses.find((c) => c.slug === input.course)
  if (!academy || !course) throw new ActionError('Unknown course')
  const existing = await prisma.certificate.findUnique({ where: { userId_academy_course: { userId: user.id, academy: academy.slug, course: course.slug } }, select: { id: true } })
  if (existing) return existing.id
  const progress = progressOf(await getProgress(user.id, academy.slug), progressLessons(academy).filter((l) => l.course === course))
  if (!progress.complete) throw new ActionError(`Finish every lesson and quiz first (${progress.done} of ${progress.total} done)`)
  // Email sign-ups start with the email's local part as name - completing the profile confirms the real one.
  if (!hasCompleteBasicProfile(await getBasicProfile(user.id))) throw new ActionError('Complete your profile first: name, country and at least one role')
  const name = certificateName(user.name)
  let cert: { id: string }
  try {
    cert = await prisma.certificate.create({ data: { userId: user.id, academy: academy.slug, course: course.slug, name, courseTitle: course.title }, select: { id: true } })
  } catch (err) {
    // A second click or tab won the race - hand back the certificate it issued.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const won = await prisma.certificate.findUnique({ where: { userId_academy_course: { userId: user.id, academy: academy.slug, course: course.slug } }, select: { id: true } })
      if (won) return won.id
    }
    throw err
  }
  await recordAudit({ actorId: user.id, action: 'certificate.issue', entityType: 'Certificate', entityId: cert.id, after: { academy: academy.slug, course: course.slug, name } })
  return cert.id
})

/** The name printed on a certificate is always the profile name - one place to fix a typo. */
function certificateName(profileName: string) {
  const name = profileName.trim()
  if (!name) throw new ActionError('Add your name in your profile first - it is printed on the certificate')
  if (!printableName(name)) throw new ActionError('The certificate can only print names in Latin or Thai letters - add that spelling of your name in your profile first')
  return name
}

/** The owner copies their current profile name onto the certificate. Keeps id, link and issue date. */
export const updateCertificateName = action({ schema: certificateIdSchema, permission: 'user' }, async (input, user) => {
  const cert = await getCertificate(input.id)
  if (!cert) throw new ActionError('Certificate not found')
  if (cert.userId !== user.id) throw new ForbiddenError('Not your certificate')
  const name = certificateName(user.name)
  if (name === cert.name) return
  await prisma.certificate.update({ where: { id: cert.id }, data: { name } })
  await recordAudit({ actorId: user.id, action: 'certificate.rename', entityType: 'Certificate', entityId: cert.id, before: { name: cert.name }, after: { name } })
})

/** The owner deletes their certificate (e.g. to re-issue it with a corrected name); a super admin removes a misused one. */
export const deleteCertificate = action({ schema: certificateIdSchema, permission: 'user' }, async (input, user) => {
  const cert = await getCertificate(input.id)
  if (!cert) throw new ActionError('Certificate not found')
  if (cert.userId !== user.id && !user.isSuperAdmin) throw new ForbiddenError('Not your certificate')
  await prisma.certificate.delete({ where: { id: cert.id } })
  await recordAudit({ actorId: user.id, action: 'certificate.delete', entityType: 'Certificate', entityId: cert.id, before: { userId: cert.userId, academy: cert.academy, course: cert.course, name: cert.name } })
  return `/education/${cert.academy}/${cert.course}`
})
