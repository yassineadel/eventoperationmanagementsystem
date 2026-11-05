import { Link, useNavigate } from 'react-router-dom'
import { api, type OrderStatus } from './api'
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Progress, Stat } from './ui'
import { ago, egp, num } from './format'
import { useLoad } from './hooks'

type Dashboard = {
  revenue: number; serviceFees: number; refunded: number; ticketsSold: number; customers: number; upcomingEvents: number; pendingRefunds: number
  orders: Partial<Record<OrderStatus, number>>; events: Partial<Record<string, number>>
  sales: { day: string; revenue: number; orders: number; tickets: number }[]
  topEvents: { id: string; name: string; sold: number; capacity: number; revenue: number }[]
  recentOrders: { id: string; reference: string; status: OrderStatus; total: string; createdAt: string; user: { fullName: string }; event: { name: string } }[]
}

const ORDER_COLORS: Record<OrderStatus, string> = { PAID: '#0f8a5f', PENDING: '#d18a12', FAILED: '#c4314b', CANCELLED: '#8b8aa3' }

export default function DashboardPage() {
  const { data, error, loading, reload } = useLoad(() => api.get<Dashboard>('/dashboard'), [])
  const navigate = useNavigate()
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox error={error} retry={reload} />

  const max = Math.max(1, ...data.sales.map((s) => s.revenue))
  const salesTotal = data.sales.reduce((n, s) => n + s.revenue, 0)
  const ordersTotal = Object.values(data.orders).reduce((n, v) => n + (v ?? 0), 0)

  return <>
    <PageHeader title="Dashboard" sub="Live numbers from the database. Everything updates as customers buy." actions={<>
      <button className="cx-btn" onClick={reload}>Refresh</button>
      <Link className="cx-btn is-primary" to="/admin/events/new">+ New event</Link>
    </>} />

    <div className="cx-stats">
      <Stat tone="purple" label="Revenue" value={egp(data.revenue)} hint={`${egp(data.serviceFees)} in service fees`} />
      <Stat tone="green" label="Tickets sold" value={num(data.ticketsSold)} hint={`${num(data.orders.PAID ?? 0)} paid orders`} />
      <Stat tone="blue" label="Customers" value={num(data.customers)} hint="registered accounts" />
      <Stat tone="amber" label="Upcoming events" value={num(data.upcomingEvents)} hint={`${num(data.events.DRAFT ?? 0)} drafts waiting`} />
      <Link to="/admin/refunds" style={{ textDecoration: 'none' }}><Stat tone="red" label="Refunds to review" value={num(data.pendingRefunds)} hint={`${egp(data.refunded)} refunded so far`} /></Link>
    </div>

    <div className="cx-grid cx-grid-main">
      <Card title="Sales, last 14 days" actions={<span className="cx-muted cx-small">{egp(salesTotal)} total</span>}>
        <div className="cx-chart">
          {data.sales.map((s) => <div key={s.day} className="cx-bar">
            <div className="cx-bar-fill" style={{ height: `${Math.max(2, (s.revenue / max) * 100)}%` }}>
              <span className="cx-bar-tip">{egp(s.revenue)} · {s.tickets} tickets</span>
            </div>
            <small>{new Date(s.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small>
          </div>)}
        </div>
      </Card>

      <Card title="Orders by status">
        <div className="cx-split">{(Object.keys(ORDER_COLORS) as OrderStatus[]).map((s) =>
          <div key={s} style={{ width: `${((data.orders[s] ?? 0) / Math.max(1, ordersTotal)) * 100}%`, background: ORDER_COLORS[s] }} />)}</div>
        <div className="cx-legend">{(Object.keys(ORDER_COLORS) as OrderStatus[]).map((s) =>
          <span key={s}><i style={{ background: ORDER_COLORS[s] }} />{s.charAt(0) + s.slice(1).toLowerCase()} · {num(data.orders[s] ?? 0)}</span>)}</div>
        <div className="cx-divider" style={{ margin: '18px 0' }} />
        <div className="cx-legend" style={{ flexDirection: 'column', gap: 10, fontSize: 13 }}>
          <span>Published events: <b>{num(data.events.PUBLISHED ?? 0)}</b></span>
          <span>Drafts: <b>{num(data.events.DRAFT ?? 0)}</b></span>
          <span>Cancelled: <b>{num(data.events.CANCELLED ?? 0)}</b></span>
        </div>
      </Card>
    </div>

    <div className="cx-grid cx-grid-2" style={{ marginTop: 16 }}>
      <Card title="Best-selling events" actions={<Link className="cx-btn is-small is-ghost" to="/admin/events">All events</Link>}>
        {data.topEvents.length ? <div className="cx-list">{data.topEvents.map((e, i) =>
          <Link key={e.id} to={`/admin/events/${e.id}`} className="cx-list-row">
            <span className="cx-rank">{i + 1}</span>
            <span className="cx-two" style={{ minWidth: 0, flex: 1 }}><span className="cx-strong">{e.name}</span><Progress value={e.sold} max={e.capacity} /></span>
            <span className="cx-strong">{egp(e.revenue)}</span>
          </Link>)}</div> : <Empty>No sales yet.</Empty>}
      </Card>

      <Card title="Latest orders" actions={<Link className="cx-btn is-small is-ghost" to="/admin/orders">All orders</Link>}>
        {data.recentOrders.length ? <div className="cx-table-wrap"><table className="cx-table"><tbody>{data.recentOrders.map((o) =>
          <tr key={o.id} className="is-link" onClick={() => navigate(`/admin/orders/${o.id}`)}>
            <td><span className="cx-two"><span className="cx-strong cx-mono">{o.reference}</span><span className="cx-muted cx-small">{ago(o.createdAt)}</span></span></td>
            <td><span className="cx-two"><span>{o.user.fullName}</span><span className="cx-muted cx-small">{o.event.name}</span></span></td>
            <td><Badge value={o.status} /></td>
            <td className="num cx-strong">{egp(o.total)}</td>
          </tr>)}</tbody></table></div> : <Empty>No orders yet.</Empty>}
      </Card>
    </div>
  </>
}
