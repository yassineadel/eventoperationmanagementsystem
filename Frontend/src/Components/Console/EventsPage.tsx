import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, qs, type EventRow, type Lookups, type Paged } from './api'
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Pager, Progress, SearchBox, Tabs } from './ui'
import { date, egp, title } from './format'
import { useLoad } from './hooks'

export default function EventsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const status = params.get('status') ?? ''
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const when = params.get('when') ?? ''
  const page = Number(params.get('page') ?? 1)
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); if (k !== 'page') p.delete('page'); setParams(p) }

  const lookups = useLoad(() => api.get<Lookups>('/lookups'), [])
  const { data, error, loading, reload } = useLoad(() => api.get<Paged<EventRow>>(`/events${qs({ status, q, category, when, page })}`), [status, q, category, when, page])

  return <>
    <PageHeader title="Events" sub="Every event in the database: drafts, on sale, cancelled and past." actions={<Link className="cx-btn is-primary" to="/admin/events/new">+ New event</Link>} />
    <Card>
      <div className="cx-toolbar">
        <Tabs value={status} onChange={(v) => set('status', v)} options={[{ value: '', label: 'All' }, { value: 'PUBLISHED', label: 'On sale' }, { value: 'DRAFT', label: 'Drafts' }, { value: 'CANCELLED', label: 'Cancelled' }]} />
        <SearchBox value={q} onChange={(v) => set('q', v)} placeholder="Search by name or performer…" />
        <select className="cx-input" value={category} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>{lookups.data?.categories.map((c) => <option key={c} value={c}>{title(c)}</option>)}
        </select>
        <select className="cx-input" value={when} onChange={(e) => set('when', e.target.value)}>
          <option value="">Any date</option><option value="upcoming">Upcoming</option><option value="past">Past</option>
        </select>
      </div>
      {error && <ErrorBox error={error} retry={reload} />}
      {loading && !data ? <Loading /> : data && (data.rows.length ? <>
        <div className="cx-table-wrap"><table className="cx-table">
          <thead><tr><th>Event</th><th>Date</th><th>Venue</th><th>Status</th><th>Sold</th><th className="num">From</th></tr></thead>
          <tbody>{data.rows.map((e) => <tr key={e.id} className="is-link" onClick={() => navigate(`/admin/events/${e.id}`)}>
            <td><span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {e.images[0] ? <img className="cx-thumb" src={e.images[0]} alt="" /> : <span className="cx-thumb" />}
              <span className="cx-two"><span className="cx-strong">{e.name}</span><span className="cx-muted cx-small">{title(e.category)}{e.performer ? ` · ${e.performer}` : ''}</span></span>
            </span></td>
            <td><span className="cx-two"><span>{date(e.startAt)}</span>{e.isPast && <span className="cx-muted cx-small">Past</span>}</span></td>
            <td><span className="cx-two"><span>{e.venue.name}</span><span className="cx-muted cx-small">{e.venue.city} · {title(e.venue.type)}</span></span></td>
            <td><Badge value={e.status} label={e.status === 'PUBLISHED' ? 'On sale' : undefined} /></td>
            <td><Progress value={e.sold} max={e.capacity} /></td>
            <td className="num">{e.fromPrice === null ? '—' : e.fromPrice === 0 ? 'Free' : egp(e.fromPrice)}</td>
          </tr>)}</tbody>
        </table></div>
        <Pager page={data.page} pageCount={data.pageCount} total={data.total} onPage={(p) => set('page', String(p))} />
      </> : <Empty>No events match these filters.</Empty>)}
    </Card>
  </>
}
