import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminEventsApi, EventNotFoundError, type EventDetail } from '../../lib/adminEventsApi'
import { now } from '../../lib/adminTime'
import { eventKeyFor, ticketsApi, type Ticket } from '../../lib/ordersApi'
import { categoryNames } from '../Homepage/strings'
import { ConfirmDialog, PencilIcon, Toast } from './AdminFeedback'
import { AdminHero, AdminLayout, BackArrowIcon, CalendarIcon, ForwardArrowIcon, ResourceStatus, TicketIcon } from './AdminLayout'
import { useAdminActor } from './adminIdentity'
import { plural } from './adminText'
import { useErrorText } from './errorStrings'
import { displayStatus, EVENT_TONE, shownWaveStates, WAVE_TONE, waveLabel } from './eventRules'
import { Badge, BlockIcon, HeroBadge, ProgressBar, ReasonDialog, SendIcon } from './EventsParts'
import { eventToastText, useEventsStrings, type EventToast } from './eventsStrings'
import { AlertIcon, InfoList } from './OrdersParts'
import { fillIn, useOrdersFormat } from './ordersStrings'
import { useAdminResource } from './useAdminResource'
import { useFlashToast } from './useFlashToast'

type Loaded = EventDetail & { tickets: Ticket[] }

async function load(id: string): Promise<Loaded> {
  const [detail, tickets] = await Promise.all([adminEventsApi.get(id), ticketsApi.list()])
  const key = eventKeyFor(id)
  return { ...detail, tickets: tickets.filter((k) => k.eventKey === key) }
}

export default function EventDetailPage() {
  const { eventId = '' } = useParams()
  const t = useEventsStrings()
  const f = useOrdersFormat()
  const errorText = useErrorText()
  const actor = useAdminActor()
  const { state, retry, setData } = useAdminResource(eventId, () => load(eventId), (e) => e instanceof EventNotFoundError)
  const [dialog, setDialog] = useState<'publish' | 'cancel' | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useFlashToast<EventToast>()
  const [failure, setFailure] = useState<string | null>(null)

  const backLink = (
    <Link className="ad-back" to="/admin/events">
      <BackArrowIcon />
      {t.backToEvents}
    </Link>
  )

  if (state.status !== 'ready') {
    return (
      <AdminLayout title={t.detailEyebrow} crumbs={[{ label: t.listTitle, to: '/admin/events' }, { label: t.detailEyebrow }]}>
        {backLink}
        <ResourceStatus
          state={state}
          loading={t.loadingEvent}
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

  const { event, categories, tickets } = state.data
  const shown = displayStatus(event)
  const catName = categoryNames[event.category]?.[f.lang] ?? event.category
  const canEdit = shown === 'draft' || shown === 'published'
  const draftPast = shown === 'draft' && event.isPast
  const ticketsLocked = event.status === 'cancelled' || event.isPast
  const issued = tickets.filter((k) => k.status !== 'cancelled')
  const checkedIn = issued.filter((k) => k.status === 'checked').length
  const doorsOpen = event.doorsOpenAt <= now()
  const revenue = (price: number, sold: number) => price * sold

  async function act(action: () => Promise<EventDetail>, kind: EventToast['kind']) {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      setFailure(errorText(error, t.failed))
      setBusy(false)
      return
    }
    // The action is done; a failed reload afterwards only means the page is out of date.
    setBusy(false)
    setDialog(null)
    setToast({ kind, name: event.name, id: event.id })
    try {
      setData(await load(event.id))
    } catch {
      retry()
    }
  }

  return (
    <AdminLayout title={event.name} crumbs={[{ label: t.listTitle, to: '/admin/events' }, { label: event.name }]} revealCount={3}>
      {backLink}

      <AdminHero
        eyebrow={t.detailEyebrow}
        title={event.name}
        action={
          <>
            {canEdit && (
              <Link className="ad-glass-btn" to={`/admin/events/${event.id}/edit`}>
                <PencilIcon />
                {t.edit}
              </Link>
            )}
            {event.status === 'draft' && !draftPast && (
              <button type="button" className="ad-primary" onClick={() => setDialog('publish')}>
                <SendIcon />
                {t.publish}
              </button>
            )}
            {shown === 'published' && (
              <button type="button" className="ad-glass-btn ad-glass-btn--danger" onClick={() => setDialog('cancel')}>
                <BlockIcon />
                {t.cancelEvent}
              </button>
            )}
          </>
        }
      >
        <div className="ad-hero-chips">
          <span className="ad-glass-chip">{f.date(event.startAt)}</span>
          <span className="ad-glass-chip">{event.venue}</span>
          <span className="ad-glass-chip">{catName}</span>
          <HeroBadge tone={EVENT_TONE[shown]} label={t[shown]} />
        </div>
      </AdminHero>

      <div className="ad-detail-grid od-detail-grid">
        <div className="od-main">
          {event.status === 'cancelled' && event.cancellationReason && (
            <section className="od-reason od-reason--cancelled" aria-labelledby="reason-title" data-scroll-reveal="">
              <span className="od-reason-icon" aria-hidden="true">
                <AlertIcon size={22} />
              </span>
              <div>
                <h2 id="reason-title" className="od-reason-kicker">
                  {t.cancelDetails}
                </h2>
                <p className="od-reason-note">
                  <strong>{t.reason}:</strong> {f.text(event.cancellationReason)}
                </p>
                {event.cancelledAt && <p className="od-reason-meta">{f.date(event.cancelledAt)}</p>}
              </div>
            </section>
          )}
          {shown === 'draft' && (
            <p className="ev-note" role="note">
              <AlertIcon />
              {draftPast ? t.draftPastNote : t.draftNote}
            </p>
          )}
          {shown === 'past' && (
            <p className="ev-note" role="note">
              <CalendarIcon />
              {t.pastNote}
            </p>
          )}

          <section className="ad-card" aria-labelledby="about-title" data-scroll-reveal="">
            <h2 id="about-title" className="ad-card-h ad-card-h--bar">
              {t.about}
            </h2>
            <p className="ev-description">{event.description || t.noDescription}</p>
          </section>

          <section className="ad-card" aria-labelledby="cats-title" data-scroll-reveal="">
            <div className="ad-card-head ad-card-head--tight">
              <h2 id="cats-title" className="ad-card-h">
                {t.ticketCategories}
              </h2>
              <div className="ad-row-actions">
                <Link className="od-link" to={`/admin/orders?event=${event.id}`}>
                  {t.viewOrders}
                  <ForwardArrowIcon />
                </Link>
                <Link className="od-link" to={`/admin/tickets?event=${event.id}`}>
                  {t.viewTickets}
                  <ForwardArrowIcon />
                </Link>
                {!ticketsLocked && (
                  <Link className="ad-tint-btn ad-tint-btn--small" to={`/admin/events/${event.id}/tickets`}>
                    <PencilIcon size={15} />
                    {t.editTickets}
                  </Link>
                )}
              </div>
            </div>
            {categories.length > 0 ? (
              <div className="ad-table-wrap">
                <table aria-labelledby="cats-title" className="ad-table ev-waves-table">
                  <thead>
                    <tr>
                      <th scope="col">{t.cCategory}</th>
                      <th scope="col" className="ad-num">
                        {t.cPrice}
                      </th>
                      <th scope="col" className="ad-num">
                        {t.cSold}
                      </th>
                      <th scope="col" className="ad-num">
                        {t.cRevenue}
                      </th>
                      <th scope="col">{t.stateCol}</th>
                    </tr>
                  </thead>
                  {categories.map((c) => {
                    const states = shownWaveStates(c.waves, shown)
                    return (
                      <tbody key={c.key} className="ev-cat-group">
                        <tr className="ev-cat-row">
                          <th scope="row">
                            <strong>{c.name}</strong>
                            <span className="ad-mono ad-muted ev-cat-code">{c.key}</span>
                          </th>
                          <td className="ad-num ad-muted">{shown === 'published' ? fillIn(t.nowAt, { price: f.money(c.price) }) : null}</td>
                          <td className="ad-num">
                            <span className="ev-cat-sold">
                              <span className="ad-strong">
                                {f.num(c.sold)} / {f.num(c.capacity)}
                              </span>
                              <ProgressBar value={c.sold} max={c.capacity} />
                            </span>
                          </td>
                          <td className="ad-num ad-strong">{f.money(c.waves.reduce((n, w) => n + revenue(w.price, w.sold), 0))}</td>
                          <td />
                        </tr>
                        {c.waves.map((w, i) => (
                          <tr key={w.id} className="ev-wave-line">
                            <th scope="row">
                              <span className="ad-sr-only">{c.name} · </span>
                              {w.name}
                            </th>
                            <td className="ad-num">{f.money(w.price)}</td>
                            <td className="ad-num">
                              {f.num(w.sold)} / {f.num(w.capacity)}
                            </td>
                            <td className="ad-num">{f.money(revenue(w.price, w.sold))}</td>
                            <td>
                              <Badge tone={WAVE_TONE[states[i]]} label={waveLabel(t, states[i])} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    )
                  })}
                </table>
              </div>
            ) : (
              <p className="od-empty-note">
                <span aria-hidden="true">
                  <TicketIcon size={20} />
                </span>
                {ticketsLocked ? t.noTicketCats : t.noCatsYet}
              </p>
            )}
            {categories.length > 0 && (
              <dl className="od-totals">
                <div>
                  <dt>{t.cRevenue}</dt>
                  <dd>{f.money(categories.reduce((n, c) => n + c.waves.reduce((m, w) => m + revenue(w.price, w.sold), 0), 0))}</dd>
                </div>
                <div className="od-totals-grand">
                  <dt>{t.total}</dt>
                  <dd>
                    {f.num(event.sold)} / {f.num(event.capacity)}
                  </dd>
                </div>
              </dl>
            )}
          </section>
        </div>

        <aside className="ad-detail-side">
          <section className="ad-card" aria-labelledby="schedule-title">
            <h2 id="schedule-title" className="ad-card-h ad-card-h--bar">
              {t.schedule}
            </h2>
            <InfoList
              rows={[
                { label: t.starts, value: f.date(event.startAt) },
                { label: t.doors, value: f.time(event.doorsOpenAt) },
                { label: t.duration, value: plural(f.lang, event.durationMinutes, t.minutes, f.num(event.durationMinutes)) },
                { label: t.salesOpen, value: event.salesOpenAt ? f.date(event.salesOpenAt) : t.whenPublished },
                { label: t.salesClose, value: event.salesCloseAt ? f.date(event.salesCloseAt) : t.untilStart },
              ]}
            />
          </section>

          {issued.length > 0 && (
            <section className="ad-card" aria-labelledby="checkin-title">
              <h2 id="checkin-title" className="ad-card-h ad-card-h--bar">
                {t.checkinTitle}
              </h2>
              {doorsOpen ? (
                <>
                  <InfoList
                    rows={[
                      { label: t.issued, value: f.num(issued.length) },
                      { label: t.checkedIn, value: f.num(checkedIn) },
                      { label: t.noShows, value: f.num(issued.length - checkedIn) },
                    ]}
                  />
                  <div className="ev-checkin-bar">
                    <ProgressBar value={checkedIn} max={issued.length} />
                  </div>
                </>
              ) : (
                <p className="ev-card-text">{t.checkinNotYet}</p>
              )}
            </section>
          )}

          <section className="ad-card" aria-labelledby="venue-title">
            <h2 id="venue-title" className="ad-card-h ad-card-h--bar">
              {t.venue}
            </h2>
            <InfoList
              rows={[
                { label: t.venue, value: <Link to={`/admin/venues/${event.venueId}`}>{event.venue}</Link> },
                { label: t.city, value: event.city },
                ...(event.performer ? [{ label: t.performer, value: event.performer }] : []),
              ]}
            />
          </section>

          <section className="ad-card" aria-labelledby="record-title">
            <h2 id="record-title" className="ad-card-h ad-card-h--bar">
              {t.record}
            </h2>
            <InfoList
              rows={[
                { label: t.created, value: f.date(event.createdAt) },
                ...(event.publishedAt ? [{ label: t.publishedOn, value: f.date(event.publishedAt) }] : []),
                ...(event.cancelledAt ? [{ label: t.cancelledOn, value: f.date(event.cancelledAt) }] : []),
                { label: t.eventId, value: event.id, mono: true },
              ]}
            />
          </section>
        </aside>
      </div>

      {dialog === 'publish' && (
        <ConfirmDialog
          title={fillIn(t.publishTitle, { name: event.name })}
          text={categories.length ? t.publishText : `${t.publishText} ${t.publishNoTickets}`}
          confirmLabel={busy ? t.publishing : t.publish}
          cancelLabel={t.cancel}
          busy={busy}
          icon={<SendIcon />}
          tone="primary"
          onConfirm={() => act(() => adminEventsApi.publish(event.id), 'published')}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === 'cancel' && (
        <ReasonDialog
          title={t.cancelTitle}
          lead={`${t.cancelLead} · ${event.name}`}
          label={t.cancelReason}
          errorText={t.cancelReasonError}
          warning={fillIn(t.cancelWarning, { tickets: plural(f.lang, event.sold, t.ticketsCount, f.num(event.sold)) })}
          icon={<BlockIcon />}
          confirmLabel={t.confirmCancel}
          busyLabel={t.cancelling}
          cancelLabel={t.keepEvent}
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => act(() => adminEventsApi.cancel(event.id, reason, actor.name), 'cancelled')}
        />
      )}

      {toast && (
        <Toast
          key={`${toast.kind}:${toast.id}`}
          tone={toast.kind === 'failed' ? 'error' : 'success'}
          message={eventToastText(t, toast)}
          dismissLabel={t.dismiss}
          onDismiss={() => setToast(null)}
        />
      )}
      {failure && <Toast key={failure} tone="error" message={failure} dismissLabel={t.dismiss} onDismiss={() => setFailure(null)} />}
    </AdminLayout>
  )
}
