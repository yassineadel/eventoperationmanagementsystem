import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { usePreferences } from '../Auth/preferences'
import { seatSections, type BookingCatalogue, type Seat } from './catalogue'
import { bookingMoney, bookingNumber } from './strings'
import { useBookingStrings } from './liveStrings'

const MAP_WIDTH = 1120
const MAP_HEIGHT = 1040
// Sizes of one row in the grid (they match Booking.css), used to fit rows of any length
const SEAT_SIZE = 44, GAP = 6, ROW_LABEL = 26, AISLE = 22, FRAME = 60

// Rows of 8 or more seats get an aisle in the middle (the sample's rows of 20 get it after seat 10, as before)
const aisleAfter = (seatCount: number) => seatCount >= 8 ? Math.floor(seatCount / 2) : null

export default function SeatMap({ eventId, catalogue, selectedIds, purchasedIds, onInspect, inspectedId, disabled }: {
  eventId: string; catalogue: BookingCatalogue; selectedIds: string[]; purchasedIds: string[]; onInspect: (seat: Seat) => void; inspectedId?: string; disabled: boolean
}) {
  const { lang } = usePreferences()
  const t = useBookingStrings(eventId)
  const viewport = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const [mapHeight, setMapHeight] = useState(MAP_HEIGHT)
  const [zoom, setZoom] = useState(1)
  const currentZoom = useRef(1)
  const [focusIndex, setFocusIndex] = useState(1)
  const points = useRef(new Map<number, { x: number; y: number }>())
  const travel = useRef(new Map<number, number>())
  const dragged = useRef(false)

  // The map from the data: sections → rows → seats. Every seat gets a number in reading order (its "index"),
  // which keyboard navigation uses. rowStarts[r] is the index of the first seat of row r (rows counted across sections).
  const sections = seatSections(catalogue)
  const rows = sections.flatMap((section, sectionIndex) => section.rows.map((row, rowIndex) => ({ sectionIndex, rowIndex, seats: row.seats })))
  const rowStarts: number[] = []
  let seatCount = 0
  for (const row of rows) { rowStarts.push(seatCount); seatCount += row.seats.length }
  const tabbable = focusIndex < seatCount ? focusIndex : 0
  // Wide enough for the longest row (never narrower than the original map)
  const rowWidth = (count: number) => ROW_LABEL + count * SEAT_SIZE + (aisleAfter(count) ? AISLE + GAP : 0) + count * GAP
  const mapWidth = Math.max(MAP_WIDTH, ...rows.map((row) => rowWidth(row.seats.length) + FRAME))
  const live = Boolean(catalogue.sections)

  useEffect(() => { if (viewport.current) viewport.current.scrollLeft = (mapWidth - viewport.current.clientWidth) / 2 }, [mapWidth])
  useEffect(() => {
    const element = world.current
    if (!element) return
    const observer = new ResizeObserver(() => setMapHeight(element.offsetHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function changeZoom(value: number) {
    const next = Math.min(1.75, Math.max(.65, value))
    const previous = currentZoom.current
    currentZoom.current = next
    setZoom(next)
    const element = viewport.current
    if (element) requestAnimationFrame(() => {
      element.scrollLeft = (element.scrollLeft + element.clientWidth / 2) * next / previous - element.clientWidth / 2
      element.scrollTop = (element.scrollTop + element.clientHeight / 2) * next / previous - element.clientHeight / 2
    })
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if (!points.current.size) dragged.current = false
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    travel.current.set(event.pointerId, 0)
    if (!(event.target as HTMLElement).closest('button')) event.currentTarget.setPointerCapture(event.pointerId)
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = points.current.get(event.pointerId)
    if (!previous) return
    const before = [...points.current.values()]
    const distanceTravelled = (travel.current.get(event.pointerId) ?? 0) + Math.hypot(event.clientX - previous.x, event.clientY - previous.y)
    travel.current.set(event.pointerId, distanceTravelled)
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const after = [...points.current.values()]
    if (after.length === 2) {
      const oldDistance = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y)
      const distance = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y)
      if (oldDistance > 0) changeZoom(currentZoom.current * distance / oldDistance)
      dragged.current = true
    } else if (after.length === 1 && (dragged.current || distanceTravelled > 4)) {
      dragged.current = true
      event.currentTarget.scrollLeft -= event.clientX - previous.x
      event.currentTarget.scrollTop -= event.clientY - previous.y
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    points.current.delete(event.pointerId)
    travel.current.delete(event.pointerId)
    window.setTimeout(() => { if (!points.current.size) dragged.current = false }, 0)
  }

  // The seat at (row r, column c), keeping c inside the row. Before the first row: the first seat; after the last: the last seat.
  function seatAt(r: number, column: number) {
    if (r < 0) return 0
    if (r >= rows.length) return seatCount - 1
    return rowStarts[r] + Math.min(column, rows[r].seats.length - 1)
  }
  // The same row number in the next (+1) or previous (-1) section, e.g. Orchestra row C → Balcony row C
  function seatInSection(r: number, column: number, step: 1 | -1) {
    const { sectionIndex, rowIndex } = rows[r]
    const target = sections[sectionIndex + step]
    if (!target) return step === 1 ? seatCount - 1 : 0
    const firstRow = rows.findIndex((row) => row.sectionIndex === sectionIndex + step)
    return seatAt(firstRow + Math.min(rowIndex, target.rows.length - 1), column)
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, r: number, column: number) {
    if (event.key === 'Enter' || event.key === ' ') dragged.current = false
    const index = rowStarts[r] + column
    const last = rows[r].seats.length - 1
    const destination = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1
      : event.key === 'ArrowDown' ? seatAt(r + 1, column) : event.key === 'ArrowUp' ? seatAt(r - 1, column)
      : event.key === 'Home' ? rowStarts[r] : event.key === 'End' ? rowStarts[r] + last
      : event.key === 'PageDown' ? seatInSection(r, column, 1) : event.key === 'PageUp' ? seatInSection(r, column, -1) : null
    if (destination === null) return
    event.preventDefault()
    const target = viewport.current?.querySelector<HTMLButtonElement>(`[data-seat-index="${Math.max(0, Math.min(seatCount - 1, destination))}"]`)
    target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return <section className="booking-map-card" aria-labelledby="seat-map-title"><div className="booking-panel-heading"><div><p className="discovery-eyebrow">{t.seated}</p><h2 id="seat-map-title">{t.mapTitle}</h2><p>{t.mapLead}</p></div></div>
    <div className="booking-map-toolbar"><ul className="booking-seat-legend">{(['available', 'selected', 'held', 'sold'] as const).map((status) => <li key={status}><span className={`seat-legend-dot is-${status}`} aria-hidden="true" />{t[status]}</li>)}</ul>
      <div className="booking-zoom"><button type="button" onClick={() => changeZoom(currentZoom.current - .2)} disabled={zoom <= .65} aria-label={t.zoomOut}>−</button><output aria-live="polite">{bookingNumber(Math.round(zoom * 100), lang)}%</output><button type="button" onClick={() => changeZoom(currentZoom.current + .2)} disabled={zoom >= 1.75} aria-label={t.zoomIn}>+</button><button className="booking-reset-view" type="button" onClick={() => { changeZoom(1); requestAnimationFrame(() => { if (viewport.current) { viewport.current.scrollTop = 0; viewport.current.scrollLeft = (mapWidth - viewport.current.clientWidth) / 2 } }) }}>{t.resetView}</button></div>
    </div>
    <p id="seat-map-help" className="booking-map-help">{t.mapHelp}</p>
    <div ref={viewport} className="booking-seat-viewport" role="group" aria-label={t.map} aria-describedby="seat-map-help" dir="ltr" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerLeave={(event) => {
      if (event.pointerType === 'mouse' && !event.currentTarget.hasPointerCapture(event.pointerId)) { points.current.delete(event.pointerId); travel.current.delete(event.pointerId) }
    }}>
      <div className="booking-seat-canvas" style={{ width: mapWidth * zoom, height: mapHeight * zoom }}><div ref={world} className="booking-seat-world" style={{ width: mapWidth, transform: `scale(${zoom})` }}>
        <div className="booking-stage"><span>{t.stage}</span><i aria-hidden="true" /></div>
        {sections.map((section, sectionIndex) => <fieldset className={`booking-seat-section tone-${section.color}`} key={section.key}><legend>{section.label[lang]}{section.price !== undefined && <> <span>{bookingMoney(section.price, lang)}</span></>}</legend>
          {section.rows.map((row, rowIndex) => {
            const r = rows.findIndex((item) => item.sectionIndex === sectionIndex && item.rowIndex === rowIndex)
            const aisle = aisleAfter(row.seats.length)
            // One column for the row label, one per seat, and one for the aisle when there is one
            const columns = aisle ? `${ROW_LABEL}px repeat(${aisle}, ${SEAT_SIZE}px) ${AISLE}px repeat(${row.seats.length - aisle}, ${SEAT_SIZE}px)` : `${ROW_LABEL}px repeat(${row.seats.length}, ${SEAT_SIZE}px)`
            return <div className="booking-seat-row" key={row.label} style={{ gridTemplateColumns: columns, ...(live ? { justifyContent: 'center' } : {}) }}><span className="booking-row-label" aria-hidden="true">{row.label}</span>
              {row.seats.map((seat, column) => {
                const index = rowStarts[r] + column
                const category = catalogue.categories.find((category) => category.id === seat.categoryId)
                const status = purchasedIds.includes(seat.id) ? 'sold' : selectedIds.includes(seat.id) ? 'selected' : seat.status
                // The section name is only added when it says something the category name doesn't (real venues)
                const where = category && category.name[lang] === section.label[lang] ? '' : `, ${section.label[lang]}`
                const label = `${category ? category.name[lang] : t.notOnSale}${where}, ${t.row} ${seat.row}, ${t.seat} ${bookingNumber(seat.number, lang)}${category ? `, ${bookingMoney(category.price, lang)}` : ''}, ${t[status]}`
                return <Fragment key={seat.id}><button type="button" data-seat-index={index} className={`booking-seat is-${status}${inspectedId === seat.id ? ' is-inspected' : ''}${category ? ` tone-${category.color}` : ''}`} tabIndex={tabbable === index ? 0 : -1} aria-pressed={status === 'selected'} aria-disabled={disabled || status === 'sold' || status === 'held'} aria-label={label} onFocus={() => setFocusIndex(index)} onKeyDown={(event) => keyDown(event, r, column)} onClick={() => { if (!dragged.current) onInspect(seat) }}>
                  <span>{bookingNumber(seat.number, lang)}</span>{status === 'selected' && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>}
                </button>{aisle !== null && column === aisle - 1 && <span className="booking-seat-aisle" aria-hidden="true" />}</Fragment>
              })}
            </div>
          })}
        </fieldset>)}
      </div></div>
    </div><p className="booking-map-caption">{t.seatingNote}</p>
  </section>
}
