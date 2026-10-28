import { Link } from 'react-router-dom'
import { useState, type CSSProperties } from 'react'
import type { Language } from '../types'
import type { HomeStrings } from '../strings'
import type { PublicVenue } from '../../../lib/homepageApi'
import type { Resource } from '../../../lib/useEventsApi'
import { useScrollReveal } from '../useScrollReveal'
import Icon from './Icon'

function VenueCard({ venue, lang, t }: { venue: PublicVenue; lang: Language; t: HomeStrings }) {
  const [failed, setFailed] = useState(false)
  const query = new URLSearchParams({ q: venue.name.en })
  if (venue.searchCity) query.set('city', venue.searchCity)
  return <article className="home-venue-card" data-scroll-reveal="">
    <Link className="home-venue-link" to={`/events?${query}`} aria-label={`${t.venueEvents}: ${venue.name[lang]}`}>
      <div className="home-venue-photo">{!failed ? <img className="home-venue-image" src={venue.image} alt="" loading="lazy" width="640" height="512" onError={() => setFailed(true)} /> : <div className="home-venue-image home-venue-image-fallback"><Icon name="pin" size={55} /></div>}{venue.illustrativeImage && !failed && <span className="home-venue-photo-note">{t.illustrativePhoto}</span>}</div>
      <div className="home-venue-caption"><div className="home-venue-content"><h3>{venue.name[lang]}</h3><p><Icon name="pin" size={14} />{venue.city[lang]}</p></div><span className="home-venue-arrow" aria-hidden="true"><Icon name="arrow" size={22} /></span></div>
    </Link>
  </article>
}

export default function VenueDiscovery({ resource, lang, t }: {
  resource: Resource<PublicVenue[]>; lang: Language; t: HomeStrings
}) {
  const venues = resource.data ?? []
  const revealRef = useScrollReveal<HTMLDivElement>(venues.length)

  return (
    <section id="venues" className="home-venues home-section" aria-labelledby="venues-title">
      <div className="home-container">
        <div className="home-venues-heading"><h2 id="venues-title">{t.venues}</h2><p>{t.venuesLead}</p></div>
        {resource.status === 'loading' ? <div className="home-api-message" role="status">{t.loadingVenues}</div>
          : resource.status === 'error' || resource.status === 'not-found' ? <div className="home-api-message" role="alert"><p>{t.venuesError}</p><button className="home-outline-button" onClick={resource.retry}>{t.retry}</button></div>
          : venues.length ? <div ref={revealRef} className="home-venues-grid" style={{ '--venue-columns': Math.min(venues.length, 3) } as CSSProperties}>{venues.map((venue) => <VenueCard key={venue.id} venue={venue} lang={lang} t={t} />)}</div>
          : <p className="home-api-message">{t.venuesEmpty}</p>}
      </div>
    </section>
  )
}
