'use server'

import { revalidatePath } from 'next/cache'
import { action, ActionError, ForbiddenError } from '@/lib/action'
import { recordAudit } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { IMAGE_KINDS } from '@/lib/image-kinds'
import { needsAdultConfirmation } from '@/lib/campus'
import { assertOrgQuota, findOrCreateCatalogOrg, findOrCreateOrg } from '@/lib/organizations'
import { profileSchema } from './schemas'
import { isOwnUpload } from '@/lib/storage'

export const saveProfile = action({ schema: profileSchema, permission: 'user' }, async (input, user) => {
  const { universities, adultConfirmed, trackInterests, campusCoordinatorInterest, ...data } = input
  const before = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { image: true, name: true, country: true, builderRoles: true, campusProfile: { select: { trackInterests: true, campusCoordinatorInterest: true, adultConfirmedAt: true } }, universityMemberships: { select: { universityId: true, kind: true, clubId: true } } },
  })
  // Avatar: keep the current one (e.g. from Google/GitHub), or an own upload.
  if (input.image && input.image !== before.image && !isOwnUpload(input.image, IMAGE_KINDS.avatar.category, user.id)) throw new ActionError('Upload your avatar here')
  // Hidden organizations can't be picked (crafted requests included) - except the ones the user already has.
  const ownIds = before.universityMemberships.flatMap((m) => [m.universityId, ...(m.clubId ? [m.clubId] : [])])
  const pickable = { OR: [{ hidden: false }, { id: { in: ownIds } }] }
  // The 18+ confirmation is recorded once (adultConfirmedAt + one audit entry), not on every save.
  const confirmsAdult = adultConfirmed && needsAdultConfirmation(universities) && !before.campusProfile?.adultConfirmedAt

  const created: { id: string; type: string; name: string }[] = []
  const fromCatalog: { id: string; name: string; rorId: string; claimed: boolean }[] = []
  const memberships = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data })
    const rows = []
    for (const e of universities) {
      let universityId = e.universityId
      let country: string | null
      if (universityId) {
        const uni = await tx.organization.findFirst({ where: { id: universityId, type: 'university', ...pickable }, select: { country: true } })
        // the form only offers visible or own ones - anything else is a crafted (or stale, after an admin merge) id
        if (!uni) throw new ForbiddenError('Pick your university from the list')
        country = uni.country
      } else if (e.catalogUniversity) {
        const org = await findOrCreateCatalogOrg(tx, e.catalogUniversity.rorId)
        if (org.hidden && !ownIds.includes(org.id)) throw new ForbiddenError('Pick your university from the list')
        universityId = org.id
        country = org.country
        if (org.created || org.claimed) fromCatalog.push({ id: org.id, name: org.name, rorId: e.catalogUniversity.rorId, claimed: org.claimed })
      } else {
        country = e.newUniversity!.country
        const org = await findOrCreateOrg(tx, { type: 'university', name: e.newUniversity!.name, country, parentId: null, createdById: user.id })
        universityId = org.id
        if (org.created) created.push({ id: org.id, type: 'university', name: e.newUniversity!.name })
      }
      // ponytail: a club that isn't (or no longer is, after an admin merge) under this university is dropped, not an error -
      // the picker can't show it, so the user couldn't fix it anyway.
      let clubId = e.clubId && (await tx.organization.findFirst({ where: { id: e.clubId, type: 'blockchain_club', parentId: universityId, ...pickable }, select: { id: true } })) ? e.clubId : null
      if (e.newClubName) {
        const org = await findOrCreateOrg(tx, { type: 'blockchain_club', name: e.newClubName, country, parentId: universityId, createdById: user.id })
        clubId = org.id
        if (org.created) created.push({ id: org.id, type: 'blockchain_club', name: e.newClubName })
      }
      rows.push({ universityId, kind: e.kind, fieldOfStudy: e.fieldOfStudy, graduationYear: e.graduationYear, clubId, clubPosition: clubId ? e.clubPosition : null })
    }
    if (created.length) await assertOrgQuota(tx, user.id)
    // A typed-in name can resolve to a university already picked in another row.
    if (new Set(rows.map((r) => r.universityId)).size !== rows.length) throw new ActionError('You added the same university twice')
    await tx.universityMembership.deleteMany({ where: { userId: user.id, universityId: { notIn: rows.map((r) => r.universityId) } } })
    for (const { universityId, ...r } of rows) {
      await tx.universityMembership.upsert({ where: { userId_universityId: { userId: user.id, universityId } }, create: { userId: user.id, universityId, ...r }, update: r })
    }
    // Created on the first save as a student; afterwards kept in sync (the schema clears the answers for non-students).
    const student = rows.some((r) => r.kind === 'student')
    if (student || before.campusProfile) {
      const campus = { trackInterests, campusCoordinatorInterest, ...(confirmsAdult ? { adultConfirmedAt: new Date() } : {}) }
      await tx.campusProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...campus }, update: campus })
    }
    return rows
  })

  const { universityMemberships, campusProfile, ...beforeUser } = before
  // claimed = an existing typed-in entry got the catalog link (rorId, verified, the catalog's names)
  for (const o of fromCatalog) await recordAudit({ actorId: user.id, action: o.claimed ? 'organization.ror_link' : 'organization.create', entityType: 'Organization', entityId: o.id, after: o.claimed ? { rorId: o.rorId, verified: true } : { type: 'university', name: o.name, rorId: o.rorId } })
  for (const o of created) await recordAudit({ actorId: user.id, action: 'organization.create', entityType: 'Organization', entityId: o.id, after: { type: o.type, name: o.name } })
  await recordAudit({
    actorId: user.id, action: 'user.profile.update', entityType: 'User', entityId: user.id,
    before: { ...beforeUser, trackInterests: campusProfile?.trackInterests ?? [], campusCoordinatorInterest: campusProfile?.campusCoordinatorInterest ?? false, universities: universityMemberships },
    after: { image: input.image, name: input.name, country: input.country, builderRoles: input.builderRoles, trackInterests, campusCoordinatorInterest, universities: memberships.map((m) => ({ universityId: m.universityId, kind: m.kind })), ...(confirmsAdult ? { adultConfirmed: true } : {}) },
  })
  revalidatePath('/', 'layout')
  return null
})
