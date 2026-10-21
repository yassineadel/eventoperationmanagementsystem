import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CATEGORY_COLOURS,
  formCapacity,
  rowRange,
  venuesApi,
  VenueNotFoundError,
  type VenueForm,
  type VenueKind,
} from '../../lib/venuesApi'
import { usePreferences } from '../Auth/preferences'
import { ConfirmDialog, PlusIcon, TrashIcon } from './AdminFeedback'
import { AdminHero, AdminLayout, BackArrowIcon, Icon, LoadingPanel, MessagePanel, RetryButton } from './AdminLayout'
import { useAdminStrings, type AdminStrings } from './adminStrings'
import { fill, type VenueToast } from './venueMessages'

const EMPTY: VenueForm = {
  name: '',
  address: '',
  city: '',
  country: 'Egypt',
  kind: 'seated',
  sections: [{ name: 'Stalls', firstRow: 'A', lastRow: 'J', seatsPerRow: 20 }],
  zones: [{ name: 'General', capacity: 500 }],
  categories: [{ name: 'Standard', code: 'STANDARD', colour: CATEGORY_COLOURS[4] }],
}

type Required = 'name' | 'address' | 'city'
const REQUIRED: Required[] = ['name', 'address', 'city']

const backLink = (t: AdminStrings) => (
  <Link className="ad-back" to="/admin/venues">
    <BackArrowIcon />
    {t.backToVenues}
  </Link>
)

/* ------------------------------------------------------------------ pages */

export function VenueAddPage() {
  return <VenueEditor mode="add" initial={EMPTY} />
}

// Keyed by the venue ID so moving to another venue starts from a fresh loading state.
export function VenueEditPage() {
  const { venueId = '' } = useParams()
  return <VenueEditLoader key={venueId} venueId={venueId} />
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'not-found' } | { status: 'ready'; form: VenueForm }

function VenueEditLoader({ venueId }: { venueId: string }) {
  const t = useAdminStrings()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    venuesApi
      .getForm(venueId)
      .then((form) => !cancelled && setState({ status: 'ready', form }))
      .catch((err) => !cancelled && setState({ status: err instanceof VenueNotFoundError ? 'not-found' : 'error' }))
    return () => {
      cancelled = true
    }
  }, [venueId, attempt])

  if (state.status === 'ready') return <VenueEditor mode="edit" venueId={venueId} initial={state.form} />

  return (
    <AdminLayout title={t.editVenue} crumbs={[{ label: t.listTitle, to: '/admin/venues' }, { label: t.editVenue }]}>
      {backLink(t)}
      {state.status === 'loading' && <LoadingPanel label={t.loadingForm} rows={4} />}
      {state.status === 'error' && (
        <MessagePanel
          tone="error"
          title={t.venueErrorTitle}
          text={t.errorText}
          action={
            <RetryButton
              label={t.tryAgain}
              onClick={() => {
                setState({ status: 'loading' })
                setAttempt((n) => n + 1)
              }}
            />
          }
        />
      )}
      {state.status === 'not-found' && <MessagePanel tone="empty" title={t.notFoundTitle} text={t.notFoundText} />}
    </AdminLayout>
  )
}

/* ----------------------------------------------------------------- editor */

type EditorProps = { mode: 'add' | 'edit'; venueId?: string; initial: VenueForm }

function VenueEditor({ mode, venueId, initial }: EditorProps) {
  const t = useAdminStrings()
  const { lang } = usePreferences()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const fmt = useCallback((n: number) => n.toLocaleString(locale), [locale])

  const [form, setForm] = useState<VenueForm>(initial)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const originalName = initial.name

  const missing = (key: Required) => !form[key].trim()
  const valid = REQUIRED.every((key) => !missing(key))
  const seated = form.kind === 'seated'
  const capacity = formCapacity(form)
  const errorText: Record<Required, string> = { name: t.errName, address: t.errAddress, city: t.errCity }

  const patch = (changes: Partial<VenueForm>) => setForm((f) => ({ ...f, ...changes }))
  function patchItem<K extends 'sections' | 'zones' | 'categories'>(key: K, index: number, changes: Partial<VenueForm[K][number]>) {
    setForm((f) => ({ ...f, [key]: f[key].map((item, i) => (i === index ? { ...item, ...changes } : item)) }))
  }
  function removeItem(key: 'sections' | 'zones' | 'categories', index: number) {
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== index) }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) {
      setTried(true)
      const first = REQUIRED.find(missing)
      if (first) document.getElementById(`venue-${first}`)?.focus()
      return
    }
    setSaving(true)
    setFailed(false)
    try {
      const venue = mode === 'add' ? await venuesApi.create(form) : await venuesApi.update(venueId!, form)
      const toast: VenueToast = { kind: mode === 'add' ? 'added' : 'saved', name: venue.name, id: venue.id }
      navigate('/admin/venues', { state: { toast } })
    } catch {
      setSaving(false)
      setFailed(true)
    }
  }

  async function confirmDelete() {
    setSaving(true)
    try {
      await venuesApi.remove(venueId!)
      const toast: VenueToast = { kind: 'deleted', name: originalName, id: venueId! }
      navigate('/admin/venues', { state: { toast } })
    } catch {
      setSaving(false)
      setConfirming(false)
      setFailed(true)
    }
  }

  const field = (key: Required | 'country', label: string, placeholder?: string, wide = false) => {
    const show = key !== 'country' && tried && missing(key)
    return (
      <div className={`ad-field${wide ? ' ad-field--wide' : ''}`}>
        <label htmlFor={`venue-${key}`}>
          {label}
          {key !== 'country' && (
            <span className="ad-required" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        <input
          id={`venue-${key}`}
          type="text"
          value={form[key]}
          placeholder={placeholder}
          required={key !== 'country'}
          aria-invalid={show}
          aria-describedby={show ? `venue-${key}-error` : undefined}
          onChange={(e) => patch({ [key]: e.target.value })}
        />
        {show && (
          <p id={`venue-${key}-error`} className="ad-field-error">
            {errorText[key as Required]}
          </p>
        )}
      </div>
    )
  }

  const kinds: Array<{ value: VenueKind; label: string; hint: string }> = [
    { value: 'seated', label: t.seated, hint: t.seatedHint },
    { value: 'standing', label: t.standing, hint: t.standingHint },
  ]
  const number = (value: string) => Number(value.replace(/[^0-9]/g, '')) || 0
  const title = mode === 'add' ? t.addTitle : `${t.editVenue} · ${originalName}`
  const crumb = mode === 'add' ? t.newVenue : originalName

  return (
    <AdminLayout title={title} crumbs={[{ label: t.listTitle, to: '/admin/venues' }, { label: crumb }]}>
      {backLink(t)}
      <AdminHero eyebrow={t.listEyebrow} title={title}>
        <p className="ad-hero-lead">{mode === 'add' ? t.addLead : t.editLead}</p>
      </AdminHero>

      <form className="ad-form-grid" onSubmit={submit} noValidate>
        <div className="ad-form-main">
          <section className="ad-card" aria-labelledby="step-details">
            <div className="ad-card-head ad-card-head--tight">
              <div className="ad-card-title">
                <span className="ad-step" aria-hidden="true">
                  {fmt(1)}
                </span>
                <h2 id="step-details" className="ad-card-h">
                  {t.stepDetails}
                </h2>
              </div>
            </div>
            <div className="ad-fields">
              {field('name', t.fieldName, t.phName, true)}
              {field('address', t.fieldAddress, t.phAddress, true)}
              {field('city', t.fieldCity, t.phCity)}
              {field('country', t.fieldCountry)}
            </div>
          </section>

          <section className="ad-card" aria-labelledby="step-layout">
            <div className="ad-card-head ad-card-head--tight">
              <div className="ad-card-title">
                <span className="ad-step" aria-hidden="true">
                  {fmt(2)}
                </span>
                <h2 id="step-layout" className="ad-card-h">
                  {t.stepLayout}
                </h2>
              </div>
            </div>
            <div className="ad-form-body">
              <fieldset className="ad-kind-cards">
                <legend className="ad-sr-only">{t.stepLayout}</legend>
                {kinds.map((k) => (
                  <label key={k.value} className="ad-kind-card">
                    <input
                      type="radio"
                      name="venue-kind"
                      value={k.value}
                      checked={form.kind === k.value}
                      onChange={() => patch({ kind: k.value })}
                    />
                    <span>
                      <strong>{k.label}</strong>
                      <span>{k.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {seated ? (
                <div className="ad-editor">
                  <h3>{t.sections}</h3>
                  <div className="ad-editor-head ad-editor-row--sections" aria-hidden="true">
                    <span>{t.sectionName}</span>
                    <span>{t.firstRow}</span>
                    <span>{t.lastRow}</span>
                    <span>{t.seatsPerRow}</span>
                    <span className="ad-end">{t.seatsCol}</span>
                    <span />
                  </div>
                  {form.sections.map((s, i) => (
                    <div className="ad-editor-row ad-editor-row--sections" key={i}>
                      <input
                        aria-label={`${t.sectionName} ${i + 1}`}
                        value={s.name}
                        onChange={(e) => patchItem('sections', i, { name: e.target.value })}
                      />
                      <input
                        className="ad-mono"
                        aria-label={`${t.firstRow} · ${t.sectionName} ${i + 1}`}
                        maxLength={1}
                        value={s.firstRow}
                        onChange={(e) => patchItem('sections', i, { firstRow: e.target.value.toUpperCase() })}
                      />
                      <input
                        className="ad-mono"
                        aria-label={`${t.lastRow} · ${t.sectionName} ${i + 1}`}
                        maxLength={1}
                        value={s.lastRow}
                        onChange={(e) => patchItem('sections', i, { lastRow: e.target.value.toUpperCase() })}
                      />
                      <input
                        inputMode="numeric"
                        aria-label={`${t.seatsPerRow} · ${t.sectionName} ${i + 1}`}
                        value={String(s.seatsPerRow)}
                        onChange={(e) => patchItem('sections', i, { seatsPerRow: number(e.target.value) })}
                      />
                      <strong className="ad-end">{fmt(rowRange(s.firstRow, s.lastRow).length * s.seatsPerRow)}</strong>
                      <RemoveButton label={`${t.remove} ${s.name}`} onClick={() => removeItem('sections', i)} />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="ad-add-row"
                    onClick={() => patch({ sections: [...form.sections, { name: '', firstRow: 'A', lastRow: 'A', seatsPerRow: 10 }] })}
                  >
                    <PlusIcon size={16} />
                    {t.addSection}
                  </button>
                </div>
              ) : (
                <div className="ad-editor">
                  <h3>{t.zones}</h3>
                  <div className="ad-editor-head ad-editor-row--zones" aria-hidden="true">
                    <span>{t.zoneName}</span>
                    <span>{t.zoneCapacity}</span>
                    <span />
                  </div>
                  {form.zones.map((z, i) => (
                    <div className="ad-editor-row ad-editor-row--zones" key={i}>
                      <input
                        aria-label={`${t.zoneName} ${i + 1}`}
                        value={z.name}
                        onChange={(e) => patchItem('zones', i, { name: e.target.value })}
                      />
                      <input
                        inputMode="numeric"
                        aria-label={`${t.zoneCapacity} · ${t.zoneName} ${i + 1}`}
                        value={String(z.capacity)}
                        onChange={(e) => patchItem('zones', i, { capacity: number(e.target.value) })}
                      />
                      <RemoveButton label={`${t.remove} ${z.name}`} onClick={() => removeItem('zones', i)} />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="ad-add-row"
                    onClick={() => patch({ zones: [...form.zones, { name: '', capacity: 100 }] })}
                  >
                    <PlusIcon size={16} />
                    {t.addZone}
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="ad-card" aria-labelledby="step-categories">
            <div className="ad-card-head ad-card-head--tight">
              <div className="ad-card-title">
                <span className="ad-step" aria-hidden="true">
                  {fmt(3)}
                </span>
                <h2 id="step-categories" className="ad-card-h">
                  {t.stepCategories}
                </h2>
              </div>
            </div>
            <div className="ad-form-body">
              <p className="ad-muted">{t.categoriesHint}</p>
              <div className="ad-editor">
                <div className="ad-editor-head ad-editor-row--cats" aria-hidden="true">
                  <span />
                  <span>{t.categoryName}</span>
                  <span>{t.categoryCode}</span>
                  <span />
                </div>
                {form.categories.map((c, i) => (
                  <div className="ad-editor-row ad-editor-row--cats" key={i}>
                    <button
                      type="button"
                      className="ad-swatch-btn"
                      aria-label={`${t.changeColour} ${c.name}`}
                      onClick={() => {
                        const next = (CATEGORY_COLOURS.indexOf(c.colour) + 1) % CATEGORY_COLOURS.length
                        patchItem('categories', i, { colour: CATEGORY_COLOURS[next] })
                      }}
                    >
                      <span style={{ background: c.colour }} />
                    </button>
                    <input
                      aria-label={`${t.categoryName} ${i + 1}`}
                      value={c.name}
                      onChange={(e) => patchItem('categories', i, { name: e.target.value })}
                    />
                    <input
                      className="ad-mono"
                      aria-label={`${t.categoryCode} ${i + 1}`}
                      value={c.code}
                      onChange={(e) => patchItem('categories', i, { code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    />
                    <RemoveButton label={`${t.remove} ${c.name}`} onClick={() => removeItem('categories', i)} />
                  </div>
                ))}
                <button
                  type="button"
                  className="ad-add-row"
                  onClick={() =>
                    patch({
                      categories: [
                        ...form.categories,
                        { name: '', code: '', colour: CATEGORY_COLOURS[form.categories.length % CATEGORY_COLOURS.length] },
                      ],
                    })
                  }
                >
                  <PlusIcon size={16} />
                  {t.addCategory}
                </button>
              </div>
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
                <dt>{t.colLayout}</dt>
                <dd>{seated ? t.seated : t.standing}</dd>
              </div>
              <div>
                <dt>{seated ? t.sections : t.zones}</dt>
                <dd>{fmt(seated ? form.sections.length : form.zones.length)}</dd>
              </div>
              <div>
                <dt>{t.categories}</dt>
                <dd>{fmt(form.categories.length)}</dd>
              </div>
              <div className="ad-summary-total">
                <dt>{t.totalCapacity}</dt>
                <dd>
                  {fmt(capacity)} {seated ? t.seatsWord : t.placesWord}
                </dd>
              </div>
            </dl>
            <div className="ad-summary-actions">
              {tried && !valid && (
                <p className="ad-error-summary" role="alert">
                  {t.errSummary}
                </p>
              )}
              {failed && (
                <p className="ad-error-summary" role="alert">
                  {t.actionFailed}
                </p>
              )}
              <button type="submit" className="ad-primary" disabled={saving}>
                <Icon>
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </Icon>
                {saving ? t.saving : mode === 'add' ? t.saveVenue : t.saveChanges}
              </button>
              <Link className="ad-secondary" to="/admin/venues">
                {t.cancel}
              </Link>
            </div>
          </section>

          {mode === 'edit' && (
            <section className="ad-card ad-danger-card" aria-labelledby="danger-title">
              <h2 id="danger-title">{t.dangerTitle}</h2>
              <p>{t.deleteText}</p>
              <button type="button" className="ad-danger-outline" onClick={() => setConfirming(true)}>
                <TrashIcon size={16} />
                {t.deleteVenue}
              </button>
            </section>
          )}
        </aside>
      </form>

      {confirming && (
        <ConfirmDialog
          title={fill(t.deleteTitle, originalName)}
          text={t.deleteText}
          confirmLabel={t.deleteVenue}
          cancelLabel={t.cancel}
          busy={saving}
          onConfirm={confirmDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </AdminLayout>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ad-icon-action" aria-label={label} title={label} onClick={onClick}>
      <TrashIcon size={16} />
    </button>
  )
}
