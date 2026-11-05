import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, qs, type OrderRow, type OrderStatus, type Paged, type TicketStatus } from './api'
import { Badge, Card, Confirm, Empty, ErrorBox, KeyValue, Loading, PageHeader, Pager, SearchBox, Tabs } from './ui'
import { dateTime, egp, num, seatLabel } from './format'
import { useAction, useLoad } from './hooks'

export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const status = params.get('status') ?? ''
  const q = params.get('q') ?? ''
  const eventId = params.get('eventId') ?? ''
  const page = Number(params.get('page') ?? 1)
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); if (k !== 'page') p.delete('page'); setParams(p) }
  const { data, error, loading, reload } = useLoad(() => api.get<Paged<OrderRow> & { paidTotal: number }>(`/orders${qs({ status, q, eventId, page })}`), [status, q, eventId, page])

  return <>
    <PageHeader title="Orders" sub="Every checkout, paid or not." />
    <Card>
      <div className="cx-toolbar">
        <Tabs value={status} onChange={(v) => set('status', v)} options={[{ value: '', label: 'All' }, { value: 'PAID', label: 'Paid' }, { value: 'PENDING', label: 'Waiting for payment' }, { value: 'FAILED', label: 'Failed' }, { value: 'CANCELLED', label: 'Cancelled' }]} />
        <SearchBox value={q} onChange={(v) => set('q', v)} placeholder="Order number, customer or event…" />
        {eventId && <button className="cx-btn is-small" onClick={() => set('eventId', '')}>One event only ✕</button>}
        {data && <span className="cx-muted" style={{ marginLeft: 'auto' }}>Paid in this view: <b>{egp(data.paidTotal)}</b></span>}
      </div>
      {error && <ErrorBox error={error} retry={reload} />}
      {loading && !data ? <Loading /> : data && (data.rows.length ? <>
        <div className="cx-table-wrap"><table className="cx-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Event</th><th>Status</th><th>Payment</th><th className="num">Tickets</th><th className="num">Total</th></tr></thead>
          <tbody>{data.rows.map((o) => <tr key={o.id} className="is-link" onClick={() => navigate(`/admin/orders/${o.id}`)}>
            <td><span className="cx-two"><span className="cx-strong cx-mono">{o.reference}</span><span className="cx-muted cx-small">{dateTime(o.createdAt)}</span></span></td>
            <td><span className="cx-two"><span>{o.user.fullName}</span><span className="cx-muted cx-small">{o.user.email}</span></span></td>
            <td>{o.event.name}</td>
            <td><Badge value={o.status} /></td>
            <td className="cx-small cx-muted">{o.payment ? `${o.payment.provider === 'stripe' ? 'Stripe' : 'Test payment'}` : '—'}</td>
            <td className="num">{num(o.tickets)}</td>
            <td className="num cx-strong">{egp(o.total)}</td>
          </tr>)}</tbody>
        </table></div>
        <Pager page={data.page} pageCount={data.pageCount} total={data.total} onPage={(p) => set('page', String(p))} />
      </> : <Empty>No orders match.</Empty>)}
    </Card>
  </>
}

type OrderDetail = {
  id: string; reference: string; status: OrderStatus; subtotal: string; serviceFeeTotal: string; total: string; createdAt: string; paidAt: string | null; expiresAt: string | null; policyAcceptedAt: string | null
  user: { id: string; fullName: string; email: string; phone: string | null }
  event: { id: string; name: string; startAt: string; venue: { name: string } }
  payment: { provider: string; providerTxId: string | null; status: string; amount: string; paidAt: string | null } | null
  items: { id: string; quantity: number; unitPrice: string; serviceFeeAmount: string; ticketCategory: { name: string }
    tickets: { id: string; attendeeName: string; status: TicketStatus; seat: { section: string; row: string; number: number } | null; holder: { id: string; fullName: string; email: string } }[] }[]
}

export function OrderPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { data: o, error, loading, reload } = useLoad(() => api.get<OrderDetail>(`/orders/${orderId}`), [orderId])
  const { run } = useAction()
  const [cancel, setCancel] = useState(false)
  if (loading && !o) return <Loading />
  if (error || !o) return <ErrorBox error={error} retry={reload} />
  const tickets = o.items.flatMap((i) => i.tickets.map((t) => ({ ...t, category: i.ticketCategory.name })))

  return <>
    <PageHeader back={{ to: '/admin/orders', label: 'Orders' }} title={<><span className="cx-mono" style={{ fontFamily: 'inherit' }}>{o.reference}</span> <Badge value={o.status} /></>}
      sub={`${o.event.name} · ordered ${dateTime(o.createdAt)}`}
      actions={o.status === 'PENDING' && <button className="cx-btn is-danger" onClick={() => setCancel(true)}>Cancel order</button>} />
    <div className="cx-grid cx-grid-main">
      <div className="cx-stack">
        <Card title="Items">
          <div className="cx-table-wrap"><table className="cx-table">
            <thead><tr><th>Ticket type</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Fee</th><th className="num">Line</th></tr></thead>
            <tbody>{o.items.map((i) => <tr key={i.id}>
              <td className="cx-strong">{i.ticketCategory.name}</td><td className="num">{i.quantity}</td><td className="num">{egp(i.unitPrice)}</td><td className="num">{egp(i.serviceFeeAmount)}</td>
              <td className="num cx-strong">{egp((Number(i.unitPrice) + Number(i.serviceFeeAmount)) * i.quantity)}</td>
            </tr>)}
              <tr><td colSpan={4} className="cx-muted">Subtotal</td><td className="num">{egp(o.subtotal)}</td></tr>
              <tr><td colSpan={4} className="cx-muted">Service fees</td><td className="num">{egp(o.serviceFeeTotal)}</td></tr>
              <tr><td colSpan={4} className="cx-strong">Total</td><td className="num cx-strong">{egp(o.total)}</td></tr>
            </tbody>
          </table></div>
        </Card>
        <Card title={`Tickets (${tickets.length})`}>
          {tickets.length ? <div className="cx-table-wrap"><table className="cx-table">
            <thead><tr><th>Name on ticket</th><th>Type</th><th>Seat</th><th>Held by</th><th>Status</th></tr></thead>
            <tbody>{tickets.map((t) => <tr key={t.id} className="is-link" onClick={() => navigate(`/admin/tickets/${t.id}`)}>
              <td className="cx-strong">{t.attendeeName}</td><td>{t.category}</td><td className="cx-small">{seatLabel(t.seat)}</td>
              <td className="cx-small">{t.holder.id === o.user.id ? 'Buyer' : <>{t.holder.fullName} <span className="cx-muted">(transferred)</span></>}</td>
              <td><Badge value={t.status} /></td>
            </tr>)}</tbody>
          </table></div> : <Empty>{o.status === 'PAID' ? 'No tickets.' : 'Tickets are issued once the order is paid.'}</Empty>}
        </Card>
      </div>
      <div className="cx-stack">
        <Card title="Customer"><KeyValue items={[
          ['Name', <Link to={`/admin/users/${o.user.id}`}>{o.user.fullName}</Link>], ['Email', o.user.email], ['Phone', o.user.phone ?? '—'],
        ]} /></Card>
        <Card title="Payment">{o.payment ? <KeyValue items={[
          ['Provider', o.payment.provider === 'stripe' ? 'Stripe (card)' : 'Payment simulator (test)'], ['Status', <Badge value={o.payment.status} />],
          ['Amount', egp(o.payment.amount)], ['Paid at', dateTime(o.payment.paidAt)],
          ['Reference', <span className="cx-mono">{o.payment.providerTxId ?? '—'}</span>],
        ]} /> : <Empty>No payment was started.</Empty>}</Card>
        <Card title="Timeline"><div className="cx-timeline">
          <div><span>Order created<br /><small className="cx-muted">{dateTime(o.createdAt)}</small></span></div>
          {o.policyAcceptedAt && <div><span>Policy accepted<br /><small className="cx-muted">{dateTime(o.policyAcceptedAt)}</small></span></div>}
          {o.paidAt && <div><span>Paid<br /><small className="cx-muted">{dateTime(o.paidAt)}</small></span></div>}
          {o.status === 'PENDING' && o.expiresAt && <div><span>Payment deadline<br /><small className="cx-muted">{dateTime(o.expiresAt)}</small></span></div>}
          {(o.status === 'CANCELLED' || o.status === 'FAILED') && <div><span>{o.status === 'FAILED' ? 'Payment failed' : 'Cancelled'}; places released</span></div>}
        </div></Card>
      </div>
    </div>
    {cancel && <Confirm title="Cancel order" message="The payment is stopped and the reserved places go back on sale." confirm="Cancel order" danger
      onConfirm={() => run(() => api.post(`/orders/${o.id}/cancel`), 'Order cancelled', reload)} onClose={() => setCancel(false)} />}
  </>
}
