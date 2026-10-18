import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { events } from '../Homepage/data/events'
import { categoryNames, cityNames, homeStrings } from '../Homepage/strings'
import { formatDate } from '../Homepage/discovery'
import type { Category } from '../Homepage/types'
import EventCard from '../Homepage/components/EventCard'
import Icon from '../Homepage/components/Icon'
import { discoveryStrings } from './strings'
import { eventUiStrings } from './eventUiStrings'
import { useSavedEvents } from './savedEventsContext'
import { getListingResults, listingSearchParams, parseListingFilters, type ListingFilters, type SortOrder } from './listing'

function ListingSearch({ query, placeholder, label, onSearch }: { query: string; placeholder: string; label: string; onSearch: (query: string) => void }) {
  const [draft, setDraft] = useState(query)
  function submit(event: FormEvent) { event.preventDefault(); onSearch(draft) }
  return <form className="listing-search" role="search" aria-label={label} onSubmit={submit}>
    <label className="home-sr-only" htmlFor="listing-query">{label}</label>
    <Icon name="search" /><input id="listing-query" type="search" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} />
    <button className="home-button" type="submit">{label}<Icon name="arrow" size={18} /></button>
  </form>
}

export default function EventsListing() {
  const { lang } = usePreferences()
  const t = discoveryStrings[lang]
  const savedText = eventUiStrings[lang]
  const { savedIds, isPersistent } = useSavedEvents()
  const home = homeStrings[lang]
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sidebarOpen = filtersOpen || hash === '#categories'
  const filters = parseListingFilters(params)
  const results = getListingResults(events, filters, lang, savedIds)
  const noSavedEvents = filters.savedOnly && savedIds.length === 0
  const number = (value: number) => new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en').format(value)
  useEffect(() => { document.title = t.listingPageTitle }, [t.listingPageTitle])

  function update(next: Partial<ListingFilters>, resetPage = true) {
    if (sidebarOpen) setFiltersOpen(true)
    setParams(listingSearchParams({ ...filters, ...next, page: resetPage ? 1 : next.page ?? results.page }))
  }
  function clear() {
    if (sidebarOpen) setFiltersOpen(true)
    setParams(listingSearchParams({ ...parseListingFilters(new URLSearchParams()), sort: filters.sort }))
  }
  function toggleCategory(category: Category) {
    update({ categories: filters.categories.includes(category) ? filters.categories.filter((item) => item !== category) : [...filters.categories, category] })
  }
  function toggleSidebar() {
    setFiltersOpen(!sidebarOpen)
    if (sidebarOpen && hash) navigate({ pathname: '/events', search: `?${params}`, hash: '' }, { replace: true })
  }
  function changePage(page: number) {
    update({ page }, false)
    document.getElementById('listing-results-title')?.focus({ preventScroll: true })
    document.getElementById('listing-results-title')?.scrollIntoView({ behavior: 'instant', block: 'start' })
  }

  const chips: { id: string; label: string; remove: () => void }[] = []
  if (filters.query) chips.push({ id: 'query', label: `${t.search}: ${filters.query}`, remove: () => update({ query: '' }) })
  if (filters.savedOnly) chips.push({ id: 'saved', label: savedText.savedEvents, remove: () => update({ savedOnly: false }) })
  filters.categories.forEach((category) => chips.push({ id: category, label: categoryNames[category][lang], remove: () => toggleCategory(category) }))
  if (filters.city) chips.push({ id: 'city', label: cityNames[filters.city][lang], remove: () => update({ city: '' }) })
  if (filters.from) chips.push({ id: 'from', label: `${t.from}: ${formatDate(`${filters.from}T12:00:00+02:00`, lang)}`, remove: () => update({ from: '' }) })
  if (filters.to) chips.push({ id: 'to', label: `${t.until}: ${formatDate(`${filters.to}T12:00:00+02:00`, lang)}`, remove: () => update({ to: '' }) })
  if (filters.price !== 'all') chips.push({ id: 'price', label: filters.price === 'free' ? t.freeOnly : t.paidOnly, remove: () => update({ price: 'all' }) })
  const sortLabels: Record<SortOrder, string> = { soonest: t.soonest, popular: t.popular, 'price-low': t.priceLow, 'price-high': t.priceHigh, name: t.name }

  return <div className="listing-page home-container">
    <header className="discovery-page-heading"><p className="discovery-eyebrow">{t.allEvents}</p><h1 className="discovery-title">{t.listingTitle}</h1><p>{t.listingLead}</p></header>
    <ListingSearch key={filters.query} query={filters.query} placeholder={t.searchPlaceholder} label={t.search} onSearch={(query) => update({ query })} />
    <button className="listing-filter-toggle home-outline-button" onClick={toggleSidebar} aria-controls="listing-filters" aria-expanded={sidebarOpen}><Icon name="filter" size={18} />{sidebarOpen ? t.hideFilters : t.showFilters}{chips.length > 0 && <span>({number(chips.length)})</span>}</button>
    <div className="listing-layout">
      <aside id="listing-filters" className={`listing-sidebar${sidebarOpen ? ' is-open' : ''}`} aria-label={t.filters}>
        <div className="listing-sidebar-title"><h2>{t.filters}</h2>{chips.length > 0 && <button className="home-text-link" onClick={clear}>{t.clearAll}</button>}</div>
        <fieldset id="categories" className="listing-filter-group"><legend>{t.category}</legend>
          {(Object.keys(categoryNames) as Category[]).map((category) => <label className="listing-checkbox" key={category}><input type="checkbox" checked={filters.categories.includes(category)} onChange={() => toggleCategory(category)} /><span>{categoryNames[category][lang]}</span><span className="listing-category-count">{number(events.filter((event) => event.category === category).length)}</span></label>)}
        </fieldset>
        <div className="listing-filter-group"><label htmlFor="listing-city">{t.city}</label><select id="listing-city" value={filters.city} onChange={(event) => update({ city: event.target.value as ListingFilters['city'] })}><option value="">{home.anyCity}</option>{Object.entries(cityNames).map(([id, name]) => <option key={id} value={id}>{name[lang]}</option>)}</select></div>
        <fieldset className="listing-filter-group" aria-describedby={results.invalidDates ? 'listing-date-error' : undefined}><legend>{t.dateRange}</legend>
          <label htmlFor="listing-from">{t.fromDate}</label><input id="listing-from" type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} />
          <label htmlFor="listing-to">{t.toDate}</label><input id="listing-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update({ to: event.target.value })} />
          {results.invalidDates && <p id="listing-date-error" className="listing-date-error" role="alert">{t.invalidDates}</p>}
        </fieldset>
        <div className="listing-filter-group"><label htmlFor="listing-price">{t.price}</label><select id="listing-price" value={filters.price} onChange={(event) => update({ price: event.target.value as ListingFilters['price'] })}><option value="all">{t.allPrices}</option><option value="free">{t.freeOnly}</option><option value="paid">{t.paidOnly}</option></select></div>
      </aside>
      <section className="listing-results" aria-labelledby="listing-results-title">
        <div className="listing-toolbar">
          <h2 id="listing-results-title" tabIndex={-1}>{filters.savedOnly ? savedText.savedEvents : t.allEvents}</h2>
          <div className="listing-controls">
            <button type="button" className="listing-saved-toggle" aria-pressed={filters.savedOnly} aria-label={savedText.savedOnly} onClick={() => update({ savedOnly: !filters.savedOnly })}><Icon name="bookmark" size={17} /><span>{savedText.saved}</span><span>({number(savedIds.length)})</span></button>
            <div className="listing-sort"><label htmlFor="listing-sort">{t.sortBy}</label><select id="listing-sort" value={filters.sort} onChange={(event) => update({ sort: event.target.value as SortOrder })}>{Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          </div>
        </div>
        {chips.length > 0 && <div className="listing-active-filters" role="group" aria-label={t.activeFilters}>{chips.map((chip) => <button key={chip.id} onClick={chip.remove} aria-label={`${t.removeFilter}: ${chip.label}`}><span>{chip.label}</span><Icon name="close" size={14} /></button>)}<button className="listing-clear-chip" onClick={clear}>{t.clearAll}</button></div>}
        <p className="listing-count" role="status" aria-live="polite">{t.showing} <b>{number(results.start)}–{number(results.end)}</b> {t.of} <b>{number(results.total)}</b> {t.events}</p>
        {filters.savedOnly && <p className="listing-saved-note">{isPersistent ? savedText.savedInBrowser : savedText.savedSession}</p>}
        {results.total ? <div className="listing-grid">{results.events.map((event) => <EventCard key={event.id} event={event} lang={lang} t={home} />)}</div>
          : <div className="home-empty listing-empty"><Icon name={noSavedEvents ? 'bookmark' : 'search'} size={38} /><h3>{noSavedEvents ? savedText.savedEmptyTitle : filters.savedOnly ? savedText.savedFilteredTitle : t.emptyTitle}</h3><p>{results.invalidDates ? t.invalidDates : noSavedEvents ? savedText.savedEmptyLead : t.emptyLead}</p><button className="home-button" onClick={clear}>{noSavedEvents ? t.exploreEvents : t.clearAll}</button></div>}
        {results.pageCount > 1 && <nav className="listing-pagination" aria-label={t.pagination}>
          <button className="listing-page-step" disabled={results.page === 1} onClick={() => changePage(results.page - 1)}><span className="discovery-back-arrow"><Icon name="arrow" size={17} /></span>{t.previous}</button>
          {Array.from({ length: results.pageCount }, (_, index) => index + 1).map((page) => <button key={page} aria-label={`${t.page} ${number(page)}`} aria-current={results.page === page ? 'page' : undefined} onClick={() => changePage(page)}>{number(page)}</button>)}
          <button className="listing-page-step" disabled={results.page === results.pageCount} onClick={() => changePage(results.page + 1)}>{t.next}<Icon name="arrow" size={17} /></button>
        </nav>}
        <p className="discovery-sample-note">{t.demo}</p>
      </section>
    </div>
  </div>
}
