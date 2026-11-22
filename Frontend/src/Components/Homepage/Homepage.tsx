import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { homepageQuery } from '../../lib/homepageApi'
import { listingApiQuery } from '../../lib/eventsModel'
import { useFeaturedEvents, useHomepageEvents, useHomepageVenues } from './useHomepageApi'
import { homeStrings } from './strings'
import { emptyFilters, type EventView, type Filters } from './types'
import { useRecommendations } from './useRecommendations'
import Navbar from './components/Navbar'
import FeaturedCarousel from './components/FeaturedCarousel'
import EventHub from './components/EventHub'
import VenueDiscovery from './components/VenueDiscovery'
import RecommendationDialog from './components/RecommendationDialog'
import Footer from './components/Footer'
import EventSearch from './components/EventSearch'
import './Homepage.css'
import './EventBoard.css'

function Homepage() {
  const { lang, theme } = usePreferences()
  const { hash } = useLocation()
  const t = homeStrings[lang]
  const [draft, setDraft] = useState<Filters>(emptyFilters)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [view, setView] = useState<EventView>('upcoming')
  const [personaliseOpen, setPersonaliseOpen] = useState(false)
  const { preferences, updatePreferences } = useRecommendations()
  const query = homepageQuery(filters, view, preferences)
  const results = useHomepageEvents(query.filters, query.conflict)
  // The carousel shows only the events an admin switched on in the console ("Show in homepage carousel").
  // With none switched on it is hidden, and the search bar moves up.
  const chosen = useFeaturedEvents()
  const featured = chosen.data?.events ?? []
  const showCarousel = chosen.status === 'loading' || featured.length > 0
  const venues = useHomepageVenues()
  const active = Object.values(filters).some(Boolean) || Object.values(draft).some(Boolean)
  useEffect(() => { document.title = t.title }, [t.title])

  function clearFilters() { setDraft(emptyFilters); setFilters(emptyFilters) }
  return <div id="home" className={`home-root home-board${showCarousel ? '' : ' home-board--no-carousel'}`} lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} data-theme={theme} data-anchor={hash === '#venues' ? 'venues' : undefined}>
    <a className="home-skip-link" href="#home-main">{t.skip}</a><Navbar t={t} onViewChange={setView} />
    <main id="home-main" tabIndex={-1}>
      {showCarousel && <div className="home-container board-carousel-wrap"><FeaturedCarousel t={t} lang={lang} events={featured} loading={chosen.status === 'loading'} /></div>}
      <div className="home-container board-search-dock"><EventSearch t={t} lang={lang} draft={draft} setDraft={setDraft} onSearch={() => setFilters({ ...draft })} /></div>
      <header className="board-heading home-container"><div><span className="board-eyebrow">{lang === 'ar' ? 'ما يحدث في مصر' : "What's on in Egypt"}</span><h1>{t.pageHeading}</h1></div><p>{t.pageLead}</p></header>
      <div className="board-discovery-layout home-container">
        <EventHub t={t} lang={lang} resource={results} onClear={clearFilters} active={active} view={view} onViewChange={setView} preferences={preferences} onPreferencesChange={updatePreferences} onPersonalise={() => setPersonaliseOpen(true)} listingHref={`/events?${listingApiQuery(query.filters)}`} />
      </div>
      <VenueDiscovery resource={venues} lang={lang} t={t} />
    </main><Footer t={t} appearance="board" />
    {personaliseOpen && <RecommendationDialog lang={lang} t={t} preferences={preferences} onChange={updatePreferences} onClose={() => setPersonaliseOpen(false)} />}
  </div>
}
export default Homepage
