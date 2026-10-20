import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EVENTS, ordersApi, ticketsApi, type Order, type OrderStatus } from '../../lib/ordersApi'
import { AdminHero, AdminLayout, ForwardArrowIcon, Icon, LoadingPanel, MessagePanel, RetryButton } from './AdminLayout'
import { EventChips, Metric, OrdersTabs, SearchBox, StatusBadge, StatusPills } from './OrdersParts'
import { useOrdersFormat, useOrdersStrings } from './ordersStrings'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; orders: Order[]; ticketCount: number }
type StatusFilter = 'all' | OrderStatus

export default function OrderListPage() {
  const t = useOrdersStrings()
  const f = useOrdersFormat()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [event, setEvent] = useState('all')

  useEffect(() => {
    let cancelled = false
    Promise.all([ordersApi.list(), ticketsApi.list()])
      .then(([orders, tickets]) => !cancelled && setState({ status: 'ready', orders, ticketCount: tickets.length }))
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  const orders = state.status === 'ready' ? state.orders : []
  const q = query.trim().toLowerCase()
  const matchesText = (o: Order) => !q || `${o.id} ${o.customer.name} ${o.customer.email}`.toLowerCase().includes(q)
  const matchesEvent = (o: Order) => event === 'all' || o.eventKey === event
  const matchesStatus = (o: Order) => status === 'all' || o.status === status
  const rows = orders.filter((o) => matchesText(o) && matchesEvent(o) && matchesStatus(o))
  const paid = orders.filter((o) => o.status === 'paid')
  const hasFilters = q !== '' || status !== 'all' || event !== 'all'
  const eventKeys = Object.keys(EVENTS).filter((k) => orders.some((o) => o.eventKey === k))

  const statusChoices = (['all', 'paid', 'pending', 'refunded', 'cancelled'] as StatusFilter[]).map((v) => ({
    value: v,
    label: v === 'all' ? t.all : t[v],
    count: orders.filter((o) => matchesText(o) && matchesEvent(o) && (v === 'all' || o.status === v)).length,
  }))
  const eventChoices = ['all', ...eventKeys].map((k) => ({
    value: k,
    label: k === 'all' ? t.allEvents : EVENTS[k].name,
    count: orders.filter((o) => matchesText(o) && matchesStatus(o) && (k === 'all' || o.eventKey === k)).length,
  }))

  function clearFilters() {
    setQuery('')
    setStatus('all')
    setEvent('all')
  }

  return (
    <AdminLayout title={t.ordersTitle} crumbs={[{ label: t.ordersTitle }]} revealCount={state.status === 'ready' ? orders.length : 0}>
      <AdminHero eyebrow={t.ordersEyebrow} title={t.ordersTitle}>
        <p className="ad-hero-lead">{t.ordersLead}</p>
      </AdminHero>

      {state.status === 'loading' && <LoadingPanel label={t.loadingOrders} />}
      {state.status === 'error' && (
        <MessagePanel tone="error" title={t.errorOrders} text={t.errorText} action={<RetryButton label={t.tryAgain} onClick={retry} />} />
      )}
      {state.status === 'ready' && (
        <>
          <OrdersTabs active="orders" orders={orders.length} tickets={state.ticketCount} t={t} fmt={f.num} />
          {orders.length === 0 ? (
            <MessagePanel tone="empty" title={t.emptyOrders} text={t.emptyOrdersText} />
          ) : (
            <>
              <div className="ad-metrics">
                <Metric label={t.mOrders} value={f.num(orders.length)} sub={t.mOrdersSub} dot="#7200f5" />
                <Metric label={t.mTickets} value={f.num(paid.reduce((n, o) => n + o.qty, 0))} sub={t.mTicketsSub} dot="#a78bfa" />
                <Metric label={t.mRevenue} value={f.num(paid.reduce((n, o) => n + o.total, 0))} sub={t.mRevenueSub} dot="#c4b5fd" />
                <Metric label={t.mPending} value={f.num(orders.filter((o) => o.status === 'pending').length)} sub={t.mPendingSub} dot="#5c00c9" />
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
                  <SearchBox id="order-search" label={t.searchOrdersLabel} placeholder={t.searchOrders} value={query} onChange={setQuery} />
                </div>

                <div className="ad-filters" role="group" aria-label={t.filterOrders}>
                  <StatusPills id="order-status" label={t.status} value={status} choices={statusChoices} onChange={setStatus} fmt={f.num} />
                  <EventChips id="order-event" label={t.event} value={event} choices={eventChoices} onChange={setEvent} fmt={f.num} />
                  {hasFilters && (
                    <button type="button" className="ad-textbtn ad-clear" onClick={clearFilters}>
                      <Icon size={16}>
                        <path d="M6 6l12 12M18 6 6 18" />
                      </Icon>
                      {t.clear}
                    </button>
                  )}
                </div>

                <div className="ad-table-wrap">
                  <table className="ad-table od-table">
                    <thead>
                      <tr>
                        <th scope="col">{t.cOrder}</th>
                        <th scope="col">{t.cCustomer}</th>
                        <th scope="col">{t.cEvent}</th>
                        <th scope="col" className="ad-num">
                          {t.cTickets}
                        </th>
                        <th scope="col" className="ad-num">
                          {t.cTotal}
                        </th>
                        <th scope="col">{t.cPayment}</th>
                        <th scope="col">{t.cPlaced}</th>
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
                            <strong className="ad-block">{o.customer.name}</strong>
                            <span className="ad-block ad-muted" dir="ltr">
                              {o.customer.email}
                            </span>
                          </td>
                          <td>{EVENTS[o.eventKey].name}</td>
                          <td className="ad-num ad-strong">{f.num(o.qty)}</td>
                          <td className="ad-num ad-strong od-nowrap">{f.money(o.total)}</td>
                          <td>
                            <StatusBadge status={o.status} t={t} />
                          </td>
                          <td className="ad-muted od-nowrap">{f.date(o.placedAt)}</td>
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
                    <button type="button" className="ad-tint-btn" onClick={clearFilters}>
                      {t.clear}
                    </button>
                  </div>
                )}

                <div className="ad-card-foot">
                  {t.showing} {f.num(rows.length)} {t.of} {f.num(orders.length)} {t.ordersWord}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </AdminLayout>
  )
}
