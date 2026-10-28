import { useEffect, useState } from 'react'
import { usePreferences } from '../Auth/preferences'
import { homepageQuery } from '../../lib/homepageApi'
import { useApiListing } from '../../lib/useEventsApi'
import { useHomepageEvents, useHomepageVenues } from './useHomepageApi'
import { homeStrings } from './strings'
import { emptyFilters, type EventView, type Filters } from './types'
import { useRecommendations } from './useRecommendations'
import Navbar from './components/Navbar'
import HeroSection from './components/HeroSection'
import EventHub from './components/EventHub'
import VenueDiscovery from './components/VenueDiscovery'
import RecommendationDialog from './components/RecommendationDialog'
import Footer from './components/Footer'
import './Homepage.css'

function Homepage() {
  const { lang, theme } = usePreferences()
  const t = homeStrings[lang]
  const [draft, setDraft] = useState<Filters>(emptyFilters)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [view, setView] = useState<EventView>('trending')
  const [personaliseOpen, setPersonaliseOpen] = useState(false)
  const { preferences, updatePreferences } = useRecommendations()
  const query = homepageQuery(filters, view, preferences)
  const results = useHomepageEvents(query.filters, query.conflict)
  const hero = useApiListing(homepageQuery(emptyFilters, 'trending', { interests: [], city: '' }).filters, true)
  const venues = useHomepageVenues()
  const active = Object.values(filters).some(Boolean) || Object.values(draft).some(Boolean)
  useEffect(() => { document.title = t.title }, [t.title])

  function clearFilters() { setDraft(emptyFilters); setFilters(emptyFilters) }
  return <div id="home" className="home-root" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} data-theme={theme}>
    <a className="home-skip-link" href="#home-main">{t.skip}</a><Navbar t={t} onViewChange={setView} />
    <main id="home-main" tabIndex={-1}><HeroSection t={t} lang={lang} event={hero.data?.events.find((event) => event.status === 'available') ?? hero.data?.events[0] ?? null} loading={hero.status === 'loading'} failed={hero.status === 'error' || hero.status === 'not-found'} onRetry={hero.retry} />
      <EventHub t={t} lang={lang} draft={draft} setDraft={setDraft} resource={results} onSearch={() => setFilters({ ...draft })} onClear={clearFilters} active={active} view={view} onViewChange={setView} preferences={preferences} onPreferencesChange={updatePreferences} onPersonalise={() => setPersonaliseOpen(true)} />
      <VenueDiscovery resource={venues} lang={lang} t={t} />
    </main><Footer t={t} />
    {personaliseOpen && <RecommendationDialog lang={lang} t={t} preferences={preferences} onChange={updatePreferences} onClose={() => setPersonaliseOpen(false)} />}
  </div>
}
export default Homepage
