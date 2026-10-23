import { Link } from 'react-router-dom'
import { EVENTS, loadOrdersBook, type Ticket, type TicketStatus } from '../../lib/ordersApi'
import { AdminHero, AdminLayout, ForwardArrowIcon, Icon, MessagePanel, ResourceStatus, TicketIcon } from './AdminLayout'
import { EventChips, OrdersTabs, SearchBox, StatusBadge, StatusPills } from './OrdersParts'
import { useOrdersFormat, useOrdersStrings } from './ordersStrings'
import { useAdminResource } from './useAdminResource'
import { oneOf, useListParams } from './useListParams'

type StatusFilter = 'all' | TicketStatus
const STATUSES: StatusFilter[] = ['all', 'valid', 'checked', 'cancelled']
const FILTERS = { q: '', status: 'all', event: 'all' }

export default function TicketListPage() {
  const t = useOrdersStrings()
  const f = useOrdersFormat()
  const { state, retry } = useAdminResource('tickets', loadOrdersBook)
  const { values, set, clear } = useListParams(FILTERS)
  const status = oneOf(values.status, STATUSES, 'all')
  const event = values.event

  const tickets = state.status === 'ready' ? state.data.tickets : []
  const eventIdOf = (k: Ticket) => EVENTS[k.eventKey].eventId
  const q = values.q.trim().toLowerCase()
  const matchesText = (k: Ticket) => !q || `${k.code} ${k.holder}`.toLowerCase().includes(q)
  const matchesEvent = (k: Ticket, e = event) => e === 'all' || eventIdOf(k) === e
  const matchesStatus = (k: Ticket, s = status) => s === 'all' || k.status === s
  const rows = tickets.filter((k) => matchesText(k) && matchesEvent(k) && matchesStatus(k))
  const hasFilters = q !== '' || status !== 'all' || event !== 'all'
  const events = Object.values(EVENTS).filter((e) => tickets.some((k) => k.eventKey === e.key))

  const statusChoices = STATUSES.map((v) => ({
    value: v,
    label: v === 'all' ? t.all : t[v],
    count: tickets.filter((k) => matchesText(k) && matchesEvent(k) && matchesStatus(k, v)).length,
  }))
  const eventChoices = [{ value: 'all', label: t.allEvents }, ...events.map((e) => ({ value: e.eventId, label: e.name }))].map((c) => ({
    ...c,
    count: tickets.filter((k) => matchesText(k) && matchesStatus(k) && matchesEvent(k, c.value)).length,
  }))

  return (
    <AdminLayout title={t.tabTickets} crumbs={[{ label: t.ordersTitle, to: '/admin/orders' }, { label: t.tabTickets }]} revealCount={state.status === 'ready' ? 1 : 0}>
      <AdminHero eyebrow={t.ordersEyebrow} title={t.ordersTitle}>
        <p className="ad-hero-lead">{t.ordersLead}</p>
      </AdminHero>

      <ResourceStatus state={state} loading={t.loadingTickets} errorTitle={t.errorTickets} errorText={t.errorText} retryLabel={t.tryAgain} onRetry={retry} />
      {state.status === 'ready' && (
        <>
          <OrdersTabs
            active="tickets"
            orders={state.data.orders.length}
            tickets={tickets.length}
            refunds={state.data.requests.filter((r) => r.status === 'submitted').length}
            t={t}
            fmt={f.num}
          />
          {tickets.length === 0 ? (
            <MessagePanel tone="empty" title={t.emptyTickets} text={t.emptyTicketsText} icon={<TicketIcon size={34} />} />
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
                <SearchBox id="ticket-search" label={t.searchTicketsLabel} placeholder={t.searchTickets} value={values.q} onChange={(v) => set('q', v)} />
              </div>

              <div className="ad-filters" role="group" aria-label={t.filterTickets}>
                <StatusPills id="ticket-status" label={t.status} value={status} choices={statusChoices} onChange={(v) => set('status', v)} fmt={f.num} />
                <EventChips id="ticket-event" label={t.event} value={event} choices={eventChoices} onChange={(v) => set('event', v)} fmt={f.num} />
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
                <table className="ad-table od-table">
                  <thead>
                    <tr>
                      <th scope="col">{t.cCode}</th>
                      <th scope="col">{t.cHolder}</th>
                      <th scope="col" className="ad-hide-sm">
                        {t.cEvent}
                      </th>
                      <th scope="col" className="ad-hide-sm">
                        {t.cCategory}
                      </th>
                      <th scope="col" className="ad-hide-sm">
                        {t.cSeat}
                      </th>
                      <th scope="col">{t.cStatus}</th>
                      <th scope="col" className="ad-hide-sm">
                        {t.cOrder}
                      </th>
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
                        <td className="ad-hide-sm">
                          <Link to={`/admin/events/${eventIdOf(k)}`}>{EVENTS[k.eventKey].name}</Link>
                        </td>
                        <td className="ad-hide-sm">
                          <span className="ad-kind ad-kind--seated">{k.category}</span>
                        </td>
                        <td className="ad-muted od-nowrap ad-hide-sm">{k.seat}</td>
                        <td>
                          <StatusBadge status={k.status} t={t} />
                        </td>
                        <td className="ad-hide-sm">
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
                  <button type="button" className="ad-tint-btn" onClick={clear}>
                    {t.clear}
                  </button>
                </div>
              )}

              <div className="ad-card-foot" role="status">
                {t.showing} {f.num(rows.length)} {t.of} {f.num(tickets.length)} {t.ticketsWord}
              </div>
            </section>
          )}
        </>
      )}
    </AdminLayout>
  )
}
