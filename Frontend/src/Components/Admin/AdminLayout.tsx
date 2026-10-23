import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import concertPanel from '../../assets/hafletna-concert.webp'
import { usePreferences } from '../Auth/preferences'
import { useSession } from '../Auth/sessionContext'
import { useScrollReveal } from '../Homepage/useScrollReveal'
import { AnnounceContext, type Announce } from './adminAnnounce'
import { useAdminActor } from './adminIdentity'
import { useAdminStrings } from './adminStrings'
import type { ResourceState } from './useAdminResource'
import './Admin.css'

/* ---------------------------------------------------------------- icons */

export function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const LockIcon = () => (
  <Icon size={16}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
)

export const VenueIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M3 21h18" />
    <path d="M5 21V10l7-5 7 5v11" />
    <path d="M10 21v-5h4v5" />
  </Icon>
)

export const TicketIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
    <path d="M13 6v12" strokeDasharray="2 2" />
  </Icon>
)

export const CalendarIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Icon>
)

export const UsersIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21a7 7 0 0 1 14 0" />
    <path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" />
  </Icon>
)

export const HomeIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M3 11 12 4l9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-6h4v6" />
  </Icon>
)

export const BackArrowIcon = () => (
  <span className="ad-flip">
    <Icon>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Icon>
  </span>
)

export const ForwardArrowIcon = () => (
  <span className="ad-flip">
    <Icon size={16}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Icon>
  </span>
)

function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 36) / 42} viewBox="0 0 42 36" aria-hidden="true">
      <defs>
        <linearGradient id="adMarkFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <rect x="13" y="3" width="26" height="19" rx="4" fill="#4c1d95" transform="rotate(-12 26 12)" />
      <rect x="3" y="11" width="30" height="21" rx="5" fill="url(#adMarkFill)" transform="rotate(-8 18 21)" />
      <path d="M14 15v14" stroke="#0a0b2e" strokeWidth="2" strokeDasharray="2 2.5" transform="rotate(-8 18 21)" />
    </svg>
  )
}

/* ------------------------------------------------------------- controls */

function PreferenceControls() {
  const t = useAdminStrings()
  const { lang, theme, setLang, setTheme } = usePreferences()
  const dark = theme === 'dark'
  return (
    <div className="ad-controls">
      <div className="ad-segmented" role="group" aria-label={t.langGroup}>
        <button type="button" aria-pressed={lang === 'en'} lang="en" onClick={() => setLang('en')}>
          English
        </button>
        <button type="button" aria-pressed={lang === 'ar'} lang="ar" onClick={() => setLang('ar')}>
          العربية
        </button>
      </div>
      <button
        type="button"
        className="ad-icon-btn"
        aria-label={dark ? t.toLight : t.toDark}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
      >
        {dark ? (
          <Icon size={20}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </Icon>
        ) : (
          <Icon size={20}>
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </Icon>
        )}
      </button>
    </div>
  )
}

function Account() {
  const t = useAdminStrings()
  const actor = useAdminActor()
  const { signOut } = useSession()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function leave() {
    setBusy(true)
    try {
      await signOut()
    } finally {
      navigate('/login')
    }
  }

  return (
    <div className="ad-account">
      <span className="ad-avatar" aria-hidden="true">
        {actor.name.charAt(0).toUpperCase()}
      </span>
      <span>
        <strong>{actor.name}</strong>
        <span>{actor.preview ? t.previewRole : t.accountRole}</span>
      </span>
      {!actor.preview && (
        <button type="button" className="ad-signout" aria-label={t.signOut} title={t.signOut} disabled={busy} onClick={leave}>
          <Icon size={18}>
            <path d="M15 4h4v16h-4" />
            <path d="M10 8l-4 4 4 4" />
            <path d="M6 12h10" />
          </Icon>
        </button>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- layout */

type Crumb = { label: string; to?: string }

type AdminLayoutProps = {
  title: string
  crumbs: Crumb[]
  children: ReactNode
  /** Number of [data-scroll-reveal] items once content is ready; same fade-up as the customer pages. */
  revealCount?: number
}

// The path the console showed last, so focus moves to the new page only after navigating.
let lastPath: string | null = null

export function AdminLayout({ title, crumbs, children, revealCount = 0 }: AdminLayoutProps) {
  const t = useAdminStrings()
  const { lang, theme } = usePreferences()
  const { pathname } = useLocation()
  const mainRef = useScrollReveal<HTMLElement>(revealCount)
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  const timers = useRef<number[]>([])

  // Live regions stay mounted; clearing first makes a repeated message speak again.
  const announce = useCallback<Announce>((text, urgency = 'polite') => {
    const set = urgency === 'assertive' ? setAssertive : setPolite
    set('')
    timers.current.push(window.setTimeout(() => set(text), 80))
  }, [])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((id) => window.clearTimeout(id))
  }, [])

  useEffect(() => {
    document.title = `${title} | ${t.brandName} ${t.adminTag}`
  }, [title, t.brandName, t.adminTag])

  // After moving to another page, start keyboard and screen reader users at its content.
  useEffect(() => {
    if (lastPath !== null && lastPath !== pathname) mainRef.current?.focus({ preventScroll: true })
    lastPath = pathname
  }, [pathname, mainRef])

  const ordersSection = /^\/admin\/(orders|tickets|refunds)(\/|$)/.test(pathname)

  return (
    <AnnounceContext.Provider value={announce}>
      <div className="ad-root" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} data-theme={theme}>
        <a
          className="ad-skip"
          href="#ad-main"
          onClick={(e) => {
            e.preventDefault()
            mainRef.current?.focus()
          }}
        >
          {t.skipToContent}
        </a>
        <nav className="ad-side" aria-label={t.navLabel}>
          <div className="ad-brand">
            <BrandMark />
            <span>{t.brandName}</span>
            <span className="ad-brand-tag">{t.adminTag}</span>
          </div>
          <NavLink to="/admin" end className="ad-nav-item">
            <HomeIcon />
            <span>{t.navOverview}</span>
          </NavLink>
          <span className="ad-nav-label">{t.navManage}</span>
          <NavLink to="/admin/events" className="ad-nav-item">
            <CalendarIcon />
            <span>{t.navEvents}</span>
          </NavLink>
          <NavLink to="/admin/venues" className="ad-nav-item">
            <VenueIcon />
            <span>{t.navVenues}</span>
          </NavLink>
          <Link to="/admin/orders" className={`ad-nav-item${ordersSection ? ' active' : ''}`} aria-current={ordersSection ? 'page' : undefined}>
            <TicketIcon />
            <span>{t.navOrders}</span>
          </Link>
          <NavLink to="/admin/users" className="ad-nav-item">
            <UsersIcon />
            <span>{t.navUsers}</span>
          </NavLink>
          <div className="ad-side-spacer" />
          <Account />
        </nav>

        <div className="ad-shell">
          <header className="ad-topbar">
            <nav aria-label={t.breadcrumb}>
              <ol className="ad-crumbs">
                <li>{t.console}</li>
                {crumbs.map((c, i) => {
                  const current = i === crumbs.length - 1
                  return (
                    <li key={`${i}:${c.label}`}>
                      {c.to && !current ? (
                        <Link to={c.to}>{c.label}</Link>
                      ) : (
                        <strong aria-current={current ? 'page' : undefined}>{c.label}</strong>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>
            <PreferenceControls />
          </header>
          <main className="ad-main" id="ad-main" ref={mainRef} tabIndex={-1}>
            {children}
          </main>
        </div>

        <div className="ad-sr-only" aria-live="polite" aria-atomic="true">
          {polite}
        </div>
        <div className="ad-sr-only" aria-live="assertive" aria-atomic="true">
          {assertive}
        </div>
      </div>
    </AnnounceContext.Provider>
  )
}

/* ----------------------------------------------------------------- hero */

type HeroProps = {
  eyebrow: string
  title: ReactNode
  /** Read-only badge on the right; pass `action` instead for buttons. */
  badge?: string
  action?: ReactNode
  children?: ReactNode
}

export function AdminHero({ eyebrow, title, badge, action, children }: HeroProps) {
  return (
    <div className="ad-hero" style={{ ['--ad-hero-img' as string]: `url(${concertPanel})` }}>
      <div className="ad-hero-copy">
        <p className="ad-eyebrow">{eyebrow}</p>
        <h1 className="ad-hero-title">{title}</h1>
        {children}
      </div>
      {badge && (
        <span className="ad-glass-pill">
          <LockIcon />
          {badge}
        </span>
      )}
      {action && <div className="ad-hero-actions">{action}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------- states */

export function LoadingPanel({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <section className="ad-card ad-loading" aria-busy="true">
      <div className="ad-loading-head">
        <span className="ad-spinner" aria-hidden="true" />
        <p role="status">{label}</p>
      </div>
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div className="ad-skel-row" key={i}>
            <span className="ad-skel-box" />
            <span className="ad-skel-lines">
              <span style={{ width: `${[62, 48, 70, 54, 44][i % 5]}%` }} />
              <span />
            </span>
            <span className="ad-skel-btn" />
          </div>
        ))}
      </div>
    </section>
  )
}

type MessageProps = {
  tone: 'empty' | 'error'
  title: string
  text: string
  action?: ReactNode
  /** Icon for empty states; defaults to the venue icon. */
  icon?: ReactNode
}

export function MessagePanel({ tone, title, text, action, icon }: MessageProps) {
  return (
    <section className={`ad-card ad-message ad-message--${tone}`}>
      <span className="ad-message-icon" aria-hidden="true">
        {tone === 'error' ? (
          <Icon size={34}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
          </Icon>
        ) : (
          (icon ?? <VenueIcon size={34} />)
        )}
      </span>
      <h2>{title}</h2>
      <p role={tone === 'error' ? 'alert' : undefined}>{text}</p>
      {action}
    </section>
  )
}

export function RetryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ad-primary" onClick={onClick}>
      <Icon>
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 4v5h-5" />
      </Icon>
      {label}
    </button>
  )
}

type StatusProps = {
  state: ResourceState<unknown>
  loading: string
  rows?: number
  errorTitle: string
  errorText: string
  retryLabel: string
  onRetry: () => void
  notFoundTitle?: string
  notFoundText?: string
}

/** The loading, error and not-found panels every admin page shows before its data is ready. */
export function ResourceStatus({ state, loading, rows, errorTitle, errorText, retryLabel, onRetry, notFoundTitle, notFoundText }: StatusProps) {
  if (state.status === 'loading') return <LoadingPanel label={loading} rows={rows} />
  if (state.status === 'error') return <MessagePanel tone="error" title={errorTitle} text={errorText} action={<RetryButton label={retryLabel} onClick={onRetry} />} />
  if (state.status === 'not-found') return <MessagePanel tone="empty" title={notFoundTitle ?? errorTitle} text={notFoundText ?? errorText} />
  return null
}
