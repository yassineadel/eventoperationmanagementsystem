import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, qs, type Paged, type RefundStatus, type TicketRow, type TicketStatus } from './api'
import { Badge, Card, Confirm, Empty, ErrorBox, KeyValue, Loading, PageHeader, Pager, SearchBox, Tabs } from './ui'
import { dateTime, egp, seatLabel, title } from './format'
import { useAction, useLoad } from './hooks'

export function TicketsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const status = params.get('status') ?? ''
  const q = params.get('q') ?? ''
  const eventId = params.get('eventId') ?? ''
  const page = Number(params.get('page') ?? 1)
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); if (k !== 'page') p.delete('page'); setParams(p) }
  const { data, error, loading, reload } = useLoad(() => api.get<Paged<TicketRow>>(`/tickets${qs({ status, q, eventId, page })}`), [status, q, eventId, page])

  return <>
    <PageHeader title="Tickets" sub="Every issued ticket, who holds it now, and its state at the gate." />
    <Card>
      <div className="cx-toolbar">
        <Tabs value={status} onChange={(v) => set('status', v)} options={[{ value: '', label: 'All' }, { value: 'VALID', label: 'Valid' }, { value: 'USED', label: 'Used' }, { value: 'REFUNDED', label: 'Refunded' }, { value: 'VOID', label: 'Void' }]} />
        <SearchBox value={q} onChange={(v) => set('q', v)} placeholder="Name, holder email, order or ticket ID…" />
        {eventId && <button className="cx-btn is-small" onClick={() => set('eventId', '')}>One event only ✕</button>}
      </div>
      {error && <ErrorBox error={error} retry={reload} />}
      {loading && !data ? <Loading /> : data && (data.rows.length ? <>
        <div className="cx-table-wrap"><table className="cx-table">
          <thead><tr><th>Name on ticket</th><th>Event</th><th>Type / seat</th><th>Holder</th><th>Order</th><th>Status</th></tr></thead>
          <tbody>{data.rows.map((t) => <tr key={t.id} className="is-link" onClick={() => navigate(`/admin/tickets/${t.id}`)}>
            <td><span className="cx-two"><span className="cx-strong">{t.attendeeName}</span>{t.transferCount > 0 && <span className="cx-muted cx-small">Transferred {t.transferCount}×</span>}</span></td>
            <td><span className="cx-two"><span>{t.event.name}</span><span className="cx-muted cx-small">{dateTime(t.event.startAt)}</span></span></td>
            <td><span className="cx-two"><span>{t.ticketCategory.name}</span><span className="cx-muted cx-small">{seatLabel(t.seat)}</span></span></td>
            <td><span className="cx-two"><span>{t.holder.fullName}</span><span className="cx-muted cx-small">{t.holder.email}</span></span></td>
            <td className="cx-mono">{t.orderItem.order.reference}</td>
            <td><Badge value={t.status} /></td>
          </tr>)}</tbody>
        </table></div>
        <Pager page={data.page} pageCount={data.pageCount} total={data.total} onPage={(p) => set('page', String(p))} />
      </> : <Empty>No tickets match.</Empty>)}
    </Card>
  </>
}

type TicketDetail = {
  id: string; attendeeName: string; status: TicketStatus; transferCount: number; createdAt: string; usedAt: string | null
  event: { id: string; name: string; startAt: string; status: string; venue: { name: string } }
  ticketCategory: { name: string }; seat: { section: string; row: string; number: number } | null
  orderItem: { unitPrice: string; serviceFeeAmount: string; order: { id: string; reference: string; paidAt: string | null } }
  refunds: { id: string; status: RefundStatus; type: string; amount: string; reason: string | null; rejectionReason: string | null; createdAt: string }[]
  scanRecords: { id: string; result: string; method: string; scannedAt: string }[]
  purchaser: { id: string; fullName: string; email: string }; holder: { id: string; fullName: string; email: string }
  transfers: { sequence: number; createdAt: string; fromUser: { id: string; email: string }; toUser: { id: string; email: string } }[]
}

export function TicketPage() {
  const { ticketId } = useParams()
  const { data: t, error, loading, reload } = useLoad(() => api.get<TicketDetail>(`/tickets/${ticketId}`), [ticketId])
  const { run, busy } = useAction()
  const [voiding, setVoiding] = useState(false)
  if (loading && !t) return <Loading />
  if (error || !t) return <ErrorBox error={error} retry={reload} />

  return <>
    <PageHeader back={{ to: '/admin/tickets', label: 'Tickets' }} title={<>{t.attendeeName} <Badge value={t.status} /></>}
      sub={`${t.event.name} · ${t.ticketCategory.name} · ${seatLabel(t.seat)}`}
      actions={t.status === 'VALID' && <>
        <button className="cx-btn" disabled={busy} onClick={() => run(() => api.post(`/tickets/${t.id}/resend`), `Ticket emailed to ${t.holder.email}`)}>Email ticket to holder</button>
        <button className="cx-btn is-danger" onClick={() => setVoiding(true)}>Void ticket</button>
      </>} />
    <div className="cx-grid cx-grid-main">
      <div className="cx-stack">
        <Card title="Ticket"><KeyValue items={[
          ['Event', <Link to={`/admin/events/${t.event.id}`}>{t.event.name}</Link>], ['Date', dateTime(t.event.startAt)], ['Venue', t.event.venue.name],
          ['Type', t.ticketCategory.name], ['Seat', seatLabel(t.seat)], ['Price paid', egp(Number(t.orderItem.unitPrice) + Number(t.orderItem.serviceFeeAmount))],
          ['Order', <Link className="cx-mono" to={`/admin/orders/${t.orderItem.order.id}`}>{t.orderItem.order.reference}</Link>], ['Issued', dateTime(t.createdAt)],
          ['Used at the gate', t.usedAt ? dateTime(t.usedAt) : 'Not yet'], ['Ticket ID', <span className="cx-mono">{t.id}</span>],
        ]} /></Card>
        <Card title="Refunds">{t.refunds.length ? <div className="cx-list">{t.refunds.map((r) => <div key={r.id} className="cx-list-row">
          <span className="cx-two"><span><Badge value={r.status} /> <span className="cx-muted cx-small">{title(r.type)} · {dateTime(r.createdAt)}</span></span>
            {r.reason && <span className="cx-small">“{r.reason}”</span>}
            {r.rejectionReason && <span className="cx-small" style={{ color: 'var(--cx-red)' }}>Declined: {r.rejectionReason}</span>}</span>
          <span className="cx-strong">{egp(r.amount)}</span>
        </div>)}</div> : <Empty>No refund requests.</Empty>}</Card>
        <Card title="Gate scans">{t.scanRecords.length ? <div className="cx-list">{t.scanRecords.map((s) => <div key={s.id} className="cx-list-row">
          <Badge value={s.result === 'ACCEPTED' ? 'VALID' : 'REJECTED'} label={title(s.result)} /><span className="cx-muted">{title(s.method)} · {dateTime(s.scannedAt)}</span>
        </div>)}</div> : <Empty>Not scanned yet.</Empty>}</Card>
      </div>
      <div className="cx-stack">
        <Card title="Ownership"><KeyValue items={[
          ['Bought by', <Link to={`/admin/users/${t.purchaser.id}`}>{t.purchaser.fullName}</Link>],
          ['Held now by', <Link to={`/admin/users/${t.holder.id}`}>{t.holder.fullName}</Link>],
          ['Transfers', `${t.transferCount} of 3 used`],
        ]} /></Card>
        <Card title="Transfer history">{t.transfers.length ? <div className="cx-timeline">{t.transfers.map((x) =>
          <div key={x.sequence}><span><b>{x.fromUser.email}</b> → <b>{x.toUser.email}</b><br /><small className="cx-muted">{dateTime(x.createdAt)}</small></span></div>)}</div>
          : <Empty>Never transferred.</Empty>}</Card>
      </div>
    </div>
    {voiding && <Confirm title="Void ticket" danger confirm="Void ticket"
      message="The ticket stops working at the gate and its place goes back on sale. No money is refunded: use this for stolen, duplicate or fraudulent tickets. To pay a customer back, approve a refund instead."
      reason={{ label: 'Reason (kept in the activity log)' }} suggestions={['Reported stolen', 'Duplicate issued by mistake', 'Fraudulent purchase']}
      onConfirm={(reason) => run(() => api.post(`/tickets/${t.id}/void`, { reason }), 'Ticket voided', reload)} onClose={() => setVoiding(false)} />}
  </>
}
