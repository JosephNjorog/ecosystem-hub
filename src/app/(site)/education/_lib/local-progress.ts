import { localProgressSchema, type LocalProgress } from './schemas'

// Signed-out lesson visits, kept in this browser until the user signs in (then synced and cleared, SyncLocalProgress).
// Storage can be missing or blocked (private mode) - every access is wrapped; losing it only loses unsynced progress.
const storageKey = (academy: string) => `team1-education:${academy}`

export function readLocalProgress(academy: string): LocalProgress | null {
  try {
    const raw = localStorage.getItem(storageKey(academy))
    const parsed = raw ? localProgressSchema.safeParse(JSON.parse(raw)) : null
    return parsed?.success ? parsed.data : null
  } catch {
    return null
  }
}

function update(academy: string, fn: (p: LocalProgress) => void) {
  try {
    const p = readLocalProgress(academy) ?? { visits: {} }
    fn(p)
    localStorage.setItem(storageKey(academy), JSON.stringify(p))
  } catch {}
}

export const saveLocalVisit = (academy: string, lesson: string) => update(academy, (p) => void (p.visits[lesson] = Date.now()))

export function clearLocalProgress(academy: string) {
  try {
    localStorage.removeItem(storageKey(academy))
  } catch {}
}
