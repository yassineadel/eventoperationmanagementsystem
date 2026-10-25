import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminEventsApi } from '../../lib/adminEventsApi'
import { venuesApi, type Venue, type VenueKind } from '../../lib/venuesApi'
import { ConfirmDialog, PencilIcon, PlusIcon, Toast, TrashIcon } from './AdminFeedback'
import { AdminHero, AdminLayout, ForwardArrowIcon, Icon, MessagePanel, ResourceStatus } from './AdminLayout'
import { useAdminStrings, type AdminStrings } from './adminStrings'
import { useErrorText } from './errorStrings'
import { initials } from './eventRules'
import { EventChips, ListCount, Metric, SearchBox, StatusPills, type Choice } from './OrdersParts'
import { useOrdersFormat } from './ordersStrings'
import { shownOf } from './adminText'
import { useAdminResource } from './useAdminResource'
import { useFlashToast } from './useFlashToast'
import { oneOf, useListParams } from './useListParams'
import { fill, toastText, type VenueToast } from './venueMessages'

type KindFilter = 'all' | VenueKind
const KINDS: KindFilter[] = ['all', 'seated', 'standing']
const FILTERS = { q: '', kind: 'all', city: 'all' }

type Loaded = { venues: Venue[]; eventCounts: Record<string, number> }

async function load(): Promise<Loaded> {
  const [venues, events] = await Promise.all([venuesApi.list(), adminEventsApi.list()])
  const eventCounts: Record<string, number> = {}
  for (const e of events) eventCounts[e.venueId] = (eventCounts[e.venueId] ?? 0) + 1
  return { venues, eventCounts }
}

function KindBadge({ kind, t }: { kind: VenueKind; t: AdminStrings }) {
  return kind === 'seated' ? (
    <span className="ad-kind ad-kind--seated">{t.seated}</span>
  ) : (
    <span className="ad-kind ad-kind--standing">{t.standing}</span>
  )
}

export default function VenueListPage() {
  const t = useAdminStrings()
  const f = useOrdersFormat()
  const errorText = useErrorText()
  const { state, retry, setData } = useAdminResource('venues', load)
  const { values, set, clear } = useListParams(FILTERS)
  const kind = oneOf(values.kind, KINDS, 'all')
  const city = values.city

  const [toast, setToast] = useFlashToast<VenueToast>()
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const venues = state.status === 'ready' ? state.data.venues : []
  const eventCounts = state.status === 'ready' ? state.data.eventCounts : {}
  const q = values.q.trim().toLowerCase()
  const matchesSearch = (v: Venue) => !q || `${v.name} ${v.address} ${v.city}`.toLowerCase().includes(q)
  const matchesCity = (v: Venue, c = city) => c === 'all' || v.city === c
  const matchesKind = (v: Venue, k = kind) => k === 'all' || v.kind === k
  const rows = venues.filter((v) => matchesSearch(v) && matchesCity(v) && matchesKind(v))
  const cities = [...new Set(venues.map((v) => v.city))].sort()
  const hasFilters = q !== '' || kind !== 'all' || city !== 'all'
  const largest = venues.reduce<Venue | null>((max, v) => (!max || v.totalCapacity > max.totalCapacity ? v : max), null)

  const kindChoices: Choice<KindFilter>[] = KINDS.map((k) => ({
    value: k,
    label: k === 'all' ? t.all : t[k],
    count: venues.filter((v) => matchesSearch(v) && matchesCity(v) && matchesKind(v, k)).length,
  }))
  const cityChoices: Choice<string>[] = ['all', ...cities].map((c) => ({
    value: c,
    label: c === 'all' ? t.allLocations : c,
    count: venues.filter((v) => matchesSearch(v) && matchesKind(v) && matchesCity(v, c)).length,
  }))

  const target = venues.find((v) => v.id === confirmId)
  const tableHeading = () => document.getElementById('venues-table-title')

  async function confirmDelete() {
    if (!target) return
    setBusy(true)
    try {
      await venuesApi.remove(target.id)
    } catch (error) {
      setFailure(errorText(error, t.actionFailed))
      setBusy(false)
      setConfirmId(null)
      return
    }
    setBusy(false)
    setConfirmId(null)
    setToast({ kind: 'deleted', name: target.name, id: target.id })
    // The venue is gone either way; a failed reload only means the list is out of date.
    load().then(setData, retry)
  }

  async function undoDelete(id: string) {
    setToast(null)
    try {
      await venuesApi.restore(id)
      setData(await load())
      requestAnimationFrame(() => (document.querySelector<HTMLElement>(`[data-venue-row="${id}"] a`) ?? tableHeading())?.focus())
    } catch (error) {
      setFailure(errorText(error, t.actionFailed))
    }
  }

  return (
    <AdminLayout title={t.listTitle} crumbs={[{ label: t.listTitle }]} revealCount={state.status === 'ready' ? 5 : 0}>
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

      <ResourceStatus state={state} loading={t.loadingVenues} errorTitle={t.errorTitle} errorText={t.errorText} retryLabel={t.tryAgain} onRetry={retry} />

      {state.status === 'ready' && venues.length === 0 && <MessagePanel tone="empty" title={t.emptyTitle} text={t.emptyText} />}

      {state.status === 'ready' && venues.length > 0 && (
        <>
          <div className="ad-metrics">
            <Metric label={t.metricVenues} value={f.num(venues.length)} sub={t.metricVenuesSub} dot="var(--ad-dot-1)" />
            <Metric label={t.metricCapacity} value={f.num(venues.reduce((n, v) => n + v.totalCapacity, 0))} sub={t.metricCapacitySub} dot="var(--ad-dot-2)" />
            <Metric label={t.metricCities} value={f.num(cities.length)} sub={cities.join(', ')} dot="var(--ad-dot-3)" />
            {largest && <Metric label={t.metricLargest} value={f.num(largest.totalCapacity)} sub={largest.name} dot="var(--ad-dot-4)" />}
          </div>

          <section className="ad-card" aria-labelledby="venues-table-title" data-scroll-reveal="">
            <div className="ad-card-head">
              <div className="ad-card-title">
                <span className="ad-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <h2 id="venues-table-title" tabIndex={-1}>
                  {t.allVenues}
                </h2>
                <span className="ad-count">{f.num(rows.length)}</span>
              </div>
              <SearchBox id="venue-search" label={t.searchLabel} placeholder={t.searchPlaceholder} value={values.q} onChange={(v) => set('q', v)} />
            </div>

            <div className="ad-filters" role="group" aria-label={t.filterGroup}>
              <StatusPills id="kind-filter-label" label={t.filterLayout} value={kind} choices={kindChoices} onChange={(v) => set('kind', v)} fmt={f.num} />
              <EventChips
                id="city-filter-label"
                label={t.filterLocation}
                value={city}
                choices={cityChoices}
                onChange={(v) => set('city', v)}
                fmt={f.num}
                icon={
                  <Icon size={16}>
                    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
                    <circle cx="12" cy="9.5" r="2.5" />
                  </Icon>
                }
              />
              {hasFilters && (
                <button type="button" className="ad-textbtn ad-clear" onClick={clear}>
                  <Icon size={16}>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </Icon>
                  {t.clearFilters}
                </button>
              )}
            </div>

            <div className="ad-table-wrap">
              <table aria-labelledby="venues-table-title" className="ad-table">
                <thead>
                  <tr>
                    <th scope="col">{t.colName}</th>
                    <th scope="col" className="ad-hide-sm">
                      {t.colLocation}
                    </th>
                    <th scope="col">{t.colLayout}</th>
                    <th scope="col" className="ad-num">
                      {t.colCapacity}
                    </th>
                    <th scope="col" className="ad-num ad-hide-sm">
                      {t.colEvents}
                    </th>
                    <th scope="col" className="ad-end">
                      {t.colActions}
                    </th>
                  </tr>
                </thead>
                {/* Keyed by the filters so the rows replay the customer tab-change fade */}
                <tbody key={`${kind}|${city}`} className="ad-rows-enter">
                  {rows.map((v) => {
                    const events = eventCounts[v.id] ?? 0
                    return (
                      <tr key={v.id} data-venue-row={v.id}>
                        <td>
                          <div className="ad-venue-cell">
                            <span className="ad-venue-initials" aria-hidden="true">
                              {initials(v.name)}
                            </span>
                            <span>
                              <Link className="ad-strong" to={`/admin/venues/${v.id}`}>
                                {v.name}
                              </Link>
                              <span className="ad-mono" dir="ltr">
                                {v.id.slice(0, 8)}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="ad-hide-sm">
                          <span className="ad-block">{v.address}</span>
                          <span className="ad-block ad-muted">
                            {v.city}, {v.country}
                          </span>
                        </td>
                        <td>
                          <KindBadge kind={v.kind} t={t} />
                        </td>
                        <td className="ad-num ad-strong">{f.num(v.totalCapacity)}</td>
                        <td className="ad-num ad-hide-sm">{f.num(events)}</td>
                        <td className="ad-end">
                          <div className="ad-row-actions">
                            <Link className="ad-tint-btn ad-tint-btn--small" to={`/admin/venues/${v.id}`} aria-label={`${t.viewDetailsFor} ${v.name}`}>
                              {t.viewDetails}
                              <ForwardArrowIcon />
                            </Link>
                            <Link className="ad-icon-action" to={`/admin/venues/${v.id}/edit`} aria-label={`${t.editFor} ${v.name}`} title={t.edit}>
                              <PencilIcon />
                            </Link>
                            {events === 0 && (
                              <button
                                type="button"
                                className="ad-icon-action ad-icon-action--danger"
                                aria-label={`${t.deleteFor} ${v.name}`}
                                title={t.delete}
                                onClick={() => setConfirmId(v.id)}
                              >
                                <TrashIcon />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {rows.length === 0 && (
              <div className="ad-no-matches">
                <p>{t.noMatches}</p>
                <button type="button" className="ad-tint-btn" onClick={clear}>
                  {t.clearFilters}
                </button>
              </div>
            )}

            <div className="ad-card-foot">
              <ListCount text={shownOf(f.lang, rows.length, venues.length, t.showingCount, f.num)} />
              <span className="ad-foot-note">{t.inUseNote}</span>
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
                {f.num(target.totalCapacity)} {t.capacity}
              </strong>
            </>
          }
          confirmLabel={t.deleteVenue}
          cancelLabel={t.cancel}
          busy={busy}
          returnFocus={tableHeading}
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
          focusAction={toast.kind === 'deleted'}
          dismissLabel={t.dismiss}
          onDismiss={() => setToast(null)}
        />
      )}
      {failure && <Toast key={failure} tone="error" message={failure} dismissLabel={t.dismiss} onDismiss={() => setFailure(null)} />}
    </AdminLayout>
  )
}
