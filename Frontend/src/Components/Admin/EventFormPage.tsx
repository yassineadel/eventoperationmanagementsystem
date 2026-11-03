import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminEventsApi, EVENT_CATEGORIES, EventNotFoundError, MAX_EVENT_IMAGES, POLICY_KEYS, policyForm, type EventForm, type EventStatus, type PolicyKey } from '../../lib/adminEventsApi'
import { minutesAfter, now } from '../../lib/adminTime'
import { venuesApi, type Venue } from '../../lib/venuesApi'
import { categoryNames } from '../Homepage/strings'
import { ConfirmDialog, PlusIcon, TrashIcon } from './AdminFeedback'
import { AdminHero, AdminLayout, BackArrowIcon, CalendarIcon, Icon, LockIcon, MessagePanel, ResourceStatus } from './AdminLayout'
import { useAdminStrings } from './adminStrings'
import { parseWhole } from './adminText'
import { useErrorText } from './errorStrings'
import { displayStatus, EVENT_TONE, eventFormProblems, incompleteFaqs, PROBLEM_FIELD, type EventProblem } from './eventRules'
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
  images: [],
  policies: policyForm({}),
  faqs: [],
}

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

/** A picked photo as a data URL; the API version uploads it and stores the returned URL instead. */
function readPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const POLICY_LABEL: Record<PolicyKey, 'polAgeRestrictions' | 'polEntryConditions' | 'polProhibitedItems' | 'polRefundPolicy' | 'polAccessibility'> = {
  ageRestrictions: 'polAgeRestrictions',
  entryConditions: 'polEntryConditions',
  prohibitedItems: 'polProhibitedItems',
  refundPolicy: 'polRefundPolicy',
  accessibility: 'polAccessibility',
}

type Loaded = { form: EventForm; status: EventStatus; isPast: boolean; name: string; venues: Venue[] }

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
        mode === 'edit' ? adminEventsApi.getForm(eventId) : Promise.resolve({ form: EMPTY, status: 'draft' as const, isPast: false, name: '' }),
        venuesApi.list(),
      ])
      return { ...event, venues }
    },
    (e) => e instanceof EventNotFoundError,
  )

  const title = mode === 'add' ? t.addTitle : t.editTitle
  if (state.status === 'ready') {
    const shown = displayStatus(state.data)
    if (shown === 'draft' || shown === 'published') return <EventEditor mode={mode} eventId={eventId} {...state.data} />
    // Cancelled events and events that have started are kept as they were.
    return (
      <AdminLayout title={title} crumbs={[{ label: t.listTitle, to: '/admin/events' }, { label: state.data.name, to: `/admin/events/${eventId}` }, { label: title }]}>
        <Link className="ad-back" to={`/admin/events/${eventId}`}>
          <BackArrowIcon />
          {fillIn(t.backToEvent, { name: state.data.name })}
        </Link>
        <MessagePanel tone="empty" title={t.lockedTitle} text={t.lockedText} icon={<LockIcon size={34} />} />
      </AdminLayout>
    )
  }

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
        notFoundIcon={<CalendarIcon size={34} />}
        notFoundText={t.notFoundText}
      />
    </AdminLayout>
  )
}

/* ----------------------------------------------------------------- editor */

type EditorProps = { mode: 'add' | 'edit'; eventId: string } & Loaded

function EventEditor({ mode, eventId, form: initial, status, isPast, name: originalName, venues }: EditorProps) {
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
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  // Where focus goes after the next render: a new question, the control after a removal.
  const focusAfter = useRef<string | null>(null)
  useEffect(() => {
    if (!focusAfter.current) return
    document.getElementById(focusAfter.current)?.focus()
    focusAfter.current = null
  })

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
    if (first === 'faqs') {
      const row = incompleteFaqs(form.faqs)[0]
      const q = form.faqs[row]
      document.getElementById(`event-faq-${row}-${q.question.trim() ? 'a' : 'q'}`)?.focus()
    } else if (first) document.getElementById(`event-${PROBLEM_FIELD[first]}`)?.focus()
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
      faqs: t.errFaqs,
    }
    return text[p]
  }

  const patch = (changes: Partial<EventForm>) => setForm((current) => ({ ...current, ...changes }))
  const touch = (key: keyof EventForm) => setTouched((s) => (s.has(key) ? s : new Set(s).add(key)))

  async function addPhotos(files: FileList | null) {
    const picked = [...(files ?? [])]
    if (photoInput.current) photoInput.current.value = ''
    if (!picked.length) return
    const room = MAX_EVENT_IMAGES - form.images.length
    const usable = picked.filter((file) => PHOTO_TYPES.includes(file.type) && file.size <= MAX_PHOTO_BYTES)
    const problem =
      usable.length < picked.length
        ? picked.some((file) => !PHOTO_TYPES.includes(file.type))
          ? t.photoType
          : t.photoSize
        : usable.length > room
          ? fillIn(t.photoLimit, { max: f.num(MAX_EVENT_IMAGES) })
          : null
    setPhotoError(problem)
    try {
      const urls = await Promise.all(usable.slice(0, Math.max(0, room)).map(readPhoto))
      setForm((current) => ({ ...current, images: [...current.images, ...urls].slice(0, MAX_EVENT_IMAGES) }))
    } catch {
      setPhotoError(t.photoType)
    }
  }

  function removePhoto(index: number) {
    const next = form.images.length > 1 ? `event-photo-${Math.min(index, form.images.length - 2)}-remove` : 'event-add-photos'
    focusAfter.current = next
    patch({ images: form.images.filter((_, i) => i !== index) })
  }

  function makeCover(index: number) {
    focusAfter.current = 'event-photo-0-remove'
    patch({ images: [form.images[index], ...form.images.filter((_, i) => i !== index)] })
  }

  function addFaq() {
    focusAfter.current = `event-faq-${form.faqs.length}-q`
    patch({ faqs: [...form.faqs, { question: '', answer: '' }] })
  }

  function removeFaq(index: number) {
    focusAfter.current = form.faqs.length > 1 ? `event-faq-${Math.min(index, form.faqs.length - 2)}-q` : 'event-add-faq'
    patch({ faqs: form.faqs.filter((_, i) => i !== index) })
  }

  const badFaqs = new Set(tried > 0 ? incompleteFaqs(form.faqs) : [])

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

          <section className="ad-card" aria-labelledby="step-photos">
            <div className="ad-card-head ad-card-head--tight">
              <div className="ad-card-title">
                <span className="ad-step" aria-hidden="true">
                  {f.num(4)}
                </span>
                <h2 id="step-photos" className="ad-card-h">
                  {t.stepPhotos}
                </h2>
              </div>
            </div>
            <div className="ev-block">
              <p id="event-photos-hint" className="ev-hint">
                {fillIn(t.photosHint, { max: f.num(MAX_EVENT_IMAGES) })}
              </p>
              {form.images.length > 0 ? (
                <ul className="ev-photos" aria-labelledby="step-photos">
                  {form.images.map((src, i) => (
                    <li key={`${i}:${src.slice(-24)}`} className="ev-photo">
                      <img src={src} alt={fillIn(t.photoAlt, { n: f.num(i + 1), name: form.name || t.newEvent })} />
                      {i === 0 && <span className="ev-photo-cover">{t.cover}</span>}
                      <span className="ev-photo-actions">
                        {i > 0 && (
                          <button
                            type="button"
                            id={`event-photo-${i}-cover`}
                            className="ad-icon-action"
                            aria-label={fillIn(t.makeCover, { n: f.num(i + 1) })}
                            title={fillIn(t.makeCover, { n: f.num(i + 1) })}
                            onClick={() => makeCover(i)}
                          >
                            <Icon size={16}>
                              <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
                            </Icon>
                          </button>
                        )}
                        <button
                          type="button"
                          id={`event-photo-${i}-remove`}
                          className="ad-icon-action"
                          aria-label={fillIn(t.removePhoto, { n: f.num(i + 1) })}
                          title={fillIn(t.removePhoto, { n: f.num(i + 1) })}
                          onClick={() => removePhoto(i)}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="od-empty-note">{t.noPhotos}</p>
              )}
              <input
                ref={photoInput}
                type="file"
                accept={PHOTO_TYPES.join(',')}
                multiple
                hidden
                onChange={(e) => void addPhotos(e.target.files)}
              />
              <button
                type="button"
                id="event-add-photos"
                className="ad-tint-btn"
                aria-describedby={['event-photos-hint', photoError && 'event-photos-error'].filter(Boolean).join(' ')}
                aria-disabled={form.images.length >= MAX_EVENT_IMAGES || undefined}
                onClick={() => (form.images.length >= MAX_EVENT_IMAGES ? setPhotoError(fillIn(t.photoLimit, { max: f.num(MAX_EVENT_IMAGES) })) : photoInput.current?.click())}
              >
                <PlusIcon />
                {t.addPhotos}
              </button>
              {photoError && (
                <p id="event-photos-error" className="ad-field-error" role="alert">
                  {photoError}
                </p>
              )}
            </div>
          </section>

          <section className="ad-card" aria-labelledby="step-policies">
            <div className="ad-card-head ad-card-head--tight">
              <div className="ad-card-title">
                <span className="ad-step" aria-hidden="true">
                  {f.num(5)}
                </span>
                <h2 id="step-policies" className="ad-card-h">
                  {t.stepPolicies}
                </h2>
              </div>
            </div>
            <div className="ad-fields">
              <p className="ev-hint ad-field--wide">{t.policiesHint}</p>
              {POLICY_KEYS.map((key) => (
                <div key={key} className="ad-field ad-field--wide">
                  <label htmlFor={`event-policy-${key}`}>{t[POLICY_LABEL[key]]}</label>
                  <textarea
                    id={`event-policy-${key}`}
                    rows={2}
                    value={form.policies[key]}
                    onChange={(e) => patch({ policies: { ...form.policies, [key]: e.target.value } })}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="ad-card" aria-labelledby="step-faqs">
            <div className="ad-card-head ad-card-head--tight">
              <div className="ad-card-title">
                <span className="ad-step" aria-hidden="true">
                  {f.num(6)}
                </span>
                <h2 id="step-faqs" className="ad-card-h">
                  {t.stepFaqs}
                </h2>
              </div>
            </div>
            <div className="ev-block">
              <p className="ev-hint">{t.faqsHint}</p>
              {form.faqs.length === 0 && <p className="od-empty-note">{t.noFaqs}</p>}
              {form.faqs.map((q, i) => {
                const bad = badFaqs.has(i)
                const error = bad ? `event-faq-${i}-error` : undefined
                return (
                  <fieldset key={i} className="ev-faq-row">
                    <legend className="ad-sr-only">{fillIn(t.faqQuestion, { n: f.num(i + 1) })}</legend>
                    <div className="ad-field">
                      <label htmlFor={`event-faq-${i}-q`}>{fillIn(t.faqQuestion, { n: f.num(i + 1) })}</label>
                      <input
                        id={`event-faq-${i}-q`}
                        type="text"
                        value={q.question}
                        aria-invalid={(bad && !q.question.trim()) || undefined}
                        aria-describedby={error}
                        onChange={(e) => patch({ faqs: form.faqs.map((x, k) => (k === i ? { ...x, question: e.target.value } : x)) })}
                      />
                    </div>
                    <div className="ad-field">
                      <label htmlFor={`event-faq-${i}-a`}>{fillIn(t.faqAnswer, { n: f.num(i + 1) })}</label>
                      <textarea
                        id={`event-faq-${i}-a`}
                        rows={2}
                        value={q.answer}
                        aria-invalid={(bad && !q.answer.trim()) || undefined}
                        aria-describedby={error}
                        onChange={(e) => patch({ faqs: form.faqs.map((x, k) => (k === i ? { ...x, answer: e.target.value } : x)) })}
                      />
                    </div>
                    <button
                      type="button"
                      className="ad-icon-action ev-faq-remove"
                      aria-label={fillIn(t.removeFaq, { n: f.num(i + 1) })}
                      title={fillIn(t.removeFaq, { n: f.num(i + 1) })}
                      onClick={() => removeFaq(i)}
                    >
                      <TrashIcon size={16} />
                    </button>
                    {bad && (
                      <p id={error} className="ad-field-error ev-faq-error">
                        {t.errFaqs}
                      </p>
                    )}
                  </fieldset>
                )
              })}
              <button type="button" id="event-add-faq" className="ad-tint-btn" onClick={addFaq}>
                <PlusIcon />
                {t.addFaq}
              </button>
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
                  <Badge tone={EVENT_TONE[displayStatus({ status, isPast })]} label={t[displayStatus({ status, isPast })]} />
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
                // Keyed by the attempt, so every failed save is announced again.
                <p key={tried} className="ad-error-summary" role="alert">
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
