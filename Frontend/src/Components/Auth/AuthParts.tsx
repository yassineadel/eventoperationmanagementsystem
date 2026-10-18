import { useEffect, useState, type ReactNode } from 'react'
import concertPanel from '../../assets/hafletna-concert.webp'
import { authApi } from '../../lib/authApi'
import { CODE_LENGTH, passwordChecks } from '../../lib/validation'
import { rememberAccountReturn } from '../../lib/sessionUser'
import { usePreferences, useStrings } from './preferences'
import './Auth.css'

function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ')
}

/* ---------------------------------------------------------------- icons */

function StrokeIcon({ children, size = 20 }: { children: ReactNode; size?: number }) {
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

const ErrorIcon = ({ size }: { size?: number }) => (
  <StrokeIcon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <path d="M12 16h.01" />
  </StrokeIcon>
)

const SuccessIcon = () => (
  <StrokeIcon>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.5 2.5L16 9.5" />
  </StrokeIcon>
)

const InfoIcon = () => (
  <StrokeIcon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </StrokeIcon>
)

export const BackArrow = () => (
  <span className="hf-back-arrow">
    <StrokeIcon size={18}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </StrokeIcon>
  </span>
)

/* ------------------------------------------------- language and theme */

export function PreferenceControls({ variant }: { variant: 'main' | 'panel' }) {
  const t = useStrings()
  const { lang, theme, setLang, setTheme } = usePreferences()
  const dark = theme === 'dark'

  return (
    <div className={cx('hf-controls', `hf-controls--${variant}`)}>
      <div className="hf-segmented" role="group" aria-label={t.langGroup}>
        <button type="button" aria-pressed={lang === 'en'} lang="en" onClick={() => setLang('en')}>
          English
        </button>
        <button type="button" aria-pressed={lang === 'ar'} lang="ar" onClick={() => setLang('ar')}>
          العربية
        </button>
      </div>
      <button
        type="button"
        className="hf-icon-btn"
        aria-label={dark ? t.toLight : t.toDark}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
      >
        {dark ? (
          <StrokeIcon>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </StrokeIcon>
        ) : (
          <StrokeIcon>
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </StrokeIcon>
        )}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------- layout */

type AuthLayoutProps = {
  title: string
  lead?: ReactNode
  children: ReactNode
}

export function AuthLayout({ title, lead, children }: AuthLayoutProps) {
  const t = useStrings()
  const { lang, theme } = usePreferences()

  useEffect(() => {
    document.title = `${title} | ${t.brandName}`
  }, [title, t.brandName])

  return (
    <div className="hf-root" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} data-theme={theme}>
      <aside className="hf-brand" aria-label={t.brandName}>
        <img className="hf-brand-photo" src={concertPanel} alt={t.brandPhotoAlt} />
        <div className="hf-brand-top">
          <PreferenceControls variant="panel" />
        </div>
      </aside>

      <main className="hf-main">
        <div className="hf-topbar">
          <PreferenceControls variant="main" />
        </div>
        <div className="hf-center">
          <section className="hf-card" aria-labelledby="hf-title">
            <div className="hf-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h1 id="hf-title" className="hf-title">
              {title}
            </h1>
            {lead && <p className="hf-lead">{lead}</p>}
            {children}
          </section>
        </div>
        <p className="hf-terms">{t.terms}</p>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------ messages */

type AlertProps = { tone: 'error' | 'success' | 'info'; children: ReactNode }

export function Alert({ tone, children }: AlertProps) {
  return (
    <div className={cx('hf-alert', `hf-alert--${tone}`)} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="hf-alert-icon">
        {tone === 'error' ? <ErrorIcon /> : tone === 'success' ? <SuccessIcon /> : <InfoIcon />}
      </span>
      <div className="hf-alert-body">{children}</div>
    </div>
  )
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="hf-field-error">
      <ErrorIcon size={16} />
      <span>{children}</span>
    </p>
  )
}

/* -------------------------------------------------------------- fields */

type TextFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  type?: 'text' | 'email' | 'tel'
  autoComplete?: string
  inputMode?: 'text' | 'email' | 'numeric' | 'tel'
  hint?: string
  error?: string | null
  disabled?: boolean
  dir?: 'ltr' | 'rtl'
  labelAside?: ReactNode
}

export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  autoComplete,
  inputMode,
  hint,
  error,
  disabled,
  dir,
  labelAside,
}: TextFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="hf-field">
      <div className="hf-label-row">
        <label htmlFor={id} className="hf-label">
          {label}
        </label>
        {labelAside}
      </div>
      <input
        id={id}
        className={cx('hf-input', error && 'is-invalid')}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        dir={dir}
        spellCheck={false}
      />
      {hint && (
        <p id={`${id}-hint`} className="hf-hint">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

type PasswordFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  autoComplete: 'current-password' | 'new-password' | 'off'
  error?: string | null
  disabled?: boolean
  describedBy?: string
  labelAside?: ReactNode
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  error,
  disabled,
  describedBy,
  labelAside,
}: PasswordFieldProps) {
  const t = useStrings()
  const [visible, setVisible] = useState(false)
  const ids = [describedBy, error && `${id}-error`].filter(Boolean).join(' ') || undefined

  return (
    <div className="hf-field">
      <div className="hf-label-row">
        <label htmlFor={id} className="hf-label">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="hf-password">
        <input
          id={id}
          className={cx('hf-input', 'hf-input--password', error && 'is-invalid')}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids}
          disabled={disabled}
          dir="ltr"
          spellCheck={false}
        />
        <button
          type="button"
          className="hf-eye"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t.hidePassword : t.showPassword}
          aria-pressed={visible}
          aria-controls={id}
          disabled={disabled}
        >
          {visible ? (
            <StrokeIcon>
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 5.2A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3 3.9M6.1 6.1A17 17 0 0 0 2.5 12S6 19 12 19a9.4 9.4 0 0 0 4.2-1" />
            </StrokeIcon>
          ) : (
            <StrokeIcon>
              <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
              <circle cx="12" cy="12" r="3" />
            </StrokeIcon>
          )}
        </button>
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

export function PasswordRules({ id, password }: { id: string; password: string }) {
  const t = useStrings()
  const checks = passwordChecks(password)
  const rules: Array<[boolean, string]> = [
    [checks.length, t.ruleLength],
    [checks.upper, t.ruleUpper],
    [checks.lower, t.ruleLower],
    [checks.number, t.ruleNumber],
  ]

  return (
    <ul id={id} className="hf-rules" aria-label={t.rulesLabel}>
      {rules.map(([met, label]) => (
        <li key={label} className={met ? 'is-met' : undefined}>
          <span className="hf-rule-dot" aria-hidden="true">
            {met && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            )}
          </span>
          <span>
            {label}
            <span className="hf-sr-only">{met ? ` (${t.ruleMet})` : ` (${t.ruleNotMet})`}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

type CodeInputProps = {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
  autoFocus?: boolean
}

// Six visual boxes over one real input: typing, pasting a full code and
// one-time-code autofill all work, and screen readers meet a single field.
export function CodeInput({ id, value, onChange, invalid, describedBy, disabled, autoFocus }: CodeInputProps) {
  const [focused, setFocused] = useState(false)
  const active = Math.min(value.length, CODE_LENGTH - 1)

  return (
    <div className={cx('hf-code', disabled && 'is-disabled')} dir="ltr">
      <div className="hf-code-boxes" aria-hidden="true">
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const digit = value.charAt(i)
          const isActive = focused && i === active
          return (
            <span
              key={i}
              className={cx('hf-code-box', digit && 'is-filled', isActive && 'is-active', invalid && 'is-invalid')}
            >
              {digit}
              {isActive && !digit && <span className="hf-code-caret" />}
            </span>
          )
        })}
      </div>
      <input
        id={id}
        className="hf-code-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    </div>
  )
}

/* ------------------------------------------------------------- actions */

export function SubmitButton({ busy, children, busyLabel }: { busy: boolean; children: ReactNode; busyLabel: string }) {
  return (
    <button type="submit" className="hf-primary" disabled={busy} aria-busy={busy}>
      {busy && (
        <svg className="hf-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 9 9" />
        </svg>
      )}
      <span>{busy ? busyLabel : children}</span>
    </button>
  )
}

export function GoogleButton({ returnTo = '/' }: { returnTo?: string }) {
  const t = useStrings()
  return (
    <a className="hf-google" href={authApi.googleUrl} onClick={() => rememberAccountReturn(returnTo)}>
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {t.google}
    </a>
  )
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="hf-divider" aria-hidden="true">
      <span />
      {children}
      <span />
    </div>
  )
}
