import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import type { Progress } from './rules'

/** A user's progress in one academy (once per request). */
export const getProgress = cache(async (userId: string, academy: string): Promise<Progress> => {
  const [visits, passes] = await Promise.all([
    prisma.lessonVisit.findMany({ where: { userId, academy }, select: { lesson: true }, orderBy: { visitedAt: 'desc' } }),
    prisma.quizPass.findMany({ where: { userId, academy }, select: { quizId: true } }),
  ])
  return { visited: new Set(visits.map((v) => v.lesson)), passed: new Set(passes.map((p) => p.quizId)), last: visits[0]?.lesson ?? null }
})

/** Profile fields `hasCompleteBasicProfile` checks - claiming a certificate needs a complete profile. */
export const getBasicProfile = cache((userId: string) => prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, country: true, builderRoles: true } }))

/** All of a user's certificates, newest first (dashboard). */
export const listMyCertificates = cache((userId: string) =>
  prisma.certificate.findMany({ where: { userId }, orderBy: { issuedAt: 'desc' }, select: { id: true, courseTitle: true, issuedAt: true } }),
)

/** Certificate id per course slug. */
export const getCertificateIds = cache(async (userId: string, academy: string): Promise<Map<string, string>> => {
  const rows = await prisma.certificate.findMany({ where: { userId, academy }, select: { id: true, course: true } })
  return new Map(rows.map((r) => [r.course, r.id]))
})

export const getCertificate = cache((id: string) =>
  prisma.certificate.findUnique({ where: { id }, select: { id: true, userId: true, academy: true, course: true, name: true, courseTitle: true, issuedAt: true } }),
)

/** Tries + lock per quiz id, for the questions the user hasn't passed yet. */
export const getQuizAttempts = cache(async (userId: string, academy: string) => {
  const rows = await prisma.quizAttempt.findMany({ where: { userId, academy }, select: { quizId: true, tries: true, lockedUntil: true } })
  return new Map(rows.map((r) => [r.quizId, r]))
})
