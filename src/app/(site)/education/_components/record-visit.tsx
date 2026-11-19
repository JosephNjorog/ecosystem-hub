'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { recordLessonVisit } from '../_lib/actions'
import { saveLocalVisit } from '../_lib/local-progress'

/** Saves the lesson as opened (progress + resume point): in the DB when signed in, else on this device until sign-in. */
export function RecordVisit(props: { academy: string; course: string; module: string; lesson: string; signedIn: boolean }) {
  const { academy, course, module, lesson, signedIn } = props
  const router = useRouter()
  useEffect(() => {
    // ponytail: fire-and-forget - a lost visit only means the lesson shows as not done yet.
    // First visit → refresh so the sidebar tick and "x of y done" include this lesson (once per lesson, ever).
    if (signedIn) void recordLessonVisit({ academy, course, module, lesson }).then((res) => res.ok && res.data && router.refresh())
    else saveLocalVisit(academy, `${course}/${module}/${lesson}`)
  }, [academy, course, module, lesson, signedIn, router])
  return null
}
