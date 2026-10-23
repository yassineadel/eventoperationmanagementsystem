import { Link } from 'react-router-dom'
import { adminEventsApi, waveStates, type AdminEvent, type EventCategory } from '../../lib/adminEventsApi'
import { minutesAfter, now } from '../../lib/adminTime'
import { loadOrdersBook } from '../../lib/ordersApi'
import { AdminHero, AdminLayout, ForwardArrowIcon, ResourceStatus } from './AdminLayout'
import { useAdminStrings } from './adminStrings'
import { CheckIcon, ProgressBar } from './EventsParts'
import { AlertIcon, Metric } from './OrdersParts'
import { fillIn, useOrdersFormat } from './ordersStrings'
import { useAdminResource } from './useAdminResource'

const DAY = 24 * 60

async function load() {
  const at = now()
  const [events, book] = await Promise.all([adminEventsApi.list(), loadOrdersBook()])
  const upcoming = events
    .filter((e) => e.status === 'published' && e.startAt > at && e.startAt <= minutesAfter(at, 14 * DAY))
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
  const live = events.filter((e) => e.status === 'published' && e.startAt > at)
  const details = await Promise.all(live.map((e) => adminEventsApi.get(e.id)))
  const categories = Object.fromEntries(details.map((d) => [d.event.id, d.categories])) as Record<string, EventCategory[]>
  return { at, events, upcoming, live, categories, ...book }
}

type SellingOut = { event: AdminEvent; category: string; wave: string; left: number; capacity: number }

export default function AdminHomePage() {
  const t = useAdminStrings()
  const f = useOrdersFormat()
  const { state, retry } = useAdminResource('overview', load)

  if (state.status !== 'ready') {
    return (
      <AdminLayout title={t.overviewTitle} crumbs={[{ label: t.overviewTitle }]}>
        <AdminHero eyebrow={t.overviewEyebrow} title={t.overviewTitle}>
          <p className="ad-hero-lead">{t.overviewLead}</p>
        </AdminHero>
        <ResourceStatus state={state} loading={t.loadingOverview} errorTitle={t.overviewError} errorText={t.errorText} retryLabel={t.tryAgain} onRetry={retry} />
      </AdminLayout>
    )
  }

  const { at, events, upcoming, live, categories, orders, requests } = state.data
  const waiting = requests.filter((r) => r.status === 'submitted')
  const overdue = orders.filter((o) => o.status === 'pending' && o.payment.dueBy && o.payment.dueBy < at)
  const draftsSoon = events.filter((e) => e.status === 'draft' && e.startAt > at && e.startAt <= minutesAfter(at, 30 * DAY))
  const cancelled = events.filter((e) => e.status === 'cancelled')
  const sellingOut: SellingOut[] = live.flatMap((event) =>
    (categories[event.id] ?? []).flatMap((c) => {
      const i = waveStates(c.waves).indexOf('on-sale')
      const wave = c.waves[i]
      if (!wave) return []
      const left = wave.capacity - wave.sold
      return left <= Math.max(1, Math.round(wave.capacity * 0.1)) ? [{ event, category: c.name, wave: wave.name, left, capacity: wave.capacity }] : []
    }),
  )
  const revenue = orders.filter((o) => o.status === 'paid').reduce((n, o) => n + o.total, 0)
  const sold = events.filter((e) => e.status !== 'cancelled').reduce((n, e) => n + e.sold, 0)
  const nothingToDo = !waiting.length && !overdue.length && !sellingOut.length && !draftsSoon.length

  const cheapestOnSale = (eventId: string) => {
    const prices = (categories[eventId] ?? []).flatMap((c) => {
      const i = waveStates(c.waves).indexOf('on-sale')
      return i < 0 ? [] : [c.waves[i].price]
    })
    return prices.length ? Math.min(...prices) : null
  }

  return (
    <AdminLayout title={t.overviewTitle} crumbs={[{ label: t.overviewTitle }]} revealCount={6}>
      <AdminHero eyebrow={t.overviewEyebrow} title={t.overviewTitle}>
        <p className="ad-hero-lead">
          {t.overviewLead} · {f.date(at)}
        </p>
      </AdminHero>

      <div className="ad-metrics">
        <Metric label={t.mRevenue} value={f.money(revenue)} sub={t.mRevenueSub} dot="var(--ad-dot-1)" />
        <Metric label={t.mTickets} value={f.num(sold)} sub={t.mTicketsSub} dot="var(--ad-dot-2)" />
        <Metric label={t.mUpcoming} value={f.num(upcoming.length)} sub={t.mUpcomingSub} dot="var(--ad-dot-3)" />
        <Metric label={t.mRequests} value={f.num(waiting.length)} sub={t.mRequestsSub} dot="var(--ad-dot-4)" />
      </div>

      <section className="ad-card" aria-labelledby="attention-title" data-scroll-reveal="">
        <h2 id="attention-title" className="ad-card-h ad-card-h--bar">
          {t.attention}
        </h2>
        {nothingToDo ? (
          <p className="od-empty-note">
            <span aria-hidden="true">
              <CheckIcon size={20} />
            </span>
            {t.allClear}
          </p>
        ) : (
          <ul className="ov-list">
            {waiting.length > 0 && (
              <li>
                <AttentionRow label={t.aRefunds} count={f.num(waiting.length)} to="/admin/refunds" action={t.review} />
              </li>
            )}
            {overdue.length > 0 && (
              <li>
                <AttentionRow label={t.aOverdue} count={f.num(overdue.length)} to="/admin/orders?status=pending" action={t.review} />
              </li>
            )}
            {draftsSoon.map((e) => (
              <li key={`draft:${e.id}`}>
                <AttentionRow label={`${t.aDrafts}: ${e.name} · ${f.date(e.startAt)}`} to={`/admin/events/${e.id}`} action={t.review} />
              </li>
            ))}
            {sellingOut.map((s) => (
              <li key={`wave:${s.event.id}:${s.category}`}>
                <AttentionRow
                  label={`${t.aSellingOut}: ${s.event.name} · ${s.category} · ${s.wave} — ${fillIn(t.leftInWave, { left: f.num(s.left), cap: f.num(s.capacity) })}`}
                  to={`/admin/events/${s.event.id}`}
                  action={t.review}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ad-card" aria-labelledby="upcoming-title" data-scroll-reveal="">
        <div className="ad-card-head ad-card-head--tight">
          <h2 id="upcoming-title" className="ad-card-h">
            {t.upcoming}
          </h2>
          <Link className="od-link" to="/admin/events?status=published">
            {t.allEvents}
            <ForwardArrowIcon />
          </Link>
        </div>
        {upcoming.length ? (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th scope="col">{t.cEvent}</th>
                  <th scope="col">{t.cWhen}</th>
                  <th scope="col">{t.cSold}</th>
                  <th scope="col" className="ad-num ad-hide-sm">
                    {t.cWave}
                  </th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((e) => {
                  const price = cheapestOnSale(e.id)
                  return (
                    <tr key={e.id}>
                      <th scope="row">
                        <Link to={`/admin/events/${e.id}`}>{e.name}</Link>
                        <span className="ad-block ad-muted">{e.venue}</span>
                      </th>
                      <td className="od-nowrap">{f.date(e.startAt)}</td>
                      <td>
                        <span className="ev-sales">
                          <span className="ad-strong">
                            {f.num(e.sold)} / {f.num(e.capacity)}
                          </span>
                          <ProgressBar value={e.sold} max={e.capacity} />
                        </span>
                      </td>
                      <td className="ad-num ad-hide-sm">{price === null ? t.noWave : f.money(price)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="od-empty-note">{t.noUpcoming}</p>
        )}
      </section>

      {cancelled.length > 0 && (
        <section className="ad-card" aria-labelledby="cancelled-title" data-scroll-reveal="">
          <h2 id="cancelled-title" className="ad-card-h ad-card-h--bar">
            {t.recentCancelled}
          </h2>
          <ul className="ov-list">
            {cancelled.map((e) => (
              <li key={e.id}>
                <AttentionRow label={`${e.name} · ${f.date(e.startAt)}`} to={`/admin/events/${e.id}`} action={t.review} quiet />
              </li>
            ))}
          </ul>
        </section>
      )}
    </AdminLayout>
  )
}

function AttentionRow({ label, count, to, action, quiet = false }: { label: string; count?: string; to: string; action: string; quiet?: boolean }) {
  return (
    <div className={`ov-row${quiet ? ' is-quiet' : ''}`}>
      <span className="ov-row-icon" aria-hidden="true">
        <AlertIcon size={18} />
      </span>
      <span className="ov-row-text">
        {count && <strong className="ov-count">{count}</strong>}
        {label}
      </span>
      <Link className="ad-tint-btn ad-tint-btn--small" to={to} aria-label={`${action}: ${label}`}>
        {action}
        <ForwardArrowIcon />
      </Link>
    </div>
  )
}
