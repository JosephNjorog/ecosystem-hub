import { z } from 'zod'
import { graduationYearRange, MAX_UNIVERSITIES, normalizeOrgName, parseRorId, needsAdultConfirmation, TRACK_INTERESTS, UNIVERSITY_KINDS, type TrackInterest, type UniversityKind } from '@/lib/campus'
import { isCountryCode } from '@/lib/countries'
import { BUILDER_ROLES, EMPLOYMENT_ROLES, EVM_ADDRESS, WALLET_ERROR, type BuilderRole } from '@/lib/profile'

// Zod schema for the builder profile. Apart from profile.ts so the client profile form doesn't ship zod.

// builders-hub lib/profile/socialAccountValidation.ts
const GITHUB = /^(?:https?:\/\/(?:www\.)?github\.com\/)?([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})\/?$/i
const X = /^(?:@|https?:\/\/(?:www\.)?(?:twitter|x)\.com\/)?([A-Za-z0-9_]{1,15})\/?$/i
const LINKEDIN = /^https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub|company|school)\/[\p{L}\p{N}_\-.%]+\/?$/iu
const TELEGRAM = /^@?([A-Za-z][A-Za-z0-9_]{4,31})$/

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v)
const handle = (re: RegExp, msg: string) =>
  z.preprocess(blank, z.string().nullable().optional()).transform((v, ctx) => {
    if (!v) return null
    const m = v.match(re)
    if (!m) {
      ctx.addIssue({ code: 'custom', message: msg })
      return z.NEVER
    }
    return m[1]!
  })
const optText = (max: number) => z.preprocess(blank, z.string().max(max).nullable().optional()).transform((v) => v ?? null)
const httpUrl = z.string().trim().url('Must be a valid link').refine((u) => /^https?:\/\//i.test(u), 'Must start with https://')
const dedupe = (items: string[]) => {
  const seen = new Set<string>()
  return items.map((s) => s.trim()).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
}

// One university of the profile: an existing one (id), one from the catalog (ROR id) or a typed-in one (name + country).
// Student-only fields are dropped for faculty/staff. Only the shape is checked here: required
// fields are checked in profileSchema's superRefine, and only with the University role - a
// half-filled row left behind by toggling the role off must not block the save.
const universityEntry = z.object({
  universityId: z.string().min(1).nullable(),
  catalogUniversity: z.object({ rorId: z.string().refine((r) => parseRorId(r) === r, 'Pick your university from the list'), name: z.string().max(300) }).nullable(),
  newUniversity: z.object({
    name: z.string().trim().max(120),
    country: z.string().nullable().refine((c) => !c || isCountryCode(c), 'Unknown country'),
  }).nullable(),
  kind: z.enum(UNIVERSITY_KINDS.map((k) => k.id) as [UniversityKind, ...UniversityKind[]]),
  fieldOfStudy: optText(80),
  graduationYear: z.number().int().nullable().refine((y) => {
    const r = graduationYearRange(new Date())
    return y === null || (y >= r.min && y <= r.max)
  }, 'Enter a valid graduation year'),
  clubId: z.string().min(1).nullable(),
  newClubName: optText(120),
  clubPosition: optText(80),
}).transform((e) => e.kind === 'student'
  ? { ...e, clubPosition: e.clubId || e.newClubName ? e.clubPosition : null }
  : { ...e, fieldOfStudy: null, graduationYear: null, clubId: null, newClubName: null, clubPosition: null })

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  bio: optText(250).refine((v) => !v || v.length <= 250, 'Bio must not exceed 250 characters'),
  // Required: name, country and a role are what hasCompleteBasicProfile (joining a hackathon) checks.
  country: z.string().nullable().refine((c) => !!c && isCountryCode(c), 'Pick a country'),
  builderRoles: z.array(z.enum(BUILDER_ROLES.map((r) => r.id) as [BuilderRole, ...BuilderRole[]])).min(1, 'Pick at least one role').transform((r) => [...new Set(r)]),
  companyName: optText(120),
  employeeRole: z.preprocess(blank, z.enum(EMPLOYMENT_ROLES).nullable().optional()).transform((v) => v ?? null),
  githubAccount: handle(GITHUB, 'Enter a valid GitHub username or github.com link'),
  xAccount: handle(X, 'Enter an X handle or a link like https://x.com/yourhandle'),
  linkedinAccount: z.preprocess(blank, z.string().regex(LINKEDIN, 'Enter a LinkedIn link like https://www.linkedin.com/in/username').nullable().optional()).transform((v) => v ?? null),
  telegramAccount: handle(TELEGRAM, 'Enter a valid Telegram username (5–32 chars, starts with a letter)'),
  otherSocials: z.array(httpUrl).max(5, 'At most 5 links'),
  wallets: z.array(z.string().trim().regex(EVM_ADDRESS, WALLET_ERROR)).max(5).transform(dedupe),
  skills: z.array(z.string().max(40)).transform(dedupe).pipe(z.array(z.string()).max(30, 'At most 30 skills')),
  newsletterOptIn: z.boolean(),
  image: z.string().url().nullable(),
  // Campus - only kept with the University role (see the transform below).
  universities: z.array(universityEntry).max(MAX_UNIVERSITIES, `At most ${MAX_UNIVERSITIES} universities`),
  trackInterests: z.array(z.enum(TRACK_INTERESTS.map((t) => t.id) as [TrackInterest, ...TrackInterest[]])).transform((t) => [...new Set(t)]),
  campusCoordinatorInterest: z.boolean(),
  adultConfirmed: z.boolean(),
}).superRefine((p, ctx) => {
  if (!p.builderRoles.includes('university')) return
  if (p.universities.length === 0) ctx.addIssue({ code: 'custom', message: 'Add your university', path: ['universities'] })
  p.universities.forEach((e, i) => {
    const issue = (message: string, field: string) => ctx.addIssue({ code: 'custom', message, path: ['universities', i, field] })
    if ([e.universityId, e.catalogUniversity, e.newUniversity].filter(Boolean).length !== 1) issue('Pick your university', 'universityId')
    // a name of only punctuation would normalize to '' and collide with every other such name
    if (e.newUniversity && normalizeOrgName(e.newUniversity.name).length < 2) issue('Enter the university name', 'newUniversity')
    if (e.newUniversity && !e.newUniversity.country) issue("Pick the university's country", 'newUniversity')
    if (e.kind === 'student' && !e.fieldOfStudy) issue('Pick your field of study', 'fieldOfStudy')
    if (e.clubId && e.newClubName) issue('Pick one club', 'clubId')
    if (e.newClubName && normalizeOrgName(e.newClubName).length < 2) issue('Enter the club name', 'newClubName')
  })
  const ids = p.universities.map((u) => u.universityId).filter(Boolean)
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'You added the same university twice', path: ['universities'] })
  if (needsAdultConfirmation(p.universities) && !p.adultConfirmed) ctx.addIssue({ code: 'custom', message: 'Confirm that you are 18 or older', path: ['adultConfirmed'] })
}).transform((p) => {
  const universities = p.builderRoles.includes('university') ? p.universities : []
  const student = needsAdultConfirmation(universities)
  return { ...p, universities, trackInterests: student ? p.trackInterests : [], campusCoordinatorInterest: student && p.campusCoordinatorInterest }
})

export type ProfileInput = z.input<typeof profileSchema>
export type Profile = z.output<typeof profileSchema>
