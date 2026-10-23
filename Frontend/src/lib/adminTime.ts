// Dates and "now" for the admin console.
//
// The console works with Cairo wall-clock times written as "YYYY-MM-DDTHH:mm", which is
// also what a datetime-local input reads and writes. Values in any other shape, such as
// the API's "2026-10-24T17:00:00.000Z", are converted to that form first, so formatting
// never throws on real data and every admin sees event times as they are in Cairo,
// wherever their computer is.

export const EVENT_TIME_ZONE = 'Africa/Cairo'

const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const NAIVE_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/

const cairo = new Intl.DateTimeFormat('en-GB', {
  timeZone: EVENT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Any date string as a Cairo wall time, or null when it can't be read. */
export function toWall(value: string | null | undefined): string | null {
  if (!value) return null
  if (WALL.test(value)) return value
  if (NAIVE_SECONDS.test(value)) return value.slice(0, 16)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const part = Object.fromEntries(cairo.formatToParts(date).map((p) => [p.type, p.value]))
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`
}

/** A wall time as a Date whose UTC fields hold the wall-clock values; format it with timeZone 'UTC'. */
export function wallDate(wall: string) {
  return new Date(`${wall}:00Z`)
}

export function minutesAfter(wall: string, minutes: number) {
  const d = wallDate(wall)
  d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return d.toISOString().slice(0, 16)
}

/** Days from one wall time to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return (wallDate(to).getTime() - wallDate(from).getTime()) / 86_400_000
}

/* ----------------------------------------------------------------- clock */

/**
 * The sample data is written around 19 October 2026, so while the console runs on it
 * "now" is pinned there and past/upcoming events stay put. Call `switchToRealClock()` once the
 * console reads live data.
 */
export const SAMPLE_NOW = '2026-10-19T12:00'

let clock: () => string = () => SAMPLE_NOW

export function now() {
  return clock()
}

export function setClock(next: () => string) {
  clock = next
}

export function switchToRealClock() {
  clock = () => toWall(new Date().toISOString())!
}
