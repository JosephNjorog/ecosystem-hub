import type { PermissionDef } from '@/lib/permissions'

export const campusPermissions = {
  'campus.view': { group: 'campus', label: 'See students, faculty and staff with their university details', sensitive: "Sees students' names, email addresses, Telegram handles and study details" },
  'campus.manage': { group: 'campus', label: 'Maintain the university and blockchain club lists (verify, rename, hide, merge)' },
} as const satisfies Record<string, PermissionDef>
