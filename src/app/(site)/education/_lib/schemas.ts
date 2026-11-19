import { z } from 'zod'

const slug = z.string().min(1).max(120)
const capped = <T extends z.ZodType>(r: T) => r.refine((o) => Object.keys(o as object).length <= 1000, 'Too many entries')

export const lessonRefSchema = z.object({ academy: slug, course: slug, module: slug, lesson: slug })
export const quizAnswerSchema = z.object({ academy: slug, quizId: slug, attempt: z.number().int().min(0).max(10_000), selected: z.array(z.number().int().min(0).max(50)).max(50) })
export const courseRefSchema = z.object({ academy: slug, course: slug })
export const certificateIdSchema = z.object({ id: z.string().min(1).max(40) })

/** Lessons a signed-out user opened on this device (localStorage), sent once after sign-in. `visits`: lessonKey → last opened (ms).
 *  Quiz answers are not kept signed out - they only count when graded on the server (answerQuiz). */
export const localProgressSchema = z.object({ visits: capped(z.record(z.string().max(400), z.number().int().nonnegative())) })
export type LocalProgress = z.infer<typeof localProgressSchema>
export const syncProgressSchema = localProgressSchema.extend({ academy: slug })
