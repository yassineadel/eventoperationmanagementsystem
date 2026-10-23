import { Suspense, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { useSession } from '../Auth/sessionContext'
import { ADMIN_PREVIEW, isAdminRole } from './adminAccess'
import { useAdminStrings } from './adminStrings'

// This guard sits outside the lazily loaded console, so it stays small: plain markup with
// inline styles, no Admin.css and no sample data.
const page = (dark: boolean) => ({
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  background: dark ? '#090c20' : '#fbf8f3',
  color: dark ? '#f8f3fb' : '#0a0b23',
  fontFamily: 'system-ui, sans-serif',
})
const box = { maxWidth: 440, textAlign: 'center' as const, display: 'grid', gap: 12 }
const button = (dark: boolean) => ({
  justifySelf: 'center',
  padding: '10px 18px',
  borderRadius: 7,
  border: 0,
  background: dark ? '#ad76ff' : '#7200f5',
  color: dark ? '#090c20' : '#ffffff',
  font: '700 15px system-ui, sans-serif',
  textDecoration: 'none',
  cursor: 'pointer',
})

function Gate({ title, text, action }: { title: string; text?: string; action?: (style: React.CSSProperties) => ReactNode }) {
  const { lang, theme } = usePreferences()
  const dark = theme === 'dark'
  return (
    <main style={page(dark)} lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div style={box}>
        <h1 style={{ margin: 0, fontSize: 24 }} role={text ? undefined : 'status'}>
          {title}
        </h1>
        {text && <p style={{ margin: 0, lineHeight: 1.55, color: dark ? '#c1bdd3' : '#59586c' }}>{text}</p>}
        {action?.(button(dark))}
      </div>
    </main>
  )
}

/**
 * Wraps every /admin route. Guests go to the login page; signed-in people without the
 * admin role see a "no access" page. The backend checks the role on every admin request
 * as well; this keeps non-admins out of the console in the first place, and the console's
 * pages only load once access is confirmed.
 */
export default function RequireAdmin() {
  const t = useAdminStrings()
  const { status, user, refresh } = useSession()
  const location = useLocation()

  if (!ADMIN_PREVIEW) {
    if (status === 'loading') return <Gate title={t.checkingAccess} />
    if (status === 'guest') return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />
    if (status === 'unavailable') {
      return (
        <Gate
          title={t.sessionErrorTitle}
          text={t.sessionErrorText}
          action={(style) => (
            <button type="button" style={style} onClick={() => void refresh()}>
              {t.tryAgain}
            </button>
          )}
        />
      )
    }
    if (!isAdminRole(user?.role)) {
      return (
        <Gate
          title={t.noAccessTitle}
          text={t.noAccessText}
          action={(style) => (
            <Link to="/" style={style}>
              {t.backHome}
            </Link>
          )}
        />
      )
    }
  }

  return (
    <Suspense fallback={<Gate title={t.checkingAccess} />}>
      <Outlet />
    </Suspense>
  )
}
