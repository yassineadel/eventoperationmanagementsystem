import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  venuesApi,
  VenueNotFoundError,
  type SeatSection,
  type VenueCategory,
  type VenueDetail,
  type VenueLayout,
} from '../../lib/venuesApi'
import { usePreferences } from '../Auth/preferences'
import { ConfirmDialog, PencilIcon, TrashIcon } from './AdminFeedback'
import { fill } from './venueMessages'
import { AdminHero, AdminLayout, BackArrowIcon, Icon, LoadingPanel, MessagePanel, RetryButton } from './AdminLayout'
import { useAdminStrings, type AdminStrings } from './adminStrings'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; detail: VenueDetail }

const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5, 1.8]
const DEFAULT_ZOOM = 2

function tint(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/* ------------------------------------------------------------ seat map */

type MapProps = {
  layout: VenueLayout
  active: string | null
  zoom: number
  t: AdminStrings
}

type SeatSectionProps = {
  section: SeatSection
  categories: Record<string, VenueCategory>
  active: string | null
  t: AdminStrings
}

function SeatSectionView({ section, categories, active, t }: SeatSectionProps) {
  return (
    <div className="ad-section">
      <span className="ad-section-name">{section.name}</span>
      <div className="ad-rows">
        {section.rows.map((row) => (
          <div className="ad-row" key={row.label}>
            <span className="ad-row-label" aria-hidden="true">
              {row.label}
            </span>
            {row.seats.map((seat) => (
              <span
                key={seat.id}
                className={active && active !== seat.categoryKey ? 'ad-seat is-dim' : 'ad-seat'}
                style={{ background: categories[seat.categoryKey].colour }}
                title={`${t.seat} ${row.label}${seat.number} · ${section.name} · ${categories[seat.categoryKey].name} · ${t.id} ${seat.id}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function SeatMap({ layout, active, zoom, t }: MapProps) {
  if (layout.kind !== 'seated') return null
  const categories = Object.fromEntries(layout.categories.map((c) => [c.key, c]))
  const front = layout.sections.filter((s) => s.tier === 'front')
  const back = layout.sections.filter((s) => s.tier === 'back')
  const style = { '--ad-zoom': zoom } as CSSProperties

  return (
    <div className="ad-map ad-map--dots" tabIndex={0} role="region" aria-label={t.seatMap}>
      <div className="ad-seatmap" style={style}>
        <div className="ad-stage">{t.stage}</div>
        <div className="ad-sections">
          {front.map((s) => (
            <SeatSectionView key={s.id} section={s} categories={categories} active={active} t={t} />
          ))}
        </div>
        {back.map((s) => (
          <SeatSectionView key={s.id} section={s} categories={categories} active={active} t={t} />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ zone map */

function ZoneMap({ layout, active, zoom, t, fmt, dark }: MapProps & { fmt: (n: number) => string; dark: boolean }) {
  if (layout.kind !== 'standing') return null
  const colours = Object.fromEntries(layout.categories.map((c) => [c.key, c.colour]))
  const rectStyle = (r: { x: number; y: number; w: number; h: number }): CSSProperties => ({
    insetInlineStart: `${r.x}%`,
    top: `${r.y}%`,
    width: `${r.w}%`,
    height: `${r.h}%`,
  })

  return (
    <div className="ad-map" tabIndex={0} role="region" aria-label={t.zoneMap}>
      <div className="ad-plan-wrap">
        <div className="ad-plan" style={{ width: Math.round(640 * zoom), height: Math.round(440 * zoom) }}>
          <span className="ad-tick ad-tick--x0" aria-hidden="true">0</span>
          <span className="ad-tick ad-tick--x50" aria-hidden="true">50</span>
          <span className="ad-tick ad-tick--x100" aria-hidden="true">100</span>
          <span className="ad-tick ad-tick--y50" aria-hidden="true">50</span>
          <span className="ad-tick ad-tick--y100" aria-hidden="true">100</span>
          <div className="ad-stage ad-stage--plan" style={rectStyle(layout.stage)}>
            {t.stage}
          </div>
          {layout.zones.map((z) => {
            const colour = colours[z.categoryKey]
            const coords = `x ${z.rect.x} · y ${z.rect.y} · ${z.rect.w} × ${z.rect.h}`
            return (
              <div
                key={z.id}
                className={active && active !== z.categoryKey ? 'ad-zone is-dim' : 'ad-zone'}
                style={{ ...rectStyle(z.rect), borderColor: colour, background: tint(colour, dark ? 0.26 : 0.14) }}
                title={`${z.name} · ${z.categoryKey} · ${fmt(z.capacity)} ${t.placesWord} · ${coords}`}
              >
                <span>
                  <strong>{z.name}</strong>
                  <span className="ad-mono">{z.categoryKey}</span>
                </span>
                <span className="ad-zone-foot">
                  {fmt(z.capacity)} {t.placesWord}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- side panels */

type CategoriesProps = {
  categories: VenueCategory[]
  active: string | null
  onPick: (key: string | null) => void
  hint: string
  unit: string
  fmt: (n: number) => string
  t: AdminStrings
}

function CategoriesPanel({ categories, active, onPick, hint, unit, fmt, t }: CategoriesProps) {
  return (
    <section className="ad-card" aria-labelledby="cats-title" data-scroll-reveal="">
      <div className="ad-card-head ad-card-head--tight">
        <div>
          <h2 id="cats-title" className="ad-card-h">
            {t.categories}
          </h2>
          <p className="ad-card-sub">{hint}</p>
        </div>
        {active && (
          <button type="button" className="ad-tint-btn ad-tint-btn--small" onClick={() => onPick(null)}>
            {t.showAll}
          </button>
        )}
      </div>
      <ul className="ad-cats">
        {categories.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              aria-pressed={active === c.key}
              onClick={() => onPick(active === c.key ? null : c.key)}
              style={{ borderColor: active === c.key ? c.colour : undefined }}
            >
              <span className="ad-swatch" style={{ background: c.colour }} aria-hidden="true" />
              <span className="ad-cat-text">
                <span>
                  <strong>{c.name}</strong>
                  <span className="ad-mono">{c.key}</span>
                </span>
                <span className="ad-muted">{c.area}</span>
              </span>
              <span className="ad-cat-count">
                <strong>{fmt(c.places)}</strong>
                <span>{unit}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------------------------------------------------------------- page */

// Keyed by the venue ID so moving to another venue starts from a fresh loading state.
export default function VenueDetailPage() {
  const { venueId = '' } = useParams()
  return <VenueDetail key={venueId} venueId={venueId} />
}

function VenueDetail({ venueId }: { venueId: string }) {
  const t = useAdminStrings()
  const { lang, theme } = usePreferences()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const fmt = useCallback((n: number) => n.toLocaleString(locale), [locale])

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [active, setActive] = useState<string | null>(null)
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    venuesApi
      .get(venueId)
      .then((detail) => !cancelled && setState({ status: 'ready', detail }))
      .catch((err) => !cancelled && setState({ status: err instanceof VenueNotFoundError ? 'not-found' : 'error' }))
    return () => {
      cancelled = true
    }
  }, [venueId, attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  const backLink = (
    <Link className="ad-back" to="/admin/venues">
      <BackArrowIcon />
      {t.backToVenues}
    </Link>
  )

  if (state.status !== 'ready') {
    return (
      <AdminLayout title={t.detailEyebrow} crumbs={[{ label: t.listTitle, to: '/admin/venues' }, { label: t.detailEyebrow }]}>
        {backLink}
        {state.status === 'loading' && <LoadingPanel label={t.loadingVenue} rows={4} />}
        {state.status === 'error' && (
          <MessagePanel
            tone="error"
            title={t.venueErrorTitle}
            text={t.errorText}
            action={<RetryButton label={t.tryAgain} onClick={retry} />}
          />
        )}
        {state.status === 'not-found' && <MessagePanel tone="empty" title={t.notFoundTitle} text={t.notFoundText} />}
      </AdminLayout>
    )
  }

  const { venue, layout } = state.detail

  async function confirmDelete() {
    setBusy(true)
    try {
      await venuesApi.remove(venue.id)
      navigate('/admin/venues', { state: { toast: { kind: 'deleted', name: venue.name, id: venue.id } } })
    } catch {
      setBusy(false)
      setConfirming(false)
    }
  }
  const seated = layout.kind === 'seated'
  const zoom = ZOOMS[zoomIndex]
  const unit = seated ? t.seatsWord : t.placesWord
  const partCount = seated ? layout.sections.length : layout.zones.length
  const stageText =
    layout.kind === 'seated' ? t.stageFront : `x ${layout.stage.x} · y ${layout.stage.y} · ${layout.stage.w} × ${layout.stage.h}`

  return (
    <AdminLayout
      title={venue.name}
      crumbs={[{ label: t.listTitle, to: '/admin/venues' }, { label: venue.name }]}
      revealCount={partCount}
    >
      {backLink}

      <AdminHero
        eyebrow={t.detailEyebrow}
        title={venue.name}
        action={
          <>
            <Link className="ad-glass-btn" to={`/admin/venues/${venue.id}/edit`}>
              <PencilIcon size={16} />
              {t.editVenue}
            </Link>
            <button type="button" className="ad-glass-btn ad-glass-btn--danger" onClick={() => setConfirming(true)}>
              <TrashIcon size={16} />
              {t.delete}
            </button>
          </>
        }
      >
        <div className="ad-hero-chips">
          <span className="ad-glass-chip">
            <Icon size={16}>
              <path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
              <circle cx="12" cy="10" r="2.5" />
            </Icon>
            {venue.address} · {venue.city}, {venue.country}
          </span>
          <span className="ad-glass-chip">
            <Icon size={16}>
              <circle cx="9" cy="8" r="4" />
              <path d="M2 21a7 7 0 0 1 14 0" />
            </Icon>
            <strong>{fmt(venue.totalCapacity)}</strong> {t.capacity}
          </span>
          <span className="ad-glass-chip ad-glass-chip--accent">{seated ? t.seatedLayout : t.zoneLayout}</span>
        </div>
      </AdminHero>

      <div className="ad-detail-grid">
        <section className="ad-card ad-layout-card" aria-labelledby="layout-title" data-scroll-reveal="">
          <div className="ad-card-head">
            <div>
              <h2 id="layout-title" className="ad-card-h">
                {t.layoutTitle}
              </h2>
              <p className="ad-card-sub">
                {fmt(venue.totalCapacity)} {unit} · {fmt(partCount)} {seated ? t.sectionsWord : t.zonesWord} ·{' '}
                {seated ? t.hoverHint : t.gridHint}
              </p>
            </div>
            <div className="ad-zoom" role="group" aria-label={t.zoomGroup}>
              <button
                type="button"
                aria-label={t.zoomOut}
                disabled={zoomIndex === 0}
                onClick={() => setZoomIndex((z) => Math.max(0, z - 1))}
              >
                <Icon>
                  <path d="M5 12h14" />
                </Icon>
              </button>
              <span aria-live="polite">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                aria-label={t.zoomIn}
                disabled={zoomIndex === ZOOMS.length - 1}
                onClick={() => setZoomIndex((z) => Math.min(ZOOMS.length - 1, z + 1))}
              >
                <Icon>
                  <path d="M5 12h14M12 5v14" />
                </Icon>
              </button>
              <button type="button" className="ad-zoom-fit" onClick={() => setZoomIndex(DEFAULT_ZOOM)}>
                {t.fit}
              </button>
            </div>
          </div>

          {seated ? (
            <SeatMap layout={layout} active={active} zoom={zoom} t={t} />
          ) : (
            <ZoneMap layout={layout} active={active} zoom={zoom} t={t} fmt={fmt} dark={theme === 'dark'} />
          )}

          <div className="ad-legend">
            <span>
              <span className="ad-legend-box ad-legend-box--stage" aria-hidden="true" />
              {t.stage}
            </span>
            {layout.categories.map((c) => (
              <span key={c.key}>
                <span className="ad-legend-box" style={{ background: c.colour }} aria-hidden="true" />
                {c.name}
              </span>
            ))}
            {!seated && <span className="ad-legend-note">{t.gridLines}</span>}
          </div>
        </section>

        <aside className="ad-detail-side">
          <CategoriesPanel
            categories={layout.categories}
            active={active}
            onPick={setActive}
            hint={seated ? t.categoriesHintSeats : t.categoriesHintZones}
            unit={unit}
            fmt={fmt}
            t={t}
          />

          <section className="ad-card" aria-labelledby="info-title" data-scroll-reveal="">
            <h2 id="info-title" className="ad-card-h ad-card-h--bar">
              {t.venueInfo}
            </h2>
            <dl className="ad-info">
              <div>
                <dt>{t.venueId}</dt>
                <dd className="ad-mono">{venue.id.slice(0, 8)}</dd>
              </div>
              <div>
                <dt>{t.address}</dt>
                <dd>{venue.address}</dd>
              </div>
              <div>
                <dt>{t.city}</dt>
                <dd>{venue.city}</dd>
              </div>
              <div>
                <dt>{t.country}</dt>
                <dd>{venue.country}</dd>
              </div>
              <div>
                <dt>{t.totalCapacity}</dt>
                <dd>{fmt(venue.totalCapacity)}</dd>
              </div>
              <div>
                <dt>{t.stagePosition}</dt>
                <dd className={seated ? undefined : 'ad-mono'} dir={seated ? undefined : 'ltr'}>
                  {stageText}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      {confirming && (
        <ConfirmDialog
          title={fill(t.deleteTitle, venue.name)}
          text={t.deleteText}
          details={
            <>
              <span>
                {venue.address} · {venue.city}
              </span>
              <strong>
                {fmt(venue.totalCapacity)} {t.capacity}
              </strong>
            </>
          }
          confirmLabel={t.deleteVenue}
          cancelLabel={t.cancel}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </AdminLayout>
  )
}
