import { Link } from 'react-router-dom'
import type { Language, Venue } from '../types'
import { cityNames, type HomeStrings } from '../strings'
import { useScrollReveal } from '../useScrollReveal'
import Icon from './Icon'

export default function VenueDiscovery({ venues, lang, t }: {
  venues: Venue[]; lang: Language; t: HomeStrings
}) {
  const revealRef = useScrollReveal<HTMLDivElement>(venues.length)

  return (
    <section id="venues" className="home-venues home-section" aria-labelledby="venues-title">
      <div className="home-container">
        <div className="home-venues-heading"><h2 id="venues-title">{t.venues}</h2><p>{t.venuesLead}</p></div>
        <div ref={revealRef} className="home-venues-grid">
          {venues.map((venue) => (
            <article className="home-venue-card" key={venue.id} data-scroll-reveal="">
              <Link className="home-venue-link" to={`/events?${new URLSearchParams({ q: venue.name.en, city: venue.city })}`} aria-label={`${t.venueEvents}: ${venue.name[lang]}`}>
                <div className="home-venue-photo"><img className="home-venue-image" src={venue.image} alt="" loading="lazy" width="640" height="512" /></div>
                <div className="home-venue-caption">
                  <div className="home-venue-content">
                    <h3>{venue.name[lang]}</h3>
                    <p><Icon name="pin" size={14} />{cityNames[venue.city][lang]}</p>
                  </div>
                  <span className="home-venue-arrow" aria-hidden="true"><Icon name="arrow" size={22} /></span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
