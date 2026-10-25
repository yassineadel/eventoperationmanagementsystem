import { Link } from 'react-router-dom'
import { now } from '../../lib/adminTime'
import { isSelf, usersApi, type AdminUser, type UserRole } from '../../lib/usersApi'
import { AdminHero, AdminLayout, ForwardArrowIcon, Icon, MessagePanel, ResourceStatus, UsersIcon } from './AdminLayout'
import { useAdminActor } from './adminIdentity'
import { initials } from './eventRules'
import { Badge, RoleBadge } from './EventsParts'
import { ListCount, Metric, SearchBox, StatusPills, type Choice } from './OrdersParts'
import { fillIn, useOrdersFormat } from './ordersStrings'
import { shownOf } from './adminText'
import { useUsersStrings } from './usersStrings'
import { useAdminResource } from './useAdminResource'
import { oneOf, useListParams } from './useListParams'

type RoleFilter = 'all' | UserRole
type StateFilter = 'all' | 'active' | 'blocked'
const ROLES: RoleFilter[] = ['all', 'user', 'admin']
const STATES: StateFilter[] = ['all', 'active', 'blocked']
const FILTERS = { q: '', role: 'all', state: 'all' }

export default function UserListPage() {
  const t = useUsersStrings()
  const f = useOrdersFormat()
  const actor = useAdminActor()
  const { state, retry } = useAdminResource('users', () => usersApi.list())
  const { values, set, clear } = useListParams(FILTERS)
  const role = oneOf(values.role, ROLES, 'all')
  const blocked = oneOf(values.state, STATES, 'all')

  const users = state.status === 'ready' ? state.data : []
  const q = values.q.trim().toLowerCase()
  const matchesSearch = (u: AdminUser) => !q || `${u.fullName} ${u.email} ${u.phone ?? ''}`.toLowerCase().includes(q)
  const matchesRole = (u: AdminUser, r = role) => r === 'all' || u.role === r
  const matchesState = (u: AdminUser, s = blocked) => s === 'all' || (s === 'blocked') === u.isBlocked
  const rows = users.filter((u) => matchesSearch(u) && matchesRole(u) && matchesState(u))
  const hasFilters = q !== '' || role !== 'all' || blocked !== 'all'

  const roleChoices: Choice<RoleFilter>[] = ROLES.map((r) => ({
    value: r,
    label: r === 'all' ? t.all : t[r],
    count: users.filter((u) => matchesSearch(u) && matchesState(u) && matchesRole(u, r)).length,
  }))
  const stateChoices: Choice<StateFilter>[] = STATES.map((s) => ({
    value: s,
    label: s === 'all' ? t.all : t[s],
    count: users.filter((u) => matchesSearch(u) && matchesRole(u) && matchesState(u, s)).length,
  }))

  const month = now().slice(0, 7)
  const monthName = new Intl.DateTimeFormat(f.lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))

  return (
    <AdminLayout title={t.listTitle} crumbs={[{ label: t.listTitle }]} revealCount={state.status === 'ready' ? 5 : 0}>
      <AdminHero eyebrow={t.listEyebrow} title={t.listTitle}>
        <p className="ad-hero-lead">{t.listLead}</p>
      </AdminHero>

      <ResourceStatus state={state} loading={t.loading} errorTitle={t.errorTitle} errorText={t.errorText} retryLabel={t.tryAgain} onRetry={retry} />

      {state.status === 'ready' && users.length === 0 && <MessagePanel tone="empty" title={t.emptyTitle} text={t.emptyText} icon={<UsersIcon size={34} />} />}

      {state.status === 'ready' && users.length > 0 && (
        <>
          <div className="ad-metrics">
            <Metric label={t.mUsers} value={f.num(users.length)} sub={t.mUsersSub} dot="var(--ad-dot-1)" />
            <Metric label={t.mAdmins} value={f.num(users.filter((u) => u.role === 'admin').length)} sub={t.mAdminsSub} dot="var(--ad-dot-2)" />
            <Metric label={t.mBlocked} value={f.num(users.filter((u) => u.isBlocked).length)} sub={t.mBlockedSub} dot="var(--ad-dot-3)" />
            <Metric
              label={t.mNew}
              value={f.num(users.filter((u) => u.createdAt.startsWith(month)).length)}
              sub={fillIn(t.mNewSub, { month: monthName })}
              dot="var(--ad-dot-4)"
            />
          </div>

          <section className="ad-card" aria-labelledby="users-table-title" data-scroll-reveal="">
            <div className="ad-card-head">
              <div className="ad-card-title">
                <span className="ad-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <h2 id="users-table-title">{t.allUsers}</h2>
                <span className="ad-count">{f.num(rows.length)}</span>
              </div>
              <SearchBox id="user-search" label={t.searchLabel} placeholder={t.searchPlaceholder} value={values.q} onChange={(v) => set('q', v)} />
            </div>

            <div className="ad-filters" role="group" aria-label={t.filterGroup}>
              <StatusPills id="user-role-label" label={t.role} value={role} choices={roleChoices} onChange={(v) => set('role', v)} fmt={f.num} />
              <StatusPills id="user-state-label" label={t.status} value={blocked} choices={stateChoices} onChange={(v) => set('state', v)} fmt={f.num} />
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
              <table aria-labelledby="users-table-title" className="ad-table ad-table--wide">
                <thead>
                  <tr>
                    <th scope="col">{t.cUser}</th>
                    <th scope="col">{t.cRole}</th>
                    <th scope="col" className="ad-hide-sm">
                      {t.cSignIn}
                    </th>
                    <th scope="col" className="ad-num ad-hide-sm">
                      {t.cOrders}
                    </th>
                    <th scope="col" className="ad-hide-sm">
                      {t.cJoined}
                    </th>
                    <th scope="col">{t.cStatus}</th>
                    <th scope="col" className="ad-end">
                      {t.cActions}
                    </th>
                  </tr>
                </thead>
                {/* Keyed by the filters so the rows replay the customer tab-change fade */}
                <tbody key={`${role}|${blocked}`} className="ad-rows-enter">
                  {rows.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="ad-venue-cell">
                          <span className="ad-venue-initials" aria-hidden="true">
                            {initials(u.fullName)}
                          </span>
                          <span>
                            <Link className="ad-strong" to={`/admin/users/${u.id}`}>
                              {u.fullName}
                            </Link>
                            {isSelf(u, actor) && <span className="ev-you">{t.you}</span>}
                            <span className="ad-block ad-muted" dir="ltr">
                              {u.email}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <RoleBadge role={u.role} label={t[u.role]} />
                      </td>
                      <td className="ad-hide-sm">{u.provider === 'google' ? t.google : t.emailSignIn}</td>
                      <td className="ad-num ad-strong ad-hide-sm">{f.num(u.orders)}</td>
                      <td className="od-nowrap ad-hide-sm">{f.date(u.createdAt)}</td>
                      <td>
                        <Badge tone={u.isBlocked ? 'cancelled' : 'paid'} label={u.isBlocked ? t.blocked : t.active} />
                      </td>
                      <td className="ad-end">
                        <Link className="ad-tint-btn ad-tint-btn--small" to={`/admin/users/${u.id}`} aria-label={`${t.viewFor} ${u.fullName}`}>
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
                <p>{t.noMatches}</p>
                <button type="button" className="ad-tint-btn" onClick={clear}>
                  {t.clear}
                </button>
              </div>
            )}

            <div className="ad-card-foot">
                  <ListCount text={shownOf(f.lang, rows.length, users.length, t.showingCount, f.num)} />
                </div>
          </section>
        </>
      )}
    </AdminLayout>
  )
}
