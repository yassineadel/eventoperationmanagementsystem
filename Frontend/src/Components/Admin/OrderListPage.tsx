import { Link } from 'react-router-dom'
import { EVENTS, isOverdue, loadOrdersBook, type Order, type OrderStatus } from '../../lib/ordersApi'
import { AdminHero, AdminLayout, ForwardArrowIcon, Icon, MessagePanel, ResourceStatus, TicketIcon } from './AdminLayout'
import { EventChips, ListCount, Metric, OrdersTabs, SearchBox, StatusBadge, StatusPills } from './OrdersParts'
import { useOrdersFormat, useOrdersStrings } from './ordersStrings'
import { plural, shownOf } from './adminText'
import { useAdminResource } from './useAdminResource'
import { oneOf, useListParams } from './useListParams'

type StatusFilter = 'all' | OrderStatus | 'overdue'
const STATUSES: StatusFilter[] = ['all', 'paid', 'pending', 'overdue', 'refunded', 'cancelled']
const FILTERS = { q: '', status: 'all', event: 'all' }

export default function OrderListPage() {
  const t = useOrdersStrings()
  const f = useOrdersFormat()
  const { state, retry } = useAdminResource('orders', loadOrdersBook)
  const { values, set, clear } = useListParams(FILTERS)
  const status = oneOf(values.status, STATUSES, 'all')
  const event = values.event

  const orders = state.status === 'ready' ? state.data.orders : []
  const eventIdOf = (o: Order) => EVENTS[o.eventKey].eventId
  const q = values.q.trim().toLowerCase()
  const matchesText = (o: Order) => !q || `${o.id} ${o.customer.name} ${o.customer.email}`.toLowerCase().includes(q)
  const matchesEvent = (o: Order, e = event) => e === 'all' || eventIdOf(o) === e
  const matchesStatus = (o: Order, s = status) => s === 'all' || (s === 'overdue' ? isOverdue(o) : o.status === s)
  const rows = orders.filter((o) => matchesText(o) && matchesEvent(o) && matchesStatus(o))
  // Money kept: what was paid less what was refunded. Tickets: the ones still valid or used.
  const revenue = orders.reduce((n, o) => n + (o.payment.paidAt ? o.total - (o.payment.refundAmount ?? 0) : 0), 0)
  const issued = state.status === 'ready' ? state.data.tickets.filter((k) => k.status !== 'cancelled').length : 0
  const hasFilters = q !== '' || status !== 'all' || event !== 'all'
  const events = Object.values(EVENTS).filter((e) => orders.some((o) => o.eventKey === e.key))

  const statusChoices = STATUSES.map((v) => ({
    value: v,
    label: v === 'all' ? t.all : t[v],
    count: orders.filter((o) => matchesText(o) && matchesEvent(o) && matchesStatus(o, v)).length,
  }))
  const eventChoices = [{ value: 'all', label: t.allEvents }, ...events.map((e) => ({ value: e.eventId, label: e.name }))].map((c) => ({
    ...c,
    count: orders.filter((o) => matchesText(o) && matchesStatus(o) && matchesEvent(o, c.value)).length,
  }))

  return (
    <AdminLayout title={t.ordersTitle} crumbs={[{ label: t.ordersTitle }]} revealCount={state.status === 'ready' ? 5 : 0}>
      <AdminHero eyebrow={t.ordersEyebrow} title={t.ordersTitle}>
        <p className="ad-hero-lead">{t.ordersLead}</p>
      </AdminHero>

      <ResourceStatus state={state} loading={t.loadingOrders} errorTitle={t.errorOrders} errorText={t.errorText} retryLabel={t.tryAgain} onRetry={retry} />
      {state.status === 'ready' && (
        <>
          <OrdersTabs
            active="orders"
            orders={orders.length}
            tickets={state.data.tickets.length}
            refunds={state.data.requests.filter((r) => r.status === 'submitted').length}
            t={t}
            fmt={f.num}
          />
          {orders.length === 0 ? (
            <MessagePanel tone="empty" title={t.emptyOrders} text={t.emptyOrdersText} icon={<TicketIcon size={34} />} />
          ) : (
            <>
              <div className="ad-metrics">
                <Metric label={t.mOrders} value={f.num(orders.length)} sub={t.mOrdersSub} dot="var(--ad-dot-1)" />
                <Metric label={t.mTickets} value={f.num(issued)} sub={t.mTicketsSub} dot="var(--ad-dot-2)" />
                <Metric label={t.mRevenue} value={f.money(revenue)} sub={t.mRevenueSub} dot="var(--ad-dot-3)" />
                <Metric label={t.mPending} value={f.num(orders.filter((o) => o.status === 'pending').length)} sub={t.mPendingSub} dot="var(--ad-dot-4)" />
              </div>

              <section className="ad-card" aria-labelledby="orders-title" data-scroll-reveal="">
                <div className="ad-card-head">
                  <div className="ad-card-title">
                    <span className="ad-bars" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    <h2 id="orders-title">{t.allOrders}</h2>
                    <span className="ad-count">{f.num(rows.length)}</span>
                  </div>
                  <SearchBox id="order-search" label={t.searchOrdersLabel} placeholder={t.searchOrders} value={values.q} onChange={(v) => set('q', v)} />
                </div>

                <div className="ad-filters" role="group" aria-label={t.filterOrders}>
                  <StatusPills id="order-status" label={t.status} value={status} choices={statusChoices} onChange={(v) => set('status', v)} fmt={f.num} />
                  <EventChips id="order-event" label={t.event} value={event} choices={eventChoices} onChange={(v) => set('event', v)} fmt={f.num} />
                  {hasFilters && (
                    <button type="button" className="ad-textbtn ad-clear" onClick={clear}>
                      <Icon size={16}>
                        <path d="M6 6l12 12M18 6 6 18" />
                      </Icon>
                      {t.clear}
                    </button>
                  )}
                </div>

                <div className="ad-table-wrap">
                  <table aria-labelledby="orders-title" className="ad-table od-table">
                    <thead>
                      <tr>
                        <th scope="col">{t.cOrder}</th>
                        <th scope="col">{t.cCustomer}</th>
                        <th scope="col" className="ad-hide-sm">
                          {t.cEvent}
                        </th>
                        <th scope="col" className="ad-num ad-hide-sm">
                          {t.cTickets}
                        </th>
                        <th scope="col" className="ad-num">
                          {t.cTotal}
                        </th>
                        <th scope="col">{t.cPayment}</th>
                        <th scope="col" className="ad-hide-sm">
                          {t.cPlaced}
                        </th>
                        <th scope="col" className="ad-end">
                          {t.cActions}
                        </th>
                      </tr>
                    </thead>
                    <tbody key={`${status}|${event}`} className="ad-rows-enter">
                      {rows.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <Link className="ad-mono od-nowrap" to={`/admin/orders/${o.id}`}>
                              {o.id}
                            </Link>
                          </td>
                          <td>
                            <Link className="ad-block" to={`/admin/users/${o.customer.userId}`}>
                              {o.customer.name}
                            </Link>
                            <span className="ad-block ad-muted" dir="ltr">
                              {o.customer.email}
                            </span>
                            {/* The event and tickets columns are hidden on phones; their gist moves here. */}
                            <span className="ad-block ad-muted ad-show-sm">
                              {EVENTS[o.eventKey].name} · {plural(f.lang, o.qty, t.ticketsCount, f.num(o.qty))}
                            </span>
                          </td>
                          <td className="ad-hide-sm">
                            <Link to={`/admin/events/${eventIdOf(o)}`}>{EVENTS[o.eventKey].name}</Link>
                          </td>
                          <td className="ad-num ad-strong ad-hide-sm">{f.num(o.qty)}</td>
                          <td className="ad-num ad-strong od-nowrap">{f.money(o.total)}</td>
                          <td>
                            <StatusBadge status={o.status} t={t} />
                          </td>
                          <td className="ad-muted od-nowrap ad-hide-sm">{f.date(o.placedAt)}</td>
                          <td className="ad-end">
                            <Link className="ad-tint-btn ad-tint-btn--small" to={`/admin/orders/${o.id}`} aria-label={`${t.viewOrder} ${o.id}`}>
                              {t.view}
                              <ForwardArrowIcon />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {rows.length === 0 && (
                  <div className="ad-no-matches">
                    <p>{t.noOrders}</p>
                    <button type="button" className="ad-tint-btn" onClick={clear}>
                      {t.clear}
                    </button>
                  </div>
                )}

                <div className="ad-card-foot">
                  <ListCount text={shownOf(f.lang, rows.length, orders.length, t.ordersShowing, f.num)} />
                </div>
              </section>
            </>
          )}
        </>
      )}
    </AdminLayout>
  )
}
