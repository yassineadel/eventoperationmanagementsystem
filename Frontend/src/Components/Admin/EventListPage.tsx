import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminEventsApi, EVENT_CATEGORIES, isOnSale, type AdminEvent } from '../../lib/adminEventsApi'
import { categoryNames } from '../Homepage/strings'
import { ConfirmDialog, PencilIcon, PlusIcon, Toast, TrashIcon } from './AdminFeedback'
import { AdminHero, AdminLayout, CalendarIcon, ForwardArrowIcon, Icon, MessagePanel, ResourceStatus } from './AdminLayout'
import { plural, shownOf } from './adminText'
import { useErrorText } from './errorStrings'
import { displayStatus, EVENT_TONE, type EventDisplayStatus } from './eventRules'
import { Badge, ProgressBar } from './EventsParts'
import { eventToastText, useEventsStrings, type EventToast } from './eventsStrings'
import { EventChips, ListCount, Metric, SearchBox, StatusPills, type Choice } from './OrdersParts'
import { fillIn, useOrdersFormat } from './ordersStrings'
import { useAdminResource } from './useAdminResource'
import { useFlashToast } from './useFlashToast'
import { oneOf, useListParams } from './useListParams'

type StatusFilter = 'all' | EventDisplayStatus
const STATUSES: StatusFilter[] = ['all', 'draft', 'published', 'past', 'cancelled']
const FILTERS = { q: '', status: 'all', category: 'all' }

export default function EventListPage() {
  const t = useEventsStrings()
  const f = useOrdersFormat()
  const errorText = useErrorText()
  const { state, retry, setData } = useAdminResource('events', () => adminEventsApi.list())
  const { values, set, clear } = useListParams(FILTERS)
  const status = oneOf(values.status, STATUSES, 'all')
  const category = values.category

  const [toast, setToast] = useFlashToast<EventToast>()
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const events = state.status === 'ready' ? state.data : []
  const q = values.q.trim().toLowerCase()
  const matchesSearch = (e: AdminEvent) => !q || `${e.name} ${e.performer} ${e.venue} ${e.city}`.toLowerCase().includes(q)
  const matchesStatus = (e: AdminEvent, s = status) => s === 'all' || displayStatus(e) === s
  const matchesCategory = (e: AdminEvent, c = category) => c === 'all' || e.category === c
  const rows = events.filter((e) => matchesSearch(e) && matchesStatus(e) && matchesCategory(e))
  const hasFilters = q !== '' || status !== 'all' || category !== 'all'
  const catName = (c: string) => categoryNames[c as AdminEvent['category']]?.[f.lang] ?? c

  const statusChoices: Choice<StatusFilter>[] = STATUSES.map((s) => ({
    value: s,
    label: s === 'all' ? t.all : t[s],
    count: events.filter((e) => matchesSearch(e) && matchesCategory(e) && matchesStatus(e, s)).length,
  }))
  const categoryChoices: Choice<string>[] = ['all', ...EVENT_CATEGORIES.filter((c) => events.some((e) => e.category === c))].map((c) => ({
    value: c,
    label: c === 'all' ? t.allCategories : catName(c),
    count: events.filter((e) => matchesSearch(e) && matchesStatus(e) && matchesCategory(e, c)).length,
  }))

  const live = events.filter((e) => isOnSale(e)).length
  const drafts = events.filter((e) => e.status === 'draft').length
  const sold = events.reduce((n, e) => n + (e.status === 'cancelled' ? 0 : e.sold), 0)
  const places = events.reduce((n, e) => n + (e.status === 'cancelled' ? 0 : e.capacity), 0)

  const target = events.find((e) => e.id === confirmId)
  const tableHeading = () => document.getElementById('events-table-title')

  async function confirmDelete() {
    if (!target) return
    setBusy(true)
    try {
      await adminEventsApi.remove(target.id)
    } catch (error) {
      setFailure(errorText(error, t.failed))
      setBusy(false)
      setConfirmId(null)
      return
    }
    setBusy(false)
    setConfirmId(null)
    setToast({ kind: 'deleted', name: target.name, id: target.id })
    // The draft is gone either way; a failed reload only means the list is out of date.
    adminEventsApi.list().then(setData, retry)
  }

  async function undoDelete(id: string) {
    setToast(null)
    try {
      await adminEventsApi.restore(id)
      setData(await adminEventsApi.list())
      // Back on the restored row, or the table when it is filtered out.
      requestAnimationFrame(() => (document.querySelector<HTMLElement>(`[data-event-row="${id}"] a`) ?? tableHeading())?.focus())
    } catch (error) {
      setFailure(errorText(error, t.failed))
    }
  }

  return (
    <AdminLayout title={t.listTitle} crumbs={[{ label: t.listTitle }]} revealCount={state.status === 'ready' ? 5 : 0}>
      <AdminHero
        eyebrow={t.listEyebrow}
        title={t.listTitle}
        action={
          <Link className="ad-primary" to="/admin/events/new">
            <PlusIcon />
            {t.addEvent}
          </Link>
        }
      >
        <p className="ad-hero-lead">{t.listLead}</p>
      </AdminHero>

      <ResourceStatus state={state} loading={t.loading} errorTitle={t.errorTitle} errorText={t.errorText} retryLabel={t.tryAgain} onRetry={retry} />

      {state.status === 'ready' && events.length === 0 && (
        <MessagePanel tone="empty" title={t.emptyTitle} text={t.emptyText} icon={<CalendarIcon size={34} />} />
      )}

      {state.status === 'ready' && events.length > 0 && (
        <>
          <div className="ad-metrics">
            <Metric label={t.mEvents} value={f.num(events.length)} sub={t.mEventsSub} dot="var(--ad-dot-1)" />
            <Metric label={t.mLive} value={f.num(live)} sub={t.mLiveSub} dot="var(--ad-dot-2)" />
            <Metric label={t.mDrafts} value={f.num(drafts)} sub={t.mDraftsSub} dot="var(--ad-dot-3)" />
            <Metric
              label={t.mSold}
              value={f.num(sold)}
              sub={fillIn(t.mSoldSub, { places: plural(f.lang, places, t.placesCount, f.num(places)) })}
              dot="var(--ad-dot-4)"
            />
          </div>

          <section className="ad-card" aria-labelledby="events-table-title" data-scroll-reveal="">
            <div className="ad-card-head">
              <div className="ad-card-title">
                <span className="ad-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <h2 id="events-table-title" tabIndex={-1}>
                  {t.allEvents}
                </h2>
                <span className="ad-count">{f.num(rows.length)}</span>
              </div>
              <SearchBox id="event-search" label={t.searchLabel} placeholder={t.searchPlaceholder} value={values.q} onChange={(v) => set('q', v)} />
            </div>

            <div className="ad-filters" role="group" aria-label={t.filterGroup}>
              <StatusPills id="event-status-label" label={t.status} value={status} choices={statusChoices} onChange={(v) => set('status', v)} fmt={f.num} />
              <EventChips id="event-category-label" label={t.category} value={category} choices={categoryChoices} onChange={(v) => set('category', v)} fmt={f.num} />
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
              <table aria-labelledby="events-table-title" className="ad-table ev-table">
                <thead>
                  <tr>
                    <th scope="col">{t.cEvent}</th>
                    <th scope="col">{t.cDate}</th>
                    <th scope="col" className="ad-hide-sm">
                      {t.cVenue}
                    </th>
                    <th scope="col">{t.cStatus}</th>
                    <th scope="col" className="ad-hide-sm">
                      {t.cSales}
                    </th>
                    <th scope="col" className="ad-end">
                      {t.cActions}
                    </th>
                  </tr>
                </thead>
                {/* Keyed by the filters so the rows replay the customer tab-change fade */}
                <tbody key={`${status}|${category}`} className="ad-rows-enter">
                  {rows.map((e) => {
                    const shown = displayStatus(e)
                    return (
                      <tr key={e.id} data-event-row={e.id}>
                        <td>
                          <span className="ad-block">
                            <Link className="ad-strong" to={`/admin/events/${e.id}`}>
                              {e.name}
                            </Link>
                          </span>
                          <span className="ad-block ad-muted">{catName(e.category)}</span>
                          {/* The venue and sales columns are hidden on phones; their gist moves here. */}
                          <span className="ad-block ad-muted ad-show-sm">
                            {e.venue} · {e.capacity > 0 ? `${f.num(e.sold)} / ${f.num(e.capacity)}` : t.noCategories}
                          </span>
                        </td>
                        <td className="od-nowrap">{f.date(e.startAt)}</td>
                        <td className="ad-hide-sm">
                          <Link className="ad-block" to={`/admin/venues/${e.venueId}`}>
                            {e.venue}
                          </Link>
                          <span className="ad-block ad-muted">{e.city}</span>
                        </td>
                        <td>
                          <Badge tone={EVENT_TONE[shown]} label={t[shown]} />
                        </td>
                        <td className="ad-hide-sm">
                          {e.capacity > 0 ? (
                            <span className="ev-sales">
                              <span className="ad-strong">
                                {f.num(e.sold)} / {f.num(e.capacity)}
                              </span>
                              <ProgressBar value={e.sold} max={e.capacity} />
                            </span>
                          ) : (
                            <span className="ad-muted">{t.noCategories}</span>
                          )}
                        </td>
                        <td className="ad-end">
                          <div className="ad-row-actions">
                            <Link className="ad-tint-btn ad-tint-btn--small" to={`/admin/events/${e.id}`} aria-label={`${t.viewFor} ${e.name}`}>
                              {t.view}
                              <ForwardArrowIcon />
                            </Link>
                            {(shown === 'draft' || shown === 'published') && (
                              <Link className="ad-icon-action" to={`/admin/events/${e.id}/edit`} aria-label={`${t.editFor} ${e.name}`} title={t.edit}>
                                <PencilIcon />
                              </Link>
                            )}
                            {e.status === 'draft' && (
                              <button
                                type="button"
                                className="ad-icon-action ad-icon-action--danger"
                                aria-label={`${t.deleteFor} ${e.name}`}
                                title={t.delete}
                                onClick={() => setConfirmId(e.id)}
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
                  {t.clear}
                </button>
              </div>
            )}

            <div className="ad-card-foot">
              <ListCount text={shownOf(f.lang, rows.length, events.length, t.showingCount, f.num)} />
              <span className="ad-foot-note">{t.deleteDraftsOnly}</span>
            </div>
          </section>
        </>
      )}

      {target && (
        <ConfirmDialog
          title={fillIn(t.deleteTitle, { name: target.name })}
          text={t.deleteText}
          details={
            <>
              <span>
                {target.venue} · {f.date(target.startAt)}
              </span>
              <strong>{t.draft}</strong>
            </>
          }
          confirmLabel={t.deleteEvent}
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
          message={eventToastText(t, toast)}
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
