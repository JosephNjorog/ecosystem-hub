import { Badge } from '@/components/ui/badge'

const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-surface-hover text-fg-muted' },
  published: { label: 'Published', className: 'bg-success/15 text-success' },
  unlisted: { label: 'Unlisted', className: 'bg-warning/15 text-warning' },
  archived: { label: 'Archived', className: 'bg-surface-hover text-fg-faint' },
}

/** Reachable by link: published (listed) or unlisted (link only - not in listings, sitemap or search). */
export const isReachable = (status: string) => status === 'published' || status === 'unlisted'

/**
 * Who sees an event page: `listed` (published), `link` (by link only, noindex) or `hidden` (404).
 * A published hackathon decides its own reachability - its event's status only decides listing, so a
 * draft or archived event behaves like unlisted (e.g. an event deleted on the member portal must not
 * take a live hackathon down). Listings and the sitemap stay `published` only.
 */
export function eventVisibility(eventStatus: string, hackathonStatus: string | null | undefined): 'listed' | 'link' | 'hidden' {
  if (eventStatus === 'published') return 'listed'
  return eventStatus === 'unlisted' || hackathonStatus === 'published' ? 'link' : 'hidden'
}

/** Shown before an event with a published hackathon goes to draft or archived. */
export const LIVE_HACKATHON_CONFIRM = 'This event’s hackathon is still published and stays reachable - unpublish it separately if needed.'

export function EventStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.draft!
  return <Badge className={`rounded-full border-0 ${s.className}`}>{s.label}</Badge>
}
