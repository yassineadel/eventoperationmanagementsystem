import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type VenueRow } from './api'
import { Badge, Card, Confirm, Empty, ErrorBox, Field, KeyValue, Loading, PageHeader, Progress } from './ui'
import { date, num, title, mapEmbed } from './format'
import { useAction, useLoad, useToast } from './hooks'


export function VenuesPage() {
  const { data, error, loading, reload } = useLoad(() => api.get<VenueRow[]>('/venues'), [])
  return <>
    <PageHeader title="Venues" sub="Where events happen. Each venue has its seats or standing zones, a photo and a Google Maps location."
      actions={<Link className="cx-btn is-primary" to="/admin/venues/new">+ New venue</Link>} />
    {error && <ErrorBox error={error} retry={reload} />}
    {loading && !data ? <Loading /> : data && <div className="cx-venue-grid">{data.map((v) => <Link key={v.id} to={`/admin/venues/${v.slug}`} className="cx-venue">
      {v.image ? <img src={v.image} alt="" /> : <div className="cx-venue-ph" />}
      <div>
        <h3>{v.name}</h3>
        <span className="cx-muted cx-small">{v.address}, {v.city}</span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          <Badge value={v.type === 'SEATED' ? 'USED' : 'APPROVED'} label={title(v.type)} />
          <Badge value="USER" label={`${num(v.capacity)} places`} />
          <Badge value={v.published ? 'PUBLISHED' : 'USER'} label={`${v.published} on sale · ${v.events} events`} />
        </span>
      </div>
    </Link>)}</div>}
  </>
}

type Layout = {
  venue: VenueRow & { country: string }
  stage: { position: string }
  categories: { key: string; label: string; color: string | null; capacity: number }[]
  sections?: { key: string; label: string; rows: { label: string; seats: { id: string; number: number; categoryKey: string }[] }[] }[]
  zones?: { id: string; key: string; label: string; categoryKey: string; capacity: number; x: number; y: number; width: number; height: number }[]
  definition: Definition | null
  hasSales: boolean
  events: { id: string; name: string; status: string; startAt: string; sold: number; capacity: number }[]
}
type Definition = {
  name: string; address: string; city: string; type: 'SEATED' | 'STANDING'; image?: string; mapUrl?: string; stage: { position: string }
  categories: { key: string; label: string; color: string }[]
  sections?: { key: string; label: string; rows: { label: string; seats: number; category: string }[] }[]
  zones?: { key: string; label: string; category: string; capacity: number }[]
}

export function LayoutPreview({ layout }: { layout: Pick<Layout, 'categories' | 'sections' | 'zones'> }) {
  const color = (key: string) => layout.categories.find((c) => c.key === key)?.color ?? '#7200f5'
  return <>
    {layout.sections && <div className="cx-seatmap"><div className="cx-stage">STAGE</div>
      {layout.sections.map((s) => <div key={s.key} className="cx-seat-section"><b>{s.label}</b>
        {s.rows.map((r) => <div key={r.label} className="cx-seat-row"><em>{r.label}</em>{r.seats.map((seat) => <span key={seat.id} className="cx-seat" style={{ background: color(seat.categoryKey) }} title={`${s.key}-${r.label}-${seat.number}`} />)}</div>)}
      </div>)}</div>}
    {layout.zones && <><div className="cx-stage">STAGE</div><div className="cx-zones">
      {layout.zones.map((z) => <div key={z.key} className="cx-zone" style={{ left: `${z.x}%`, top: `${z.y - 8}%`, width: `${z.width}%`, height: `${z.height}%`, background: color(z.categoryKey) }}>{z.label}<br />{num(z.capacity)}</div>)}
    </div></>}
    <div className="cx-legend" style={{ marginTop: 12 }}>{layout.categories.map((c) => <span key={c.key}><i style={{ background: c.color ?? '#7200f5' }} />{c.label} · {num(c.capacity)}</span>)}</div>
  </>
}

export function VenuePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { data: v, error, loading, reload } = useLoad(() => api.get<Layout>(`/venues/${slug}`), [slug])
  const { run } = useAction()
  const [del, setDel] = useState(false)
  if (loading && !v) return <Loading />
  if (error || !v) return <ErrorBox error={error} retry={reload} />
  const venue = v.venue

  return <>
    <PageHeader back={{ to: '/admin/venues', label: 'Venues' }} title={venue.name} sub={`${venue.address}, ${venue.city} · ${title(venue.type)} · ${num(venue.capacity)} places`}
      actions={<>
        <Link className="cx-btn" to={`/admin/venues/${slug}/edit`}>Edit venue</Link>
        {v.events.length === 0 && <button className="cx-btn is-danger" onClick={() => setDel(true)}>Delete</button>}
      </>} />
    <div className="cx-grid cx-grid-2">
      <div className="cx-stack">
        {venue.image ? <img className="cx-cover" style={{ height: 260 }} src={venue.image} alt="" /> : <div className="cx-note">No photo yet. The website shows an illustrative one. Add a photo link in Edit.</div>}
        <Card title="Location" actions={venue.mapUrl && <a className="cx-btn is-small is-ghost" href={venue.mapUrl} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>}>
          <iframe className="cx-map" title="Venue location" loading="lazy" src={mapEmbed(venue.latitude, venue.longitude)} />
        </Card>
      </div>
      <div className="cx-stack">
        <Card title={venue.type === 'SEATED' ? 'Seat map' : 'Standing zones'}><LayoutPreview layout={v} /></Card>
        <Card title={`Events here (${v.events.length})`}>{v.events.length ? <div className="cx-list">{v.events.map((e) =>
          <Link key={e.id} to={`/admin/events/${e.id}`} className="cx-list-row"><span className="cx-two"><span className="cx-strong">{e.name}</span><span className="cx-muted cx-small">{date(e.startAt)}</span></span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Badge value={e.status} /><Progress value={e.sold} max={e.capacity} /></span></Link>)}</div>
          : <Empty>No events at this venue yet.</Empty>}</Card>
        <Card title="Details"><KeyValue items={[['City', venue.city], ['Coordinates', `${Number(venue.latitude).toFixed(5)}, ${Number(venue.longitude).toFixed(5)}`], ['Web address', <span className="cx-mono">{venue.slug}</span>]]} /></Card>
      </div>
    </div>
    {del && <Confirm title="Delete venue" danger confirm="Delete venue" message="The venue, its seats and zones are deleted for good."
      onConfirm={() => run(() => api.del(`/venues/${slug}`), 'Venue deleted', () => navigate('/admin/venues'))} onClose={() => setDel(false)} />}
  </>
}

// ── form ──
type Cat = { label: string; color: string }
type RowGroup = { rows: number; seats: number; category: string }
type Section = { label: string; groups: RowGroup[] }
type Zone = { label: string; capacity: number; category: string }
type VenueForm = { name: string; address: string; city: string; type: 'SEATED' | 'STANDING'; image: string; mapUrl: string; stage: string; categories: Cat[]; sections: Section[]; zones: Zone[] }

const COLORS = ['#C9A227', '#2E86AB', '#6C757D', '#8E44AD', '#16A085', '#D35400']
const NEW: VenueForm = {
  name: '', address: '', city: 'Cairo', type: 'SEATED', image: '', mapUrl: '', stage: 'top',
  categories: [{ label: 'VIP', color: COLORS[0] }, { label: 'Standard', color: COLORS[1] }],
  sections: [{ label: 'Orchestra', groups: [{ rows: 3, seats: 14, category: 'VIP' }, { rows: 7, seats: 16, category: 'Standard' }] }],
  zones: [{ label: 'Front Stage', capacity: 300, category: 'VIP' }, { label: 'General Admission', capacity: 1200, category: 'Standard' }],
}
const rowLabel = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`)

/** turns a stored layout back into the compact form (consecutive rows with the same size and type become one group) */
const toForm = (d: Definition): VenueForm => {
  const label = (key: string) => d.categories.find((c) => c.key === key)?.label ?? key
  return {
    name: d.name, address: d.address, city: d.city, type: d.type, image: d.image ?? '', mapUrl: d.mapUrl ?? '', stage: d.stage.position,
    categories: d.categories.map((c) => ({ label: c.label, color: c.color })),
    sections: (d.sections ?? []).map((s) => ({
      label: s.label,
      groups: s.rows.reduce<RowGroup[]>((gs, r) => {
        const last = gs[gs.length - 1]
        if (last && last.seats === r.seats && last.category === label(r.category)) last.rows++
        else gs.push({ rows: 1, seats: r.seats, category: label(r.category) })
        return gs
      }, []),
    })),
    zones: (d.zones ?? []).map((z) => ({ label: z.label, capacity: z.capacity, category: label(z.category) })),
  }
}

const toBody = (f: VenueForm) => ({
  name: f.name, address: f.address, city: f.city, type: f.type, image: f.image, mapUrl: f.mapUrl, stage: f.stage, categories: f.categories,
  sections: f.type === 'SEATED' ? f.sections.map((s) => {
    let i = 0
    return { label: s.label, rows: s.groups.flatMap((g) => Array.from({ length: g.rows }, () => ({ label: rowLabel(i++), seats: g.seats, category: g.category }))) }
  }) : undefined,
  zones: f.type === 'STANDING' ? f.zones : undefined,
})

export function VenueFormPage() {
  const { slug } = useParams()
  const editing = !!slug
  const navigate = useNavigate()
  const toast = useToast()
  const existing = useLoad(() => (slug ? api.get<Layout>(`/venues/${slug}`) : Promise.resolve(null)), [slug])
  const [f, setF] = useState<VenueForm>(NEW)
  const [place, setPlace] = useState<{ latitude: number; longitude: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // fill the form once the venue has loaded (adjusting state while rendering, not in an effect)
  const [filledFrom, setFilledFrom] = useState<Layout | null>(null)
  if (existing.data && existing.data !== filledFrom) {
    setFilledFrom(existing.data)
    const d = existing.data.definition
    setF(d ? toForm(d) : { ...NEW, name: existing.data.venue.name, address: existing.data.venue.address, city: existing.data.venue.city, type: existing.data.venue.type })
    setPlace({ latitude: Number(existing.data.venue.latitude), longitude: Number(existing.data.venue.longitude) })
  }

  // read the coordinates from the pasted Google Maps link, for the live preview
  const [mapCheck, setMapCheck] = useState<{ url: string; error: string }>({ url: '', error: '' })
  useEffect(() => {
    const url = f.mapUrl.trim()
    if (!url) return
    const t = setTimeout(() => {
      api.post<{ latitude: number; longitude: number }>('/venues/map-preview', { url })
        .then((p) => { setPlace(p); setMapCheck({ url, error: '' }) })
        .catch((e) => setMapCheck({ url, error: e instanceof Error ? e.message : 'Could not read the link' }))
    }, 500)
    return () => clearTimeout(t)
  }, [f.mapUrl])
  const mapError = mapCheck.url === f.mapUrl.trim() ? mapCheck.error : ''

  const capacity = useMemo(() => f.type === 'SEATED'
    ? f.sections.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.rows * g.seats, 0), 0)
    : f.zones.reduce((n, z) => n + Number(z.capacity || 0), 0), [f])

  const set = <K extends keyof VenueForm>(k: K, v: VenueForm[K]) => setF((x) => ({ ...x, [k]: v }))
  const catNames = f.categories.map((c) => c.label).filter(Boolean)
  const locked = editing && existing.data?.hasSales

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const saved = editing ? await api.put<Layout>(`/venues/${slug}`, toBody(f)) : await api.post<Layout>('/venues', toBody(f))
      toast(editing ? 'Venue saved' : 'Venue created. You can use it for events now.')
      navigate(`/admin/venues/${saved.venue.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (editing && existing.loading && !existing.data) return <Loading />
  if (existing.error) return <ErrorBox error={existing.error} />

  return <>
    <PageHeader back={{ to: editing ? `/admin/venues/${slug}` : '/admin/venues', label: editing ? 'Venue' : 'Venues' }} title={editing ? `Edit ${f.name || 'venue'}` : 'New venue'}
      sub={`${num(capacity)} places in total`} />
    {error && <ErrorBox error={error} />}
    {locked && <div className="cx-note is-amber" style={{ marginBottom: 16 }}>Tickets are already sold here, so the seats and zones are locked. You can still change the name, address, photo and map.</div>}
    <form onSubmit={submit} className="cx-stack">
      <div className="cx-grid cx-grid-2">
        <Card title="Venue"><div className="cx-form">
          <Field label="Name" wide><input className="cx-input" required value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Cairo Opera House — Main Hall" /></Field>
          <Field label="Address" wide><input className="cx-input" required value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Street, district" /></Field>
          <Field label="City"><select className="cx-input" value={f.city} onChange={(e) => set('city', e.target.value)} style={{ width: '100%' }}>{['Cairo', 'Giza', 'Alexandria'].map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Type"><select className="cx-input" value={f.type} disabled={!!locked} onChange={(e) => set('type', e.target.value as VenueForm['type'])} style={{ width: '100%' }}>
            <option value="SEATED">Seated (numbered seats)</option><option value="STANDING">Standing (zones)</option></select></Field>
          <Field label="Photo link" hint="An https link to a photo of the venue." wide><input className="cx-input" value={f.image} onChange={(e) => set('image', e.target.value)} placeholder="https://…" /></Field>
          {f.image && <img className="cx-cover is-wide" style={{ gridColumn: '1 / -1' }} src={f.image} alt="Venue preview" />}
        </div></Card>
        <Card title="Location on Google Maps"><div className="cx-stack" style={{ gap: 10 }}>
          <Field label="Google Maps link" hint="In Google Maps, find the venue, press Share, copy the link and paste it here.">
            <input className="cx-input" value={f.mapUrl} onChange={(e) => set('mapUrl', e.target.value)} placeholder="https://maps.app.goo.gl/…" required={!editing} />
          </Field>
          {mapError && <div className="cx-note is-red">{mapError}</div>}
          {place ? <><iframe className="cx-map" title="Map preview" src={mapEmbed(place.latitude, place.longitude)} />
            <span className="cx-muted cx-small">Pin at {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}</span></>
            : <div className="cx-empty">The map appears here once the link is read.</div>}
        </div></Card>
      </div>

      <Card title="Ticket areas" actions={!locked && <button type="button" className="cx-btn is-small" onClick={() => set('categories', [...f.categories, { label: '', color: COLORS[f.categories.length % COLORS.length] }])}>+ Area</button>}>
        <p className="cx-muted" style={{ marginTop: 0 }}>The kinds of places this venue sells, e.g. VIP and Standard. Each event sets its own price per area.</p>
        <div className="cx-stack" style={{ gap: 8 }}>{f.categories.map((c, i) => <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="color" value={c.color} disabled={!!locked} onChange={(e) => set('categories', f.categories.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} style={{ width: 42, height: 38, border: 0, background: 'none' }} />
          <input className="cx-input" value={c.label} disabled={!!locked} placeholder="Area name" onChange={(e) => set('categories', f.categories.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          {!locked && f.categories.length > 1 && <button type="button" className="cx-btn is-small is-ghost" onClick={() => set('categories', f.categories.filter((_, j) => j !== i))}>Remove</button>}
        </div>)}</div>
      </Card>

      {f.type === 'SEATED' ? <Card title="Seats" actions={!locked && <button type="button" className="cx-btn is-small" onClick={() => set('sections', [...f.sections, { label: `Section ${f.sections.length + 1}`, groups: [{ rows: 5, seats: 12, category: catNames[0] ?? '' }] }])}>+ Section</button>}>
        <p className="cx-muted" style={{ marginTop: 0 }}>Rows are lettered A, B, C… from the stage. Seats are numbered from the left.</p>
        <div className="cx-stack">{f.sections.map((s, si) => <div key={si} className="cx-repeat">
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="cx-input" value={s.label} disabled={!!locked} placeholder="Section name, e.g. Balcony" onChange={(e) => set('sections', f.sections.map((x, j) => (j === si ? { ...x, label: e.target.value } : x)))} />
            {!locked && f.sections.length > 1 && <button type="button" className="cx-btn is-small is-ghost" onClick={() => set('sections', f.sections.filter((_, j) => j !== si))}>Remove section</button>}
          </div>
          {s.groups.map((g, gi) => {
            const upd = (patch: Partial<RowGroup>) => set('sections', f.sections.map((x, j) => (j === si ? { ...x, groups: x.groups.map((y, k) => (k === gi ? { ...y, ...patch } : y)) } : x)))
            return <div key={gi} className="cx-repeat-row">
              <Field label="Number of rows"><input className="cx-input" type="number" min={1} max={60} disabled={!!locked} value={g.rows} onChange={(e) => upd({ rows: Number(e.target.value) })} /></Field>
              <Field label="Seats per row"><input className="cx-input" type="number" min={1} max={80} disabled={!!locked} value={g.seats} onChange={(e) => upd({ seats: Number(e.target.value) })} /></Field>
              <Field label="Area"><select className="cx-input" style={{ width: '100%' }} disabled={!!locked} value={g.category} onChange={(e) => upd({ category: e.target.value })}>{catNames.map((c) => <option key={c}>{c}</option>)}</select></Field>
              {!locked && s.groups.length > 1 ? <button type="button" className="cx-btn is-small is-ghost" onClick={() => set('sections', f.sections.map((x, j) => (j === si ? { ...x, groups: x.groups.filter((_, k) => k !== gi) } : x)))}>✕</button> : <span />}
            </div>
          })}
          {!locked && <button type="button" className="cx-btn is-small is-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => set('sections', f.sections.map((x, j) => (j === si ? { ...x, groups: [...x.groups, { rows: 2, seats: x.groups[x.groups.length - 1]?.seats ?? 12, category: catNames[catNames.length - 1] ?? '' }] } : x)))}>+ More rows</button>}
        </div>)}</div>
      </Card> : <Card title="Standing zones" actions={!locked && <button type="button" className="cx-btn is-small" onClick={() => set('zones', [...f.zones, { label: `Zone ${f.zones.length + 1}`, capacity: 200, category: catNames[0] ?? '' }])}>+ Zone</button>}>
        <p className="cx-muted" style={{ marginTop: 0 }}>Zones are drawn from the stage outwards in this order.</p>
        <div className="cx-stack" style={{ gap: 8 }}>{f.zones.map((z, i) => {
          const upd = (patch: Partial<Zone>) => set('zones', f.zones.map((x, j) => (j === i ? { ...x, ...patch } : x)))
          return <div key={i} className="cx-repeat-row">
            <Field label="Zone name"><input className="cx-input" disabled={!!locked} value={z.label} onChange={(e) => upd({ label: e.target.value })} /></Field>
            <Field label="Capacity"><input className="cx-input" type="number" min={1} disabled={!!locked} value={z.capacity} onChange={(e) => upd({ capacity: Number(e.target.value) })} /></Field>
            <Field label="Area"><select className="cx-input" style={{ width: '100%' }} disabled={!!locked} value={z.category} onChange={(e) => upd({ category: e.target.value })}>{catNames.map((c) => <option key={c}>{c}</option>)}</select></Field>
            {!locked && f.zones.length > 1 ? <button type="button" className="cx-btn is-small is-ghost" onClick={() => set('zones', f.zones.filter((_, j) => j !== i))}>✕</button> : <span />}
          </div>
        })}</div>
      </Card>}

      <div className="cx-form-actions">
        <button type="button" className="cx-btn is-ghost" onClick={() => navigate(-1)}>Cancel</button>
        <button className="cx-btn is-primary" disabled={saving || capacity === 0}>{saving ? 'Saving…' : editing ? 'Save venue' : 'Create venue'}</button>
      </div>
    </form>
  </>
}
