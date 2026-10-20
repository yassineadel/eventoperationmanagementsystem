import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { usePreferences } from '../Auth/preferences'
import type { BookingCatalogue, Seat } from './catalogue'
import { bookingMoney, bookingNumber, bookingStrings } from './strings'

const MAP_WIDTH = 1120
const MAP_HEIGHT = 1040
export default function SeatMap({ catalogue, selectedIds, purchasedIds, onInspect, inspectedId, disabled }: {
  catalogue: BookingCatalogue; selectedIds: string[]; purchasedIds: string[]; onInspect: (seat: Seat) => void; inspectedId?: string; disabled: boolean
}) {
  const { lang } = usePreferences()
  const t = bookingStrings[lang]
  const viewport = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const [mapHeight, setMapHeight] = useState(MAP_HEIGHT)
  const [zoom, setZoom] = useState(1)
  const currentZoom = useRef(1)
  const [focusIndex, setFocusIndex] = useState(1)
  const points = useRef(new Map<number, { x: number; y: number }>())
  const travel = useRef(new Map<number, number>())
  const dragged = useRef(false)
  useEffect(() => { if (viewport.current) viewport.current.scrollLeft = (MAP_WIDTH - viewport.current.clientWidth) / 2 }, [])
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
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'Enter' || event.key === ' ') dragged.current = false
    const column = index % 20
    const destination = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'ArrowDown' ? index + 20 : event.key === 'ArrowUp' ? index - 20 : event.key === 'Home' ? index - column : event.key === 'End' ? index - column + 19 : event.key === 'PageDown' ? index + 80 : event.key === 'PageUp' ? index - 80 : null
    if (destination === null) return
    event.preventDefault()
    const target = viewport.current?.querySelector<HTMLButtonElement>(`[data-seat-index="${Math.max(0, Math.min(239, destination))}"]`)
    target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return <section className="booking-map-card" aria-labelledby="seat-map-title"><div className="booking-panel-heading"><div><p className="discovery-eyebrow">{t.seated}</p><h2 id="seat-map-title">{t.mapTitle}</h2><p>{t.mapLead}</p></div></div>
    <div className="booking-map-toolbar"><ul className="booking-seat-legend">{(['available', 'selected', 'held', 'sold'] as const).map((status) => <li key={status}><span className={`seat-legend-dot is-${status}`} aria-hidden="true" />{t[status]}</li>)}</ul>
      <div className="booking-zoom"><button type="button" onClick={() => changeZoom(currentZoom.current - .2)} disabled={zoom <= .65} aria-label={t.zoomOut}>−</button><output aria-live="polite">{bookingNumber(Math.round(zoom * 100), lang)}%</output><button type="button" onClick={() => changeZoom(currentZoom.current + .2)} disabled={zoom >= 1.75} aria-label={t.zoomIn}>+</button><button className="booking-reset-view" type="button" onClick={() => { changeZoom(1); requestAnimationFrame(() => { if (viewport.current) { viewport.current.scrollTop = 0; viewport.current.scrollLeft = (MAP_WIDTH - viewport.current.clientWidth) / 2 } }) }}>{t.resetView}</button></div>
    </div>
    <p id="seat-map-help" className="booking-map-help">{t.mapHelp}</p>
    <div ref={viewport} className="booking-seat-viewport" role="group" aria-label={t.map} aria-describedby="seat-map-help" dir="ltr" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerLeave={(event) => {
      if (event.pointerType === 'mouse' && !event.currentTarget.hasPointerCapture(event.pointerId)) { points.current.delete(event.pointerId); travel.current.delete(event.pointerId) }
    }}>
      <div className="booking-seat-canvas" style={{ width: MAP_WIDTH * zoom, height: mapHeight * zoom }}><div ref={world} className="booking-seat-world" style={{ transform: `scale(${zoom})` }}>
        <div className="booking-stage"><span>{t.stage}</span><i aria-hidden="true" /></div>
        {catalogue.categories.map((category, sectionIndex) => <fieldset className={`booking-seat-section tone-${category.color}`} key={category.id}><legend>{category.name[lang]} <span>{bookingMoney(category.price, lang)}</span></legend>
          {Array.from({ length: 4 }, (_, rowIndex) => <div className="booking-seat-row" key={rowIndex}><span className="booking-row-label" aria-hidden="true">{String.fromCharCode(65 + sectionIndex * 4 + rowIndex)}</span>
            {catalogue.seats.slice(sectionIndex * 80 + rowIndex * 20, sectionIndex * 80 + rowIndex * 20 + 20).map((seat) => {
              const index = catalogue.seats.indexOf(seat)
              const status = purchasedIds.includes(seat.id) ? 'sold' : selectedIds.includes(seat.id) ? 'selected' : seat.status
              return <Fragment key={seat.id}><button type="button" data-seat-index={index} className={`booking-seat is-${status}${inspectedId === seat.id ? ' is-inspected' : ''}`} tabIndex={focusIndex === index ? 0 : -1} aria-pressed={status === 'selected'} aria-disabled={disabled || status === 'sold' || status === 'held'} aria-label={`${category.name[lang]}, ${t.row} ${seat.row}, ${t.seat} ${bookingNumber(seat.number, lang)}, ${bookingMoney(category.price, lang)}, ${t[status]}`} onFocus={() => setFocusIndex(index)} onKeyDown={(event) => keyDown(event, index)} onClick={() => { if (!dragged.current) onInspect(seat) }}>
                <span>{bookingNumber(seat.number, lang)}</span>{status === 'selected' && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>}
              </button>{seat.number === 10 && <span className="booking-seat-aisle" aria-hidden="true" />}</Fragment>
            })}
          </div>)}
        </fieldset>)}
      </div></div>
    </div><p className="booking-map-caption">{t.seatingNote}</p>
  </section>
}
