import type { FormEvent } from 'react'
import { categoryNames, cityNames, type HomeStrings } from '../strings'
import type { Category, Filters, Language } from '../types'
import Icon from './Icon'

export default function EventSearch({ t, lang, draft, setDraft, onSearch }: {
  t: HomeStrings; lang: Language; draft: Filters; setDraft: (filters: Filters) => void; onSearch: () => void
}) {
  function submit(event: FormEvent) { event.preventDefault(); onSearch() }
  return <form className="home-search" role="search" aria-label={t.search} onSubmit={submit}>
    <div className="home-search-field home-search-field--query"><label htmlFor="event-query">{t.searchLabel}</label><div><Icon name="search" size={21} /><input id="event-query" type="search" value={draft.query} onChange={(event) => setDraft({ ...draft, query: event.target.value })} placeholder={t.searchPlaceholder} /></div></div>
    <div className="home-search-field home-search-field--city"><label htmlFor="event-city">{t.cityLabel}</label><div><Icon name="pin" size={20} /><select id="event-city" value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value as Filters['city'] })}><option value="">{t.anyCity}</option>{Object.entries(cityNames).map(([id, name]) => <option key={id} value={id}>{name[lang]}</option>)}</select></div></div>
    <div id="categories" className="home-search-field home-search-field--category"><label htmlFor="event-category">{t.categoryLabel}</label><div><Icon name="filter" size={20} /><select id="event-category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category | '' })}><option value="">{t.anyCategory}</option>{Object.entries(categoryNames).map(([id, name]) => <option key={id} value={id}>{name[lang]}</option>)}</select></div></div>
    <div className="home-search-field home-search-field--date"><label htmlFor="event-date">{t.dateLabel}</label><Icon name="calendar" size={19} /><input id="event-date" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></div>
    <button className="home-search-submit" type="submit" aria-label={t.search}><span>{t.searchAction}</span><Icon name="arrow" size={20} /></button>
  </form>
}
