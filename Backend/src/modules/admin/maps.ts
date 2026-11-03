// Reads the coordinates out of a Google Maps link the admin pasted, so a venue can be placed on a map
// without a Maps API key. Short share links (maps.app.goo.gl, goo.gl/maps) are followed to the full link.

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)

const PATTERNS = [
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // the place's own pin (most precise)
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // the map's centre
  /[?&](?:q|query|ll|center|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i,
]

export const coordinatesIn = (url: string): { latitude: number; longitude: number } | null => {
  const text = decodeURIComponent(url)
  for (const pattern of PATTERNS) {
    const m = text.match(pattern)
    if (m && valid(Number(m[1]), Number(m[2]))) return { latitude: Number(m[1]), longitude: Number(m[2]) }
  }
  return null
}

// exact Google Maps hosts only, so the server never fetches an address like google.attacker.com
const GOOGLE_HOSTS = /^(?:(?:www\.|maps\.)?google\.(?:com|com\.eg|co\.uk|de|fr|ae|com\.sa)|maps\.app\.goo\.gl|goo\.gl)$/i

export class MapLinkError extends Error {}

/**
 * Turns a Google Maps link into coordinates. Only Google hosts are fetched, so the server is never
 * asked to visit an arbitrary address.
 */
export const resolveMapLink = async (raw: string) => {
  let url: URL
  try {
    url = new URL(String(raw ?? '').trim())
  } catch {
    throw new MapLinkError('Paste the full Google Maps link (it starts with https://)')
  }
  if (url.protocol !== 'https:' || !GOOGLE_HOSTS.test(url.hostname)) {
    throw new MapLinkError('This is not a Google Maps link. In Google Maps, press Share and copy the link.')
  }

  let found = coordinatesIn(url.href)
  let finalUrl = url.href
  if (!found) {
    // short link: follow the redirects (at most a few hops, Google hosts only)
    let next = url.href
    for (let hop = 0; hop < 4 && !found; hop++) {
      const res = await fetch(next, { redirect: 'manual', signal: AbortSignal.timeout(8000) }).catch(() => null)
      const location = res?.headers.get('location')
      if (!location) break
      const target = new URL(location, next)
      if (!GOOGLE_HOSTS.test(target.hostname)) break
      next = finalUrl = target.href
      found = coordinatesIn(next)
    }
  }
  if (!found) throw new MapLinkError('Could not find the location in this link. Open the place in Google Maps, press Share, and paste that link.')
  return { ...found, mapUrl: url.href, resolvedUrl: finalUrl }
}
