// Formatting helpers for the admin console.

export const egp = (v: number | string | null | undefined) =>
  `EGP ${Number(v ?? 0).toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
export const num = (v: number) => v.toLocaleString('en')
export const date = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const dateTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
export const ago = (v: string, now = Date.now()) => {
  const s = (now - new Date(v).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
export const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ')
export const seatLabel = (seat: { section: string; row: string; number: number } | null) => (seat ? `${seat.section} · Row ${seat.row} · Seat ${seat.number}` : 'Standing')
/** a datetime-local input value from an ISO date (local time) */
export const toInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
/** Google's embeddable map for a point: no API key needed */
export const mapEmbed = (lat: number | string, lng: number | string) => `https://www.google.com/maps?${new URLSearchParams({ q: `${lat},${lng}`, z: '16', output: 'embed' })}`
