import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useSession } from '../Auth/sessionContext'
import { api, qs, type OrderStatus, type Paged, type RefundStatus, type TicketStatus, type UserRow } from './api'
import { Badge, Card, Confirm, Empty, ErrorBox, KeyValue, Loading, PageHeader, Pager, SearchBox, Stat, Tabs } from './ui'
import { date, dateTime, egp, num } from './format'
import { useAction, useLoad } from './hooks'

export function UsersPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q') ?? ''
  const filter = params.get('filter') ?? ''
  const page = Number(params.get('page') ?? 1)
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); if (k !== 'page') p.delete('page'); setParams(p) }
  const query = filter === 'ADMIN' ? { role: 'ADMIN' } : filter === 'blocked' ? { blocked: 'true' } : filter === 'USER' ? { role: 'USER' } : {}
  const { data, error, loading, reload } = useLoad(() => api.get<Paged<UserRow>>(`/users${qs({ q, page, ...query })}`), [q, filter, page])

  return <>
    <PageHeader title="Customers" sub="Everyone with a Hafletna account. Block abusers, or give a teammate admin access." />
    <Card>
      <div className="cx-toolbar">
        <Tabs value={filter} onChange={(v) => set('filter', v)} options={[{ value: '', label: 'Everyone' }, { value: 'USER', label: 'Customers' }, { value: 'ADMIN', label: 'Admins' }, { value: 'blocked', label: 'Blocked' }]} />
        <SearchBox value={q} onChange={(v) => set('q', v)} placeholder="Name, email or phone…" />
      </div>
      {error && <ErrorBox error={error} retry={reload} />}
      {loading && !data ? <Loading /> : data && (data.rows.length ? <>
        <div className="cx-table-wrap"><table className="cx-table">
          <thead><tr><th>Name</th><th>Joined</th><th>Role</th><th className="num">Orders</th><th className="num">Tickets</th><th className="num">Spent</th></tr></thead>
          <tbody>{data.rows.map((u) => <tr key={u.id} className="is-link" onClick={() => navigate(`/admin/users/${u.id}`)}>
            <td><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="cx-avatar">{u.fullName.charAt(0)}</span>
              <span className="cx-two"><span className="cx-strong">{u.fullName} {u.isBlocked && <Badge value="BLOCKED" />}</span><span className="cx-muted cx-small">{u.email}{u.google ? ' · Google' : ''}</span></span></span></td>
            <td>{date(u.createdAt)}</td>
            <td><Badge value={u.role} label={u.role === 'ADMIN' ? 'Admin' : 'Customer'} /></td>
            <td className="num">{num(u.orders)}</td><td className="num">{num(u.tickets)}</td><td className="num cx-strong">{egp(u.spent)}</td>
          </tr>)}</tbody>
        </table></div>
        <Pager page={data.page} pageCount={data.pageCount} total={data.total} onPage={(p) => set('page', String(p))} />
      </> : <Empty>No accounts match.</Empty>)}
    </Card>
  </>
}

type UserDetail = UserRow & {
  blockedAt: string | null; blockedBy: { fullName: string } | null; marketingOptIn: boolean
  orders: { id: string; reference: string; status: OrderStatus; total: string; createdAt: string; event: { name: string } }[]
  heldTickets: { id: string; attendeeName: string; status: TicketStatus; event: { name: string; startAt: string }; ticketCategory: { name: string } }[]
  refundsAsPayee: { id: string; status: RefundStatus; amount: string; createdAt: string; ticket: { event: { name: string } } }[]
}

export function UserPage() {
  const { userId } = useParams()
  const { user: me } = useSession()
  const { data: u, error, loading, reload } = useLoad(() => api.get<UserDetail>(`/users/${userId}`), [userId])
  const { run } = useAction()
  const [dialog, setDialog] = useState<'block' | 'unblock' | 'admin' | 'user' | null>(null)
  if (loading && !u) return <Loading />
  if (error || !u) return <ErrorBox error={error} retry={reload} />
  const self = me?.id === u.id

  return <>
    <PageHeader back={{ to: '/admin/users', label: 'Customers' }} title={<>{u.fullName} {u.role === 'ADMIN' && <Badge value="ADMIN" label="Admin" />} {u.isBlocked && <Badge value="BLOCKED" />}</>}
      sub={`${u.email} · joined ${date(u.createdAt)}`}
      actions={!self && <>
        {u.role === 'USER' ? <button className="cx-btn" onClick={() => setDialog('admin')}>Make admin</button> : <button className="cx-btn" onClick={() => setDialog('user')}>Remove admin access</button>}
        {u.isBlocked ? <button className="cx-btn is-success" onClick={() => setDialog('unblock')}>Unblock</button> : <button className="cx-btn is-danger" onClick={() => setDialog('block')}>Block account</button>}
      </>} />
    {u.isBlocked && <div className="cx-note is-red" style={{ marginBottom: 16 }}><b>Blocked</b> {u.blockedAt && `on ${dateTime(u.blockedAt)}`}{u.blockedBy && ` by ${u.blockedBy.fullName}`}. Reason: {u.blockedReason}. They cannot sign in or buy tickets.</div>}
    <div className="cx-stats">
      <Stat tone="purple" label="Total spent" value={egp(u.spent)} />
      <Stat tone="blue" label="Orders" value={num(u.orders.length)} />
      <Stat tone="green" label="Tickets held" value={num(u.heldTickets.filter((t) => t.status === 'VALID').length)} />
      <Stat tone="amber" label="Refund requests" value={num(u.refundsAsPayee.length)} />
    </div>
    <div className="cx-grid cx-grid-main">
      <div className="cx-stack">
        <Card title="Orders">{u.orders.length ? <div className="cx-table-wrap"><table className="cx-table"><tbody>{u.orders.map((o) => <tr key={o.id}>
          <td><Link className="cx-strong cx-mono" to={`/admin/orders/${o.id}`}>{o.reference}</Link></td><td>{o.event.name}</td><td className="cx-muted">{date(o.createdAt)}</td>
          <td><Badge value={o.status} /></td><td className="num cx-strong">{egp(o.total)}</td></tr>)}</tbody></table></div> : <Empty>No orders.</Empty>}</Card>
        <Card title="Tickets they hold">{u.heldTickets.length ? <div className="cx-table-wrap"><table className="cx-table"><tbody>{u.heldTickets.map((t) => <tr key={t.id}>
          <td><Link className="cx-strong" to={`/admin/tickets/${t.id}`}>{t.attendeeName}</Link></td><td>{t.event.name}</td><td className="cx-muted">{t.ticketCategory.name}</td>
          <td><Badge value={t.status} /></td></tr>)}</tbody></table></div> : <Empty>No tickets.</Empty>}</Card>
      </div>
      <div className="cx-stack">
        <Card title="Account"><KeyValue items={[
          ['Email', u.email], ['Phone', u.phone ?? '—'], ['Signs in with', u.google ? 'Google' : 'Email and password'],
          ['Marketing emails', u.marketingOptIn ? 'Yes' : 'No'], ['Role', u.role === 'ADMIN' ? 'Administrator' : 'Customer'],
        ]} /></Card>
        <Card title="Refunds">{u.refundsAsPayee.length ? <div className="cx-list">{u.refundsAsPayee.map((r) =>
          <div key={r.id} className="cx-list-row"><span className="cx-two"><span>{r.ticket.event.name}</span><span className="cx-muted cx-small">{date(r.createdAt)}</span></span><span><Badge value={r.status} /> <b>{egp(r.amount)}</b></span></div>)}</div>
          : <Empty>No refund requests.</Empty>}</Card>
      </div>
    </div>
    {dialog === 'block' && <Confirm title={`Block ${u.fullName}`} danger confirm="Block account"
      message="They are signed out at once and cannot sign in, buy or transfer tickets until you unblock them."
      reason={{ label: 'Reason (kept on their account)' }} suggestions={['Repeated chargebacks', 'Reselling tickets above face value', 'Abusive behaviour']}
      onConfirm={(reason) => run(() => api.post(`/users/${u.id}/block`, { reason }), 'Account blocked', reload)} onClose={() => setDialog(null)} />}
    {dialog === 'unblock' && <Confirm title={`Unblock ${u.fullName}`} message="They can sign in and buy tickets again." confirm="Unblock"
      onConfirm={() => run(() => api.post(`/users/${u.id}/unblock`), 'Account unblocked', reload)} onClose={() => setDialog(null)} />}
    {dialog === 'admin' && <Confirm title="Make admin" message={<>{u.fullName} will be able to open this console and change events, refunds and accounts.</>} confirm="Make admin"
      onConfirm={() => run(() => api.patch(`/users/${u.id}/role`, { role: 'ADMIN' }), `${u.fullName} is now an admin`, reload)} onClose={() => setDialog(null)} />}
    {dialog === 'user' && <Confirm title="Remove admin access" message={<>{u.fullName} becomes a normal customer straight away.</>} confirm="Remove access" danger
      onConfirm={() => run(() => api.patch(`/users/${u.id}/role`, { role: 'USER' }), 'Admin access removed', reload)} onClose={() => setDialog(null)} />}
  </>
}
