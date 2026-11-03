import { Link } from 'react-router-dom'
import { addDays, dayOf } from '../../lib/analyticsApi'
import { now } from '../../lib/adminTime'
import { auditApi, type AuditEntry, type AuditTarget } from '../../lib/auditLog'
import { useActivityStrings } from './activityStrings'
import { AdminHero, AdminLayout, Icon, LockIcon, MessagePanel, ResourceStatus } from './AdminLayout'
import { plural, shownOf } from './adminText'
import { downloadCsv } from './csv'
import { EventChips, ListCount, Metric, SearchBox, StatusPills } from './OrdersParts'
import { fillIn, useOrdersFormat } from './ordersStrings'
import { useAdminResource } from './useAdminResource'
import { oneOf, useListParams } from './useListParams'

type TypeFilter = 'all' | AuditTarget
const TYPES: TypeFilter[] = ['all', 'event', 'venue', 'order', 'refund', 'user']
const FILTERS = { q: '', type: 'all', admin: 'all' }

/** Where each kind of record lives in the console. */
function recordLink(target: AuditEntry['target']) {
  switch (target.type) {
    case 'event':
      return `/admin/events/${target.id}`
    case 'venue':
      return `/admin/venues/${target.id}`
    case 'order':
      return `/admin/orders/${target.id}`
    case 'refund':
      return `/admin/refunds?q=${encodeURIComponent(target.id)}`
    case 'user':
      return `/admin/users/${target.id}`
  }
}

/**
 * Activity log (FR-ADM-04): every administrative change, newest first. Read only; the server
 * writes the log from the signed-in admin's session and entries are never changed or removed.
 */
export default function ActivityLogPage() {
  const t = useActivityStrings()
  const f = useOrdersFormat()
  const { state, retry } = useAdminResource('activity', auditApi.list)
  const { values, set, clear } = useListParams(FILTERS)
  const type = oneOf(values.type, TYPES, 'all')

  const entries = state.status === 'ready' ? state.data : []
  const q = values.q.trim().toLowerCase()
  const details = (e: AuditEntry) => {
    const parts = [
      e.action === 'roleChanged' && e.detail ? fillIn(t.newRole, { role: t.roles[e.detail] ?? e.detail }) : e.detail,
      e.amount ? f.money(e.amount) : undefined,
      e.tickets ? plural(f.lang, e.tickets, t.tickets, f.num(e.tickets)) : undefined,
    ]
    return parts.filter(Boolean).join(' · ')
  }
  const matchesText = (e: AuditEntry) => !q || `${e.actor} ${e.target.label} ${e.target.id} ${e.detail ?? ''}`.toLowerCase().includes(q)
  const matchesType = (e: AuditEntry, v = type) => v === 'all' || e.target.type === v
  const matchesAdmin = (e: AuditEntry, v = values.admin) => v === 'all' || e.actor === v
  const rows = entries.filter((e) => matchesText(e) && matchesType(e) && matchesAdmin(e))
  const hasFilters = q !== '' || type !== 'all' || values.admin !== 'all'
  const admins = [...new Set(entries.map((e) => e.actor))].sort()
  const weekAgo = addDays(dayOf(now()), -6)

  const typeChoices = TYPES.map((v) => ({
    value: v,
    label: v === 'all' ? t.all : t.types[v],
    count: entries.filter((e) => matchesText(e) && matchesAdmin(e) && matchesType(e, v)).length,
  }))
  const adminChoices = [{ value: 'all', label: t.allAdmins }, ...admins.map((a) => ({ value: a, label: a }))].map((c) => ({
    ...c,
    count: entries.filter((e) => matchesText(e) && matchesType(e) && matchesAdmin(e, c.value)).length,
  }))

  function exportCsv() {
    downloadCsv(`hafletna-activity-log-${dayOf(now())}.csv`, [
      [t.cWhen, t.cAdmin, t.cAction, t.record, 'ID', t.cDetails],
      ...rows.map((e) => [e.at, e.actor, t.actions[e.action], `${t.typeOne[e.target.type]}: ${e.target.label}`, e.target.id, details(e)]),
    ])
  }

  return (
    <AdminLayout title={t.title} crumbs={[{ label: t.title }]} revealCount={state.status === 'ready' ? 1 : 0}>
      <AdminHero
        eyebrow={t.eyebrow}
        title={t.title}
        action={
          entries.length > 0 ? (
            <button type="button" className="ad-glass-btn" onClick={exportCsv}>
              <Icon size={17}>
                <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
              </Icon>
              {t.downloadCsv}
            </button>
          ) : undefined
        }
      >
        <p className="ad-hero-lead">{t.lead}</p>
      </AdminHero>

      <ResourceStatus state={state} loading={t.loading} errorTitle={t.errorTitle} errorText={t.errorText} retryLabel={t.tryAgain} onRetry={retry} />
      {state.status === 'ready' && (
        <>
          <div className="ad-metrics">
            <Metric label={t.mEntries} value={f.num(entries.length)} sub={t.mEntriesSub} dot="var(--ad-dot-1)" />
            <Metric label={t.mAdmins} value={f.num(admins.length)} sub={t.mAdminsSub} dot="var(--ad-dot-2)" />
            <Metric label={t.mWeek} value={f.num(entries.filter((e) => dayOf(e.at) >= weekAgo).length)} sub={t.mWeekSub} dot="var(--ad-dot-3)" />
            <Metric
              label={t.mMoney}
              value={f.money(entries.filter((e) => ['refunded', 'approved', 'blocked'].includes(e.action)).reduce((n, e) => n + (e.amount ?? 0), 0))}
              sub={t.mMoneySub}
              dot="var(--ad-dot-4)"
            />
          </div>

          {entries.length === 0 ? (
            <MessagePanel tone="empty" title={t.title} text={t.noEntries} icon={<LockIcon size={34} />} />
          ) : (
            <section className="ad-card" aria-labelledby="activity-title" data-scroll-reveal="">
              <div className="ad-card-head">
                <div className="ad-card-title">
                  <span className="ad-bars" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <h2 id="activity-title">{t.allEntries}</h2>
                  <span className="ad-count">{f.num(rows.length)}</span>
                </div>
                <SearchBox id="activity-search" label={t.searchLabel} placeholder={t.search} value={values.q} onChange={(v) => set('q', v)} />
              </div>

              <div className="ad-filters" role="group" aria-label={t.filterLabel}>
                <StatusPills id="activity-type" label={t.record} value={type} choices={typeChoices} onChange={(v) => set('type', v)} fmt={f.num} />
                <EventChips id="activity-admin" label={t.admin} value={values.admin} choices={adminChoices} onChange={(v) => set('admin', v)} fmt={f.num} />
                {hasFilters && (
                  <button type="button" className="ad-textbtn ad-clear" onClick={clear}>
                    <Icon size={16}>
                      <path d="M6 6l12 12M18 6 6 18" />
                    </Icon>
                    {t.clear}
                  </button>
                )}
              </div>

              <p className="ev-hint al-readonly">
                <LockIcon /> {t.readOnly}
              </p>

              <div className="ad-table-wrap">
                <table aria-labelledby="activity-title" className="ad-table ad-table--rowheads al-table">
                  <thead>
                    <tr>
                      <th scope="col">{t.cWhen}</th>
                      <th scope="col">{t.cAdmin}</th>
                      <th scope="col">{t.cAction}</th>
                      <th scope="col">{t.cRecord}</th>
                      <th scope="col" className="ad-hide-sm">
                        {t.cDetails}
                      </th>
                    </tr>
                  </thead>
                  <tbody key={`${type}|${values.admin}`} className="ad-rows-enter">
                    {rows.map((e) => (
                      <tr key={e.id}>
                        <th scope="row" className="od-nowrap">
                          {f.date(e.at)}
                        </th>
                        <td className="ad-strong">{e.actor}</td>
                        <td>
                          <span className={`al-action al-action--${e.action}`}>{t.actions[e.action]}</span>
                        </td>
                        <td>
                          <span className="ad-block ad-muted al-type">{t.typeOne[e.target.type]}</span>
                          <Link to={recordLink(e.target)} className={e.target.type === 'order' || e.target.type === 'refund' ? 'ad-mono' : undefined}>
                            {e.target.label}
                          </Link>
                        </td>
                        <td className="ad-hide-sm al-details">{details(e) || <span className="ad-muted">—</span>}</td>
                      </tr>
                    ))}
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
                <ListCount text={shownOf(f.lang, rows.length, entries.length, t.showing, f.num)} />
              </div>
            </section>
          )}
        </>
      )}
    </AdminLayout>
  )
}
