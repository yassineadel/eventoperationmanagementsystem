import { Outlet } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { homeStrings } from '../Homepage/strings'
import Navbar from '../Homepage/components/Navbar'
import Footer from '../Homepage/components/Footer'
import '../Homepage/Homepage.css'
import './Discovery.css'

export default function DiscoveryLayout() {
  const { lang, theme } = usePreferences()
  const t = homeStrings[lang]
  return <div className="home-root discovery-root" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} data-theme={theme}>
    <a className="home-skip-link" href="#discovery-main">{t.skip}</a>
    <Navbar t={t} />
    <main id="discovery-main" tabIndex={-1}><Outlet /></main>
    <Footer t={t} />
  </div>
}
