import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminEventsApi, EventNotFoundError, waveStates, type CategoryForm, type EventDetail } from '../../lib/adminEventsApi'
import { ConfirmDialog, ModalDialog, PlusIcon, TrashIcon } from './AdminFeedback'
import { AdminHero, AdminLayout, BackArrowIcon, Icon, LockIcon, ResourceStatus } from './AdminLayout'
import { useAdminStrings } from './adminStrings'
import { parseWhole, plural } from './adminText'
import { useErrorText } from './errorStrings'
import { canMoveWave, hasTicketProblems, ticketProblems, WAVE_TONE, waveChanges, waveLabel, type WaveChange } from './eventRules'
import { ArrowDownIcon, ArrowUpIcon, Badge } from './EventsParts'
import { useEventsStrings, type EventsStrings, type EventToast } from './eventsStrings'
import { AlertIcon } from './OrdersParts'
import { fillIn, useOrdersFormat } from './ordersStrings'
import { useAdminResource } from './useAdminResource'
import { useUnsavedChanges } from './useUnsavedChanges'
import './Events.css'

/** Rows in the editor carry a client-side id, so keys and focus survive removing a row. */
type Row<T> = T & { rowId: string }
type WaveRow = Row<CategoryForm['waves'][number]>
type CategoryRow = Row<Omit<CategoryForm, 'waves'>> & { waves: WaveRow[] }

let nextRow = 0
const rowId = () => `row-${++nextRow}`

/** Category codes are upper case letters, digits and underscores, like the venue seat categories. */
const toCode = (text: string) =>
  text
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

const toForms = (rows: CategoryRow[]): CategoryForm[] =>
  rows.map(({ key, name, waves }) => ({ key, name, waves: waves.map(({ id, name: n, price, capacity, sold }) => ({ id, name: n, price, capacity, sold })) }))

export default function EventTicketsPage() {
  const { eventId = '' } = useParams()
  const t = useEventsStrings()
  const { state, retry } = useAdminResource(eventId, () => adminEventsApi.get(eventId), (e) => e instanceof EventNotFoundError)

  if (state.status === 'ready') return <TicketsEditor key={eventId} detail={state.data} />

  return (
    <AdminLayout title={t.ticketsTitle} crumbs={[{ label: t.listTitle, to: '/admin/events' }, { label: t.ticketsTitle }]}>
      <Link className="ad-back" to={`/admin/events/${eventId}`}>
        <BackArrowIcon />
        {t.backToEvents}
      </Link>
      <ResourceStatus
        state={state}
        loading={t.loadingTickets}
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

function TicketsEditor({ detail }: { detail: EventDetail }) {
  const { event, categories: initial } = detail
  const t = useEventsStrings()
  const a = useAdminStrings()
  const f = useOrdersFormat()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const detailUrl = `/admin/events/${event.id}`

  const [rows, setRows] = useState<CategoryRow[]>(() =>
    initial.map((c) => ({ rowId: rowId(), key: c.key, name: c.name, waves: c.waves.map((w) => ({ ...w, rowId: rowId() })) })),
  )
  const [tried, setTried] = useState(0)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [review, setReview] = useState<WaveChange[] | null>(null)
  const focusAfter = useRef<string | null>(null)

  const readOnly = event.status === 'cancelled' || event.isPast
  const forms = toForms(rows)
  const problems = ticketProblems(forms)
  const invalid = hasTicketProblems(problems)
  const dirty = !saving && JSON.stringify(forms) !== JSON.stringify(toForms(initialRows(initial)))
  const guard = useUnsavedChanges(dirty && !readOnly)
  const soldKeys = new Set(initial.filter((c) => c.sold > 0).map((c) => c.key))
  const allWaves = forms.flatMap((c) => c.waves)

  // Move focus once the DOM shows the change: a new row, the row after a removal, or the first problem.
  useEffect(() => {
    if (!focusAfter.current) return
    document.getElementById(focusAfter.current)?.focus()
    focusAfter.current = null
  })

  const setCategory = (ci: number, changes: Partial<CategoryRow>) => setRows((list) => list.map((c, j) => (j === ci ? { ...c, ...changes } : c)))
  const setWave = (ci: number, wi: number, changes: Partial<WaveRow>) =>
    setRows((list) => list.map((c, j) => (j === ci ? { ...c, waves: c.waves.map((w, k) => (k === wi ? { ...w, ...changes } : w)) } : c)))

  function addWave(ci: number) {
    const c = rows[ci]
    const last = c.waves[c.waves.length - 1]
    const row: WaveRow = { rowId: rowId(), name: fillIn(t.newWave, { n: f.num(c.waves.length + 1) }), price: last?.price ?? 0, capacity: last?.capacity ?? 100, sold: 0 }
    setCategory(ci, { waves: [...c.waves, row] })
    focusAfter.current = `${row.rowId}-name`
  }

  function removeWave(ci: number, wi: number) {
    const c = rows[ci]
    const neighbour = c.waves[wi - 1] ?? c.waves[wi + 1]
    setCategory(ci, { waves: c.waves.filter((_, k) => k !== wi) })
    focusAfter.current = neighbour ? `${neighbour.rowId}-name` : `${c.rowId}-add`
  }

  function moveWave(ci: number, wi: number, to: number) {
    const waves = [...rows[ci].waves]
    const [moved] = waves.splice(wi, 1)
    waves.splice(to, 0, moved)
    setCategory(ci, { waves })
    focusAfter.current = `${moved.rowId}-${to < wi ? 'up' : 'down'}`
  }

  function addCategory() {
    const row: CategoryRow = { rowId: rowId(), key: '', name: '', waves: [{ rowId: rowId(), name: fillIn(t.newWave, { n: f.num(1) }), price: 0, capacity: 100, sold: 0 }] }
    setRows((list) => [...list, row])
    focusAfter.current = `${row.rowId}-name`
  }

  function removeCategory(ci: number) {
    const neighbour = rows[ci - 1] ?? rows[ci + 1]
    setRows((list) => list.filter((_, j) => j !== ci))
    focusAfter.current = neighbour ? `${neighbour.rowId}-name` : 'add-category'
  }

  function firstProblemId() {
    for (let ci = 0; ci < problems.length; ci++) {
      const p = problems[ci]
      const row = rows[ci]
      if (p.name) return `${row.rowId}-name`
      if (p.code) return `${row.rowId}-code`
      const wi = Number(Object.keys(p.waves)[0])
      if (!Number.isNaN(wi)) return `${row.waves[wi].rowId}-${p.waves[wi] === 'name' ? 'name' : 'qty'}`
      if (p.noWave) return `${row.rowId}-add`
    }
    return null
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (saving || readOnly) return
    if (invalid) {
      setTried((n) => n + 1)
      focusAfter.current = firstProblemId()
      return
    }
    // Customers may be buying a published event's tickets right now: show what changes first.
    if (event.status === 'published') {
      setReview(waveChanges(initial, forms))
      return
    }
    void save()
  }

  async function save() {
    setSaving(true)
    setFailure(null)
    try {
      await adminEventsApi.saveCategories(event.id, forms)
      const toast: EventToast = { kind: 'tickets', name: event.name, id: event.id }
      navigate(detailUrl, { state: { toast } })
    } catch (error) {
      setSaving(false)
      setReview(null)
      setFailure(errorText(error, t.failed))
    }
  }

  const showProblems = tried > 0

  return (
    <AdminLayout
      title={`${t.ticketsTitle} · ${event.name}`}
      crumbs={[{ label: t.listTitle, to: '/admin/events' }, { label: event.name, to: detailUrl }, { label: t.ticketsTitle }]}
    >
      <Link className="ad-back" to={detailUrl}>
        <BackArrowIcon />
        {fillIn(t.backToEvent, { name: event.name })}
      </Link>
      <AdminHero eyebrow={t.ticketsTitle} title={event.name}>
        <p className="ad-hero-lead">{t.ticketsLead}</p>
      </AdminHero>

      {readOnly && (
        <p className="ev-note" role="note">
          <AlertIcon />
          {t.readOnlyTickets}
        </p>
      )}

      <form className="ad-form-grid" onSubmit={submit} noValidate>
        <fieldset className="ad-form-main ev-fieldset" disabled={readOnly}>
          <legend className="ad-sr-only">{t.ticketCategories}</legend>
          {rows.length === 0 && (
            <p className="od-empty-note ad-card">
              <span aria-hidden="true">
                <AlertIcon size={20} />
              </span>
              {t.noCatsYet}
            </p>
          )}

          {rows.map((c, ci) => {
            const states = waveStates(c.waves)
            const p = problems[ci]
            const hasSales = soldKeys.has(c.key)
            const label = c.name || `${t.categoryWord} ${f.num(ci + 1)}`
            const lockedHint = `${c.rowId}-locked`
            return (
              <section className="ad-card" key={c.rowId} aria-labelledby={`${c.rowId}-title`}>
                <div className="ad-card-head ad-card-head--tight">
                  <div className="ad-card-title">
                    <span className="ad-step" aria-hidden="true">
                      {f.num(ci + 1)}
                    </span>
                    <h2 id={`${c.rowId}-title`} className="ad-card-h">
                      {label}
                    </h2>
                  </div>
                  {hasSales ? (
                    <span className="ev-lock-chip">
                      <LockIcon />
                      {t.catHasSales}
                    </span>
                  ) : (
                    <button type="button" className="ad-icon-action ad-icon-action--danger" aria-label={`${t.removeCategory} ${label}`} title={t.removeCategory} onClick={() => removeCategory(ci)}>
                      <TrashIcon />
                    </button>
                  )}
                </div>

                <div className="ad-fields">
                  <CategoryField
                    id={`${c.rowId}-name`}
                    label={t.catName}
                    value={c.name}
                    error={showProblems && p.name ? t.errCatName : null}
                    onChange={(v) => setCategory(ci, { name: v })}
                    onBlur={() => !c.key && setCategory(ci, { key: toCode(c.name) })}
                  />
                  <CategoryField
                    id={`${c.rowId}-code`}
                    label={t.catCode}
                    value={c.key}
                    mono
                    readOnly={hasSales}
                    error={showProblems && p.code ? t.errCatCode : null}
                    onChange={(v) => setCategory(ci, { key: v.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                  />
                </div>

                <div className="ad-form-body ev-waves">
                  <div className="ad-editor">
                    <div className="ad-editor-head ev-wave-row" aria-hidden="true">
                      <span>{t.waveCol}</span>
                      <span>{t.priceCol}</span>
                      <span>{t.qtyCol}</span>
                      <span className="ad-end">{t.soldCol}</span>
                      <span>{t.stateCol}</span>
                      <span />
                    </div>
                    {c.waves.map((w, wi) => {
                      const locked = w.sold > 0
                      const problem = showProblems ? p.waves[wi] : undefined
                      const errorId = `${w.rowId}-error`
                      const waveName = w.name || `${t.waveCol} ${f.num(wi + 1)}`
                      const errorMessage =
                        problem === 'name'
                          ? t.errWaveName
                          : problem === 'capacity'
                            ? w.sold > 0
                              ? fillIn(t.errWaveCapacity, { n: f.num(w.sold), sold: f.num(w.sold) })
                              : t.errWaveEmpty
                            : null
                      return (
                        <div className="ev-wave" key={w.rowId}>
                          <div className="ad-editor-row ev-wave-row">
                            <label className="ev-cell">
                              <span className="ev-cell-label">{t.waveCol}</span>
                              <input
                                id={`${w.rowId}-name`}
                                aria-label={`${t.waveCol} ${f.num(wi + 1)} · ${label}`}
                                value={w.name}
                                required
                                aria-invalid={problem === 'name'}
                                aria-describedby={problem === 'name' ? errorId : undefined}
                                onChange={(e) => setWave(ci, wi, { name: e.target.value })}
                              />
                            </label>
                            <label className="ev-cell">
                              <span className="ev-cell-label">{t.priceCol}</span>
                              <input
                                inputMode="numeric"
                                dir="ltr"
                                aria-label={`${t.priceCol} · ${waveName} · ${label}`}
                                value={String(w.price)}
                                readOnly={locked}
                                aria-describedby={locked ? lockedHint : undefined}
                                onChange={(e) => setWave(ci, wi, { price: parseWhole(e.target.value) })}
                              />
                            </label>
                            <label className="ev-cell">
                              <span className="ev-cell-label">{t.qtyCol}</span>
                              <input
                                id={`${w.rowId}-qty`}
                                inputMode="numeric"
                                dir="ltr"
                                aria-label={`${t.qtyCol} · ${waveName} · ${label}`}
                                value={String(w.capacity)}
                                required
                                aria-invalid={problem === 'capacity'}
                                aria-describedby={problem === 'capacity' ? errorId : undefined}
                                onChange={(e) => setWave(ci, wi, { capacity: parseWhole(e.target.value) })}
                              />
                            </label>
                            <span className="ad-end ev-cell">
                              <span className="ev-cell-label">{t.soldCol}</span>
                              <strong>
                                <span className="ad-sr-only">{t.soldLabel}: </span>
                                {f.num(w.sold)}
                              </strong>
                            </span>
                            <span className="ev-cell">
                              <span className="ad-sr-only">{t.stateLabel}: </span>
                              <Badge tone={WAVE_TONE[states[wi]]} label={waveLabel(t, states[wi])} />
                            </span>
                            <span className="ev-wave-actions">
                              {!locked && (
                                <>
                                  {canMoveWave(c.waves, wi, wi - 1) && (
                                    <button id={`${w.rowId}-up`} type="button" className="ad-icon-action" aria-label={`${t.moveUp} ${waveName}`} title={t.moveUp} onClick={() => moveWave(ci, wi, wi - 1)}>
                                      <ArrowUpIcon />
                                    </button>
                                  )}
                                  {canMoveWave(c.waves, wi, wi + 1) && (
                                    <button id={`${w.rowId}-down`} type="button" className="ad-icon-action" aria-label={`${t.moveDown} ${waveName}`} title={t.moveDown} onClick={() => moveWave(ci, wi, wi + 1)}>
                                      <ArrowDownIcon />
                                    </button>
                                  )}
                                  <button type="button" className="ad-icon-action" aria-label={`${t.removeWave} ${waveName}`} title={t.removeWave} onClick={() => removeWave(ci, wi)}>
                                    <TrashIcon size={16} />
                                  </button>
                                </>
                              )}
                              {locked && (
                                <span className="ev-lock-chip ev-lock-chip--small" title={t.priceLocked}>
                                  <LockIcon />
                                  {t.waveHasSales}
                                </span>
                              )}
                            </span>
                          </div>
                          {errorMessage && (
                            <p id={errorId} className="ad-field-error ev-row-error">
                              {waveName}: {errorMessage}
                            </p>
                          )}
                        </div>
                      )
                    })}
                    {c.waves.some((w) => w.sold > 0) && (
                      <p id={lockedHint} className="ev-hint">
                        <LockIcon /> {t.priceLocked}
                      </p>
                    )}
                    <button id={`${c.rowId}-add`} type="button" className="ad-add-row" onClick={() => addWave(ci)}>
                      <PlusIcon size={16} />
                      {t.addWave}
                    </button>
                    {showProblems && p.noWave && <p className="ad-field-error">{t.errNoWave}</p>}
                  </div>
                </div>

                <div className="ad-card-foot">
                  {fillIn(t.catTotal, {
                    tickets: plural(f.lang, c.waves.reduce((n, w) => n + w.capacity, 0), t.ticketsCount, f.num(c.waves.reduce((n, w) => n + w.capacity, 0))),
                    waves: plural(f.lang, c.waves.length, t.wavesCount, f.num(c.waves.length)),
                  })}
                </div>
              </section>
            )
          })}

          <button id="add-category" type="button" className="ad-add-row" onClick={addCategory}>
            <PlusIcon size={16} />
            {t.addCategory}
          </button>
        </fieldset>

        <aside className="ad-form-side">
          <section className="ad-card ad-summary" aria-labelledby="tickets-summary-title">
            <h2 id="tickets-summary-title" className="ad-card-h ad-card-h--bar">
              {t.summary}
            </h2>
            <dl className="ad-info">
              <div>
                <dt>{t.sCategories}</dt>
                <dd>{f.num(forms.length)}</dd>
              </div>
              <div>
                <dt>{t.sTickets}</dt>
                <dd>{f.num(allWaves.reduce((n, w) => n + w.capacity, 0))}</dd>
              </div>
              <div>
                <dt>{t.sSold}</dt>
                <dd>{f.num(allWaves.reduce((n, w) => n + w.sold, 0))}</dd>
              </div>
              <div className="ad-summary-total">
                <dt>{t.sRevenue}</dt>
                <dd>{f.money(allWaves.reduce((n, w) => n + w.price * w.capacity, 0))}</dd>
              </div>
            </dl>
            <div className="ad-summary-actions">
              {showProblems && invalid && (
                <p className="ad-error-summary" role="alert">
                  {t.errSummary}
                </p>
              )}
              {failure && (
                <p className="ad-error-summary" role="alert">
                  {failure}
                </p>
              )}
              {!readOnly && (
                <button type="submit" className="ad-primary" aria-disabled={saving || undefined}>
                  <Icon>
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </Icon>
                  {saving ? t.saving : t.saveTickets}
                </button>
              )}
              <Link className="ad-secondary" to={detailUrl}>
                {t.cancel}
              </Link>
            </div>
          </section>
        </aside>
      </form>

      {review && <ReviewDialog t={t} changes={review} money={f.money} num={f.num} busy={saving} onCancel={() => setReview(null)} onConfirm={save} />}

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

function initialRows(initial: EventDetail['categories']): CategoryRow[] {
  return initial.map((c) => ({ rowId: '', key: c.key, name: c.name, waves: c.waves.map((w) => ({ ...w, rowId: '' })) }))
}

type FieldProps = {
  id: string
  label: string
  value: string
  error: string | null
  mono?: boolean
  readOnly?: boolean
  onChange: (value: string) => void
  onBlur?: () => void
}

function CategoryField({ id, label, value, error, mono, readOnly, onChange, onBlur }: FieldProps) {
  return (
    <div className="ad-field">
      <label htmlFor={id}>
        {label}
        <span className="ad-required" aria-hidden="true">
          {' '}
          *
        </span>
      </label>
      <input
        id={id}
        className={mono ? 'ad-mono' : undefined}
        dir={mono ? 'ltr' : undefined}
        value={value}
        placeholder="VIP"
        required
        readOnly={readOnly}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {error && (
        <p id={`${id}-error`} className="ad-field-error">
          {error}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- review */

type ReviewProps = {
  t: EventsStrings
  changes: WaveChange[]
  money: (n: number) => string
  num: (n: number) => string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** The review step before changing tickets on a published event. */
function ReviewDialog({ t, changes, money, num, busy, onCancel, onConfirm }: ReviewProps) {
  const id = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  const describe = (c: WaveChange) => {
    switch (c.kind) {
      case 'category-added':
        return fillIn(t.chgCategoryAdded, { category: c.category })
      case 'category-removed':
        return fillIn(t.chgCategoryRemoved, { category: c.category })
      case 'wave-added':
        return fillIn(t.chgWaveAdded, { category: c.category, wave: c.wave, price: money(c.price), capacity: num(c.capacity) })
      case 'wave-removed':
        return fillIn(t.chgWaveRemoved, { category: c.category, wave: c.wave })
      case 'price':
        return fillIn(t.chgPrice, { category: c.category, wave: c.wave, from: money(c.from), to: money(c.to) })
      case 'capacity':
        return fillIn(t.chgCapacity, { category: c.category, wave: c.wave, from: num(c.from), to: num(c.to) })
      case 'on-sale':
        return fillIn(t.chgOnSale, { category: c.category, from: c.from ?? t.nothingOnSale, to: c.to ?? t.nothingOnSale })
    }
  }

  return (
    <ModalDialog labelledBy={`${id}-title`} describedBy={`${id}-lead`} className="ad-dialog--primary od-refund" busy={busy} onCancel={onCancel} initialFocus={cancelRef}>
      <div className="ad-dialog-head">
        <span className="ad-dialog-icon" aria-hidden="true">
          <AlertIcon size={22} />
        </span>
        <div>
          <h2 id={`${id}-title`}>{t.reviewTitle}</h2>
          <p id={`${id}-lead`}>{changes.length ? t.reviewLead : t.noChanges}</p>
        </div>
      </div>
      {changes.length > 0 && (
        <ul className="ev-change-list">
          {changes.map((c, i) => (
            <li key={i} className={c.kind === 'on-sale' ? 'is-highlight' : undefined}>
              {describe(c)}
            </li>
          ))}
        </ul>
      )}
      <div className="ad-dialog-actions">
        <button ref={cancelRef} type="button" className="ad-secondary" onClick={() => !busy && onCancel()} aria-disabled={busy || undefined}>
          {t.cancel}
        </button>
        <button type="button" className="ad-primary" onClick={() => !busy && onConfirm()} aria-disabled={busy || undefined}>
          {busy ? t.saving : t.reviewConfirm}
        </button>
      </div>
    </ModalDialog>
  )
}
