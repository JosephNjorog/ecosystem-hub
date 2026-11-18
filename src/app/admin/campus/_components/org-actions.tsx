'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, EyeOff, GitMerge, Pencil, ShieldCheck, ShieldOff, Tags } from 'lucide-react'
import { Field } from '@/components/field'
import { FormDialog } from '@/components/form-dialog'
import { SearchSelect, type SearchSelectOption } from '@/components/search-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useActionToast } from '@/hooks/use-action-toast'
import { mergeOrg, renameOrg, setOrgAliases, setOrgHidden, setOrgVerified } from '@/app/(app)/campus/_lib/actions'

type Org = { id: string; name: string; aliases: string[]; verified: boolean; hidden: boolean }

export function OrgActions({ org, mergeTargets }: { org: Org; mergeTargets: SearchSelectOption[] }) {
  const router = useRouter()
  const { pending, run } = useActionToast()
  const [name, setName] = useState(org.name)
  const [target, setTarget] = useState<string | null>(null)
  const [aliases, setAliases] = useState(org.aliases.join('\n'))
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={pending} onClick={() => run(() => setOrgVerified({ id: org.id, value: !org.verified }), org.verified ? 'Marked unverified' : 'Verified')}>
        {org.verified ? <><ShieldOff aria-hidden /> Unverify</> : <><ShieldCheck aria-hidden /> Verify</>}
      </Button>
      <Button variant="outline" disabled={pending} onClick={() => run(() => setOrgHidden({ id: org.id, value: !org.hidden }), org.hidden ? 'Shown in pickers again' : 'Hidden from pickers')}>
        {org.hidden ? <><Eye aria-hidden /> Show in pickers</> : <><EyeOff aria-hidden /> Hide from pickers</>}
      </Button>
      <FormDialog trigger={<Button variant="outline"><Pencil aria-hidden /> Rename</Button>} title="Rename" submitLabel="Save" pending={pending} onSubmit={() => run(() => renameOrg({ id: org.id, name }), 'Renamed')}>
        <Field id="org-name" label="Name"><Input id="org-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className="h-11" /></Field>
      </FormDialog>
      <FormDialog trigger={<Button variant="outline"><Tags aria-hidden /> Alternative names</Button>} title="Alternative names" description="Other names it goes by, e.g. in another language. The pickers find it by these too, and nobody can add them as a new entry." submitLabel="Save" pending={pending} onSubmit={() => run(() => setOrgAliases({ id: org.id, aliases: aliases.split('\n').filter((a) => a.trim()) }), 'Saved')}>
        <Field id="org-aliases" label="One per line"><Textarea id="org-aliases" value={aliases} onChange={(e) => setAliases(e.target.value)} rows={5} placeholder="Universität Wien" /></Field>
      </FormDialog>
      <FormDialog
        trigger={<Button variant="outline"><GitMerge aria-hidden /> Merge into…</Button>}
        title={`Merge “${org.name}”`}
        description="Its members (and clubs) move to the one you pick, its names become alternative names there, then this entry is deleted. This can't be undone."
        submitLabel="Merge"
        pending={pending}
        onSubmit={() => {
          if (!target) {
            toast.error('Pick the entry to keep')
            return Promise.resolve(false)
          }
          return run(() => mergeOrg({ sourceId: org.id, targetId: target }), 'Merged', () => router.push(`/admin/campus/organizations/${target}`))
        }}
      >
        <Field id="org-target" label="Keep this one"><SearchSelect id="org-target" value={target} onChange={setTarget} options={mergeTargets} placeholder="Pick the entry to keep" /></Field>
      </FormDialog>
    </div>
  )
}
