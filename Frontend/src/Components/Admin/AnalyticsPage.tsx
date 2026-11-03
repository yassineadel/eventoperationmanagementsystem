import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { analyticsApi, type AnalyticsData } from '../../lib/analyticsApi'
import { categoryNames } from '../Homepage/strings'
import { AdminHero, AdminLayout, Icon, ResourceStatus } from './AdminLayout'
import { plural } from './adminText'
import { attendance, byCategory, daily, firstDay, perEvent, presetRange, refundsByReason, summary, type DateRange, type EventRow, type RangePreset } from './analytics'
import { useAnalyticsStrings, type AnalyticsStrings } from './analyticsStrings'
import { downloadCsv } from './csv'
import { ProgressBar } from './EventsParts'
import { Metric } from './OrdersParts'
import { fillIn, useOrdersFormat } from './ordersStrings'
import { useAdminResource } from './useAdminResource'
import './Analytics.css'

type Format = ReturnType<typeof useOrdersFormat>
const PRESETS: RangePreset[] = ['7', '30', '90', 'all']
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Short day labels and compact axis numbers, in the admin's language. */
function useChartFormat(lang: 'en' | 'ar') {
  return useMemo(() => {
    const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
    const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    const longDay = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    const compact = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 })
    const percent = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { style: 'percent', maximumFractionDigits: 1 })
    const decimal = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 1 })
    const at = (d: string) => new Date(`${d}T00:00:00Z`)
    return {
      day: (d: string) => day.format(at(d)),
      longDay: (d: string) => longDay.format(at(d)),
      compact: (n: number) => compact.format(n),
      percent: (n: number) => percent.format(n),
      decimal: (n: number) => decimal.format(n),
    }
  }, [lang])
}

type ChartFormat = ReturnType<typeof useChartFormat>

/** Analytics dashboard (FR-ADM-24 to 28, 31 to 33): sales, revenue split, events, categories, attendance. */
export default function AnalyticsPage() {
  const t = useAnalyticsStrings()
  const f = useOrdersFormat()
  const c = useChartFormat(f.lang)
  const { state, retry } = useAdminResource('analytics', analyticsApi.load)

  return (
    <AdminLayout title={t.title} crumbs={[{ label: t.navAnalytics }]} revealCount={state.status === 'ready' ? 6 : 0}>
      {state.status === 'ready' ? (
        <Dashboard data={state.data} t={t} f={f} c={c} />
      ) : (
        <>
          <AdminHero eyebrow={t.eyebrow} title={t.title}>
            <p className="ad-hero-lead">{t.lead}</p>
          </AdminHero>
          <ResourceStatus state={state} loading={t.loading} rows={4} errorTitle={t.errorTitle} errorText={t.errorText} retryLabel={t.tryAgain} onRetry={retry} />
        </>
      )}
    </AdminLayout>
  )
}

function Dashboard({ data, t, f, c }: { data: AnalyticsData; t: AnalyticsStrings; f: Format; c: ChartFormat }) {
  const [params, setParams] = useSearchParams()
  const earliest = firstDay(data)
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const custom = DAY_RE.test(from) && DAY_RE.test(to)
  const preset = PRESETS.find((p) => p === params.get('range')) ?? '30'
  const badRange = custom && from > to
  const range: DateRange = custom && !badRange ? { from, to } : presetRange(preset, data)
  const eventId = params.get('event') ?? 'all'

  const update = (changes: Record<string, string | null>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === '') next.delete(k)
        else next.set(k, v)
      }
      return next
    })

  const s = summary(data, range)
  const events = perEvent(data, range)
  const days = daily(data, range, eventId === 'all' ? undefined : eventId)
  const categories = byCategory(data, range)
  const reasons = refundsByReason(data, range)
  const gate = attendance(data)
  const presetLabel: Record<RangePreset, string> = { '7': t.p7, '30': t.p30, '90': t.p90, all: t.pAll }
  const rangeText = `${c.day(range.from)} – ${c.day(range.to)}`
  const chartEvents = data.events.filter((e) => data.sales.some((x) => x.eventId === e.id))

  function exportEvents() {
    downloadCsv(`hafletna-events-${range.from}-${range.to}.csv`, [
      [t.cEvent, t.cTickets, 'Sold', 'Capacity', t.cPerDay, t.ticketValue, t.cFees, t.cRefunds, t.cOwners, t.platformShare, t.cTransfers],
      ...events.map((r) => [
        r.event.name,
        r.tickets,
        r.event.sold,
        r.event.capacity,
        r.perDay.toFixed(1),
        r.ticketValue.toFixed(2),
        r.fees.toFixed(2),
        r.refundTotal.toFixed(2),
        r.ownersDue.toFixed(2),
        r.platformNet.toFixed(2),
        r.transfers,
      ]),
      [t.total, s.tickets, '', '', '', s.ticketValue.toFixed(2), s.fees.toFixed(2), s.refundTotal.toFixed(2), s.ownersDue.toFixed(2), s.platformNet.toFixed(2), s.transfers],
    ])
  }

  return (
    <>
      <AdminHero
        eyebrow={t.eyebrow}
        title={t.title}
        action={
          <button type="button" className="ad-glass-btn" onClick={exportEvents}>
            <Icon size={17}>
              <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
            </Icon>
            {t.exportCsv}
          </button>
        }
      >
        <p className="ad-hero-lead">{t.lead}</p>
        <div className="ad-hero-chips">
          <span className="ad-glass-chip">{fillIn(t.asOf, { date: c.day(data.asOf) })}</span>
        </div>
      </AdminHero>

      <section className="ad-card an-period" aria-label={t.period}>
        <div className="ad-filter">
          <span id="an-period-label" className="ad-filter-label">
            {t.period}
          </span>
          <div className="ad-pills" role="group" aria-labelledby="an-period-label">
            {PRESETS.map((p) => (
              <button key={p} type="button" aria-pressed={!custom && preset === p} onClick={() => update({ range: p === '30' ? null : p, from: null, to: null })}>
                {presetLabel[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="an-dates">
          <label>
            <span>{t.from}</span>
            <input
              type="date"
              dir="ltr"
              min={earliest}
              max={data.asOf}
              value={range.from}
              aria-invalid={badRange || undefined}
              aria-describedby={badRange ? 'an-range-error' : undefined}
              onChange={(e) => e.target.value && update({ from: e.target.value, to: custom ? to : range.to, range: null })}
            />
          </label>
          <label>
            <span>{t.to}</span>
            <input
              type="date"
              dir="ltr"
              min={earliest}
              max={data.asOf}
              value={custom ? to : range.to}
              aria-invalid={badRange || undefined}
              aria-describedby={badRange ? 'an-range-error' : undefined}
              onChange={(e) => e.target.value && update({ to: e.target.value, from: custom ? from : range.from, range: null })}
            />
          </label>
        </div>
        {badRange && (
          <p id="an-range-error" className="ad-field-error an-range-error" role="alert">
            {t.badRange}
          </p>
        )}
      </section>

      <div className="ad-metrics">
        <Metric label={t.mTickets} value={f.num(s.tickets)} sub={rangeText} dot="var(--ad-dot-1)" />
        <Metric label={t.mTransacted} value={f.money(s.transacted)} sub={t.mTransactedSub} dot="var(--ad-dot-2)" />
        <Metric label={t.mNet} value={f.money(s.platformNet)} sub={t.mNetSub} dot="var(--ad-dot-3)" />
        <Metric label={t.mOwners} value={f.money(s.ownersDue)} sub={t.mOwnersSub} dot="var(--ad-dot-4)" />
      </div>

      <section className="ad-card" aria-labelledby="an-daily-title" data-scroll-reveal="">
        <div className="ad-card-head ad-card-head--tight">
          <div>
            <h2 id="an-daily-title" className="ad-card-h">
              {t.dailyTitle}
            </h2>
            <p className="an-lead">{t.dailyLead}</p>
          </div>
          <label className="an-select">
            <span>{t.eventPick}</span>
            <span className="ad-select">
              <select value={eventId} onChange={(e) => update({ event: e.target.value === 'all' ? null : e.target.value })}>
                <option value="all">{t.allEvents}</option>
                {chartEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <Icon size={16}>
                <path d="m6 9 6 6 6-6" />
              </Icon>
            </span>
          </label>
        </div>
        <DailyChart days={days} t={t} f={f} c={c} label={fillIn(t.chartLabel, { from: c.day(range.from), to: c.day(range.to) })} />
      </section>

      <div className="an-two">
        <section className="ad-card" aria-labelledby="an-split-title" data-scroll-reveal="">
          <h2 id="an-split-title" className="ad-card-h ad-card-h--bar">
            {t.splitTitle}
          </h2>
          <dl className="od-totals an-split">
            <div>
              <dt>{t.ticketValue}</dt>
              <dd>{f.money(s.ticketValue)}</dd>
            </div>
            <div>
              <dt>{fillIn(t.serviceFees, { rate: c.percent(data.serviceFee) })}</dt>
              <dd>{f.money(s.fees)}</dd>
            </div>
            <div className="an-split-strong">
              <dt>{t.paidIn}</dt>
              <dd>{f.money(s.transacted)}</dd>
            </div>
            <div>
              <dt>{t.refunded}</dt>
              <dd>− {f.money(s.refundTotal)}</dd>
            </div>
            <div className="an-split-sub">
              <dt>{t.refundedFees}</dt>
              <dd>{f.money(s.refundedFees)}</dd>
            </div>
            <div className="an-split-strong">
              <dt>{t.netTotal}</dt>
              <dd>{f.money(s.transacted - s.refundTotal)}</dd>
            </div>
            <div>
              <dt>{t.ownersShare}</dt>
              <dd>{f.money(s.ownersDue)}</dd>
            </div>
            <div className="od-totals-grand">
              <dt>{t.platformShare}</dt>
              <dd>{f.money(s.platformNet)}</dd>
            </div>
          </dl>
        </section>

        <section className="ad-card" aria-labelledby="an-refunds-title" data-scroll-reveal="">
          <h2 id="an-refunds-title" className="ad-card-h ad-card-h--bar">
            {t.refundsTitle}
          </h2>
          <dl className="od-totals an-split">
            <div className="an-split-strong">
              <dt>{t.ticketsRefunded}</dt>
              <dd>
                {f.num(s.refunds)} · {f.money(s.refundTotal)}
              </dd>
            </div>
            {(
              [
                ['customer', t.rCustomer],
                ['admin', t.rAdmin],
                ['eventCancelled', t.rCancelled],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="an-split-sub">
                <dt>{label}</dt>
                <dd>
                  {f.num(reasons[key].tickets)} · {f.money(reasons[key].amount)}
                </dd>
              </div>
            ))}
            <div className="od-totals-grand">
              <dt>{t.ticketsTransferred}</dt>
              <dd>{f.num(s.transfers)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="ad-card" aria-labelledby="an-events-title" data-scroll-reveal="">
        <div className="ad-card-head ad-card-head--tight">
          <div>
            <h2 id="an-events-title" className="ad-card-h">
              {t.eventsTitle}
            </h2>
            <p className="an-lead">{t.eventsLead}</p>
          </div>
          <button type="button" className="ad-tint-btn ad-tint-btn--small" onClick={exportEvents}>
            <Icon size={15}>
              <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
            </Icon>
            {t.exportCsv}
          </button>
        </div>
        {events.length > 0 ? <EventTable rows={events} totals={s} t={t} f={f} c={c} /> : <p className="ev-card-text">{t.noEvents}</p>}
      </section>

      <section className="ad-card" aria-labelledby="an-cats-title" data-scroll-reveal="">
        <div className="ad-card-head ad-card-head--tight">
          <div>
            <h2 id="an-cats-title" className="ad-card-h">
              {t.categoriesTitle}
            </h2>
            <p className="an-lead">{t.categoriesLead}</p>
          </div>
        </div>
        {categories.length > 0 ? (
          <div className="an-two an-two--flat">
            <CategoryBars title={t.byVolume} rows={[...categories].sort((a, b) => b.tickets - a.tickets)} value={(r) => r.tickets} show={(n) => f.num(n)} t={t} f={f} />
            <CategoryBars title={t.byValue} rows={[...categories].sort((a, b) => b.value - a.value)} value={(r) => r.value} show={(n) => f.money(n)} t={t} f={f} />
          </div>
        ) : (
          <p className="ev-card-text">{t.noSales}</p>
        )}
      </section>

      <section className="ad-card" aria-labelledby="an-gate-title" data-scroll-reveal="">
        <div className="ad-card-head ad-card-head--tight">
          <div>
            <h2 id="an-gate-title" className="ad-card-h">
              {t.attendanceTitle}
            </h2>
            <p className="an-lead">{t.attendanceLead}</p>
          </div>
        </div>
        {gate.length > 0 ? (
          <ul className="an-gate">
            {gate.map((g) => (
              <li key={g.eventId}>
                <span className="an-gate-name">
                  <Link to={`/admin/events/${g.eventId}`}>{g.event.name}</Link>
                  <span className="ad-muted">{f.date(g.event.startAt)}</span>
                </span>
                <span className="an-gate-bar">
                  <ProgressBar value={g.admitted} max={g.sold} />
                </span>
                <span className="an-gate-figure">
                  <strong>{c.percent(g.rate)}</strong>
                  <span className="ad-muted">{fillIn(t.admitted, { admitted: f.num(g.admitted), sold: f.num(g.sold) })}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ev-card-text">{t.noAttendance}</p>
        )}
      </section>
    </>
  )
}

/* ----------------------------------------------------------------- chart */

/** Clean axis steps: 1, 2 or 5 × a power of ten, about four lines. */
function axisTicks(max: number) {
  if (max <= 0) return [0, 1]
  const raw = max / 4
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

function DailyChart({ days, t, f, c, label }: { days: ReturnType<typeof daily>; t: AnalyticsStrings; f: Format; c: ChartFormat; label: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = days.reduce((n, d) => n + d.tickets, 0)
  if (total === 0) return <p className="ev-card-text">{t.noSales}</p>

  const ticks = axisTicks(Math.max(...days.map((d) => d.tickets)))
  const top = ticks[ticks.length - 1]
  // About six date labels whatever the range.
  const every = Math.max(1, Math.ceil(days.length / 6))
  const shown = hover === null ? null : days[hover]

  return (
    <div className="an-chart-wrap">
      <div className="an-chart" role="img" aria-label={label}>
        <div className="an-yaxis" aria-hidden="true">
          {[...ticks].reverse().map((v) => (
            <span key={v}>{c.compact(v)}</span>
          ))}
        </div>
        <div className="an-plot" onMouseLeave={() => setHover(null)}>
          {ticks.map((v) => (
            <span key={v} className="an-grid" style={{ bottom: `${(v / top) * 100}%` }} />
          ))}
          <div className="an-cols" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d, i) => (
              <span key={d.date} className={`an-col${hover === i ? ' is-hover' : ''}`} onMouseEnter={() => setHover(i)}>
                {d.tickets > 0 && <span className="an-bar" style={{ height: `${(d.tickets / top) * 100}%` }} />}
              </span>
            ))}
          </div>
          {shown && (
            <div className="an-tip" style={{ insetInlineStart: `${((hover! + 0.5) / days.length) * 100}%` }} aria-hidden="true">
              <strong>{c.longDay(shown.date)}</strong>
              <span>
                {t.cTickets}: {f.num(shown.tickets)}
              </span>
              <span>
                {t.cValue}: {f.money(shown.value)}
              </span>
            </div>
          )}
        </div>
        <div className="an-xaxis" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d, i) => (
            <span key={d.date}>{i % every === 0 ? c.day(d.date) : ''}</span>
          ))}
        </div>
      </div>
      <details className="an-table">
        <summary>{t.showTable}</summary>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <caption className="ad-sr-only">{label}</caption>
            <thead>
              <tr>
                <th scope="col">{t.cDate}</th>
                <th scope="col" className="ad-num">
                  {t.cTickets}
                </th>
                <th scope="col" className="ad-num">
                  {t.cValue}
                </th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => d.tickets > 0)
                .map((d) => (
                  <tr key={d.date}>
                    <th scope="row">{c.longDay(d.date)}</th>
                    <td className="ad-num">{f.num(d.tickets)}</td>
                    <td className="ad-num">{f.money(d.value)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

/* ---------------------------------------------------------------- tables */

function EventTable({ rows, totals, t, f, c }: { rows: EventRow[]; totals: ReturnType<typeof summary>; t: AnalyticsStrings; f: Format; c: ChartFormat }) {
  return (
    <div className="ad-table-wrap">
      <table aria-labelledby="an-events-title" className="ad-table ad-table--rowheads an-events-table">
        <thead>
          <tr>
            <th scope="col">{t.cEvent}</th>
            <th scope="col" className="ad-num">
              {t.cTickets}
            </th>
            <th scope="col">{t.cSold}</th>
            <th scope="col" className="ad-num">
              {t.cPerDay}
            </th>
            <th scope="col" className="ad-num">
              {t.cOwners}
            </th>
            <th scope="col" className="ad-num">
              {t.cFees}
            </th>
            <th scope="col" className="ad-num">
              {t.cRefunds}
            </th>
            <th scope="col" className="ad-num">
              {t.cTransfers}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.event.id}>
              <th scope="row">
                <Link className="ad-strong" to={`/admin/events/${r.event.id}`}>
                  {r.event.name}
                </Link>
                <span className="ad-block ad-muted">{categoryNames[r.event.category]?.[f.lang] ?? r.event.category}</span>
              </th>
              <td className="ad-num ad-strong">{f.num(r.tickets)}</td>
              <td>
                <span className="ev-sales">
                  <span>
                    {f.num(r.event.sold)} / {f.num(r.event.capacity)}
                  </span>
                  <ProgressBar value={r.event.sold} max={r.event.capacity} />
                </span>
              </td>
              <td className="ad-num">{c.decimal(r.perDay)}</td>
              <td className="ad-num">{f.money(r.ownersDue)}</td>
              <td className="ad-num">{f.money(r.platformNet)}</td>
              <td className="ad-num">{r.refundTotal ? f.money(r.refundTotal) : '—'}</td>
              <td className="ad-num">{r.transfers ? f.num(r.transfers) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t.total}</th>
            <td className="ad-num ad-strong">{f.num(totals.tickets)}</td>
            <td />
            <td />
            <td className="ad-num ad-strong">{f.money(totals.ownersDue)}</td>
            <td className="ad-num ad-strong">{f.money(totals.platformNet)}</td>
            <td className="ad-num ad-strong">{f.money(totals.refundTotal)}</td>
            <td className="ad-num ad-strong">{f.num(totals.transfers)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

type CategoryRow = ReturnType<typeof byCategory>[number]

function CategoryBars({ title, rows, value, show, t, f }: { title: string; rows: CategoryRow[]; value: (r: CategoryRow) => number; show: (n: number) => string; t: AnalyticsStrings; f: Format }) {
  const max = Math.max(...rows.map(value), 1)
  return (
    <div className="an-cats">
      <h3>{title}</h3>
      <ol>
        {rows.map((r) => (
          <li key={r.category}>
            <span className="an-cat-name">
              {categoryNames[r.category]?.[f.lang] ?? r.category}
              <span className="ad-muted">{plural(f.lang, r.events, t.eventsIn, f.num(r.events))}</span>
            </span>
            <span className="an-cat-track" aria-hidden="true">
              <span style={{ width: `${(value(r) / max) * 100}%` }} />
            </span>
            <strong className="an-cat-value">{show(value(r))}</strong>
          </li>
        ))}
      </ol>
    </div>
  )
}
