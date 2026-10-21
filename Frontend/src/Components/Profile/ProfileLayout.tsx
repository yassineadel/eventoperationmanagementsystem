import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { useSession } from '../Auth/sessionContext'
import type { SessionUser } from '../../lib/sessionUser'
import Icon from '../Homepage/components/Icon'
import { profileStrings, type ProfileStrings } from './strings'
import type { Profile } from './profileModel'
import type { ProfileContext } from './profileContext'
import './Profile.css'

function ProfileAccount({ user, t, settings }: { user: SessionUser; t: ProfileStrings; settings: boolean }) {
  const profile: Profile = {
    fullName: user.fullName, email: user.email, phone: user.phone, emailVerified: user.emailVerified,
    communications: { eventNews: false, personalisedOffers: false }, deletionRequestedAt: null,
  }
  const initials = profile.fullName.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join('').toLocaleUpperCase()
  const heading = <header className="account-heading">
    {settings ? <nav className="account-breadcrumbs" aria-label={t.account}><Link to="/profile">{t.account}</Link><span aria-hidden="true">/</span><span aria-current="page">{t.settings}</span></nav> : <p className="discovery-eyebrow">{t.account}</p>}
    <h1 className="discovery-title">{settings ? t.settingsTitle : t.profileTitle}</h1><p>{settings ? t.settingsLead : t.profileLead}</p>
  </header>

  return <div className={`account-page home-container${settings ? ' account-page--settings' : ''}`}>
    {!settings && heading}
    <div className="account-notice"><Icon name="user" size={22} /><div><strong>{t.account}</strong><p>{t.liveNote}</p></div></div>
    <div className="account-layout">
      <aside className="account-sidebar"><div className="account-identity"><span className="account-avatar" aria-hidden="true">{initials}</span><strong>{profile.fullName}</strong><bdi dir="ltr">{profile.email}</bdi></div>
        <nav aria-label={t.account}><NavLink end to="/profile"><Icon name="user" size={19} />{t.profile}</NavLink><NavLink to="/profile/settings"><Icon name="settings" size={19} />{t.settings}</NavLink></nav>
        <Link className="account-saved-link" to="/events?saved=1"><Icon name="bookmark" size={18} />{t.savedEvents}<Icon name="arrow" size={16} /></Link>
      </aside>
      <div className="account-content">{settings && heading}<Outlet context={{ profile, preview: false, updatePreview: () => false } satisfies ProfileContext} /></div>
    </div>
  </div>
}

export default function ProfileLayout() {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const session = useSession()
  const { pathname } = useLocation()
  const settings = pathname.endsWith('/settings')
  useEffect(() => { document.title = `${settings ? t.settings : t.profile} | ${lang === 'ar' ? 'حفلتنا' : 'Hafletna'}` }, [settings, t, lang])

  if (session.status === 'authenticated' && session.user) return <ProfileAccount key={session.user.id} user={session.user} t={t} settings={settings} />
  return <div className="account-gate home-container"><span className="account-gate-icon"><Icon name="user" size={32} /></span><h1 className="discovery-title">{t.signInTitle}</h1>
    <p role="status">{session.status === 'loading' ? t.loading : session.status === 'unavailable' ? t.unavailable : t.signInLead}</p>
    <div className="account-actions"><Link className="home-button" to={`/login?${new URLSearchParams({ returnTo: pathname })}`}>{t.signIn}<Icon name="arrow" size={18} /></Link>{session.status === 'unavailable' && <button className="home-text-link" onClick={() => void session.refresh()}>{t.retry}</button>}</div>
    <Link className="home-text-link" to="/">{t.backHome}</Link>
  </div>
}
