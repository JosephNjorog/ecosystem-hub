import { z } from 'zod'
import { MAX_ALIASES } from '@/lib/campus'

const id = z.string().min(1).max(40)

export const orgFlagSchema = z.object({ id, value: z.boolean() })
export const renameOrgSchema = z.object({ id, name: z.string().trim().min(2, 'Enter a name').max(120) })
export const mergeOrgSchema = z.object({ sourceId: id, targetId: id }).refine((m) => m.sourceId !== m.targetId, 'Pick a different organization to merge into')
export const orgAliasesSchema = z.object({ id, aliases: z.array(z.string().trim().max(120)).max(MAX_ALIASES, `At most ${MAX_ALIASES} alternative names`) })
