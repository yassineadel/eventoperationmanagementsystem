import type { ReactNode } from 'react'
import { useBooking } from './bookingContext'
import { useBookingStrings } from './liveStrings'

/**
 * The provider restores reservations globally, so the cart badge also survives a
 * refresh on Home. Buying screens wait for that same request before showing tickets.
 */
export default function LiveBookingRestore({ children }: { children: ReactNode }) {
  const { restoration, retryRestore } = useBooking()
  const t = useBookingStrings()
  if (restoration === 'loading') return <section className="home-container" role="status"><p>{t.restoring}</p></section>
  if (restoration === 'failed') return <section className="home-container discovery-not-found" role="alert"><h1 className="discovery-title">{t.loadError}</h1><button type="button" className="home-button" onClick={retryRestore}>{t.retry}</button></section>
  return children
}
