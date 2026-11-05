import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, qs, type RefundRow, type RefundStatus } from './api'
import { Badge, Card, Confirm, Empty, ErrorBox, Loading, PageHeader, Tabs } from './ui'
import { date, dateTime, egp, title } from './format'
import { useAction, useLoad, useNow } from './hooks'

const REJECT_REASONS = [
  'Refund requests close 7 days before the event, as stated in the event policy.',
  'This ticket was transferred, so it cannot be refunded.',
  'We could not verify this request. Please contact support.',
]

export default function RefundsPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? 'SUBMITTED') as RefundStatus | ''
  const { data, error, loading, reload } = useLoad(() => api.get<{ rows: RefundRow[]; counts: Partial<Record<RefundStatus, number>> }>(`/refunds${qs({ status })}`), [status])
  const { run } = useAction()
  const [approve, setApprove] = useState<RefundRow | null>(null)
  const [reject, setReject] = useState<RefundRow | null>(null)
  const c = data?.counts ?? {}
  const now = useNow()

  return <>
    <PageHeader title="Refunds" sub="Approving sends the money back to the customer's card through Stripe at once; you never need to open Stripe. Rejecting emails the customer your message." />
    <Card>
      <div className="cx-toolbar">
        <Tabs value={status} onChange={(v) => setParams(v ? { status: v } : { status: '' })} options={[
          { value: 'SUBMITTED', label: 'To review', count: c.SUBMITTED ?? 0 }, { value: 'SETTLED', label: 'Refunded', count: c.SETTLED ?? 0 },
          { value: 'APPROVED', label: 'Payout pending', count: c.APPROVED ?? 0 }, { value: 'REJECTED', label: 'Rejected', count: c.REJECTED ?? 0 }, { value: '', label: 'All' },
        ]} />
      </div>
      {error && <ErrorBox error={error} retry={reload} />}
      {loading && !data ? <Loading /> : data && (data.rows.length ? <div className="cx-table-wrap"><table className="cx-table cx-refunds">
        <thead><tr><th>Customer</th><th>Ticket</th><th>Reason</th><th className="num">Refund</th><th>Status</th><th /></tr></thead>
        <tbody>{data.rows.map((r) => {
          const daysLeft = Math.ceil((new Date(r.ticket.event.startAt).getTime() - now) / 86_400_000)
          return <tr key={r.id}>
            <td><span className="cx-two"><Link className="cx-strong" to={`/admin/users/${r.payee.id}`}>{r.payee.fullName}</Link><span className="cx-muted cx-small">{r.payee.email}</span></span></td>
            <td><span className="cx-two"><Link to={`/admin/tickets/${r.ticket.id}`}>{r.ticket.event.name}</Link>
              <span className="cx-muted cx-small">{r.ticket.ticketCategory.name} · {r.ticket.attendeeName} · <span className="cx-mono">{r.ticket.orderItem.order.reference}</span></span>
              <span className="cx-muted cx-small">Event {date(r.ticket.event.startAt)}{daysLeft >= 0 ? ` · in ${daysLeft} days` : ' · past'}</span></span></td>
            <td style={{ maxWidth: 260 }}><span className="cx-two">
              <span className="cx-small">{r.type === 'USER_REQUESTED' ? (r.reason ? `“${r.reason}”` : '—') : title(r.type)}</span>
              <span className="cx-muted cx-small">Requested {dateTime(r.createdAt)}</span>
              {r.rejectionReason && <span className="cx-small" style={{ color: 'var(--cx-red)' }}>Your message: {r.rejectionReason}</span>}
              {r.reviewedBy && <span className="cx-muted cx-small">Reviewed by {r.reviewedBy.fullName}</span>}
            </span></td>
            <td className="num"><span className="cx-two"><span className="cx-strong">{egp(r.amount)}</span>{Number(r.serviceFeeRetained) > 0 && <span className="cx-muted cx-small">fee kept {egp(r.serviceFeeRetained)}</span>}</span></td>
            <td><Badge value={r.status} label={r.status === 'SETTLED' ? 'Refunded' : r.status === 'SUBMITTED' ? 'To review' : r.status === 'APPROVED' ? 'Payout pending' : undefined} /></td>
            <td className="num" style={{ whiteSpace: 'nowrap' }}>
              {r.status === 'SUBMITTED' && <>
                <button className="cx-btn is-small is-success" onClick={() => setApprove(r)}>Approve</button>{' '}
                <button className="cx-btn is-small" onClick={() => setReject(r)}>Reject</button>
              </>}
              {r.status === 'APPROVED' && <button className="cx-btn is-small" onClick={() => run(() => api.post(`/refunds/${r.id}/settle`), 'Payout sent again', reload)}>Retry payout</button>}
            </td>
          </tr>
        })}</tbody>
      </table></div> : <Empty>{status === 'SUBMITTED' ? 'Nothing to review. 🎉' : 'No refunds here.'}</Empty>)}
    </Card>

    {approve && <Confirm title="Approve refund" confirm={`Refund ${egp(approve.amount)}`}
      message={<><b>{egp(approve.amount)}</b> goes back to {approve.payee.fullName}'s card straight away (through Stripe for card payments). The ticket stops working and its place goes back on sale. The customer gets an email.</>}
      onConfirm={() => run(() => api.post(`/refunds/${approve.id}/approve`), 'Refund approved and paid back', reload)} onClose={() => setApprove(null)} />}
    {reject && <Confirm title="Reject refund" confirm="Reject and email the customer" danger
      message={<>{reject.payee.fullName} keeps their ticket. They will get an email with your message, and it also shows on their ticket on the website.</>}
      reason={{ label: 'Message to the customer', placeholder: 'Explain why the refund was not approved…' }} suggestions={REJECT_REASONS}
      onConfirm={(reason) => run(() => api.post(`/refunds/${reject.id}/reject`, { reason }), 'Refund rejected; the customer was emailed', reload)} onClose={() => setReject(null)} />}
  </>
}
