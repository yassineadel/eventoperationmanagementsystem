import { useState } from 'react'
import { Link } from 'react-router-dom'
import { loadOrdersBook, refundRequestsApi, type RefundRequestRow, type RefundRequestStatus } from '../../lib/ordersApi'
import { ConfirmDialog, Toast } from './AdminFeedback'
import { AdminHero, AdminLayout, Icon, MessagePanel, ResourceStatus, TicketIcon } from './AdminLayout'
import { useAdminActor } from './adminIdentity'
import { plural, shownOf } from './adminText'
import { useErrorText } from './errorStrings'
import type { Tone } from './eventRules'
import { Badge, BlockIcon, CheckIcon, ReasonDialog } from './EventsParts'
import { AlertIcon, ListCount, OrdersTabs, SearchBox, StatusPills } from './OrdersParts'
import { fillIn, useOrdersFormat, useOrdersStrings } from './ordersStrings'
import { useAdminResource } from './useAdminResource'
import { oneOf, useListParams } from './useListParams'

type StatusFilter = 'all' | RefundRequestStatus
const STATUSES: StatusFilter[] = ['submitted', 'approved', 'rejected', 'all']
const FILTERS = { q: '', status: 'submitted' }
const TONE: Record<RefundRequestStatus, Tone> = { submitted: 'pending', approved: 'paid', rejected: 'cancelled' }

export default function RefundRequestsPage() {
  const t = useOrdersStrings()
  const f = useOrdersFormat()
  const actor = useAdminActor()
  const errorText = useErrorText()
  const { state, retry, setData } = useAdminResource('refunds', loadOrdersBook)
  const { values, set, clear } = useListParams(FILTERS)
  const status = oneOf(values.status, STATUSES, 'submitted')
  const [action, setAction] = useState<{ kind: 'approve' | 'reject'; id: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string; n: number } | null>(null)
  const say = (tone: 'success' | 'error', text: string) => setNotice((prev) => ({ tone, text, n: (prev?.n ?? 0) + 1 }))

  const requests = state.status === 'ready' ? state.data.requests : []
  const q = values.q.trim().toLowerCase()
  const matchesText = (r: RefundRequestRow) => !q || `${r.id} ${r.ticketCode} ${r.order.customer.name} ${r.event.name}`.toLowerCase().includes(q)
  const matchesStatus = (r: RefundRequestRow, s = status) => s === 'all' || r.status === s
  const rows = requests.filter((r) => matchesText(r) && matchesStatus(r)).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
  const statusChoices = STATUSES.map((v) => ({
    value: v,
    label: v === 'all' ? t.all : t[v],
    count: requests.filter((r) => matchesText(r) && matchesStatus(r, v)).length,
  }))
  const target = requests.find((r) => r.id === action?.id)
  const heading = () => document.getElementById('refunds-title')

  async function decide(run: () => Promise<RefundRequestRow>, message: (r: RefundRequestRow) => string) {
    setBusy(true)
    let row: RefundRequestRow
    try {
      row = await run()
    } catch (error) {
      say('error', errorText(error, t.failed))
      setBusy(false)
      return
    }
    setBusy(false)
    setAction(null)
    say('success', message(row))
    // The decision is saved; a failed reload only means the list is out of date.
    loadOrdersBook().then(setData, retry)
  }

  // Late requests, and tickets refunded or used since the request, can only be rejected.
  const approvable = (r: RefundRequestRow) => r.eligible && r.ticket.status === 'valid' && r.order.status === 'paid'
  const days = (n: number) => plural(f.lang, Math.floor(n), t.days, f.num(Math.floor(n)))

  return (
    <AdminLayout title={t.rrTitle} crumbs={[{ label: t.ordersTitle, to: '/admin/orders' }, { label: t.rrTitle }]} revealCount={state.status === 'ready' ? 1 : 0}>
      <AdminHero eyebrow={t.ordersEyebrow} title={t.ordersTitle}>
        <p className="ad-hero-lead">{t.rrLead}</p>
      </AdminHero>

      <ResourceStatus state={state} loading={t.loadingRequests} errorTitle={t.errorRequests} errorText={t.errorText} retryLabel={t.tryAgain} onRetry={retry} />
      {state.status === 'ready' && (
        <>
          <OrdersTabs
            active="refunds"
            orders={state.data.orders.length}
            tickets={state.data.tickets.length}
            refunds={requests.filter((r) => r.status === 'submitted').length}
            t={t}
            fmt={f.num}
          />
          {requests.length === 0 ? (
            <MessagePanel tone="empty" title={t.emptyRequests} text={t.emptyRequestsText} icon={<TicketIcon size={34} />} />
          ) : (
            <section className="ad-card" aria-labelledby="refunds-title" data-scroll-reveal="">
              <div className="ad-card-head">
                <div className="ad-card-title">
                  <span className="ad-bars" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <h2 id="refunds-title" tabIndex={-1}>
                    {t.rrAll}
                  </h2>
                  <span className="ad-count">{f.num(rows.length)}</span>
                </div>
                <SearchBox id="refund-search" label={t.rrSearchLabel} placeholder={t.rrSearch} value={values.q} onChange={(v) => set('q', v)} />
              </div>

              <div className="ad-filters" role="group" aria-label={t.rrFilter}>
                <StatusPills id="refund-status" label={t.status} value={status} choices={statusChoices} onChange={(v) => set('status', v)} fmt={f.num} />
                {(q !== '' || status !== 'submitted') && (
                  <button type="button" className="ad-textbtn ad-clear" onClick={clear}>
                    <Icon size={16}>
                      <path d="M6 6l12 12M18 6 6 18" />
                    </Icon>
                    {t.clear}
                  </button>
                )}
              </div>

              <ul className="rr-list">
                {rows.map((r) => (
                  <li key={r.id} className="rr-item">
                    <div className="rr-main">
                      <p className="rr-title">
                        <span className="ad-mono" dir="ltr">
                          {r.id}
                        </span>
                        <Badge tone={TONE[r.status]} label={t[r.status]} />
                        <span className={`rr-window${r.eligible ? '' : ' is-late'}`}>
                          {r.eligible ? <CheckIcon size={14} /> : <AlertIcon size={14} />}
                          {r.eligible ? t.onTime : t.lateBadge}
                        </span>
                      </p>
                      <p>
                        <Link to={`/admin/users/${r.order.customer.userId}`}>{r.order.customer.name}</Link> ·{' '}
                        <Link to={`/admin/events/${r.event.eventId}`}>{r.event.name}</Link> ·{' '}
                        <Link className="ad-mono" dir="ltr" to={`/admin/tickets/${r.ticketCode}`}>
                          {r.ticketCode}
                        </Link>{' '}
                        · {r.ticket.category}
                      </p>
                      <p className="ad-muted">
                        {t.cRequested} {f.date(r.requestedAt)} · {fillIn(t.daysBefore, { days: days(r.daysBefore) })}
                      </p>
                      <blockquote className="rr-note">
                        <span className="ad-sr-only">{t.customerNote}: </span>“{f.text(r.note)}”
                      </blockquote>
                      {r.status !== 'submitted' && r.decidedBy && r.decidedAt && (
                        <p className="ad-muted">
                          {t.cDecision}: {fillIn(t.decidedBy, { name: r.decidedBy, date: f.date(r.decidedAt) })}
                          {r.rejectReason && <> · {f.text(r.rejectReason)}</>}
                        </p>
                      )}
                    </div>
                    <div className="rr-side">
                      <dl className="rr-amount">
                        <dt>{t.cRefund}</dt>
                        <dd>{f.money(r.amount)}</dd>
                        <dd className="ad-muted">{t.refundFeeKept}</dd>
                      </dl>
                      {r.status === 'submitted' && (
                        <>
                          <div className="ad-row-actions">
                            {approvable(r) && (
                              <button
                                type="button"
                                className="ad-primary ad-primary--small"
                                aria-label={`${t.approve} ${r.id}`}
                                onClick={() => setAction({ kind: 'approve', id: r.id })}
                              >
                                <CheckIcon />
                                {t.approve}
                              </button>
                            )}
                            <button type="button" className="ad-danger-outline" aria-label={`${t.reject} ${r.id}`} onClick={() => setAction({ kind: 'reject', id: r.id })}>
                              <BlockIcon />
                              {t.reject}
                            </button>
                          </div>
                          {!approvable(r) && <p className="rr-why">{r.eligible ? t.ticketGone : t.lateNoApprove}</p>}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {rows.length === 0 && (
                <div className="ad-no-matches">
                  <p>{t.noRequests}</p>
                  <button type="button" className="ad-tint-btn" onClick={clear}>
                    {t.clear}
                  </button>
                </div>
              )}

              <div className="ad-card-foot">
                <ListCount text={shownOf(f.lang, rows.length, requests.length, t.requestsShowing, f.num)} />
              </div>
            </section>
          )}
        </>
      )}

      {target && action?.kind === 'approve' && (
        <ConfirmDialog
          title={fillIn(t.approveTitle, { id: target.id })}
          text={`${t.approveText} ${t.settlement}`}
          details={
            <>
              <span>
                {target.order.customer.name} · {target.ticket.category}
              </span>
              <strong>{f.money(target.amount)}</strong>
            </>
          }
          confirmLabel={busy ? t.approving : t.approve}
          cancelLabel={t.cancel}
          busy={busy}
          icon={<CheckIcon />}
          tone="primary"
          returnFocus={heading}
          onConfirm={() => decide(() => refundRequestsApi.approve(target.id, actor.name), (r) => fillIn(t.toastApproved, { id: r.id, amount: f.money(r.amount) }))}
          onCancel={() => setAction(null)}
        />
      )}

      {target && action?.kind === 'reject' && (
        <ReasonDialog
          title={fillIn(t.rejectTitle, { id: target.id })}
          lead={t.rejectLead}
          label={t.rejectReason}
          errorText={t.rejectReasonError}
          warning={target.eligible ? undefined : t.lateWarning}
          icon={<BlockIcon />}
          confirmLabel={t.reject}
          busyLabel={t.rejecting}
          cancelLabel={t.cancel}
          busy={busy}
          returnFocus={heading}
          onCancel={() => setAction(null)}
          onConfirm={(reason) => decide(() => refundRequestsApi.reject(target.id, reason, actor.name), (r) => fillIn(t.toastRejected, { id: r.id }))}
        />
      )}

      {notice && <Toast key={notice.n} tone={notice.tone} message={notice.text} dismissLabel={t.dismiss} onDismiss={() => setNotice(null)} />}
    </AdminLayout>
  )
}
