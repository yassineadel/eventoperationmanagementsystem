import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type EventDetail, type TicketCategory } from './api'
import { Badge, Card, Confirm, Empty, ErrorBox, Field, KeyValue, Loading, Modal, PageHeader, Progress, Stat } from './ui'
import { dateTime, egp, num, title } from './format'
import { useAction, useLoad } from './hooks'

type CatForm = { id?: string; categoryKey: string; name: string; description: string; price: string; serviceFeePercent: string }

export default function EventPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { data: e, error, loading, reload } = useLoad(() => api.get<EventDetail>(`/events/${eventId}`), [eventId])
  const { run } = useAction()
  const [dialog, setDialog] = useState<'publish' | 'cancel' | 'delete' | null>(null)
  const [cat, setCat] = useState<CatForm | null>(null)
  const [removeCat, setRemoveCat] = useState<TicketCategory | null>(null)

  if (loading && !e) return <Loading />
  if (error || !e) return <ErrorBox error={error} retry={reload} />

  const sold = e.ticketCategories.reduce((n, c) => n + c.soldCount, 0)
  const capacity = e.ticketCategories.reduce((n, c) => n + c.capacity, 0)
  const held = e.ticketCategories.reduce((n, c) => n + c.heldCount, 0)
  const cancelled = e.status === 'CANCELLED'

  const saveCat = async () => {
    if (!cat) return
    const body = { categoryKey: cat.categoryKey, name: cat.name, description: cat.description, price: Number(cat.price), serviceFeePercent: Number(cat.serviceFeePercent) }
    const ok = await run(() => (cat.id ? api.put(`/categories/${cat.id}`, body) : api.post(`/events/${e.id}/categories`, body)), cat.id ? 'Ticket type saved' : 'Ticket type added', reload)
    if (ok) setCat(null)
  }

  return <>
    <PageHeader back={{ to: '/admin/events', label: 'Events' }}
      title={<>{e.name} <Badge value={e.status} label={e.status === 'PUBLISHED' ? 'On sale' : undefined} /></>}
      sub={`${title(e.category)} · ${dateTime(e.startAt)} · ${e.venue.name}, ${e.venue.city}`}
      actions={<>
        {e.status === 'PUBLISHED' && <a className="cx-btn" href={`/events/${e.id}`} target="_blank" rel="noreferrer">View on website ↗</a>}
        {!cancelled && <Link className="cx-btn" to={`/admin/events/${e.id}/edit`}>Edit details</Link>}
        {e.status === 'DRAFT' && <button className="cx-btn is-primary" onClick={() => setDialog('publish')}>Publish</button>}
        {e.status === 'PUBLISHED' && <button className="cx-btn is-danger" onClick={() => setDialog('cancel')}>Cancel event</button>}
        {e.status === 'DRAFT' && <button className="cx-btn is-danger" onClick={() => setDialog('delete')}>Delete draft</button>}
      </>} />

    {cancelled && <div className="cx-note is-red" style={{ marginBottom: 16 }}><b>Cancelled.</b> {e.cancellationReason} Every ticket was refunded in full.</div>}
    {e.status === 'DRAFT' && <div className="cx-note is-amber" style={{ marginBottom: 16 }}>This is a draft: customers cannot see it. Add at least one ticket type, then publish it.</div>}

    <div className="cx-stats">
      <Stat tone="purple" label="Revenue" value={egp(e.stats.revenue)} />
      <Stat tone="green" label="Tickets sold" value={`${num(sold)} / ${num(capacity)}`} hint={capacity ? `${Math.round((sold / capacity) * 100)}% sold` : undefined} />
      <Stat tone="amber" label="Reserved now" value={num(held)} hint="in carts, 10-minute holds" />
      <Stat tone="blue" label="Paid orders" value={num(e.stats.orders.PAID ?? 0)} hint={`${num(e.stats.orders.PENDING ?? 0)} waiting for payment`} />
      <Stat tone="red" label="Refunded tickets" value={num(e.stats.tickets.REFUNDED ?? 0)} />
    </div>

    <div className="cx-grid cx-grid-main">
      <div className="cx-stack">
        <Card title="Ticket types" actions={!cancelled && e.availableCategories.length > 0 &&
          <button className="cx-btn is-small is-primary" onClick={() => setCat({ categoryKey: e.availableCategories[0].key, name: e.availableCategories[0].label, description: '', price: '', serviceFeePercent: '5' })}>+ Add ticket type</button>}>
          {e.ticketCategories.length ? <div className="cx-table-wrap"><table className="cx-table">
            <thead><tr><th>Type</th><th className="num">Price</th><th className="num">Fee</th><th>Sold</th><th /></tr></thead>
            <tbody>{e.ticketCategories.map((c) => <tr key={c.id}>
              <td><span className="cx-two"><span className="cx-strong">{c.name}</span><span className="cx-muted cx-small">{c.categoryKey}{c.description ? ` · ${c.description}` : ''}</span></span></td>
              <td className="num cx-strong">{Number(c.price) === 0 ? 'Free' : egp(c.price)}</td>
              <td className="num">{Number(c.serviceFeePercent)}%</td>
              <td><Progress value={c.soldCount} max={c.capacity} /></td>
              <td className="num">{!cancelled && <>
                <button className="cx-btn is-small is-ghost" onClick={() => setCat({ id: c.id, categoryKey: c.categoryKey, name: c.name, description: c.description ?? '', price: String(Number(c.price)), serviceFeePercent: String(Number(c.serviceFeePercent)) })}>Edit</button>
                {c.soldCount + c.heldCount === 0 && <button className="cx-btn is-small is-ghost" onClick={() => setRemoveCat(c)}>Remove</button>}
              </>}</td>
            </tr>)}</tbody>
          </table></div> : <Empty>No ticket types yet. Add one for each area of the venue you want to sell.</Empty>}
        </Card>

        <Card title="Description">
          <p style={{ marginTop: 0, lineHeight: 1.6 }}>{e.description}</p>
          {e.about && <p className="cx-muted" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.about}</p>}
          {e.policies && <><div className="cx-divider" /><KeyValue items={[
            ['Refund policy', e.policies.refundPolicy?.en ?? '—'],
            ['Transfer policy', e.policies.transferPolicy?.en ?? '—'],
            ...(e.policies.entryPolicy?.en ? [['Entry rules', e.policies.entryPolicy.en] as [string, string]] : []),
          ]} /></>}
        </Card>
      </div>

      <div className="cx-stack">
        {e.images[0] && <img className="cx-cover" src={e.images[0]} alt="" />}
        <Card title="Details"><KeyValue items={[
          ['Starts', dateTime(e.startAt)], ['Doors open', dateTime(e.doorsOpenAt)], ['Duration', `${e.durationMinutes} min`],
          ['Venue', <Link to={`/admin/venues/${e.venue.slug}`}>{e.venue.name}</Link>],
          ['Sales window', e.salesOpenAt || e.salesCloseAt ? `${e.salesOpenAt ? dateTime(e.salesOpenAt) : 'Now'} → ${e.salesCloseAt ? dateTime(e.salesCloseAt) : 'event start'}` : 'Until the event starts'],
          ['Created by', e.createdBy.fullName], ['Published', e.publishedAt ? dateTime(e.publishedAt) : '—'],
        ]} /></Card>
        <Card title="Shortcuts"><div className="cx-stack" style={{ gap: 8 }}>
          <Link className="cx-btn" to={`/admin/orders?eventId=${e.id}`}>Orders for this event</Link>
          <Link className="cx-btn" to={`/admin/tickets?eventId=${e.id}`}>Tickets for this event</Link>
        </div></Card>
        <Card title="Gate staff" actions={<Link className="cx-btn is-small is-ghost" to="/admin/staff">Manage</Link>}>
          {e.staffAssignments.length ? <div className="cx-list">{e.staffAssignments.map((a) => <div key={a.id} className="cx-list-row"><span className="cx-strong">{a.staff.fullName}</span><span className="cx-muted cx-mono">{a.staff.username}</span></div>)}</div>
            : <Empty>No scanner staff assigned yet.</Empty>}
        </Card>
      </div>
    </div>

    {cat && <Modal title={cat.id ? 'Edit ticket type' : 'Add ticket type'} onClose={() => setCat(null)} footer={<>
      <button className="cx-btn is-ghost" onClick={() => setCat(null)}>Back</button>
      <button className="cx-btn is-primary" onClick={saveCat} disabled={cat.price === ''}>{cat.id ? 'Save' : 'Add'}</button>
    </>}>
      {!cat.id && <Field label="Venue area" hint="Places come from the venue layout.">
        <select className="cx-input" style={{ width: '100%' }} value={cat.categoryKey} onChange={(ev) => {
          const area = e.availableCategories.find((a) => a.key === ev.target.value)
          setCat({ ...cat, categoryKey: ev.target.value, name: area?.label ?? cat.name })
        }}>{e.availableCategories.map((a) => <option key={a.key} value={a.key}>{a.label} · {a.capacity.toLocaleString()} places</option>)}</select>
      </Field>}
      <Field label="Name shown to buyers"><input className="cx-input" value={cat.name} onChange={(ev) => setCat({ ...cat, name: ev.target.value })} /></Field>
      <Field label="Description (optional)"><input className="cx-input" value={cat.description} onChange={(ev) => setCat({ ...cat, description: ev.target.value })} placeholder="e.g. Best view, free drink" /></Field>
      <div className="cx-form">
        <Field label="Price (EGP)" hint="0 makes it free."><input className="cx-input" type="number" min={0} step="0.01" value={cat.price} onChange={(ev) => setCat({ ...cat, price: ev.target.value })} /></Field>
        <Field label="Service fee (%)"><input className="cx-input" type="number" min={0} max={50} step="0.5" value={cat.serviceFeePercent} onChange={(ev) => setCat({ ...cat, serviceFeePercent: ev.target.value })} /></Field>
      </div>
      {cat.id && <div className="cx-note">A new price applies to new purchases. Tickets already sold keep the price that was paid.</div>}
    </Modal>}

    {removeCat && <Confirm title="Remove ticket type" message={`Remove ${removeCat.name}? Nobody has bought or reserved it yet.`} confirm="Remove" danger
      onConfirm={() => run(() => api.del(`/categories/${removeCat.id}`), 'Ticket type removed', reload)} onClose={() => setRemoveCat(null)} />}
    {dialog === 'publish' && <Confirm title="Publish event" message="The event goes on sale on the website straight away." confirm="Publish"
      onConfirm={() => run(() => api.post(`/events/${e.id}/publish`), 'Event published. It is on sale now.', reload)} onClose={() => setDialog(null)} />}
    {dialog === 'delete' && <Confirm title="Delete draft" message="The draft and its ticket types are deleted for good." confirm="Delete" danger
      onConfirm={() => run(() => api.del(`/events/${e.id}`), 'Draft deleted', () => navigate('/admin/events'))} onClose={() => setDialog(null)} />}
    {dialog === 'cancel' && <Confirm title="Cancel event" danger confirm="Cancel event and refund everyone"
      message={<>Sales stop at once and <b>all {num(sold)} sold tickets are refunded in full</b>, service fee included. Card payments are refunded on Stripe automatically and each customer gets an email.</>}
      reason={{ label: 'Reason (customers will see it)', placeholder: 'e.g. The performer is unwell.' }}
      suggestions={['The performer is unwell.', 'The venue is no longer available.', 'The event is postponed to a later date.']}
      onConfirm={(reason) => run(() => api.post(`/events/${e.id}/cancel`, { reason }), 'Event cancelled and tickets refunded', reload)} onClose={() => setDialog(null)} />}
  </>
}
