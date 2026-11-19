'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CheckCircle2, Lock, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { answerQuiz } from '../_lib/actions'
import { formatWait, optionOrder, QUIZ_TRIES, type PublicQuestion, type QuizLock, type QuizResult } from '../_lib/rules'

type Solved = { correctAnswers: number[]; explanation: string }

/**
 * Graded on the server (answerQuiz) - `variants` carry no answers. Signed out: the question is shown, answering needs sign-in.
 * `solved`: passed before → opens answered (first variant), further tries are practice. `lock`: tries left / locked until (unpassed only).
 * `signInHint`: show the sign-in note (once per lesson, under its first quiz).
 */
export function Quiz({ id, academy, variants, signedIn, solved, lock: initialLock, signInHint }: { id: string; academy: string; variants: PublicQuestion[]; signedIn: boolean; solved: Solved | null; lock: QuizLock | null; signInHint: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<number[]>(solved ? solved.correctAnswers : [])
  const [result, setResult] = useState<QuizResult | null>(solved && { correct: true, ...solved })
  const [lock, setLock] = useState(initialLock)
  const [practice, setPractice] = useState(!!solved) // passed (before or just now): no tries counted
  const q = variants[attempt % variants.length]
  // ponytail: wait time as of the server render / last answer (no ticking clock) - reload after the lock ends.
  const locked = !practice && lock ? lock.waitMs : 0
  const disabled = !signedIn || locked > 0 || !!result || pending

  function toggle(i: number) {
    setSelected((s) => (q.multi ? (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]) : [i]))
  }
  function check() {
    start(async () => {
      const res = await answerQuiz({ academy, quizId: id, attempt, selected })
      if (!res.ok) return void toast.error(res.error)
      setResult(res.data)
      if (res.data.correct) {
        if (!practice) router.refresh() // first pass: lesson ticks + done count
        setPractice(true)
      } else if (res.data.lock) setLock(res.data.lock)
    })
  }
  function retry() {
    setAttempt((a) => a + 1)
    setSelected([])
    setResult(null)
  }

  return (
    <fieldset className="my-8 max-w-[72ch] rounded-xl border border-line bg-surface-1 p-5 sm:p-6">
      <legend className="sr-only">Quiz question</legend>
      <p className="meta">Quiz · {q.multi ? 'select all correct answers' : 'select one answer'}</p>
      <p className="mt-2 text-lg text-fg-heading">{q.question}</p>
      <div className="mt-4 space-y-2">
        {optionOrder(q.options.length, `${id}:${attempt}`).map((i) => {
          const picked = selected.includes(i)
          return (
            <label
              key={`${attempt}-${i}`}
              className={cn(
                'flex min-h-11 items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors',
                disabled ? 'cursor-default' : 'cursor-pointer',
                !result && (picked ? 'border-brand bg-brand/5 text-fg-heading' : cn('border-line', !disabled && 'hover:border-fg-faint')),
                // Wrong answers don't say which picks were right - that would give the answer away.
                result && picked && (result.correct ? 'border-success bg-success/10 text-fg-heading' : 'border-destructive bg-destructive/10'),
                result && !picked && 'border-line opacity-70',
              )}
            >
              <input
                type={q.multi ? 'checkbox' : 'radio'}
                name={`quiz-${id}`}
                checked={picked}
                disabled={disabled}
                onChange={() => toggle(i)}
                className="mt-0.5 size-4 shrink-0 accent-brand"
              />
              <span>{q.options[i]}</span>
            </label>
          )
        })}
      </div>
      {result && (result.correct || result.hint !== null) && (
        <div role="status" className={cn('mt-4 rounded-lg p-4 text-sm', result.correct ? 'bg-success/10' : 'bg-warning/10')}>
          <p className={cn('flex items-center gap-2 font-medium', result.correct ? 'text-success' : 'text-warning')}>
            {result.correct ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
            {result.correct ? 'Correct' : 'Not quite'}
          </p>
          <p className="mt-1 text-fg-body">{result.correct ? result.explanation : <><span className="text-fg-heading">Hint:</span> {result.hint}</>}</p>
        </div>
      )}
      {locked > 0 ? (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-lg bg-warning/10 p-4 text-sm text-fg-body">
          <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>{QUIZ_TRIES} wrong answers - this question is locked. Try again in {formatWait(locked)}.</span>
        </p>
      ) : (
        signedIn && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {!result ? (
              <Button type="button" onClick={check} disabled={selected.length === 0 || pending}>{pending ? 'Checking…' : 'Check answer'}</Button>
            ) : (
              <Button type="button" variant="outline" onClick={retry}>{result.correct ? 'Practice another version' : 'Try another question'}</Button>
            )}
            {!practice && lock && lock.triesLeft < QUIZ_TRIES && (
              <span className={cn('text-sm', lock.triesLeft === 1 ? 'text-warning' : 'text-fg-muted')}>
                {lock.triesLeft === 1 ? 'Last try - a wrong answer locks this question for 24 hours.' : `${lock.triesLeft} of ${QUIZ_TRIES} tries left`}
              </span>
            )}
          </div>
        )
      )}
      {!signedIn && signInHint && (
        <p className="mt-4 border-t border-line pt-4 text-sm text-fg-muted">
          <Link href={`/sign-in?next=${encodeURIComponent(pathname)}`} className="underline underline-offset-4 hover:text-fg-heading">Sign in</Link> to answer the quizzes and count them toward a certificate.
        </p>
      )}
    </fieldset>
  )
}
