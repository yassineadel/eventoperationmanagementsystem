import { useId, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EVENTS } from '../../lib/ordersApi'
import { isSelf, UserNotFoundError, usersApi, type UserDetail, type UserRole } from '../../lib/usersApi'
import { ConfirmDialog, ModalDialog, Toast } from './AdminFeedback'
import { AdminHero, AdminLayout, BackArrowIcon, ForwardArrowIcon, ResourceStatus, TicketIcon } from './AdminLayout'
import { useAdminActor } from './adminIdentity'
import { useErrorText } from './errorStrings'
import { BlockIcon, HeroBadge, ReasonDialog, ShieldIcon } from './EventsParts'
import { AlertIcon, InfoList, StatusBadge } from './OrdersParts'
import { fillIn, useOrdersFormat, useOrdersStrings } from './ordersStrings'
import { useUsersStrings, type UsersStrings } from './usersStrings'
import { useAdminResource } from './useAdminResource'

type Notice = { tone: 'success' | 'error'; text: string; n: number }

export default function UserDetailPage() {
  const { userId = '' } = useParams()
  const t = useUsersStrings()
  const ot = useOrdersStrings()
  const f = useOrdersFormat()
  const actor = useAdminActor()
  const errorText = useErrorText()
  const { state, retry, setData } = useAdminResource(userId, () => usersApi.get(userId), (e) => e instanceof UserNotFoundError)
  const [dialog, setDialog] = useState<'block' | 'unblock' | 'role' | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const say = (tone: Notice['tone'], text: string) => setNotice((prev) => ({ tone, text, n: (prev?.n ?? 0) + 1 }))

  const backLink = (
    <Link className="ad-back" to="/admin/users">
      <BackArrowIcon />
      {t.backToUsers}
    </Link>
  )

  if (state.status !== 'ready') {
    return (
      <AdminLayout title={t.detailEyebrow} crumbs={[{ label: t.listTitle, to: '/admin/users' }, { label: t.detailEyebrow }]}>
        {backLink}
        <ResourceStatus
          state={state}
          loading={t.loadingUser}
          rows={4}
          errorTitle={t.errorTitle}
          errorText={t.errorText}
          retryLabel={t.tryAgain}
          onRetry={retry}
          notFoundTitle={t.notFoundTitle}
          notFoundText={t.notFoundText}
        />
      </AdminLayout>
    )
  }

  const { user, orders } = state.data
  const self = isSelf(user, actor)
  const selfHintId = 'user-self-hint'

  async function act(action: () => Promise<UserDetail>, success: (d: UserDetail) => string) {
    setBusy(true)
    try {
      const detail = await action()
      setData(detail)
      setDialog(null)
      say('success', success(detail))
    } catch (error) {
      say('error', errorText(error, t.failed))
    } finally {
      setBusy(false)
    }
  }

  // Your own account keeps its buttons focusable, with the reason they don't work read out.
  const selfGuard = (open: () => void) => ({
    'aria-disabled': self || undefined,
    'aria-describedby': self ? selfHintId : undefined,
    onClick: () => !self && open(),
  })

  return (
    <AdminLayout title={user.fullName} crumbs={[{ label: t.listTitle, to: '/admin/users' }, { label: user.fullName }]} revealCount={2}>
      {backLink}

      <AdminHero
        eyebrow={t.detailEyebrow}
        title={user.fullName}
        action={
          <>
            <button type="button" className="ad-glass-btn" {...selfGuard(() => setDialog('role'))}>
              <ShieldIcon />
              {t.changeRole}
            </button>
            {user.isBlocked ? (
              <button type="button" className="ad-glass-btn" onClick={() => setDialog('unblock')}>
                <BlockIcon />
                {t.unblock}
              </button>
            ) : (
              <button type="button" className="ad-glass-btn ad-glass-btn--danger" {...selfGuard(() => setDialog('block'))}>
                <BlockIcon />
                {t.block}
              </button>
            )}
            {self && (
              <p id={selfHintId} className="ev-hero-hint">
                {t.selfHint}
              </p>
            )}
          </>
        }
      >
        <div className="ad-hero-chips">
          <span className="ad-glass-chip" dir="ltr">
            {user.email}
          </span>
          <span className="ad-glass-chip">
            {t.joinedOn} · {f.date(user.createdAt)}
          </span>
          <span className="ad-glass-chip ad-glass-chip--accent">{t[user.role]}</span>
          <HeroBadge tone={user.isBlocked ? 'cancelled' : 'paid'} label={user.isBlocked ? t.blocked : t.active} />
        </div>
      </AdminHero>

      <div className="ad-detail-grid od-detail-grid">
        <div className="od-main">
          {user.isBlocked && (
            <section className="od-reason od-reason--cancelled" aria-labelledby="blocked-title" data-scroll-reveal="">
              <span className="od-reason-icon" aria-hidden="true">
                <AlertIcon size={22} />
              </span>
              <div>
                <h2 id="blocked-title" className="od-reason-kicker">
                  {t.blockedBanner}
                </h2>
                {user.blockedReason && <p className="od-reason-note">{f.text(user.blockedReason)}</p>}
                {user.blockedBy && user.blockedAt && (
                  <p className="od-reason-meta">{fillIn(t.blockedBy, { name: user.blockedBy, date: f.date(user.blockedAt) })}</p>
                )}
              </div>
            </section>
          )}

          <section className="ad-card" aria-labelledby="orders-title" data-scroll-reveal="">
            <div className="ad-card-head ad-card-head--tight">
              <h2 id="orders-title" className="ad-card-h">
                {t.ordersTitle}
              </h2>
              <span className="ad-count">{f.num(orders.length)}</span>
            </div>
            {orders.length > 0 ? (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th scope="col">{t.cOrder}</th>
                      <th scope="col">{t.cEvent}</th>
                      <th scope="col" className="ad-hide-sm">
                        {t.cPlaced}
                      </th>
                      <th scope="col" className="ad-num">
                        {t.cTotal}
                      </th>
                      <th scope="col">{t.cStatus}</th>
                      <th scope="col" className="ad-end">
                        <span className="ad-sr-only">{t.cActions}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <th scope="row" className="ad-mono" dir="ltr">
                          {o.id}
                        </th>
                        <td>
                          {EVENTS[o.eventKey] ? <Link to={`/admin/events/${EVENTS[o.eventKey].eventId}`}>{EVENTS[o.eventKey].name}</Link> : o.eventKey}
                        </td>
                        <td className="od-nowrap ad-hide-sm">{f.date(o.placedAt)}</td>
                        <td className="ad-num ad-strong">{f.money(o.total)}</td>
                        <td>
                          <StatusBadge status={o.status} t={ot} />
                        </td>
                        <td className="ad-end">
                          <Link className="od-link" to={`/admin/orders/${o.id}`} aria-label={`${t.viewOrder} ${o.id}`}>
                            {t.viewOrder}
                            <ForwardArrowIcon />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="od-empty-note">
                <span aria-hidden="true">
                  <TicketIcon size={20} />
                </span>
                {t.noOrders}
              </p>
            )}
          </section>
        </div>

        <aside className="ad-detail-side">
          <section className="ad-card" aria-labelledby="contact-title">
            <h2 id="contact-title" className="ad-card-h ad-card-h--bar">
              {t.contact}
            </h2>
            <InfoList
              rows={[
                { label: t.fullName, value: user.fullName },
                { label: t.email, value: user.email, ltr: true },
                { label: t.phone, value: user.phone ? f.phone(user.phone) : t.notGiven, ltr: !!user.phone },
              ]}
            />
          </section>

          <section className="ad-card" aria-labelledby="account-title">
            <h2 id="account-title" className="ad-card-h ad-card-h--bar">
              {t.account}
            </h2>
            <InfoList
              rows={[
                { label: t.cRole, value: t[user.role] },
                { label: t.signInWith, value: user.provider === 'google' ? t.google : t.emailSignIn },
                { label: t.marketing, value: user.marketingOptIn ? t.optedIn : t.optedOut },
                { label: t.ticketsHeld, value: f.num(user.tickets) },
                { label: t.userId, value: user.id, mono: true },
              ]}
            />
          </section>
        </aside>
      </div>

      {dialog === 'block' && (
        <ReasonDialog
          title={fillIn(t.blockTitle, { name: user.fullName })}
          lead={t.blockLead}
          label={t.blockReason}
          errorText={t.blockReasonError}
          icon={<BlockIcon />}
          confirmLabel={t.confirmBlock}
          busyLabel={t.blocking}
          cancelLabel={t.cancel}
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => act(() => usersApi.block(user.id, reason, actor), () => fillIn(t.toastBlocked, { name: user.fullName }))}
        />
      )}

      {dialog === 'unblock' && (
        <ConfirmDialog
          title={fillIn(t.unblockTitle, { name: user.fullName })}
          text={t.unblockText}
          confirmLabel={t.confirmUnblock}
          cancelLabel={t.cancel}
          busy={busy}
          icon={<BlockIcon />}
          tone="primary"
          onConfirm={() => act(() => usersApi.unblock(user.id), () => fillIn(t.toastUnblocked, { name: user.fullName }))}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === 'role' && (
        <RoleDialog
          t={t}
          name={user.fullName}
          current={user.role}
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={(role) =>
            act(
              () => usersApi.setRole(user.id, role, actor),
              (d) => fillIn(t.toastRole, { name: d.user.fullName, role: t[d.user.role] }),
            )
          }
        />
      )}

      {notice && <Toast key={notice.n} tone={notice.tone} message={notice.text} dismissLabel={t.dismiss} onDismiss={() => setNotice(null)} />}
    </AdminLayout>
  )
}

/* ------------------------------------------------------------------ role */

type RoleProps = {
  t: UsersStrings
  name: string
  current: UserRole
  busy: boolean
  onCancel: () => void
  onConfirm: (role: UserRole) => void
}

function RoleDialog({ t, name, current, busy, onCancel, onConfirm }: RoleProps) {
  const id = useId()
  const checkedRef = useRef<HTMLInputElement>(null)
  const [role, setRole] = useState<UserRole>(current)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (role === current) onCancel()
    else onConfirm(role)
  }

  const options: Array<{ value: UserRole; label: string; hint: string }> = [
    { value: 'user', label: t.user, hint: t.userHint },
    { value: 'admin', label: t.admin, hint: t.adminHint },
  ]

  return (
    <ModalDialog labelledBy={`${id}-title`} describedBy={`${id}-text`} className="ad-dialog--primary od-refund" busy={busy} onCancel={onCancel} onSubmit={submit} initialFocus={checkedRef}>
      <div className="ad-dialog-head">
        <span className="ad-dialog-icon" aria-hidden="true">
          <ShieldIcon size={22} />
        </span>
        <div>
          <h2 id={`${id}-title`}>{fillIn(t.roleTitle, { name })}</h2>
          <p id={`${id}-text`}>{t.roleLead}</p>
        </div>
      </div>
      <div className="od-refund-body">
        <fieldset className="ev-role-options">
          <legend className="ad-sr-only">{t.roleLabel}</legend>
          {options.map((o) => (
            <label key={o.value} className="ad-kind-card">
              <input
                ref={o.value === current ? checkedRef : undefined}
                type="radio"
                name={`${id}-role`}
                value={o.value}
                checked={role === o.value}
                onChange={() => setRole(o.value)}
              />
              <span>
                <strong>{o.label}</strong>
                <span>{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="ad-dialog-actions">
        <button type="button" className="ad-secondary" onClick={() => !busy && onCancel()} aria-disabled={busy || undefined}>
          {t.cancel}
        </button>
        <button type="submit" className="ad-primary" aria-disabled={busy || undefined}>
          <ShieldIcon />
          {busy ? t.saving : t.saveRole}
        </button>
      </div>
    </ModalDialog>
  )
}
