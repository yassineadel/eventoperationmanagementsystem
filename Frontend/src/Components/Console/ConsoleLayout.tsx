import { Suspense, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { useSession } from '../Auth/sessionContext'
import { Loading, ToastProvider } from './ui'
import './Console.css'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z', end: true },
  { to: '/admin/events', label: 'Events', icon: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z' },
  { to: '/admin/orders', label: 'Orders', icon: 'M2 3h3l3 12h11l3-9H6M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z' },
  { to: '/admin/tickets', label: 'Tickets', icon: 'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Zm12 0v3m0 3v2m0 3v3' },
  { to: '/admin/refunds', label: 'Refunds', icon: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v10m-3-7h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15' },
  { to: '/admin/users', label: 'Customers', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z' },
  { to: '/admin/venues', label: 'Venues', icon: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
  { to: '/admin/staff', label: 'Gate staff', icon: 'M9 12l2 2 4-4M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4Z' },
  { to: '/admin/activity', label: 'Activity log', icon: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z' },
]

export const Svg = ({ d, size = 18 }: { d: string; size?: number }) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>

/** The admin console shell. Only administrators get in; the server checks the role on every request too. */
export default function ConsoleLayout() {
  const session = useSession()
  const { theme, setTheme } = usePreferences()
  const { pathname } = useLocation()
  const [menu, setMenu] = useState(false)

  if (session.status === 'loading') return <div className="cx-root cx-center" data-theme={theme}><Loading /></div>
  if (session.status !== 'authenticated' || !session.user) return <Navigate to="/login" replace />
  if (session.user.role?.toUpperCase() !== 'ADMIN') {
    return <div className="cx-root cx-center" data-theme={theme}><div className="cx-card cx-denied">
      <h1>Administrators only</h1><p>You are signed in as {session.user.email}, which is not an administrator account.</p>
      <Link className="cx-btn is-primary" to="/">Back to the website</Link>
    </div></div>
  }
  const user = session.user

  return <ToastProvider><div className="cx-root" data-theme={theme}>
    <aside className={`cx-side${menu ? ' is-open' : ''}`}>
      <Link to="/admin" className="cx-brand" onClick={() => setMenu(false)}><span className="cx-brand-mark">H</span><span>Hafletna<small>Admin console</small></span></Link>
      <nav>{NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMenu(false)} className={({ isActive }) => (isActive ? 'is-active' : '')}><Svg d={n.icon} />{n.label}</NavLink>)}</nav>
      <div className="cx-side-foot">
        <Link to="/" className="cx-side-link"><Svg d="M10 19l-7-7 7-7M3 12h18" />Back to website</Link>
      </div>
    </aside>
    {menu && <div className="cx-scrim" onClick={() => setMenu(false)} />}
    <div className="cx-main">
      <header className="cx-top">
        <button className="cx-icon-btn cx-menu-btn" onClick={() => setMenu(!menu)} aria-label="Menu"><Svg d="M4 6h16M4 12h16M4 18h16" /></button>
        <span className="cx-crumb">{NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))?.label ?? 'Admin'}</span>
        <div className="cx-top-right">
          <button className="cx-icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Switch light or dark mode" title="Light / dark">
            <Svg d={theme === 'dark' ? 'M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z' : 'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z'} />
          </button>
          <div className="cx-me"><span className="cx-avatar">{user.fullName.charAt(0).toUpperCase()}</span><span><b>{user.fullName}</b><small>{user.email}</small></span></div>
          <button className="cx-btn is-ghost" onClick={() => session.signOut()}>Sign out</button>
        </div>
      </header>
      <main className="cx-content"><Suspense fallback={<Loading />}><Outlet /></Suspense></main>
    </div>
  </div></ToastProvider>
}
