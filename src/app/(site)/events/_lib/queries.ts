import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { eventVisibility } from './status'

/** "Upcoming" = not ended yet (multi-day events stay until they end). */
export function upcomingEventWhere(now = new Date()) {
  return { OR: [{ endAt: { gte: now } }, { endAt: null, startAt: { gte: now } }] }
}

/** Published events, upcoming or past (unlisted ones never). */
export async function listPublicEvents(when: 'upcoming' | 'past', take: number, skip = 0, hackathonsOnly = false) {
  const upcoming = upcomingEventWhere()
  return prisma.event.findMany({
    where: { status: 'published', ...(hackathonsOnly && { hackathon: { status: 'published' as const } }), ...(when === 'upcoming' ? upcoming : { NOT: upcoming }) },
    orderBy: { startAt: when === 'upcoming' ? 'asc' : 'desc' },
    skip,
    take,
    include: { hackathon: { select: { status: true } } },
  })
}

/** The event behind /events/[slug] (and its /join, /submit), or null when hidden - see `eventVisibility`. */
export const getPublicEvent = cache(async (slug: string) => {
  const found = await prisma.event.findUnique({ where: { slug }, include: { hackathon: { select: { status: true } } } })
  if (!found) return null
  const { hackathon, ...event } = found
  const visibility = eventVisibility(event.status, hackathon?.status)
  return visibility === 'hidden' ? null : { ...event, visibility }
})
