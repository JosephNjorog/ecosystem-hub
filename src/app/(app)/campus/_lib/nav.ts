import { Building2, GraduationCap } from 'lucide-react'
import type { AdminNavItem } from '@/app/admin/_lib/nav'
import { can } from '@/lib/permissions'

export const campusAdminNav: AdminNavItem[] = [
  { href: '/admin/campus', label: 'Students', icon: GraduationCap, show: (u) => can(u, 'campus.view') },
  { href: '/admin/campus/organizations', label: 'Universities & clubs', icon: Building2, show: (u) => can(u, 'campus.manage') },
]
