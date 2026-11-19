// Pure, isomorphic rules for the education area (tested in tests/education.test.ts).

export type LessonMeta = { slug: string; title: string; description: string }
export type CourseModule = { slug: string; label: string; title: string; lessons: LessonMeta[] }
export type Course = { slug: string; title: string; description: string; intro: string; modules: CourseModule[] }
/** One academy = one folder in `_content/` (academy.json + quizzes.json + flashcards.json). */
/** `credit`: where the content comes from (shown on the academy page; license file in the content folder). */
export type Academy = { slug: string; title: string; tagline: string; description: string; credit?: { name: string; url: string; license: string }; courses: Course[] }

export type QuizQuestion = { question: string; options: string[]; correctAnswers: number[]; hint: string; explanation: string }
export type Quiz = QuizQuestion & { alternates: QuizQuestion[] }
export type Flashcard = { term: string; definition: string; example?: string }

/** A lesson body: Markdown with one-line directives `::youtube[id]`, `::quiz[id]`, `::flashcards[set]`. */
export type Segment = { kind: 'md'; text: string } | { kind: 'youtube' | 'quiz' | 'flashcards'; id: string }

export function splitLesson(body: string): Segment[] {
  const parts = body.split(/^::(youtube|quiz|flashcards)\[([^\]\n]+)\][ \t]*$/m)
  const out: Segment[] = []
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i].trim()) out.push({ kind: 'md', text: parts[i] })
    if (i + 2 < parts.length) out.push({ kind: parts[i + 1] as 'youtube' | 'quiz' | 'flashcards', id: parts[i + 2] })
  }
  return out
}

/** What a lesson holds - drives its icon. Counted from the body's directives. */
export type LessonCounts = { videos: number; quizzes: number; flashcards: number; quizIds: string[] }
export type LessonKind = 'quiz' | 'flashcards' | 'video' | 'reading'

export function countDirectives(body: string): LessonCounts {
  const n: LessonCounts = { videos: 0, quizzes: 0, flashcards: 0, quizIds: [] }
  for (const s of splitLesson(body)) {
    if (s.kind === 'youtube') n.videos++
    if (s.kind === 'quiz') { n.quizzes++; n.quizIds.push(s.id) }
    if (s.kind === 'flashcards') n.flashcards++
  }
  return n
}

export function lessonKind(c: LessonCounts): LessonKind {
  return c.quizzes ? 'quiz' : c.flashcards ? 'flashcards' : c.videos ? 'video' : 'reading'
}

export const academyHref = (a: Academy) => `/education/${a.slug}`
export const courseHref = (a: Academy, c: Course) => `${academyHref(a)}/${c.slug}`

/** Lessons in reading order across all courses - prev/next walk through the whole academy. */
export function allLessons(academy: Academy) {
  return academy.courses.flatMap((course) =>
    course.modules.flatMap((module) => module.lessons.map((lesson) => ({ course, module, lesson, href: `${courseHref(academy, course)}/${module.slug}/${lesson.slug}` }))),
  )
}

export function findLesson(academy: Academy, course: string, module: string, lesson: string) {
  const all = allLessons(academy)
  const i = all.findIndex((r) => r.course.slug === course && r.module.slug === module && r.lesson.slug === lesson)
  if (i < 0) return null
  return { ...all[i], prev: all[i - 1] ?? null, next: all[i + 1] ?? null }
}

/** Multi-answer questions need exactly the right set; order doesn't matter. */
export function isCorrect(selected: number[], correct: number[]): boolean {
  return selected.length === correct.length && correct.every((c) => selected.includes(c))
}

/** Each retry shows the next phrasing (the original, then its alternates), cycling. */
export function quizVariant(quiz: Quiz, attempt: number): QuizQuestion {
  const all = [quiz, ...quiz.alternates]
  return all[attempt % all.length]
}

/** Option display order, shuffled but stable for a seed - server and client render the same order (no hydration mismatch). */
export function optionOrder(n: number, seed: string): number[] {
  let h = 2166136261 // FNV-1a → seed for a small LCG; good enough to not always put the answer in the same slot
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) | 0
    const j = (h >>> 0) % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

// Progress (signed-in users). A lesson is stored as `lessonKey` = "<course>/<module>/<lesson>" per academy.
export const lessonKey = (l: { course: { slug: string }; module: { slug: string }; lesson: { slug: string } }) => `${l.course.slug}/${l.module.slug}/${l.lesson.slug}`

/** `visited`: lesson keys opened; `passed`: quiz ids answered correctly; `last`: most recently opened lesson key. */
export type Progress = { visited: Set<string>; passed: Set<string>; last: string | null }
export type ProgressLesson = { key: string; href: string; quizIds: string[] }

/** Done = opened, and every quiz question in it answered correctly. */
export const lessonDone = (p: Progress, l: ProgressLesson) => p.visited.has(l.key) && l.quizIds.every((q) => p.passed.has(q))

/**
 * Progress over a list of lessons in reading order (a course, or a whole academy).
 * `resume`: the first unfinished lesson after the last one opened - "continue where you left off";
 * wraps to the first gap when everything after it is done. null = all done.
 */
export function progressOf(p: Progress, lessons: ProgressLesson[]) {
  const done = lessons.filter((l) => lessonDone(p, l)).length
  const lastAt = lessons.findIndex((l) => l.key === p.last)
  const open = (l: ProgressLesson) => !lessonDone(p, l)
  const resume = lessons.slice(lastAt + 1).find(open) ?? lessons.find(open) ?? null
  return { done, total: lessons.length, complete: done === lessons.length, started: lessons.some((l) => p.visited.has(l.key)), resume: resume?.href ?? null }
}

/**
 * Device visits (signed out, lessonKey → ms) worth writing after sign-in: known lessons only, times clamped
 * to `now`, and only where the device saw the lesson later than the account did (keeps the newest resume point).
 */
export function visitsToSync(local: Record<string, number>, known: Set<string>, existing: Map<string, Date>, now: number) {
  return Object.entries(local)
    .filter(([key]) => known.has(key))
    .map(([lesson, at]) => ({ lesson, visitedAt: new Date(Math.min(at, now)) }))
    .filter((v) => {
      const prev = existing.get(v.lesson)
      return !prev || prev < v.visitedAt
    })
}

/**
 * Whether the certificate font (Kanit: Latin incl. Vietnamese, Thai) can print this name. Other scripts
 * (Cyrillic, Greek, CJK, Arabic, emoji) would render blank on a certificate that can't be edited.
 * ponytail: allow-list by script; add a Noto fallback font to the PDF to widen it.
 */
export const printableName = (name: string) => /^[\p{Script=Latin}\p{Script=Thai}\p{M}\p{Zs}0-9.,'’‘\-()&]+$/u.test(name)

// Quiz tries (signed-in only; graded on the server - the browser never gets the answers of an unpassed question).
// Same rule as builders-hub: 3 wrong answers lock the question for 24 hours, then the count starts over.
export const QUIZ_TRIES = 3
export const QUIZ_LOCK_MS = 24 * 60 * 60 * 1000

/** What the browser gets of a quiz: each variant's question and options, no answers, hints or explanations. */
export type PublicQuestion = { question: string; options: string[]; multi: boolean }
export const publicVariants = (quiz: Quiz): PublicQuestion[] =>
  [quiz, ...quiz.alternates].map((v) => ({ question: v.question, options: v.options, multi: v.correctAnswers.length > 1 }))

/** `waitMs` > 0: locked for that long (as of `now`, computed on the server); else how many tries are left. */
export type QuizLock = { triesLeft: number; waitMs: number }
export function quizLock(row: { tries: number; lockedUntil: Date | null } | null | undefined, now: Date): QuizLock {
  if (row?.lockedUntil && row.lockedUntil > now) return { triesLeft: 0, waitMs: row.lockedUntil.getTime() - now.getTime() }
  return { triesLeft: row?.lockedUntil ? QUIZ_TRIES : Math.max(0, QUIZ_TRIES - (row?.tries ?? 0)), waitMs: 0 }
}

/** answerQuiz's answer. Correct → the answer + explanation. Wrong → hint and the lock state (`lock` null = practice on a
 *  passed question, no limit); `hint` null = locked, the answer was not graded. */
export type QuizResult = { correct: true; correctAnswers: number[]; explanation: string } | { correct: false; hint: string | null; lock: QuizLock | null }

/** "23 h 5 min" / "12 min" until a lock ends (rounded up to the minute). */
export function formatWait(ms: number) {
  const min = Math.max(1, Math.ceil(ms / 60_000))
  const h = Math.floor(min / 60)
  return h ? `${h} h ${min % 60} min` : `${min} min`
}

/** LinkedIn "Add to profile" link: pre-fills Licenses & certifications, with team1's company page (logo) and "Show credential" → `certUrl`. */
export const TEAM1_LINKEDIN_ORG_ID = '111983994'
export function linkedInAddUrl(cert: { id: string; courseTitle: string; issuedAt: Date }, certUrl: string) {
  const q = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: cert.courseTitle,
    organizationId: TEAM1_LINKEDIN_ORG_ID,
    issueYear: String(cert.issuedAt.getUTCFullYear()),
    issueMonth: String(cert.issuedAt.getUTCMonth() + 1),
    certUrl,
    certId: cert.id,
  })
  return `https://www.linkedin.com/profile/add?${q}`
}
