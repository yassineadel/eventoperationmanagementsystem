import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type EventDetail, type Lookups } from './api'
import { Card, ErrorBox, Field, Loading, PageHeader } from './ui'
import { title, toInput } from './format'
import { useLoad, useToast } from './hooks'

type Form = {
  name: string; category: string; performer: string; venueId: string; description: string; about: string; image: string
  startAt: string; doorsOpenAt: string; durationMinutes: string; salesOpenAt: string; salesCloseAt: string
  refundPolicy: string; transferPolicy: string; entryPolicy: string
}
const EMPTY: Form = {
  name: '', category: 'concerts', performer: '', venueId: '', description: '', about: '', image: '', startAt: '', doorsOpenAt: '', durationMinutes: '120',
  salesOpenAt: '', salesCloseAt: '',
  refundPolicy: 'You can request a refund up to 7 days before the event. Refunds need approval, and the service fee is not refunded. If the event is cancelled, you get a full refund.',
  transferPolicy: 'A ticket can be transferred to another Hafletna account at most 3 times. The old QR code stops working.',
  entryPolicy: '',
}

const fromEvent = (e: EventDetail): Form => ({
  name: e.name, category: e.category, performer: e.performer ?? '', venueId: e.venue.id, description: e.description, about: e.about ?? '', image: e.images[0] ?? '',
  startAt: toInput(e.startAt), doorsOpenAt: toInput(e.doorsOpenAt), durationMinutes: String(e.durationMinutes),
  salesOpenAt: toInput(e.salesOpenAt), salesCloseAt: toInput(e.salesCloseAt),
  refundPolicy: e.policies?.refundPolicy?.en ?? '', transferPolicy: e.policies?.transferPolicy?.en ?? '', entryPolicy: e.policies?.entryPolicy?.en ?? '',
})

/** Create an event, or edit one (`/admin/events/:id/edit`). New events start as drafts. */
export default function EventFormPage() {
  const { eventId } = useParams()
  const editing = !!eventId
  const navigate = useNavigate()
  const toast = useToast()
  const lookups = useLoad(() => api.get<Lookups>('/lookups'), [])
  const existing = useLoad(() => (eventId ? api.get<EventDetail>(`/events/${eventId}`) : Promise.resolve(null)), [eventId])
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // fill the form once the event has loaded (adjusting state while rendering, not in an effect)
  const [filledFrom, setFilledFrom] = useState<EventDetail | null>(null)
  if (existing.data && existing.data !== filledFrom) {
    setFilledFrom(existing.data)
    setForm(fromEvent(existing.data))
  }
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => {
    const next = { ...f, [k]: e.target.value }
    // a sensible default: doors open an hour before the start
    if (k === 'startAt' && e.target.value && !f.doorsOpenAt) {
      const d = new Date(e.target.value); d.setHours(d.getHours() - 1)
      next.doorsOpenAt = toInput(d.toISOString())
    }
    return next
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const body = {
      ...form,
      startAt: form.startAt ? new Date(form.startAt).toISOString() : '',
      doorsOpenAt: form.doorsOpenAt ? new Date(form.doorsOpenAt).toISOString() : '',
      salesOpenAt: form.salesOpenAt ? new Date(form.salesOpenAt).toISOString() : null,
      salesCloseAt: form.salesCloseAt ? new Date(form.salesCloseAt).toISOString() : null,
      durationMinutes: Number(form.durationMinutes),
    }
    try {
      const saved = editing ? await api.put<EventDetail>(`/events/${eventId}`, body) : await api.post<EventDetail>('/events', body)
      toast(editing ? 'Event saved' : 'Draft created. Now add its ticket types.')
      navigate(`/admin/events/${saved.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if ((editing && existing.loading && !existing.data) || (lookups.loading && !lookups.data)) return <Loading />
  if (existing.error) return <ErrorBox error={existing.error} />
  const published = existing.data && existing.data.status !== 'DRAFT'

  return <>
    <PageHeader title={editing ? `Edit ${existing.data?.name ?? 'event'}` : 'New event'} back={{ to: editing ? `/admin/events/${eventId}` : '/admin/events', label: editing ? 'Event' : 'Events' }}
      sub={editing ? 'Changes appear on the website straight away.' : 'It is saved as a draft. Add ticket types, then publish it.'} />
    {error && <ErrorBox error={error} />}
    <form onSubmit={submit} className="cx-stack">
      <Card title="Basics"><div className="cx-form">
        <Field label="Event name" wide><input className="cx-input" required value={form.name} onChange={set('name')} placeholder="e.g. Amr Diab Live" /></Field>
        <Field label="Category"><select className="cx-input" value={form.category} onChange={set('category')}>{lookups.data?.categories.map((c) => <option key={c} value={c}>{title(c)}</option>)}</select></Field>
        <Field label="Performer or organiser"><input className="cx-input" value={form.performer} onChange={set('performer')} /></Field>
        <Field label="Venue" hint={published ? 'The venue cannot change after the event is on sale.' : 'Ticket types come from the venue’s areas.'} wide>
          <select className="cx-input" required value={form.venueId} onChange={set('venueId')} disabled={!!published} style={{ width: '100%' }}>
            <option value="">Choose a venue…</option>
            {lookups.data?.venues.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.city} · {title(v.type)} · {v.capacity.toLocaleString()} places</option>)}
          </select>
        </Field>
        <Field label="Short description" wide><textarea className="cx-input" required rows={2} value={form.description} onChange={set('description')} /></Field>
        <Field label="About (longer text, optional)" wide><textarea className="cx-input" rows={4} value={form.about} onChange={set('about')} /></Field>
        <Field label="Poster image link (optional)" hint="An https link to an image." wide><input className="cx-input" value={form.image} onChange={set('image')} placeholder="https://…" /></Field>
      </div></Card>

      <Card title="Date and sales"><div className="cx-form">
        <Field label="Starts"><input className="cx-input" type="datetime-local" required value={form.startAt} onChange={set('startAt')} /></Field>
        <Field label="Doors open"><input className="cx-input" type="datetime-local" required value={form.doorsOpenAt} onChange={set('doorsOpenAt')} /></Field>
        <Field label="Duration (minutes)"><input className="cx-input" type="number" min={15} max={1440} value={form.durationMinutes} onChange={set('durationMinutes')} /></Field>
        <div />
        <Field label="Sales open (optional)" hint="Empty: on sale as soon as it is published."><input className="cx-input" type="datetime-local" value={form.salesOpenAt} onChange={set('salesOpenAt')} /></Field>
        <Field label="Sales close (optional)" hint="Empty: until the event starts."><input className="cx-input" type="datetime-local" value={form.salesCloseAt} onChange={set('salesCloseAt')} /></Field>
      </div></Card>

      <Card title="Policies shown to buyers"><div className="cx-form">
        <Field label="Refund policy" wide><textarea className="cx-input" rows={2} value={form.refundPolicy} onChange={set('refundPolicy')} /></Field>
        <Field label="Transfer policy" wide><textarea className="cx-input" rows={2} value={form.transferPolicy} onChange={set('transferPolicy')} /></Field>
        <Field label="Entry rules (optional)" wide><textarea className="cx-input" rows={2} value={form.entryPolicy} onChange={set('entryPolicy')} placeholder="e.g. 18+, no outside food" /></Field>
        <div className="cx-form-actions">
          <button type="button" className="cx-btn is-ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button className="cx-btn is-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create draft'}</button>
        </div>
      </div></Card>
    </form>
  </>
}
