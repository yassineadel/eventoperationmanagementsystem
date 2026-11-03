import { Link, useParams } from 'react-router-dom'
import { adminEventsApi, EventNotFoundError } from '../../lib/adminEventsApi'
import { eventKeyFor, ordersApi, ticketsApi, type Order, type Ticket, type TicketStatus } from '../../lib/ordersApi'
import { AdminHero, AdminLayout, BackArrowIcon, CalendarIcon, Icon, MessagePanel, ResourceStatus, TicketIcon } from './AdminLayout'
import { shownOf } from './adminText'
import { downloadCsv, slug } from './csv'
import { Badge } from './EventsParts'
import { useEventsStrings } from './eventsStrings'
import { ListCount, Metric, SearchBox, StatusPills } from './OrdersParts'
import { fillIn, useOrdersFormat } from './ordersStrings'
import { useAdminResource } from './useAdminResource'
import { oneOf, useListParams } from './useListParams'

type StatusFilter = 'all' | TicketStatus
const STATUSES: StatusFilter[] = ['all', 'valid', 'checked', 'cancelled']
const FILTERS = { q: '', status: 'all' }
const TONE = { valid: 'paid', checked: 'checked', cancelled: 'refunded' } as const

async function load(id: string) {
  const [detail, tickets, orders] = await Promise.all([adminEventsApi.get(id), ticketsApi.list(), ordersApi.list()])
  const key = eventKeyFor(id)
  return { event: detail.event, tickets: tickets.filter((k) => k.eventKey === key), orders }
}

/**
 * Guest list (FR-ADM-15): every ticket for one event with the person holding it now. A transferred
 * ticket shows its current holder and who it came from, so the gate and support see the same names.
 */
export default function EventGuestsPage() {
  const { eventId = '' } = useParams()
  const t = useEventsStrings()
  const f = useOrdersFormat()
  const { state, retry } = useAdminResource(`guests:${eventId}`, () => load(eventId), (e) => e instanceof EventNotFoundError)
  const { values, set, clear } = useListParams(FILTERS)
  const status = oneOf(values.status, STATUSES, 'all')

  const backTo = `/admin/events/${eventId}`
  if (state.status !== 'ready') {
    return (
      <AdminLayout title={t.guestList} crumbs={[{ label: t.listTitle, to: '/admin/events' }, { label: t.guestList }]}>
        <Link className="ad-back" to={backTo}>
          <BackArrowIcon />
          {t.backToEvents}
        </Link>
        <ResourceStatus
          state={state}
          loading={t.loadingGuests}
          rows={4}
          errorTitle={t.errorTitle}
          errorText={t.errorText}
          retryLabel={t.tryAgain}
          onRetry={retry}
          notFoundTitle={t.notFoundTitle}
          notFoundIcon={<CalendarIcon size={34} />}
          notFoundText={t.notFoundText}
        />
      </AdminLayout>
    )
  }

  const { event, tickets, orders } = state.data
  const buyerOf = (k: Ticket): Order['customer'] | undefined => orders.find((o) => o.id === k.orderId)?.customer
  const q = values.q.trim().toLowerCase()
  const matchesText = (k: Ticket) => !q || `${k.code} ${k.holder} ${k.holderEmail} ${buyerOf(k)?.name ?? ''}`.toLowerCase().includes(q)
  const matchesStatus = (k: Ticket, s = status) => s === 'all' || k.status === s
  const rows = tickets.filter((k) => matchesText(k) && matchesStatus(k)).sort((a, b) => a.holder.localeCompare(b.holder))
  const live = tickets.filter((k) => k.status !== 'cancelled')
  const guests = new Set(live.map((k) => k.holderEmail)).size
  const label: Record<StatusFilter, string> = { all: t.gAll, valid: t.gValid, checked: t.gChecked, cancelled: t.gRefunded }
  const statusChoices = STATUSES.map((v) => ({ value: v, label: label[v], count: tickets.filter((k) => matchesText(k) && matchesStatus(k, v)).length }))

  function exportCsv() {
    downloadCsv(`${slug(event.name)}-guests.csv`, [
      [t.gHolder, 'Email', t.gBoughtBy, t.gTicket, t.cCategory, t.gSeat, t.stateCol, t.gCheckedAt],
      ...rows.map((k) => [
        k.holder,
        k.holderEmail,
        buyerOf(k)?.name ?? '',
        k.code,
        k.category,
        k.seat,
        label[k.status],
        k.scans[0] ? f.date(k.scans[0]) : '',
      ]),
    ])
  }

  return (
    <AdminLayout title={`${t.guestList} · ${event.name}`} crumbs={[{ label: t.listTitle, to: '/admin/events' }, { label: event.name, to: backTo }, { label: t.guestList }]} revealCount={1}>
      <Link className="ad-back" to={backTo}>
        <BackArrowIcon />
        {fillIn(t.backToEvent, { name: event.name })}
      </Link>
      <AdminHero
        eyebrow={t.guestList}
        title={event.name}
        action={
          tickets.length > 0 ? (
            <button type="button" className="ad-glass-btn" onClick={exportCsv}>
              <Icon size={17}>
                <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
              </Icon>
              {t.downloadCsv}
            </button>
          ) : undefined
        }
      >
        <p className="ad-hero-lead">{t.guestsLead}</p>
        <div className="ad-hero-chips">
          <span className="ad-glass-chip">{f.date(event.startAt)}</span>
          <span className="ad-glass-chip">{event.venue}</span>
        </div>
      </AdminHero>

      <div className="ad-metrics">
        <Metric label={t.mGuests} value={f.num(guests)} sub={t.mGuestsSub} dot="var(--ad-dot-1)" />
        <Metric label={t.mValidTickets} value={f.num(tickets.filter((k) => k.status === 'valid').length)} sub={t.mValidTicketsSub} dot="var(--ad-dot-2)" />
        <Metric label={t.mCheckedIn} value={f.num(tickets.filter((k) => k.status === 'checked').length)} sub={t.mCheckedInSub} dot="var(--ad-dot-3)" />
        <Metric label={t.mTransferred} value={f.num(live.filter((k) => k.transfers.length > 0).length)} sub={t.mTransferredSub} dot="var(--ad-dot-4)" />
      </div>

      {tickets.length === 0 ? (
        <MessagePanel tone="empty" title={t.guestList} text={t.noGuests} icon={<TicketIcon size={34} />} />
      ) : (
        <section className="ad-card" aria-labelledby="guests-title" data-scroll-reveal="">
          <div className="ad-card-head">
            <div className="ad-card-title">
              <span className="ad-bars" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <h2 id="guests-title">{t.guestList}</h2>
              <span className="ad-count">{f.num(rows.length)}</span>
            </div>
            <SearchBox id="guest-search" label={t.gSearchLabel} placeholder={t.gSearch} value={values.q} onChange={(v) => set('q', v)} />
          </div>
          <div className="ad-filters" role="group" aria-label={t.gSearchLabel}>
            <StatusPills id="guest-status" label={t.stateCol} value={status} choices={statusChoices} onChange={(v) => set('status', v)} fmt={f.num} />
          </div>

          <div className="ad-table-wrap">
            <table aria-labelledby="guests-title" className="ad-table">
              <thead>
                <tr>
                  <th scope="col">{t.gHolder}</th>
                  <th scope="col" className="ad-hide-sm">
                    {t.gBoughtBy}
                  </th>
                  <th scope="col">{t.gTicket}</th>
                  <th scope="col" className="ad-hide-sm">
                    {t.gSeat}
                  </th>
                  <th scope="col">{t.stateCol}</th>
                  <th scope="col" className="ad-hide-sm">
                    {t.gCheckedAt}
                  </th>
                </tr>
              </thead>
              <tbody key={status} className="ad-rows-enter">
                {rows.map((k) => {
                  const buyer = buyerOf(k)
                  const last = k.transfers[k.transfers.length - 1]
                  return (
                    <tr key={k.code}>
                      <td>
                        {k.holderUserId ? (
                          <Link className="ad-strong" to={`/admin/users/${k.holderUserId}`}>
                            {k.holder}
                          </Link>
                        ) : (
                          <strong>{k.holder}</strong>
                        )}
                        <span className="ad-block ad-muted" dir="ltr">
                          {k.holderEmail}
                        </span>
                        {last && <span className="ev-received">{fillIn(t.gReceived, { name: last.from.name, date: f.date(last.at) })}</span>}
                      </td>
                      <td className="ad-hide-sm">{buyer && buyer.email !== k.holderEmail ? <Link to={`/admin/users/${buyer.userId}`}>{buyer.name}</Link> : <span className="ad-muted">—</span>}</td>
                      <td>
                        <Link className="ad-mono od-nowrap" to={`/admin/tickets/${k.code}`}>
                          {k.code}
                        </Link>
                        <span className="ad-block ad-muted">{k.category}</span>
                      </td>
                      <td className="ad-muted ad-hide-sm">{k.seat}</td>
                      <td>
                        <Badge tone={TONE[k.status]} label={label[k.status]} />
                      </td>
                      <td className="ad-hide-sm od-nowrap">{k.scans[0] ? f.date(k.scans[0]) : <span className="ad-muted">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <div className="ad-no-matches">
              <p>{t.noGuestMatches}</p>
              <button type="button" className="ad-tint-btn" onClick={clear}>
                {t.clear}
              </button>
            </div>
          )}

          <div className="ad-card-foot">
            <ListCount text={shownOf(f.lang, rows.length, tickets.length, t.guestsShowing, f.num)} />
          </div>
        </section>
      )}
    </AdminLayout>
  )
}
