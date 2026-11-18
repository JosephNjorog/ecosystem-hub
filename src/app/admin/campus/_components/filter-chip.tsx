import Link from 'next/link'
import { cn } from '@/lib/utils'

/** A filter link of the campus admin lists (active = the current filter). */
export function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? 'true' : undefined} className={cn('inline-flex min-h-11 items-center rounded-full border px-4 text-sm', active ? 'border-brand bg-brand/10 text-fg-heading' : 'border-line text-fg-muted hover:border-fg-faint')}>
      {children}
    </Link>
  )
}
