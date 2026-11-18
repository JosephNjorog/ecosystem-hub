'use server'

import { z } from 'zod'
import { action, ActionError } from '@/lib/action'
import { searchUniversities as search } from '@/lib/organizations'
import { rateLimit } from '@/lib/rate-limit'

// The university picker's type-ahead (core, like the pickers: src/lib/organizations.ts).

// Debounced in the form (250 ms), so a person typing stays far below this; each call scans the catalog.
const SEARCHES_PER_MINUTE = 60

export const searchUniversities = action({ schema: z.object({ q: z.string().max(100) }), permission: 'user' }, async ({ q }, user) => {
  if (!rateLimit(`university-search:${user.id}`, { limit: SEARCHES_PER_MINUTE, windowMs: 60_000 }).ok) throw new ActionError('Too many searches - wait a minute')
  return search(q)
})
