'use client'

import { PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/hooks/use-action-toast'
import { updateCertificateName } from '../_lib/actions'

/** Shown to the owner when their profile name differs from the printed one. */
export function UpdateCertificateName({ id, name }: { id: string; name: string }) {
  const { pending, run } = useActionToast()
  return (
    <Button variant="outline" disabled={pending} onClick={() => run(() => updateCertificateName({ id }), 'Name on the certificate updated')}>
      <PenLine aria-hidden /> Change name to {name}
    </Button>
  )
}
