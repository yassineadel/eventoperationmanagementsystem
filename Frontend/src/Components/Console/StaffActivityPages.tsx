import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, qs, type Lookups } from './api'
import { Badge, Card, Confirm, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Pager, Tabs } from './ui'
import { ago, date, dateTime, num, title } from './format'
import { useAction, useLoad } from './hooks'

type Staff = {
  id: string; fullName: string; username: string; role: 'SCANNER' | 'APP_ADMIN'; isBlocked: boolean; lastLoginAt: string | null; createdAt: string
  assignments: { id: string; event: { id: string; name: string; startAt: string } }[]
  _count: { scanRecords: number }
}

export function StaffPage() {
  const { data, error, loading, reload } = useLoad(() => api.get<Staff[]>('/staff'), [])
  const lookups = useLoad(() => api.get<Lookups>('/lookups'), [])
  const { run } = useAction()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ fullName: '', username: '', password: '', role: 'SCANNER' })
  const [assign, setAssign] = useState<{ staff: Staff; eventId: string } | null>(null)
  const [block, setBlock] = useState<Staff | null>(null)

  const create = async () => {
    if (await run(() => api.post('/staff', form), `Account ${form.username} created`, reload)) { setCreating(false); setForm({ fullName: '', username: '', password: '', role: 'SCANNER' }) }
  }

  return <>
    <PageHeader title="Gate staff" sub="Accounts for the scanner app at the doors. A scanner only sees the events you assign to them."
      actions={<button className="cx-btn is-primary" onClick={() => setCreating(true)}>+ New staff account</button>} />
    {error && <ErrorBox error={error} retry={reload} />}
    {loading && !data ? <Loading /> : data && (data.length ? <div className="cx-grid cx-grid-2">{data.map((s) => <Card key={s.id} title={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span className="cx-avatar">{s.fullName.charAt(0)}</span>{s.fullName} <Badge value={s.role} label={s.role === 'APP_ADMIN' ? 'Gate admin' : 'Scanner'} />{s.isBlocked && <Badge value="BLOCKED" />}</span>}
      actions={s.isBlocked ? <button className="cx-btn is-small is-success" onClick={() => run(() => api.post(`/staff/${s.id}/unblock`), 'Account unblocked', reload)}>Unblock</button>
        : <button className="cx-btn is-small is-ghost" onClick={() => setBlock(s)}>Block</button>}>
      <div className="cx-muted cx-small" style={{ marginBottom: 12 }}>
        Username <b className="cx-mono">{s.username}</b> · {num(s._count.scanRecords)} scans · last sign-in {s.lastLoginAt ? ago(s.lastLoginAt) : 'never'}
      </div>
      <div className="cx-list">{s.assignments.map((a) => <div key={a.id} className="cx-list-row">
        <span className="cx-two"><Link className="cx-strong" to={`/admin/events/${a.event.id}`}>{a.event.name}</Link><span className="cx-muted cx-small">{date(a.event.startAt)}</span></span>
        <button className="cx-btn is-small is-ghost" onClick={() => run(() => api.del(`/staff/${s.id}/assignments/${a.event.id}`), 'Removed from the event', reload)}>Remove</button>
      </div>)}</div>
      {!s.assignments.length && <Empty>Not assigned to any event.</Empty>}
      <button className="cx-btn is-small" style={{ marginTop: 12 }} onClick={() => setAssign({ staff: s, eventId: '' })}>+ Assign to an event</button>
    </Card>)}</div> : <Card><Empty>No staff accounts yet.</Empty></Card>)}

    {creating && <Modal title="New staff account" onClose={() => setCreating(false)} footer={<>
      <button className="cx-btn is-ghost" onClick={() => setCreating(false)}>Back</button>
      <button className="cx-btn is-primary" onClick={create} disabled={!form.fullName || !form.username || form.password.length < 8}>Create</button>
    </>}>
      <Field label="Full name"><input className="cx-input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
      <Field label="Username (used to sign in to the scanner app)"><input className="cx-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="e.g. mona.gate" /></Field>
      <Field label="Password" hint="At least 8 characters. Share it privately with the staff member."><input className="cx-input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
      <Field label="Role"><select className="cx-input" style={{ width: '100%' }} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="SCANNER">Scanner</option><option value="APP_ADMIN">Gate admin</option></select></Field>
    </Modal>}
    {assign && <Modal title={`Assign ${assign.staff.fullName}`} onClose={() => setAssign(null)} footer={<>
      <button className="cx-btn is-ghost" onClick={() => setAssign(null)}>Back</button>
      <button className="cx-btn is-primary" disabled={!assign.eventId} onClick={async () => { if (await run(() => api.post(`/staff/${assign.staff.id}/assignments`, { eventId: assign.eventId }), 'Assigned to the event', reload)) setAssign(null) }}>Assign</button>
    </>}>
      <Field label="Event"><select className="cx-input" style={{ width: '100%' }} value={assign.eventId} onChange={(e) => setAssign({ ...assign, eventId: e.target.value })}>
        <option value="">Choose an event…</option>
        {lookups.data?.events.filter((e) => !assign.staff.assignments.some((a) => a.event.id === e.id)).map((e) => <option key={e.id} value={e.id}>{e.name} · {date(e.startAt)}</option>)}
      </select></Field>
    </Modal>}
    {block && <Confirm title={`Block ${block.fullName}`} message="They cannot sign in to the scanner app until you unblock them." confirm="Block" danger
      onConfirm={() => run(() => api.post(`/staff/${block.id}/block`), 'Account blocked', reload)} onClose={() => setBlock(null)} />}
  </>
}

type Activity = { id: string; action: string; entityType: string; entityId: string; details: Record<string, unknown> | null; createdAt: string; actorUser: { fullName: string } | null; actorStaff: { fullName: string } | null }

const LINKS: Record<string, (id: string) => string> = {
  Event: (id) => `/admin/events/${id}`, Order: (id) => `/admin/orders/${id}`, Ticket: (id) => `/admin/tickets/${id}`, User: (id) => `/admin/users/${id}`, StaffAccount: () => '/admin/staff',
}

const describe = (a: Activity): ReactNode => {
  const d = a.details ?? {}
  const extra = [d.name, d.reason, d.username, d.amount && `EGP ${d.amount}`, d.price && `EGP ${d.price}`].filter(Boolean).map(String)
  return <>{title(a.action)}{extra.length > 0 && <span className="cx-muted"> · {extra.join(' · ')}</span>}</>
}

export function ActivityPage() {
  const [params, setParams] = useSearchParams()
  const type = params.get('type') ?? ''
  const page = Number(params.get('page') ?? 1)
  const { data, error, loading, reload } = useLoad(() => api.get<{ rows: Activity[]; total: number; page: number; pageCount: number }>(`/activity${qs({ entityType: type, page })}`), [type, page])

  return <>
    <PageHeader title="Activity log" sub="Every change made by an administrator: who did what, and when." actions={<button className="cx-btn" onClick={reload}>Refresh</button>} />
    <Card>
      <div className="cx-toolbar"><Tabs value={type} onChange={(v) => setParams(v ? { type: v } : {})} options={[
        { value: '', label: 'Everything' }, { value: 'Event', label: 'Events' }, { value: 'Refund', label: 'Refunds' }, { value: 'Order', label: 'Orders' },
        { value: 'Ticket', label: 'Tickets' }, { value: 'User', label: 'Accounts' }, { value: 'Venue', label: 'Venues' }, { value: 'StaffAccount', label: 'Staff' },
      ]} /></div>
      {error && <ErrorBox error={error} retry={reload} />}
      {loading && !data ? <Loading /> : data && (data.rows.length ? <>
        <div className="cx-table-wrap"><table className="cx-table">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>On</th></tr></thead>
          <tbody>{data.rows.map((a) => <tr key={a.id}>
            <td className="cx-small" title={dateTime(a.createdAt)}>{ago(a.createdAt)}</td>
            <td className="cx-strong">{a.actorUser?.fullName ?? a.actorStaff?.fullName ?? 'System'}</td>
            <td>{describe(a)}</td>
            <td>{LINKS[a.entityType] ? <Link to={LINKS[a.entityType](a.entityId)}>{title(a.entityType)}</Link> : title(a.entityType)}</td>
          </tr>)}</tbody>
        </table></div>
        <Pager page={data.page} pageCount={data.pageCount} total={data.total} onPage={(p) => setParams({ ...(type && { type }), page: String(p) })} />
      </> : <Empty>No activity yet.</Empty>)}
    </Card>
  </>
}
