import { Markdown } from '@/components/markdown'
import type { Flashcard, Quiz as QuizData } from '../_lib/rules'
import { publicVariants, quizLock, splitLesson } from '../_lib/rules'
import { Flashcards } from './flashcards'
import { Quiz } from './quiz'

/** Markdown with the lesson directives swapped for their widgets. Only the one quiz/card set reaches the client, not the whole JSON. */
/** `user`: the signed-in user's passed quiz ids and tries per quiz (null = signed out: questions are shown, answering needs sign-in). */
/** Answers only reach the browser for questions already passed - everything else is graded by answerQuiz. */
type UserQuizzes = { passed: Set<string>; attempts: Map<string, { tries: number; lockedUntil: Date | null }> }
export function LessonBody({ body, academy, quizzes, flashcards, user }: { body: string; academy: string; quizzes: Record<string, QuizData>; flashcards: Record<string, Flashcard[]>; user: UserQuizzes | null }) {
  const now = new Date()
  const segments = splitLesson(body)
  const firstQuiz = segments.findIndex((s) => s.kind === 'quiz')
  return segments.map((s, i) => {
    if (s.kind === 'md') return <Markdown key={i} className="lesson-prose">{s.text}</Markdown>
    if (s.kind === 'quiz') {
      const quiz = quizzes[s.id]
      const solved = user?.passed.has(s.id) ? { correctAnswers: quiz.correctAnswers, explanation: quiz.explanation } : null
      return <Quiz key={i} id={s.id} academy={academy} variants={publicVariants(quiz)} signedIn={!!user} solved={solved} lock={user && !solved ? quizLock(user.attempts.get(s.id), now) : null} signInHint={i === firstQuiz} />
    }
    if (s.kind === 'flashcards') {
      const cards = flashcards[s.id]
      return <Flashcards key={i} cards={cards} examples={cards.map((c, j) => c.example && <Markdown key={j} className="text-sm text-fg-muted">{c.example}</Markdown>)} />
    }
    return (
      <div key={i} className="my-10 aspect-video max-w-[72ch] overflow-hidden rounded-xl border border-line bg-surface-1 shadow-[0_8px_40px_-12px_rgb(0_0_0/0.5)]">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(s.id)}?rel=0`}
          title="YouTube video"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    )
  })
}
