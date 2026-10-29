import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PreferenceControls } from '../../Auth/AuthParts'
import { useSession } from '../../Auth/sessionContext'
import AccountMenu from '../../Profile/AccountMenu'
import { profileStrings } from '../../Profile/strings'
import { usePreferences } from '../../Auth/preferences'
import type { HomeStrings } from '../strings'
import type { EventView } from '../types'
import Icon from './Icon'
import { useBooking } from '../../Booking/bookingContext'
import { bookingNumber, bookingStrings } from '../../Booking/strings'

export function Brand({ name }: { name: string }) {
  return <Link className="home-brand" to="/" aria-label={name}><span className="home-brand-mark"><Icon name="ticket" size={27} /></span><span>{name}</span></Link>
}
export default function Navbar({ t, onViewChange }: { t: HomeStrings; onViewChange?: (view: EventView) => void }) {
  const { pathname, search, hash } = useLocation()
  const { user } = useSession()
  const { lang } = usePreferences()
  const { state: booking } = useBooking()
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLElement>('a')?.focus()
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus() } }
    function closeOnResize() { if (window.innerWidth > 1000) setOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnResize)
    return () => { document.removeEventListener('keydown', closeOnEscape); window.removeEventListener('resize', closeOnResize) }
  }, [open])
  return <header className="home-header"><div className={`home-container home-navbar${booking.items.length ? ' has-cart' : ''}`}>
    <Brand name={t.brand} />
    <Link className={`home-booking-cart${booking.items.length ? ' has-items' : ''}`} to="/cart" aria-label={`${bookingStrings[lang].stepCart}: ${bookingNumber(booking.items.length, lang)} ${bookingStrings[lang].tickets}`}><Icon name="cart" size={20} />{booking.items.length > 0 && <span aria-hidden="true">{bookingNumber(booking.items.length, lang)}</span>}</Link>
    {user ? <Link className="home-mobile-account" to="/profile" aria-label={profileStrings[lang].profile}><Icon name="user" size={20} /></Link> : <Link className="home-button home-mobile-signup" to="/register">{t.register}</Link>}
    <button ref={menuButton} className="home-menu-button" aria-label={open ? t.closeMenu : t.menu} aria-expanded={open} aria-controls="home-navigation" onClick={() => setOpen(!open)}><Icon name={open ? 'close' : 'menu'} size={24} /></button>
    <div ref={menu} id="home-navigation" className={`home-navigation${open ? ' is-open' : ''}`}>
      <nav aria-label={t.navigation}>
        <Link to="/" aria-current={pathname === '/' && hash !== '#venues' ? 'page' : undefined} onClick={() => { onViewChange?.('trending'); setOpen(false) }}>{t.home}</Link>
        <Link to="/events" aria-current={pathname === '/events' ? 'page' : undefined} onClick={() => setOpen(false)}>{t.events}</Link>
        <Link to="/#venues" aria-current={pathname === '/' && hash === '#venues' ? 'location' : undefined} onClick={() => setOpen(false)}>{t.venues}</Link>
        <Link to="/my-tickets" aria-current={pathname.startsWith('/my-tickets') || pathname.startsWith('/orders/') ? 'page' : undefined} onClick={() => setOpen(false)}>{lang === 'ar' ? 'تذاكري' : 'My Tickets'}</Link>
      </nav>
      <div className="home-nav-actions"><PreferenceControls variant="main" /><AccountMenu key={`${pathname}${search}`} onNavigate={() => setOpen(false)} />{!user && <><Link className="home-signin" to="/login">{t.login}</Link><Link className="home-button home-button--small" to="/register">{t.register}</Link></>}</div>
    </div>
  </div></header>
}
