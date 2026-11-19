import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowUpRight, Award, Download } from 'lucide-react'
import { BackLink } from '@/components/back-link'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { canonical } from '@/lib/metadata'
import { hasCompleteBasicProfile } from '@/lib/profile'
import { getCurrentUser } from '@/lib/session'
import { SyncLocalProgress } from '../../_components/sync-local-progress'
import { ClaimCertificate } from '../../_components/claim-certificate'
import { KIND_LABEL, LessonIcon } from '../../_components/lesson-icon'
import { getAcademy, lessonCounts, progressLessons, sumCounts } from '../../_lib/content'
import { getBasicProfile, getCertificateIds, getProgress } from '../../_lib/queries'
import { academyHref, courseHref, lessonDone, lessonKind, printableName, progressOf } from '../../_lib/rules'

type Props = { params: Promise<{ academy: string; course: string }> }

async function load(params: Props['params']) {
  const p = await params
  const academy = getAcademy(p.academy)
  const course = academy?.courses.find((c) => c.slug === p.course)
  return academy && course ? { academy, course } : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params)
  if (!found) return {}
  return { title: `${found.course.title} - ${found.academy.title}`, description: found.course.description, ...canonical(courseHref(found.academy, found.course)) }
}

export default async function CoursePage({ params }: Props) {
  const found = await load(params)
  if (!found) notFound()
  const { academy, course } = found
  const counts = lessonCounts(academy)
  const lessons = progressLessons(academy).filter((l) => l.course === course)
  const user = await getCurrentUser()
  const [progress, certIds] = user ? await Promise.all([getProgress(user.id, academy.slug), getCertificateIds(user.id, academy.slug)]) : [null, null]
  const status = progress && progressOf(progress, lessons)
  const certId = certIds?.get(course.slug)
  // Only asked once it matters: claiming needs a complete profile (claimCertificate re-checks).
  const needsProfile = !certId && !!status?.complete && !hasCompleteBasicProfile(await getBasicProfile(user!.id))
  const here = courseHref(academy, course)
  const total = sumCounts(counts, lessons.map((l) => l.href))
  const index = academy.courses.indexOf(course)
  const nextCourse = academy.courses[index + 1]

  return (
    <>
      {user && <SyncLocalProgress academy={academy.slug} />}
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="pointer-events-none absolute -top-48 right-[-15%] h-[32rem] w-[32rem] rounded-full bg-brand/12 blur-[120px]" />
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
        <div className="container-page relative pt-8 pb-14 sm:pb-20">
          <BackLink href={academyHref(academy)}>{academy.title}</BackLink>
          <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-7">
              <p className="meta animate-fade-in-up">Course {index + 1} of {academy.courses.length}</p>
              <h1 className="animate-fade-in-up mt-4 text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02] tracking-[-0.02em] [animation-delay:80ms]">
                {course.title}<span className="text-brand">.</span>
              </h1>
              <p className="animate-fade-in-up mt-5 text-xl text-fg-heading [animation-delay:160ms]">{course.description}</p>
              <Markdown className="animate-fade-in-up mt-5 text-fg-body [animation-delay:200ms]">{course.intro}</Markdown>
            </div>
            <aside className="animate-fade-in-up self-start rounded-xl border border-line bg-surface-2/80 p-6 backdrop-blur-sm [animation-delay:280ms] sm:p-8 lg:col-span-5">
              <dl className="grid grid-cols-3 gap-4">
                {([[course.modules.length, 'modules'], [total.lessons, 'lessons'], [total.videos, 'videos']] as const).map(([n, label]) => (
                  <div key={label} className="flex flex-col-reverse">
                    <dt className="meta mt-1">{label}</dt>
                    <dd className="font-heading text-4xl font-medium tracking-[-0.03em] text-fg-heading tabular-nums">{n}</dd>
                  </div>
                ))}
              </dl>
              <ol className="mt-6 space-y-2 border-t border-line pt-6">
                {course.modules.map((m) => (
                  <li key={m.slug}>
                    <a href={`#${m.slug}`} className="flex min-h-9 items-baseline gap-3 text-sm transition-colors hover:text-fg-heading">
                      <span className="meta w-20 shrink-0">{m.label}</span>
                      <span className="text-fg-body">{m.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
              {status && (
                <div className="mt-6 border-t border-line pt-6">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="meta">Your progress</span>
                    <span className="meta tabular-nums">{status.done} / {status.total} lessons</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-hover" role="progressbar" aria-label="Lessons done" aria-valuenow={status.done} aria-valuemin={0} aria-valuemax={status.total}>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(status.done / status.total) * 100}%` }} />
                  </div>
                </div>
              )}
              <Button asChild size="lg" className="mt-6 w-full">
                {status?.complete ? (
                  <a href="#certificate">{certId ? 'View your certificate' : 'Get your certificate'} <Award aria-hidden /></a>
                ) : (
                  <Link href={status?.resume ?? lessons[0].href}>{status?.started ? 'Continue where you left off' : 'Start the course'} <ArrowRight aria-hidden /></Link>
                )}
              </Button>
              {!user && (
                <p className="mt-3 text-center text-sm text-fg-muted">
                  <Link href={`/sign-in?next=${encodeURIComponent(here)}`} className="underline underline-offset-4 hover:text-fg-heading">Sign in</Link> to save your progress and earn a certificate.
                </p>
              )}
            </aside>
          </div>
        </div>
      </section>

      <section className="container-page space-y-6 py-14 sm:py-20">
        {course.modules.map((m) => {
          const mLessons = lessons.filter((l) => l.module === m)
          const t = sumCounts(counts, mLessons.map((l) => l.href))
          return (
            <article key={m.slug} id={m.slug} className="scroll-mt-20 overflow-hidden rounded-xl border border-line bg-surface-2">
              <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line p-6 sm:p-8">
                <div className="flex items-center gap-5">
                  <span aria-hidden className="min-w-[2ch] font-heading text-5xl font-medium tracking-[-0.04em] text-brand tabular-nums sm:text-6xl">{m.label.replace(/^Module /, '')}</span>
                  <div>
                    <p className="meta">{m.label}</p>
                    <h2 className="mt-1 text-2xl sm:text-3xl">{m.title}</h2>
                  </div>
                </div>
                <p className="meta">{t.lessons} lessons · {t.videos} videos · {t.quizzes} quiz questions</p>
              </header>
              <ol className="grid sm:grid-cols-2">
                {mLessons.map((l, li) => {
                  const { lesson, href } = l
                  const kind = lessonKind(counts.get(href)!)
                  const done = progress && lessonDone(progress, l)
                  return (
                    <li key={lesson.slug} className="border-line sm:odd:border-r [&:not(:last-child)]:border-b sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                      <Link href={href} className="group flex min-h-14 items-center gap-4 px-6 py-3 transition-colors hover:bg-surface-hover/40 sm:px-8">
                        <span className="meta w-5 shrink-0 tabular-nums">{String(li + 1).padStart(2, '0')}</span>
                        <LessonIcon kind={kind} />
                        <span className="min-w-0 flex-1 text-fg-body transition-colors group-hover:text-fg-heading">{lesson.title}</span>
                        {done ? <span className="meta text-success">Done</span> : kind !== 'reading' && <span className="meta hidden lg:inline">{KIND_LABEL[kind]}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </article>
          )
        })}

        <article id="certificate" className="!mt-16 scroll-mt-20 flex flex-col gap-6 rounded-xl border border-line bg-surface-2 p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-brand/40 bg-brand/10"><Award className="size-7 text-brand" aria-hidden /></span>
          <div className="flex-1">
            <p className="meta">Course certificate</p>
            {certId ? (
              <>
                <h2 className="mt-1 text-2xl">You completed {course.title}<span className="text-brand">.</span></h2>
                <p className="mt-2 text-fg-muted">Your certificate is ready - download it as a PDF or share its verification link.</p>
              </>
            ) : needsProfile ? (
              <>
                <h2 className="mt-1 text-2xl">One step before your certificate<span className="text-brand">.</span></h2>
                <p className="mt-2 text-fg-muted">Every lesson and quiz is done. Complete your profile (name, country and a role) - the name you confirm there is printed on the certificate.</p>
              </>
            ) : status?.complete ? (
              <>
                <h2 className="mt-1 text-2xl">Every lesson and quiz done<span className="text-brand">.</span></h2>
                <p className="mt-2 text-fg-muted">
                  It will be issued to <span className="text-fg-heading">{user!.name || 'your name'}</span>.{' '}
                  {user!.name && !printableName(user!.name.trim()) && <>The certificate can only print Latin or Thai letters, so add that spelling of your name first. </>}
                  Not right? <Link href="/profile" className="underline underline-offset-4 hover:text-fg-heading">Change it in your profile</Link> - you can also update the name on the certificate later.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-2xl">Earn your certificate</h2>
                <p className="mt-2 text-fg-muted">Finish all {course.modules.length} modules of this course while signed in: open every lesson and answer every quiz question correctly (3 wrong answers lock a question for 24 hours). You get a certificate for the course with your name, to download as a PDF{status ? ` - ${status.total - status.done} lessons to go` : ''}.</p>
              </>
            )}
          </div>
          {certId ? (
            <div className="flex flex-col gap-2 sm:items-end">
              <Button asChild size="lg"><Link href={`/education/certificates/${certId}`}>View certificate <ArrowRight aria-hidden /></Link></Button>
              <Button asChild size="lg" variant="outline"><a href={`/education/certificates/${certId}/pdf`}><Download aria-hidden /> Download PDF</a></Button>
            </div>
          ) : needsProfile ? (
            <Button asChild size="lg"><Link href={`/profile?next=${encodeURIComponent(here)}`}>Complete your profile <ArrowRight aria-hidden /></Link></Button>
          ) : status?.complete ? (
            <ClaimCertificate academy={academy.slug} course={course.slug} />
          ) : !user ? (
            <Button asChild size="lg" variant="outline"><Link href={`/sign-in?next=${encodeURIComponent(here)}`}>Sign in</Link></Button>
          ) : null}
        </article>

        {nextCourse && (
          <Link href={courseHref(academy, nextCourse)} className="group cta-row !mt-16">
            <span>
              <span className="meta block">Next course</span>
              {nextCourse.title}
            </span>
            <ArrowUpRight className="arrow-nudge size-8 shrink-0" aria-hidden />
          </Link>
        )}
      </section>
    </>
  )
}
