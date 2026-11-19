'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { syncLocalProgress } from '../_lib/actions'
import { clearLocalProgress, readLocalProgress } from '../_lib/local-progress'

/**
 * Rendered for signed-in users: offers to move progress made signed out on this device into the account.
 * Asks first - on a shared device the progress may be someone else's. Until answered it asks again on the next page.
 */
export function SyncLocalProgress({ academy }: { academy: string }) {
  const router = useRouter()
  useEffect(() => {
    const local = readLocalProgress(academy)
    if (!local) return
    const lessons = Object.keys(local.visits).length
    if (!lessons) return
    const id = `education-sync:${academy}`
    toast(`This device has progress from before you signed in (${lessons} lessons opened).`, {
      id, // one prompt even when several components mount
      duration: Infinity,
      action: {
        label: 'Add to my account',
        onClick: () =>
          void syncLocalProgress({ academy, ...local }).then((res) => {
            if (!res.ok) return void toast.error(res.error) // kept locally, offered again on the next page
            clearLocalProgress(academy)
            toast.success('Progress added to your account')
            router.refresh()
          }),
      },
      cancel: { label: 'Discard', onClick: () => clearLocalProgress(academy) },
    })
  }, [academy, router])
  return null
}
