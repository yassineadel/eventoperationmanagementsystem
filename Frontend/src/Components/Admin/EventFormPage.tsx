import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminEventsApi, EVENT_CATEGORIES, EventNotFoundError, type EventForm, type EventStatus } from '../../lib/adminEventsApi'
import { minutesAfter, now } from '../../lib/adminTime'
import { venuesApi, type Venue } from '../../lib/venuesApi'
import { categoryNames } from '../Homepage/strings'
import { ConfirmDialog } from './AdminFeedback'
import { AdminHero, AdminLayout, BackArrowIcon, Icon, ResourceStatus } from './AdminLayout'
import { useAdminStrings } from './adminStrings'
import { parseWhole } from './adminText'
import { useErrorText } from './errorStrings'
import { EVENT_TONE, eventFormProblems, PROBLEM_FIELD, type EventProblem } from './eventRules'
import { Badge } from './EventsParts'
import { useEventsStrings, type EventToast } from './eventsStrings'
import { fillIn, useOrdersFormat } from './ordersStrings'
import { useAdminResource } from './useAdminResource'
import { useUnsavedChanges } from './useUnsavedChanges'
import './Events.css'

const EMPTY: EventForm = {
  name: '',
  category: 'concerts',
  performer: '',
  description: '',
  venueId: '',
  startAt: '',
  doorsOpenAt: '',
  durationMinutes: 120,
  salesOpenAt: '',
  salesCloseAt: '',
}

type Loaded = { form: EventForm; status: EventStatus; name: string; venues: Venue[] }

/* ------------------------------------------------------------------ pages */

export function EventAddPage() {
  return <EventLoader mode="add" eventId="" />
}

export function EventEditPage() {
  const { eventId = '' } = useParams()
  return <EventLoader key={eventId} mode="edit" eventId={eventId} />
}

/** Loads the venue list (both modes) and the event (edit mode). */
function EventLoader({ mode, eventId }: { mode: 'add' | 'edit'; eventId: string }) {
  const t = useEventsStrings()
  const { state, retry } = useAdminResource(
    `${mode}:${eventId}`,
    async (): Promise<Loaded> => {
      const [event, venues] = await Promise.all([
        mode === 'edit' ? adminEventsApi.getForm(eventId) : Promise.resolve({ form: EMPTY, status: 'draft' as const, name: '' }),
        venuesApi.list(),
      ])
      return { ...event, venues }
    },
    (e) => e instanceof EventNotFoundError,
  )

  if (state.status === 'ready') return <EventEditor mode={mode} eventId={eventId} {...state.data} />

  const title = mode === 'add' ? t.addTitle : t.editTitle
  return (
    <AdminLayout title={title} crumbs={[{ label: t.listTitle, to: '/admin/events' }, { label: title }]}>
      <Link className="ad-back" to={mode === 'add' ? '/admin/events' : `/admin/events/${eventId}`}>
        <BackArrowIcon />
        {t.backToEvents}
      </Link>
      <ResourceStatus
        state={state}
        loading={t.loadingForm}
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

/* ----------------------------------------------------------------- editor */

type EditorProps = { mode: 'add' | 'edit'; eventId: string } & Loaded

function EventEditor({ mode, eventId, form: initial, status, name: originalName, venues }: EditorProps) {
  const t = useEventsStrings()
  const a = useAdminStrings()
  const f = useOrdersFormat()
  const navigate = useNavigate()
  const errorText = useErrorText()

  const [form, setForm] = useState<EventForm>(initial)
  const [touched, setTouched] = useState<Set<keyof EventForm>>(() => new Set())
  const [tried, setTried] = useState(0)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const problems = eventFormProblems(form, { isNew: mode === 'add', now: now() })
  const dirty = !saving && JSON.stringify(form) !== JSON.stringify(initial)
  const guard = useUnsavedChanges(dirty)
  const shownFor = (key: keyof EventForm) => problems.find((p) => PROBLEM_FIELD[p] === key && (tried > 0 || touched.has(key)))
  const venueLocked = mode === 'edit' && status !== 'draft'
  const venue = venues.find((v) => v.id === form.venueId)
  const detailUrl = mode === 'add' ? '/admin/events' : `/admin/events/${eventId}`

  // After a failed save, focus the first field with a problem once its message is on screen.
  useEffect(() => {
    if (!tried) return
    const first = problems[0]
    if (first) document.getElementById(`event-${PROBLEM_FIELD[first]}`)?.focus()
    // Only when the admin presses Save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tried])

  const message = (p: EventProblem): string => {
    if (p === 'doorsOpenAt' && form.doorsOpenAt && form.startAt && form.doorsOpenAt <= form.startAt) return t.errDoorsEarly
    const text: Record<EventProblem, string> = {
      name: t.errName,
      description: t.errDescription,
      venueId: t.errVenue,
      startAt: t.errStart,
      startPast: t.errStartPast,
      doorsOpenAt: t.errDoors,
      durationMinutes: t.errDuration,
      salesCloseAt: t.errSales,
    }
    return text[p]
  }

  const patch = (changes: Partial<EventForm>) => setForm((current) => ({ ...current, ...changes }))
  const touch = (key: keyof EventForm) => setTouched((s) => (s.has(key) ? s : new Set(s).add(key)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    if (problems.length) {
      setTried((n) => n + 1)
      return
    }
    setSaving(true)
    setFailure(null)
    try {
      const saved = mode === 'add' ? await adminEventsApi.create(form) : await adminEventsApi.update(eventId, form)
      const toast: EventToast = { kind: mode === 'add' ? 'added' : 'saved', name: saved.name, id: saved.id }
      navigate(`/admin/events/${saved.id}`, { state: { toast } })
    } catch (error) {
      setSaving(false)
      setFailure(errorText(error, t.failed))
    }
  }

  /** Label, control and messages; `control` gets the shared id and aria wiring. */
  const field = (key: keyof EventForm, label: string, control: (aria: Record<string, unknown>) => ReactNode, opts: { required?: boolean; wide?: boolean; hint?: string } = {}) => {
    const problem = shownFor(key)
    const describedBy = [problem && `event-${key}-error`, opts.hint && `event-${key}-hint`].filter(Boolean).join(' ') || undefined
    return (
      <div className={`ad-field${opts.wide ? ' ad-field--wide' : ''}`}>
        <label htmlFor={`event-${key}`}>
          {label}
          {opts.required && (
            <span className="ad-required" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        {control({
          id: `event-${key}`,
          'aria-invalid': Boolean(problem),
          'aria-describedby': describedBy,
          required: opts.required,
          onBlur: () => touch(key),
        })}
        {opts.hint && (
          <p id={`event-${key}-hint`} className="ev-hint">
            {opts.hint}
          </p>
        )}
        {problem && (
          <p id={`event-${key}-error`} className="ad-field-error">
            {message(problem)}
          </p>
        )}
      </div>
    )
  }

  const chevron = (
    <Icon size={16}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  )
  const text = (key: 'name' | 'performer', placeholder?: string) => (aria: Record<string, unknown>) => (
    <input {...aria} type="text" value={form[key]} placeholder={placeholder} onChange={(e) => patch({ [key]: e.target.value })} />
  )
  const when = (key: 'startAt' | 'doorsOpenAt' | 'salesOpenAt' | 'salesCloseAt') => (aria: Record<string, unknown>) => (
    <input
      {...aria}
      type="datetime-local"
      dir="ltr"
      value={form[key]}
      onChange={(e) => {
        const value = e.target.value
        // Doors usually open an hour before the start; suggest it until the admin sets their own.
        if (key === 'startAt' && value && (!form.doorsOpenAt || (form.startAt && form.doorsOpenAt === minutesAfter(form.startAt, -60)))) {
          patch({ startAt: value, doorsOpenAt: minutesAfter(value, -60) })
        } else patch({ [key]: value })
      }}
    />
  )

  const title = mode === 'add' ? t.addTitle : `${t.editTitle} · ${originalName}`
  const crumbs =
    mode === 'add'
      ? [{ label: t.listTitle, to: '/admin/events' }, { label: t.newEvent }]
      : [{ label: t.listTitle, to: '/admin/events' }, { label: originalName, to: detailUrl }, { label: t.editTitle }]

  return (
    <AdminLayout title={title} crumbs={crumbs}>
      <Link className="ad-back" to={detailUrl}>
        <BackArrowIcon />
        {mode === 'add' ? t.backToEvents : fillIn(t.backToEvent, { name: originalName })}
      </Link>
      <AdminHero eyebrow={t.listEyebrow} title={title}>
        <p className="ad-hero-lead">{mode === 'add' ? t.addLead : t.editLead}</p>
      </AdminHero>

      <form className="ad-form-grid" onSubmit={submit} noValidate>
        <div className="ad-form-main">
          <section className="ad-card" aria-labelledby="step-details">
            <div className="ad-card-head ad-card-head--tight">
              <div className="ad-card-title">
                <span className="ad-step" aria-hidden="true">
                  {f.num(1)}
                </span>
                <h2 id="step-details" className="ad-card-h">
                  {t.stepDetails}
                </h2>
              </div>
            </div>
            <div className="ad-fields">
              {field('name', t.fName, text('name', t.phName), { required: true, wide: true })}
              {field('category', t.fCategory, (aria) => (
                <div className="ad-select">
                  <select {...aria} value={form.category} onChange={(e) => patch({ category: e.target.value as EventForm['category'] })}>
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryNames[c][f.lang]}
                      </option>
                    ))}
                  </select>
                  {chevron}
                </div>
              ))}
              {field('performer', t.fPerformer, text('performer', t.phPerformer))}
              {field(
                'description',
                t.fDescription,
                (aria) => (
                  <textarea {...aria} rows={4} value={form.description} placeholder={t.phDescription} onChange={(e) => patch({ description: e.target.value })} />
                ),
                { required: true, wide: true },
              )}
            </div>
          </section>

          <section className="ad-card" aria-labelledby="step-where">
            <div className="ad-card-head ad-card-head--tight">
              <div className="ad-card-title">
                <span className="ad-step" aria-hidden="true">
                  {f.num(2)}
                </span>
                <h2 id="step-where" className="ad-card-h">
                  {t.stepWhere}
                </h2>
              </div>
            </div>
            <div className="ad-fields">
              {field(
                'venueId',
                t.fVenue,
                (aria) => (
                  <div className="ad-select">
                    <select {...aria} value={form.venueId} disabled={venueLocked} onChange={(e) => patch({ venueId: e.target.value })}>
                      <option value="">{t.chooseVenue}</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} · {v.city}
                        </option>
                      ))}
                    </select>
                    {chevron}
                  </div>
                ),
                { required: true, wide: true, hint: venueLocked ? t.venueLocked : undefined },
              )}
              {field('startAt', t.fStart, when('startAt'), { required: true, hint: t.timeZoneHint })}
              {field('doorsOpenAt', t.fDoors, when('doorsOpenAt'), { required: true })}
              {field(
                'durationMinutes',
                t.fDuration,
                (aria) => (
                  <input
                    {...aria}
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={form.durationMinutes ? String(form.durationMinutes) : ''}
                    onChange={(e) => patch({ durationMinutes: parseWhole(e.target.value, 24 * 60) })}
                  />
                ),
                { required: true },
              )}
            </div>
          </section>

          <section className="ad-card" aria-labelledby="step-sales">
            <div className="ad-card-head ad-card-head--tight">
              <div className="ad-card-title">
                <span className="ad-step" aria-hidden="true">
                  {f.num(3)}
                </span>
                <h2 id="step-sales" className="ad-card-h">
                  {t.stepSales}
                </h2>
              </div>
            </div>
            <div className="ad-fields">
              {field('salesOpenAt', t.fSalesOpen, when('salesOpenAt'))}
              {field('salesCloseAt', t.fSalesClose, when('salesCloseAt'))}
              <p className="ev-hint ad-field--wide">{t.salesHint}</p>
            </div>
          </section>
        </div>

        <aside className="ad-form-side">
          <section className="ad-card ad-summary" aria-labelledby="summary-title">
            <h2 id="summary-title" className="ad-card-h ad-card-h--bar">
              {t.summary}
            </h2>
            <dl className="ad-info">
              <div>
                <dt>{t.sStatus}</dt>
                <dd>
                  <Badge tone={EVENT_TONE[status]} label={t[status]} />
                </dd>
              </div>
              <div>
                <dt>{t.sVenue}</dt>
                <dd>{venue ? venue.name : t.notSet}</dd>
              </div>
              <div>
                <dt>{t.sDate}</dt>
                <dd>{form.startAt ? f.date(form.startAt) : t.notSet}</dd>
              </div>
            </dl>
            <div className="ad-summary-actions">
              {tried > 0 && problems.length > 0 && (
                <p className="ad-error-summary" role="alert">
                  {t.errSummary}
                </p>
              )}
              {failure && (
                <p className="ad-error-summary" role="alert">
                  {failure}
                </p>
              )}
              <button type="submit" className="ad-primary" aria-disabled={saving || undefined}>
                <Icon>
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </Icon>
                {saving ? t.saving : mode === 'add' ? t.saveDraft : t.saveChanges}
              </button>
              <Link className="ad-secondary" to={detailUrl}>
                {t.cancel}
              </Link>
            </div>
          </section>
        </aside>
      </form>

      {guard.pending && (
        <ConfirmDialog
          title={a.unsavedTitle}
          text={a.unsavedText}
          confirmLabel={a.leavePage}
          cancelLabel={a.keepEditing}
          onConfirm={guard.leave}
          onCancel={guard.stay}
        />
      )}
    </AdminLayout>
  )
}
