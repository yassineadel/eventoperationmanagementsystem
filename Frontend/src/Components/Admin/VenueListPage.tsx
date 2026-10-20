import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { venuesApi, type Venue, type VenueKind } from '../../lib/venuesApi'
import { usePreferences } from '../Auth/preferences'
import { ConfirmDialog, PencilIcon, PlusIcon, Toast, TrashIcon } from './AdminFeedback'
import {
  AdminHero,
  AdminLayout,
  ForwardArrowIcon,
  Icon,
  LoadingPanel,
  MessagePanel,
  RetryButton,
} from './AdminLayout'
import { useAdminStrings, type AdminStrings } from './adminStrings'
import { fill, toastText, type VenueToast } from './venueMessages'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; venues: Venue[] }
type KindFilter = 'all' | VenueKind

function KindBadge({ kind, t }: { kind: VenueKind; t: AdminStrings }) {
  return kind === 'seated' ? (
    <span className="ad-kind ad-kind--seated">{t.seated}</span>
  ) : (
    <span className="ad-kind ad-kind--standing">{t.standing}</span>
  )
}

const PinIcon = () => (
  <Icon size={16}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Icon>
)

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
}

export default function VenueListPage() {
  const t = useAdminStrings()
  const { lang } = usePreferences()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const fmt = useCallback((n: number) => n.toLocaleString(locale), [locale])

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [city, setCity] = useState('all')

  const [attempt, setAttempt] = useState(0)
  const location = useLocation()
  const navigate = useNavigate()
  const [toast, setToast] = useState<VenueToast | null>(() => (location.state as { toast?: VenueToast } | null)?.toast ?? null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Show a message handed over by another page once, then drop it from history.
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  useEffect(() => {
    let cancelled = false
    venuesApi
      .list()
      .then((venues) => !cancelled && setState({ status: 'ready', venues }))
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  const venues = useMemo(() => (state.status === 'ready' ? state.venues : []), [state])
  const q = query.trim().toLowerCase()
  const matchesSearch = (v: Venue) => !q || `${v.name} ${v.address} ${v.city}`.toLowerCase().includes(q)
  const matchesCity = (v: Venue) => city === 'all' || v.city === city
  const rows = venues.filter((v) => matchesSearch(v) && matchesCity(v) && (kind === 'all' || v.kind === kind))
  const kindCount = (k: KindFilter) =>
    venues.filter((v) => matchesSearch(v) && matchesCity(v) && (k === 'all' || v.kind === k)).length
  const cities = [...new Set(venues.map((v) => v.city))].sort()
  const cityCount = (c: string) =>
    venues.filter((v) => matchesSearch(v) && (kind === 'all' || v.kind === kind) && (c === 'all' || v.city === c)).length
  const hasFilters = q !== '' || kind !== 'all' || city !== 'all'
  const largest = venues.reduce<Venue | null>((max, v) => (!max || v.totalCapacity > max.totalCapacity ? v : max), null)

  const target = venues.find((v) => v.id === confirmId)

  async function confirmDelete() {
    if (!target) return
    setBusy(true)
    try {
      await venuesApi.remove(target.id)
      setState({ status: 'ready', venues: await venuesApi.list() })
      setToast({ kind: 'deleted', name: target.name, id: target.id })
    } catch {
      setToast({ kind: 'failed', name: target.name, id: target.id })
    } finally {
      setBusy(false)
      setConfirmId(null)
    }
  }

  async function undoDelete(id: string) {
    setToast(null)
    try {
      await venuesApi.restore(id)
      setState({ status: 'ready', venues: await venuesApi.list() })
    } catch {
      setToast({ kind: 'failed', name: '', id })
    }
  }

  function clearFilters() {
    setQuery('')
    setKind('all')
    setCity('all')
  }

  const kinds: Array<{ value: KindFilter; label: string }> = [
    { value: 'all', label: t.all },
    { value: 'seated', label: t.seated },
    { value: 'standing', label: t.standing },
  ]

  return (
    <AdminLayout
      title={t.listTitle}
      crumbs={[{ label: t.listTitle }]}
      revealCount={state.status === 'ready' ? venues.length : 0}
    >
      <AdminHero
        eyebrow={t.listEyebrow}
        title={t.listTitle}
        action={
          <Link className="ad-primary" to="/admin/venues/new">
            <PlusIcon />
            {t.addVenue}
          </Link>
        }
      >
        <p className="ad-hero-lead">{t.listLead}</p>
      </AdminHero>

      {state.status === 'loading' && <LoadingPanel label={t.loadingVenues} />}

      {state.status === 'error' && (
        <MessagePanel
          tone="error"
          title={t.errorTitle}
          text={t.errorText}
          action={<RetryButton label={t.tryAgain} onClick={retry} />}
        />
      )}

      {state.status === 'ready' && venues.length === 0 && (
        <MessagePanel tone="empty" title={t.emptyTitle} text={t.emptyText} />
      )}

      {state.status === 'ready' && venues.length > 0 && (
        <>
          <div className="ad-metrics">
            <article className="ad-metric" data-scroll-reveal="">
              <span className="ad-metric-label">
                {t.metricVenues}
                <span className="ad-metric-dot" style={{ background: '#7200f5' }} />
              </span>
              <strong>{fmt(venues.length)}</strong>
              <span>{t.metricVenuesSub}</span>
            </article>
            <article className="ad-metric" data-scroll-reveal="">
              <span className="ad-metric-label">
                {t.metricCapacity}
                <span className="ad-metric-dot" style={{ background: '#a78bfa' }} />
              </span>
              <strong>{fmt(venues.reduce((n, v) => n + v.totalCapacity, 0))}</strong>
              <span>{t.metricCapacitySub}</span>
            </article>
            <article className="ad-metric" data-scroll-reveal="">
              <span className="ad-metric-label">
                {t.metricCities}
                <span className="ad-metric-dot" style={{ background: '#c4b5fd' }} />
              </span>
              <strong>{fmt(cities.length)}</strong>
              <span>{cities.join(', ')}</span>
            </article>
            {largest && (
              <article className="ad-metric" data-scroll-reveal="">
                <span className="ad-metric-label">
                  {t.metricLargest}
                  <span className="ad-metric-dot" style={{ background: '#5c00c9' }} />
                </span>
                <strong>{fmt(largest.totalCapacity)}</strong>
                <span>{largest.name}</span>
              </article>
            )}
          </div>

          <section className="ad-card" aria-labelledby="venues-table-title" data-scroll-reveal="">
            <div className="ad-card-head">
              <div className="ad-card-title">
                <span className="ad-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <h2 id="venues-table-title">{t.allVenues}</h2>
                <span className="ad-count">{fmt(rows.length)}</span>
              </div>
              <div className="ad-search">
                <label htmlFor="venue-search" className="ad-sr-only">
                  {t.searchLabel}
                </label>
                <Icon>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </Icon>
                <input
                  id="venue-search"
                  type="search"
                  placeholder={t.searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="ad-filters" role="group" aria-label={t.filterGroup}>
              <div className="ad-filter">
                <span id="kind-filter-label" className="ad-filter-label">
                  {t.filterLayout}
                </span>
                <div className="ad-pills" role="group" aria-labelledby="kind-filter-label">
                  {kinds.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      aria-pressed={kind === k.value}
                      onClick={() => setKind(k.value)}
                    >
                      {k.label}
                      <span className="ad-pill-count">{fmt(kindCount(k.value))}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="ad-filter" role="group" aria-labelledby="city-filter-label">
                <span id="city-filter-label" className="ad-filter-label ad-filter-label--icon">
                  <PinIcon />
                  {t.filterLocation}
                </span>
                <div className="ad-chips">
                  {['all', ...cities].map((c) => (
                    <button key={c} type="button" className="ad-chip" aria-pressed={city === c} onClick={() => setCity(c)}>
                      {c === 'all' ? t.allLocations : c}
                      <span className="ad-pill-count">{fmt(cityCount(c))}</span>
                    </button>
                  ))}
                </div>
              </div>
              {hasFilters && (
                <button type="button" className="ad-textbtn ad-clear" onClick={clearFilters}>
                  <Icon size={16}>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </Icon>
                  {t.clearFilters}
                </button>
              )}
            </div>

            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th scope="col">{t.colName}</th>
                    <th scope="col">{t.colLocation}</th>
                    <th scope="col">{t.colLayout}</th>
                    <th scope="col" className="ad-num">
                      {t.colCapacity}
                    </th>
                    <th scope="col" className="ad-end">
                      {t.colActions}
                    </th>
                  </tr>
                </thead>
                {/* Keyed by the filters so the rows replay the customer tab-change fade */}
                <tbody key={`${kind}|${city}`} className="ad-rows-enter">
                  {rows.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div className="ad-venue-cell">
                          <span className="ad-venue-initials" aria-hidden="true">
                            {initials(v.name)}
                          </span>
                          <span>
                            <strong>{v.name}</strong>
                            <span className="ad-mono">{v.id.slice(0, 8)}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="ad-block">{v.address}</span>
                        <span className="ad-block ad-muted">
                          {v.city}, {v.country}
                        </span>
                      </td>
                      <td>
                        <KindBadge kind={v.kind} t={t} />
                      </td>
                      <td className="ad-num ad-strong">{fmt(v.totalCapacity)}</td>
                      <td className="ad-end">
                        <div className="ad-row-actions">
                          <Link
                            className="ad-tint-btn ad-tint-btn--small"
                            to={`/admin/venues/${v.id}`}
                            aria-label={`${t.viewDetailsFor} ${v.name}`}
                          >
                            {t.viewDetails}
                            <ForwardArrowIcon />
                          </Link>
                          <Link
                            className="ad-icon-action"
                            to={`/admin/venues/${v.id}/edit`}
                            aria-label={`${t.editFor} ${v.name}`}
                            title={t.edit}
                          >
                            <PencilIcon />
                          </Link>
                          <button
                            type="button"
                            className="ad-icon-action ad-icon-action--danger"
                            aria-label={`${t.deleteFor} ${v.name}`}
                            title={t.delete}
                            onClick={() => setConfirmId(v.id)}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length === 0 && (
              <div className="ad-no-matches">
                <p>{t.noMatches}</p>
                <button type="button" className="ad-tint-btn" onClick={clearFilters}>
                  {t.clearFilters}
                </button>
              </div>
            )}

            <div className="ad-card-foot">
              {t.showing} {fmt(rows.length)} {t.of} {fmt(venues.length)} {t.venuesWord}
            </div>
          </section>
        </>
      )}

      {target && (
        <ConfirmDialog
          title={fill(t.deleteTitle, target.name)}
          text={t.deleteText}
          details={
            <>
              <span>
                {target.address} · {target.city}
              </span>
              <strong>
                {fmt(target.totalCapacity)} {t.capacity}
              </strong>
            </>
          }
          confirmLabel={t.deleteVenue}
          cancelLabel={t.cancel}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {toast && (
        <Toast
          key={`${toast.kind}:${toast.id}`}
          tone={toast.kind === 'failed' ? 'error' : 'success'}
          message={toastText(t, toast)}
          actionLabel={toast.kind === 'deleted' ? t.undo : undefined}
          onAction={() => undoDelete(toast.id)}
          dismissLabel={t.dismiss}
          onDismiss={() => setToast(null)}
        />
      )}
    </AdminLayout>
  )
}
