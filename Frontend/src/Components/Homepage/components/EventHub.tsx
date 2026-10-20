import { useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { categoryNames, cityNames, type HomeStrings } from '../strings'
import { recommendedEvents, trendingEvents } from '../recommendations'
import type { Category, Event, EventView, Filters, Language, RecommendationPreferences } from '../types'
import { useScrollReveal } from '../useScrollReveal'
import EventCard from './EventCard'
import Icon from './Icon'

const views: EventView[] = ['upcoming', 'trending', 'for-you']

function EventResults({ events, view, lang, t }: {
  events: Event[]; view: EventView; lang: Language; t: HomeStrings;
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? events : events.slice(0, 3)
  const revealRef = useScrollReveal<HTMLDivElement>(visible.length)

  return <>
    <div ref={revealRef} className="home-event-grid">
      {visible.map((event, index) => (
        <div key={event.id} className="home-event-result" data-scroll-reveal="">
          <EventCard event={event} lang={lang} t={t} rank={view === 'trending' ? index + 1 : undefined} />
        </div>
      ))}
    </div>
    {events.length > 3 && <div className="home-show-more"><button className="home-text-link" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? t.showLess : t.showMore}<Icon name="arrow" size={17} /></button></div>}
  </>
}

export default function EventHub({ t, lang, draft, setDraft, events, onSearch, onClear, active, view, onViewChange, preferences, onPreferencesChange, onPersonalise }: {
  t: HomeStrings; lang: Language; draft: Filters; setDraft: (filters: Filters) => void; events: Event[];
  onSearch: () => void; onClear: () => void; active: boolean;
  view: EventView; onViewChange: (view: EventView) => void;
  preferences: RecommendationPreferences; onPreferencesChange: (next: RecommendationPreferences) => void;
  onPersonalise: () => void;
}) {
  const results = view === 'trending' ? trendingEvents(events, events.length)
    : view === 'for-you' ? recommendedEvents(events, preferences) : events
  const labels = { upcoming: t.upcoming, trending: t.trending, 'for-you': t.forYou }
  const personalised = Boolean(preferences.interests.length || preferences.city)
  const caption = view === 'trending' ? t.trendingLead
    : view === 'for-you' ? personalised ? t.recommendationsActive : t.recommendationsDefault : t.discoveryLead

  function handleSubmit(event: FormEvent) { event.preventDefault(); onSearch() }
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const direction = lang === 'ar' ? -1 : 1
    const step = event.key === 'ArrowRight' ? direction : event.key === 'ArrowLeft' ? -direction : 0
    const current = views.indexOf(view)
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : step ? (current + step + views.length) % views.length : -1
    if (index < 0) return
    event.preventDefault()
    onViewChange(views[index])
    document.getElementById(`event-tab-${views[index]}`)?.focus()
  }

  return (
    <section id="discover" className="home-discovery home-container home-section" aria-labelledby="discovery-title">
        <form className="home-search" role="search" aria-label={t.search} onSubmit={handleSubmit}>
          <div className="home-search-field home-search-field--query"><label htmlFor="event-query">{t.searchLabel}</label><div><Icon name="search" size={18} /><input id="event-query" type="search" value={draft.query} onChange={(event) => setDraft({ ...draft, query: event.target.value })} placeholder={t.searchPlaceholder} /></div></div>
          <div id="categories" className="home-search-field home-search-field--category"><label htmlFor="event-category">{t.categoryLabel}</label><div><Icon name={draft.category || 'ticket'} size={18} /><select id="event-category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category | '' })}><option value="">{t.anyCategory}</option>{Object.entries(categoryNames).map(([id, name]) => <option key={id} value={id}>{name[lang]}</option>)}</select></div></div>
          <div className="home-search-field home-search-field--city"><label htmlFor="event-city">{t.cityLabel}</label><div><Icon name="pin" size={18} /><select id="event-city" value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value as Filters['city'] })}><option value="">{t.anyCity}</option>{Object.entries(cityNames).map(([id, name]) => <option key={id} value={id}>{name[lang]}</option>)}</select></div></div>
          <div className="home-search-field"><label htmlFor="event-date">{t.dateLabel}</label><input id="event-date" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></div>
          <button className="home-search-submit" type="submit" aria-label={t.search}><span>{t.search}</span><Icon name="arrow" size={23} /></button>
        </form>
        <div className="home-lineup-heading">
          <h2 id="discovery-title">{t.discoveryTitle}</h2>
          <div className="home-event-tabs" role="tablist" aria-label={t.eventViews} style={{ '--active-tab': views.indexOf(view) } as CSSProperties}>
            {views.map((mode) => <button key={mode} id={`event-tab-${mode}`} role="tab" aria-selected={view === mode} aria-controls="event-panel" tabIndex={view === mode ? 0 : -1} onClick={() => onViewChange(mode)} onKeyDown={handleTabKey}>{labels[mode]}</button>)}
          </div>
        </div>
      <div id="event-panel" role="tabpanel" aria-labelledby={`event-tab-${view}`}>
        <p className="home-sr-only">{caption}</p>
        {view === 'for-you' && <button className="home-personalise-link" onClick={onPersonalise}>{t.personalise}</button>}
        <div className="home-results-bar"><p role="status" aria-live="polite"><strong>{new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en').format(results.length)}</strong> {results.length === 1 ? t.oneResult : t.results}</p>{active && <button className="home-text-link" onClick={onClear}>{t.clear}<Icon name="close" size={16} /></button>}</div>
        <div className="home-event-content" key={view}>
          {results.length ? <EventResults key={`${view}:${results.map((event) => event.id).join(',')}`} events={results} view={view} lang={lang} t={t} /> : <div className="home-empty"><Icon name="search" size={38} /><h3>{t.emptyTitle}</h3><p>{t.emptyLead}</p><button className="home-button" onClick={() => { onClear(); if (view === 'for-you') onPreferencesChange({ interests: [], city: '' }) }}>{view === 'for-you' ? t.resetPreferences : t.clear}</button></div>}
        </div>
        <p className="home-demo-note">{view === 'trending' ? `${t.demo} ${t.trendingDemo}` : t.demo}</p>
      </div>
    </section>
  )
}
