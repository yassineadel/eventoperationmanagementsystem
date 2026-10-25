import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminEventsApi } from '../../lib/adminEventsApi'
import {
  CATEGORY_COLOURS,
  formCapacity,
  MAX_SEATS_PER_ROW,
  rowRange,
  validateVenueForm,
  venuesApi,
  VenueNotFoundError,
  type VenueForm,
  type VenueKind,
  type VenueProblem,
} from '../../lib/venuesApi'
import { ConfirmDialog, PlusIcon, TrashIcon } from './AdminFeedback'
import { AdminHero, AdminLayout, BackArrowIcon, Icon, ResourceStatus } from './AdminLayout'
import { useAdminStrings, type AdminStrings } from './adminStrings'
import { parseWhole } from './adminText'
import { useErrorText } from './errorStrings'
import { fillIn, useOrdersFormat } from './ordersStrings'
import { useAdminResource } from './useAdminResource'
import { useUnsavedChanges } from './useUnsavedChanges'
import { fill, type VenueToast } from './venueMessages'
import './Events.css'

let nextKey = 0
const rowKey = () => `venue-row-${++nextKey}`

const EMPTY: VenueForm = {
  name: '',
  address: '',
  city: '',
  country: 'Egypt',
  kind: 'seated',
  sections: [{ rowKey: 'empty-section', name: 'Stalls', firstRow: 'A', lastRow: 'J', seatsPerRow: 20, categoryCode: 'STANDARD' }],
  zones: [{ rowKey: 'empty-zone', name: 'General', capacity: 500, categoryCode: 'STANDARD' }],
  categories: [{ rowKey: 'empty-category', name: 'Standard', code: 'STANDARD', colour: CATEGORY_COLOURS[4] }],
}

type Detail = 'name' | 'address' | 'city'

const backLink = (t: AdminStrings, to = '/admin/venues') => (
  <Link className="ad-back" to={to}>
    <BackArrowIcon />
    {t.backToVenues}
  </Link>
)

/* ------------------------------------------------------------------ pages */

export function VenueAddPage() {
  return <VenueEditor mode="add" initial={EMPTY} events={0} />
}

export function VenueEditPage() {
  const { venueId = '' } = useParams()
  const t = useAdminStrings()
  const { state, retry } = useAdminResource(
    venueId,
    async () => {
      const [form, events] = await Promise.all([venuesApi.getForm(venueId), adminEventsApi.countAtVenue(venueId)])
      return { form, events }
    },
    (e) => e instanceof VenueNotFoundError,
  )

  if (state.status === 'ready') return <VenueEditor key={venueId} mode="edit" venueId={venueId} initial={state.data.form} events={state.data.events} />

  return (
    <AdminLayout title={t.editVenue} crumbs={[{ label: t.listTitle, to: '/admin/venues' }, { label: t.editVenue }]}>
      {backLink(t)}
      <ResourceStatus
        state={state}
        loading={t.loadingForm}
        rows={4}
        errorTitle={t.venueErrorTitle}
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

type EditorProps = { mode: 'add' | 'edit'; venueId?: string; initial: VenueForm; events: number }

/** The id of the first control for a problem, for focus after a failed save. */
function problemTarget(p: VenueProblem, form: VenueForm) {
  switch (p.field) {
    case 'name':
    case 'address':
    case 'city':
      return `venue-${p.field}`
    case 'section':
      return `venue-section-${form.sections[p.index].rowKey}`
    case 'zone':
      return `venue-zone-${form.zones[p.index].rowKey}`
    case 'category':
      return `venue-category-${form.categories[p.index].rowKey}`
    case 'sections':
      return 'venue-add-section'
    case 'zones':
      return 'venue-add-zone'
    case 'categories':
      return 'venue-add-category'
  }
}

function VenueEditor({ mode, venueId, initial, events }: EditorProps) {
  const t = useAdminStrings()
  const f = useOrdersFormat()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const fmt = f.num

  const [form, setForm] = useState<VenueForm>(initial)
  const [touched, setTouched] = useState<Set<Detail>>(() => new Set())
  const [tried, setTried] = useState(0)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const originalName = initial.name

  const problems = validateVenueForm(form)
  const dirty = !saving && JSON.stringify(form) !== JSON.stringify(initial)
  const guard = useUnsavedChanges(dirty)
  const seated = form.kind === 'seated'
  const capacity = formCapacity(form)
  const detailText: Record<Detail, string> = { name: t.errName, address: t.errAddress, city: t.errCity }
  const showDetail = (key: Detail) => (tried > 0 || touched.has(key)) && problems.some((p) => p.field === key)
  const rowBad = (field: 'section' | 'zone' | 'category', index: number) => tried > 0 && problems.some((p) => p.field === field && 'index' in p && p.index === index)
  const listBad = (field: 'section' | 'zone' | 'category' | 'sections' | 'zones' | 'categories') => tried > 0 && problems.some((p) => p.field === field)
  const codes = form.categories.map((c) => c.code)
  // A venue that events use can grow, but its type stays and nothing already there is removed.
  const inUse = mode === 'edit' && events > 0
  const [existing] = useState(() => new Set([...initial.sections, ...initial.zones].map((item) => item.rowKey)))
  const locked = (item: { rowKey?: string }) => inUse && existing.has(item.rowKey)

  // Which category each section and zone belongs to, by row. While a code is being retyped two
  // categories can briefly share it; following the owner keeps their sections apart.
  const [owners] = useState(() => {
    const map = new Map<string, string>()
    for (const item of [...initial.sections, ...initial.zones]) {
      const owner = initial.categories.find((c) => c.code === item.categoryCode)
      if (item.rowKey && owner?.rowKey) map.set(item.rowKey, owner.rowKey)
    }
    return map
  })
  const assign = (itemKey: string | undefined, code: string) => {
    const owner = form.categories.find((c) => c.code === code)
    if (itemKey && owner?.rowKey) owners.set(itemKey, owner.rowKey)
  }

  // Where focus goes after the next render: a new row, the row after a removal.
  const focusAfter = useRef<string | null>(null)
  useEffect(() => {
    if (!focusAfter.current) return
    document.getElementById(focusAfter.current)?.focus()
    focusAfter.current = null
  })

  // After a failed save, focus the first problem once its message is on screen.
  useEffect(() => {
    if (!tried || !problems[0]) return
    document.getElementById(problemTarget(problems[0], form))?.focus()
    // Only when the admin presses Save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tried])

  const patch = (changes: Partial<VenueForm>) => setForm((current) => ({ ...current, ...changes }))
  function patchItem<K extends 'sections' | 'zones' | 'categories'>(key: K, index: number, changes: Partial<VenueForm[K][number]>) {
    setForm((current) => ({ ...current, [key]: current[key].map((item, i) => (i === index ? { ...item, ...changes } : item)) }))
  }
  function removeItem(key: 'sections' | 'zones', index: number) {
    const items = form[key]
    const neighbour = items[index + 1] ?? items[index - 1]
    const prefix = key === 'sections' ? 'venue-section' : 'venue-zone'
    focusAfter.current = neighbour ? `${prefix}-${neighbour.rowKey}` : key === 'sections' ? 'venue-add-section' : 'venue-add-zone'
    setForm((current) => ({ ...current, [key]: current[key].filter((_, i) => i !== index) }))
  }

  function addItem(key: 'sections' | 'zones') {
    const fresh = rowKey()
    const first = form.categories[0]
    if (first?.rowKey) owners.set(fresh, first.rowKey)
    focusAfter.current = `${key === 'sections' ? 'venue-section' : 'venue-zone'}-${fresh}`
    if (key === 'sections') patch({ sections: [...form.sections, { rowKey: fresh, name: '', firstRow: 'A', lastRow: 'A', seatsPerRow: 10, categoryCode: codes[0] ?? '' }] })
    else patch({ zones: [...form.zones, { rowKey: fresh, name: '', capacity: 100, categoryCode: codes[0] ?? '' }] })
  }

  /** Renaming a category's code keeps the sections and zones that belong to it pointing at it. */
  function changeCode(index: number, code: string) {
    setForm((current) => {
      const category = current.categories[index]
      const mine = (it: { rowKey?: string; categoryCode: string }) =>
        it.rowKey && owners.has(it.rowKey) ? owners.get(it.rowKey) === category.rowKey : it.categoryCode === category.code
      const follow = <T extends { rowKey?: string; categoryCode: string }>(items: T[]) => items.map((it) => (mine(it) ? { ...it, categoryCode: code } : it))
      return {
        ...current,
        categories: current.categories.map((c, i) => (i === index ? { ...c, code } : c)),
        sections: follow(current.sections),
        zones: follow(current.zones),
      }
    })
  }

  /** Removing a category moves its sections and zones to the first remaining one. */
  function removeCategory(index: number) {
    const neighbour = form.categories[index + 1] ?? form.categories[index - 1]
    focusAfter.current = neighbour ? `venue-category-${neighbour.rowKey}` : 'venue-add-category'
    setForm((current) => {
      const removed = current.categories[index]
      const categories = current.categories.filter((_, i) => i !== index)
      const fallback = categories[0]
      const mine = (it: { rowKey?: string; categoryCode: string }) =>
        it.rowKey && owners.has(it.rowKey) ? owners.get(it.rowKey) === removed.rowKey : it.categoryCode === removed.code
      const move = <T extends { rowKey?: string; categoryCode: string }>(items: T[]) =>
        items.map((it) => {
          if (!mine(it)) return it
          if (it.rowKey && fallback?.rowKey) owners.set(it.rowKey, fallback.rowKey)
          return { ...it, categoryCode: fallback?.code ?? '' }
        })
      return { ...current, categories, sections: move(current.sections), zones: move(current.zones) }
    })
  }

  function addCategory() {
    const fresh = rowKey()
    focusAfter.current = `venue-category-${fresh}`
    patch({ categories: [...form.categories, { rowKey: fresh, name: '', code: '', colour: CATEGORY_COLOURS[form.categories.length % CATEGORY_COLOURS.length] }] })
  }

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
      const venue = mode === 'add' ? await venuesApi.create(form) : await venuesApi.update(venueId!, form)
      const toast: VenueToast = { kind: mode === 'add' ? 'added' : 'saved', name: venue.name, id: venue.id }
      navigate('/admin/venues', { state: { toast } })
    } catch (error) {
      setSaving(false)
      setFailure(errorText(error, t.actionFailed))
    }
  }

  async function confirmDelete() {
    setSaving(true)
    try {
      await venuesApi.remove(venueId!)
      const toast: VenueToast = { kind: 'deleted', name: originalName, id: venueId! }
      navigate('/admin/venues', { state: { toast } })
    } catch (error) {
      setSaving(false)
      setConfirming(false)
      setFailure(errorText(error, t.actionFailed))
    }
  }

  const field = (key: Detail | 'country', label: string, placeholder?: string, wide = false) => {
    const show = key !== 'country' && showDetail(key)
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
          onBlur={() => key !== 'country' && setTouched((s) => new Set(s).add(key))}
        />
        {show && (
          <p id={`venue-${key}-error`} className="ad-field-error">
            {detailText[key as Detail]}
          </p>
        )}
      </div>
    )
  }

  const categorySelect = (id: string, label: string, value: string, onChange: (code: string) => void) => (
    <div className="ad-select ad-select--row">
      <select id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {form.categories.map((c) => (
          <option key={c.rowKey ?? c.code} value={c.code}>
            {c.name || c.code}
          </option>
        ))}
      </select>
      <Icon size={16}>
        <path d="m6 9 6 6 6-6" />
      </Icon>
    </div>
  )

  const kinds: Array<{ value: VenueKind; label: string; hint: string }> = [
    { value: 'seated', label: t.seated, hint: t.seatedHint },
    { value: 'standing', label: t.standing, hint: t.standingHint },
  ]
  const title = mode === 'add' ? t.addTitle : `${t.editVenue} · ${originalName}`
  const crumb = mode === 'add' ? t.newVenue : originalName

  return (
    <AdminLayout title={title} crumbs={[{ label: t.listTitle, to: '/admin/venues' }, { label: crumb }]}>
      {backLink(t, mode === 'edit' ? `/admin/venues/${venueId}` : '/admin/venues')}
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

          <section className="ad-card" aria-labelledby="step-categories">
            <div className="ad-card-head ad-card-head--tight">
              <div className="ad-card-title">
                <span className="ad-step" aria-hidden="true">
                  {fmt(2)}
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
                {form.categories.map((c, i) => {
                  const bad = rowBad('category', i)
                  return (
                    <div className="ad-editor-row ad-editor-row--cats" key={c.rowKey ?? i}>
                      <button
                        type="button"
                        className="ad-swatch-btn"
                        aria-label={`${t.changeColour} ${c.name} · ${fillIn(t.colourOf, { n: fmt(CATEGORY_COLOURS.indexOf(c.colour) + 1), total: fmt(CATEGORY_COLOURS.length) })}`}
                        onClick={() => {
                          const next = (CATEGORY_COLOURS.indexOf(c.colour) + 1) % CATEGORY_COLOURS.length
                          patchItem('categories', i, { colour: CATEGORY_COLOURS[next] })
                        }}
                      >
                        <span style={{ background: c.colour }} />
                      </button>
                      <input
                        id={`venue-category-${c.rowKey}`}
                        aria-label={`${t.categoryName} ${fmt(i + 1)}`}
                        value={c.name}
                        required
                        aria-invalid={bad && !c.name.trim()}
                        aria-describedby={bad ? 'venue-categories-error' : undefined}
                        onChange={(e) => patchItem('categories', i, { name: e.target.value })}
                      />
                      <input
                        className="ad-mono"
                        dir="ltr"
                        aria-label={`${t.categoryCode} ${fmt(i + 1)}`}
                        value={c.code}
                        required
                        aria-invalid={bad && (!c.code.trim() || codes.indexOf(c.code) !== i)}
                        aria-describedby={bad ? 'venue-categories-error' : undefined}
                        onChange={(e) => changeCode(i, e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                      />
                      {form.categories.length > 1 ? (
                        <RemoveButton label={`${t.remove} ${c.name}`} onClick={() => removeCategory(i)} />
                      ) : (
                        <span />
                      )}
                    </div>
                  )
                })}
                <button
                  id="venue-add-category"
                  type="button"
                  className="ad-add-row"
                  onClick={addCategory}
                >
                  <PlusIcon size={16} />
                  {t.addCategory}
                </button>
                {(listBad('category') || listBad('categories')) && (
                  <p id="venue-categories-error" className="ad-field-error">
                    {listBad('categories') ? t.errCategories : t.errCategory}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="ad-card" aria-labelledby="step-layout">
            <div className="ad-card-head ad-card-head--tight">
              <div className="ad-card-title">
                <span className="ad-step" aria-hidden="true">
                  {fmt(3)}
                </span>
                <h2 id="step-layout" className="ad-card-h">
                  {t.stepLayout}
                </h2>
              </div>
            </div>
            <div className="ad-form-body">
              {inUse && (
                <p id="venue-layout-locked" className="ev-hint">
                  {t.layoutLocked}
                </p>
              )}
              <fieldset className="ad-kind-cards" aria-describedby={inUse ? 'venue-layout-locked' : undefined}>
                <legend className="ad-sr-only">{t.stepLayout}</legend>
                {kinds.map((k) => (
                  <label key={k.value} className="ad-kind-card">
                    <input
                      type="radio"
                      name="venue-kind"
                      value={k.value}
                      checked={form.kind === k.value}
                      disabled={inUse && k.value !== initial.kind}
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
                    <span>{t.sectionCategory}</span>
                    <span className="ad-end">{t.seatsCol}</span>
                    <span />
                  </div>
                  {form.sections.map((s, i) => {
                    const bad = rowBad('section', i)
                    const describe = bad ? 'venue-sections-error' : undefined
                    const label = s.name || `${t.sectionName} ${fmt(i + 1)}`
                    return (
                      <div className="ad-editor-row ad-editor-row--sections" key={s.rowKey ?? i}>
                        <input
                          id={`venue-section-${s.rowKey}`}
                          aria-label={`${t.sectionName} ${fmt(i + 1)}`}
                          value={s.name}
                          required
                          aria-invalid={bad && !s.name.trim()}
                          aria-describedby={describe}
                          onChange={(e) => patchItem('sections', i, { name: e.target.value })}
                        />
                        <input
                          className="ad-mono"
                          dir="ltr"
                          aria-label={`${t.firstRow} · ${label}`}
                          maxLength={1}
                          value={s.firstRow}
                          aria-invalid={bad && rowRange(s.firstRow, s.lastRow).length === 0}
                          aria-describedby={describe}
                          onChange={(e) => patchItem('sections', i, { firstRow: e.target.value.toUpperCase() })}
                        />
                        <input
                          className="ad-mono"
                          dir="ltr"
                          aria-label={`${t.lastRow} · ${label}`}
                          maxLength={1}
                          value={s.lastRow}
                          aria-invalid={bad && rowRange(s.firstRow, s.lastRow).length === 0}
                          aria-describedby={describe}
                          onChange={(e) => patchItem('sections', i, { lastRow: e.target.value.toUpperCase() })}
                        />
                        <input
                          inputMode="numeric"
                          dir="ltr"
                          aria-label={`${t.seatsPerRow} · ${label}`}
                          value={String(s.seatsPerRow)}
                          aria-invalid={bad && (s.seatsPerRow < 1 || s.seatsPerRow > MAX_SEATS_PER_ROW)}
                          aria-describedby={describe}
                          onChange={(e) => patchItem('sections', i, { seatsPerRow: parseWhole(e.target.value, 999) })}
                        />
                        {categorySelect(`venue-section-cat-${s.rowKey}`, `${t.sectionCategory} · ${label}`, s.categoryCode, (code) => {
                          assign(s.rowKey, code)
                          patchItem('sections', i, { categoryCode: code })
                        })}
                        <strong className="ad-end">{fmt(rowRange(s.firstRow, s.lastRow).length * s.seatsPerRow)}</strong>
                        {locked(s) ? <span /> : <RemoveButton label={`${t.remove} ${label}`} onClick={() => removeItem('sections', i)} />}
                      </div>
                    )
                  })}
                  <button
                    id="venue-add-section"
                    type="button"
                    className="ad-add-row"
                    onClick={() => addItem('sections')}
                  >
                    <PlusIcon size={16} />
                    {t.addSection}
                  </button>
                  {(listBad('section') || listBad('sections')) && (
                    <p id="venue-sections-error" className="ad-field-error">
                      {listBad('sections') ? t.errSections : t.errSection}
                    </p>
                  )}
                </div>
              ) : (
                <div className="ad-editor">
                  <h3>{t.zones}</h3>
                  <div className="ad-editor-head ad-editor-row--zones" aria-hidden="true">
                    <span>{t.zoneName}</span>
                    <span>{t.zoneCapacity}</span>
                    <span>{t.sectionCategory}</span>
                    <span />
                  </div>
                  {form.zones.map((z, i) => {
                    const bad = rowBad('zone', i)
                    const describe = bad ? 'venue-zones-error' : undefined
                    const label = z.name || `${t.zoneName} ${fmt(i + 1)}`
                    return (
                      <div className="ad-editor-row ad-editor-row--zones" key={z.rowKey ?? i}>
                        <input
                          id={`venue-zone-${z.rowKey}`}
                          aria-label={`${t.zoneName} ${fmt(i + 1)}`}
                          value={z.name}
                          required
                          aria-invalid={bad && !z.name.trim()}
                          aria-describedby={describe}
                          onChange={(e) => patchItem('zones', i, { name: e.target.value })}
                        />
                        <input
                          inputMode="numeric"
                          dir="ltr"
                          aria-label={`${t.zoneCapacity} · ${label}`}
                          value={String(z.capacity)}
                          aria-invalid={bad && z.capacity < 1}
                          aria-describedby={describe}
                          onChange={(e) => patchItem('zones', i, { capacity: parseWhole(e.target.value, 100_000) })}
                        />
                        {categorySelect(`venue-zone-cat-${z.rowKey}`, `${t.sectionCategory} · ${label}`, z.categoryCode, (code) => {
                          assign(z.rowKey, code)
                          patchItem('zones', i, { categoryCode: code })
                        })}
                        {locked(z) ? <span /> : <RemoveButton label={`${t.remove} ${label}`} onClick={() => removeItem('zones', i)} />}
                      </div>
                    )
                  })}
                  <button
                    id="venue-add-zone"
                    type="button"
                    className="ad-add-row"
                    onClick={() => addItem('zones')}
                  >
                    <PlusIcon size={16} />
                    {t.addZone}
                  </button>
                  {(listBad('zone') || listBad('zones')) && (
                    <p id="venue-zones-error" className="ad-field-error">
                      {listBad('zones') ? t.errZones : t.errZone}
                    </p>
                  )}
                </div>
              )}
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
              {tried > 0 && problems.length > 0 && (
                // Keyed by the attempt, so every failed save is announced again.
                <p key={tried} className="ad-error-summary" role="alert">
                  {t.errFix}
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
                {saving ? t.saving : mode === 'add' ? t.saveVenue : t.saveChanges}
              </button>
              <Link className="ad-secondary" to={mode === 'edit' ? `/admin/venues/${venueId}` : '/admin/venues'}>
                {t.cancel}
              </Link>
            </div>
          </section>

          {mode === 'edit' &&
            (events === 0 ? (
              <section className="ad-card ad-danger-card" aria-labelledby="danger-title">
                <h2 id="danger-title">{t.dangerTitle}</h2>
                <p>{t.deleteText}</p>
                <button type="button" className="ad-danger-outline" onClick={() => setConfirming(true)}>
                  <TrashIcon size={16} />
                  {t.deleteVenue}
                </button>
              </section>
            ) : (
              <section className="ad-card" aria-labelledby="in-use-title">
                <h2 id="in-use-title" className="ad-card-h ad-card-h--bar">
                  {t.inUseTitle}
                </h2>
                <p className="ev-card-text">{t.inUseText}</p>
              </section>
            ))}
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

      {guard.pending && (
        <ConfirmDialog
          title={t.unsavedTitle}
          text={t.unsavedText}
          confirmLabel={t.leavePage}
          cancelLabel={t.keepEditing}
          onConfirm={guard.leave}
          onCancel={guard.stay}
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
