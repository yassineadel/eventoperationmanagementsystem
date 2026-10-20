import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { discoveryStrings } from './strings'
import Icon from '../Homepage/components/Icon'

export default function NotFound({ event = false }: { event?: boolean }) {
  const { lang } = usePreferences()
  const t = discoveryStrings[lang]
  const title = event ? t.eventNotFound : t.pageNotFound
  useEffect(() => { document.title = `${title} | ${lang === 'ar' ? 'حفلتنا' : 'Hafletna'}` }, [title, lang])
  return <section className="discovery-not-found home-container">
    <p className="discovery-eyebrow">404</p><h1 className="discovery-title">{title}</h1>
    <p>{event ? t.notFoundLead : t.pageNotFoundLead}</p>
    <Link className="home-button" to="/events">{t.exploreEvents}<Icon name="arrow" /></Link>
  </section>
}
