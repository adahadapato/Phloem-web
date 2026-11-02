import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { JobRoleDto } from '../../../api/contracts/dtos'
import { permissionGroups } from '../../../api/contracts/permissions'
import { getJobRoles, setJobRolePermissions } from '../../../api/services/staffService'
import { Button } from '../../../components/ui/Button'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'

type Message = { text: string; isError: boolean } | null

/** True when two permission lists hold the same permissions. */
const same = (a: string[], b: string[]) => a.length === b.length && a.every((p) => b.includes(p))

/**
 * One job role on a card: what it's for, how many people hold it, and its permissions as tick-boxes in groups.
 * Owners change the ticks and press Save; everyone else sees them read-only.
 */
function RoleCard({ role, canEdit, onSaved }: { role: JobRoleDto; canEdit: boolean; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState<string[]>(role.permissions)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const changed = !same(draft, role.permissions)
  const removing = role.permissions.some((p) => !draft.includes(p))

  const toggle = (permission: string) =>
    setDraft((d) => (d.includes(permission) ? d.filter((p) => p !== permission) : [...d, permission]))

  const save = async () => {
    setBusy(true)
    setMessage(null)
    const result = await setJobRolePermissions(role.role, draft)
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    await onSaved()
    setMessage({
      text: removing && role.memberCount > 0
        ? `Saved. The ${role.memberCount} ${role.memberCount === 1 ? 'person' : 'people'} with this role have been signed out so it applies now.`
        : 'Saved. It applies at their next sign-in or within a few minutes.',
      isError: false,
    })
  }

  return (
    <li className={styles.person}>
      <div className={styles.personTop}>
        <div className={styles.personWho}>
          <h2 className={styles.personName}>{role.name}</h2>
          {role.description && <span className="muted">{role.description}</span>}
        </div>
        <span className={`${styles.chip} ${styles.chipOff}`}>
          {role.memberCount} {role.memberCount === 1 ? 'person' : 'people'}
        </span>
      </div>
      <StatusBanner message={message?.text} isError={message?.isError} />

      {permissionGroups.map((group) => (
        <fieldset key={group.title} className={styles.inlinePanel} disabled={!canEdit || busy}>
          <legend><strong>{group.title}</strong></legend>
          <ul className={styles.roleList}>
            {group.items.map((item) => (
              <li key={item.permission}>
                <label className={canEdit ? undefined : styles.locked}>
                  <input type="checkbox" checked={draft.includes(item.permission)}
                         onChange={() => toggle(item.permission)} />
                  <span><strong>{item.name}</strong><span className={styles.roleAbout}>{item.about}</span></span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}

      {canEdit && (
        <div className={styles.personActions}>
          <Button small variant="secondary" busy={busy} busyText="Saving…" disabled={!changed} onClick={() => void save()}>
            Save {role.name}
          </Button>
          {changed && (
            <Button small variant="outline" disabled={busy} onClick={() => { setDraft(role.permissions); setMessage(null) }}>
              Undo changes
            </Button>
          )}
          {changed && removing && role.memberCount > 0 && (
            <span className={styles.panelHint}>Taking something away signs this role's people out.</span>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Admin → Staff → Job roles: what each staff job role is allowed to do. Owners (Admin) tick and untick permissions;
 * staff with the Staff permission can look but not change. Owners themselves always have everything.
 */
export default function AdminJobRolesPage() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['admin', 'job-roles'],
    queryFn: async ({ signal }) => unwrap(await getJobRoles(signal)),
  })
  const reload = () => queryClient.invalidateQueries({ queryKey: ['admin'] })

  return (
    <>
      <AdminHead title="Job roles"
                 sub="What each staff job role is allowed to do. Owners always have everything, in every country.">
        <Link to="/admin/staff" className={styles.linkButton}>‹ Staff</Link>
      </AdminHead>

      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the job roles." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {query.isPending && <p className="muted" aria-busy="true">Loading…</p>}

      {query.data && (
        <>
          {!query.data.canEdit && <p className={styles.count}>Only owners can change what a job role may do.</p>}
          <ul className={styles.people}>
            {query.data.roles.map((r) => (
              <RoleCard key={r.role} role={r} canEdit={query.data.canEdit} onSaved={reload} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}
