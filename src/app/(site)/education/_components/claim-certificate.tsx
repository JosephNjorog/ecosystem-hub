'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Award } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { claimCertificate } from '../_lib/actions'

export function ClaimCertificate({ academy, course }: { academy: string; course: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await claimCertificate({ academy, course })
          if (!res.ok) return void toast.error(res.error)
          router.push(`/education/certificates/${res.data}`)
        })
      }
    >
      <Award aria-hidden /> {pending ? 'Issuing…' : 'Get your certificate'}
    </Button>
  )
}
