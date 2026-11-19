'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmButton } from '@/components/confirm-button'
import { deleteCertificate } from '../_lib/actions'

/** Owner or super admin. Goes back to the course page afterwards. */
export function DeleteCertificate({ id, own }: { id: string; own: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <ConfirmButton
      size="default"
      disabled={pending}
      message={own ? 'Delete this certificate? Its link stops working. You can get a new one from the course page.' : 'Delete this certificate? Its link stops working for everyone.'}
      onConfirm={() =>
        start(async () => {
          const res = await deleteCertificate({ id })
          if (!res.ok) return void toast.error(res.error)
          toast.success('Certificate deleted')
          router.push(res.data)
        })
      }
    >
      <Trash2 aria-hidden /> Delete certificate
    </ConfirmButton>
  )
}
