import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EVENTS, ordersApi, ticketsApi, type Ticket, type TicketStatus } from '../../lib/ordersApi'
import { AdminHero, AdminLayout, ForwardArrowIcon, Icon, LoadingPanel, MessagePanel, RetryButton } from './AdminLayout'
import { EventChips, OrdersTabs, SearchBox, StatusBadge, StatusPills } from './OrdersParts'
import { useOrdersFormat, useOrdersStrings } from './ordersStrings'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; tickets: Ticket[]; orderCount: number }
type StatusFilter = 'all' | TicketStatus

export default function TicketListPage() {
  const t = useOrdersStrings()
  const f = useOrdersFormat()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [event, setEvent] = useState('all')

  useEffect(() => {
    let cancelled = false
    Promise.all([ticketsApi.list(), ordersApi.list()])
      .then(([tickets, orders]) => !cancelled && setState({ status: 'ready', tickets, orderCount: orders.length }))
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  const tickets = state.status === 'ready' ? state.tickets : []
  const q = query.trim().toLowerCase()
  const matchesText = (k: Ticket) => !q || `${k.code} ${k.holder}`.toLowerCase().includes(q)
  const matchesEvent = (k: Ticket) => event === 'all' || k.eventKey === event
  const matchesStatus = (k: Ticket) => status === 'all' || k.status === status
  const rows = tickets.filter((k) => matchesText(k) && matchesEvent(k) && matchesStatus(k))
  const hasFilters = q !== '' || status !== 'all' || event !== 'all'
  const eventKeys = Object.keys(EVENTS).filter((key) => tickets.some((k) => k.eventKey === key))

  const statusChoices = (['all', 'valid', 'checked', 'cancelled'] as StatusFilter[]).map((v) => ({
    value: v,
    label: v === 'all' ? t.all : t[v],
    count: tickets.filter((k) => matchesText(k) && matchesEvent(k) && (v === 'all' || k.status === v)).length,
  }))
  const eventChoices = ['all', ...eventKeys].map((key) => ({
    value: key,
    label: key === 'all' ? t.allEvents : EVENTS[key].name,
    count: tickets.filter((k) => matchesText(k) && matchesStatus(k) && (key === 'all' || k.eventKey === key)).length,
  }))

  function clearFilters() {
    setQuery('')
    setStatus('all')
    setEvent('all')
  }

  return (
    <AdminLayout
      title={t.tabTickets}
      crumbs={[{ label: t.ordersTitle, to: '/admin/orders' }, { label: t.tabTickets }]}
      revealCount={state.status === 'ready' ? tickets.length : 0}
    >
      <AdminHero eyebrow={t.ordersEyebrow} title={t.ordersTitle}>
        <p className="ad-hero-lead">{t.ordersLead}</p>
      </AdminHero>

      {state.status === 'loading' && <LoadingPanel label={t.loadingTickets} />}
      {state.status === 'error' && (
        <MessagePanel tone="error" title={t.errorTickets} text={t.errorText} action={<RetryButton label={t.tryAgain} onClick={retry} />} />
      )}
      {state.status === 'ready' && (
        <>
          <OrdersTabs active="tickets" orders={state.orderCount} tickets={tickets.length} t={t} fmt={f.num} />
          {tickets.length === 0 ? (
            <MessagePanel tone="empty" title={t.emptyTickets} text={t.emptyTicketsText} />
          ) : (
            <section className="ad-card" aria-labelledby="tickets-title" data-scroll-reveal="">
              <div className="ad-card-head">
                <div className="ad-card-title">
                  <span className="ad-bars" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <h2 id="tickets-title">{t.allTickets}</h2>
                  <span className="ad-count">{f.num(rows.length)}</span>
                </div>
                <SearchBox id="ticket-search" label={t.searchTicketsLabel} placeholder={t.searchTickets} value={query} onChange={setQuery} />
              </div>

              <div className="ad-filters" role="group" aria-label={t.filterTickets}>
                <StatusPills id="ticket-status" label={t.status} value={status} choices={statusChoices} onChange={setStatus} fmt={f.num} />
                <EventChips id="ticket-event" label={t.event} value={event} choices={eventChoices} onChange={setEvent} fmt={f.num} />
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
                      <th scope="col">{t.cCode}</th>
                      <th scope="col">{t.cHolder}</th>
                      <th scope="col">{t.cEvent}</th>
                      <th scope="col">{t.cCategory}</th>
                      <th scope="col">{t.cSeat}</th>
                      <th scope="col">{t.cStatus}</th>
                      <th scope="col">{t.cOrder}</th>
                      <th scope="col" className="ad-end">
                        {t.cActions}
                      </th>
                    </tr>
                  </thead>
                  <tbody key={`${status}|${event}`} className="ad-rows-enter">
                    {rows.map((k) => (
                      <tr key={k.code}>
                        <td>
                          <Link className="ad-mono od-nowrap" to={`/admin/tickets/${k.code}`}>
                            {k.code}
                          </Link>
                        </td>
                        <td>
                          <strong>{k.holder}</strong>
                        </td>
                        <td>{EVENTS[k.eventKey].name}</td>
                        <td>
                          <span className="ad-kind ad-kind--seated">{k.category}</span>
                        </td>
                        <td className="ad-muted od-nowrap">{k.seat}</td>
                        <td>
                          <StatusBadge status={k.status} t={t} />
                        </td>
                        <td>
                          <Link className="ad-mono od-nowrap" to={`/admin/orders/${k.orderId}`}>
                            {k.orderId}
                          </Link>
                        </td>
                        <td className="ad-end">
                          <Link className="ad-tint-btn ad-tint-btn--small" to={`/admin/tickets/${k.code}`} aria-label={`${t.viewTicket} ${k.code}`}>
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
                  <p>{t.noTicketsMatch}</p>
                  <button type="button" className="ad-tint-btn" onClick={clearFilters}>
                    {t.clear}
                  </button>
                </div>
              )}

              <div className="ad-card-foot">
                {t.showing} {f.num(rows.length)} {t.of} {f.num(tickets.length)} {t.ticketsWord}
              </div>
            </section>
          )}
        </>
      )}
    </AdminLayout>
  )
}
