import { useEffect, useState, type FormEvent } from 'react'
import { usePreferences } from '../Auth/preferences'
import { CodeInput, PasswordField, TextField } from '../Auth/AuthParts'
import { isEmail } from '../../lib/validation'
import AccountDialog from './AccountDialog'
import { profileStrings } from './strings'
import { useProfile } from './profileContext'
import { beginEmailChange, previewPassword, verifySampleEmail, type EmailChange } from './profileModel'

export default function EmailChangeDialog({ onClose, onComplete }: { onClose: () => void; onComplete: (persisted: boolean) => void }) {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const { profile, preview, updatePreview } = useProfile()
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState<EmailChange | null>(null)
  const [code, setCode] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<'invalid' | 'expired' | 'locked' | null>(null)
  const [now, setNow] = useState(Date.now)
  const disabled = !preview || Boolean(profile.deletionRequestedAt)
  const validAddress = isEmail(newEmail) && newEmail.trim().toLowerCase() !== profile.email.toLowerCase()

  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [pending])

  function start(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    setSubmitted(true)
    if (!validAddress || password !== previewPassword) {
      document.getElementById(!validAddress ? 'account-new-email' : 'account-email-password')?.focus()
      return
    }
    const timestamp = Date.now()
    const change = beginEmailChange(profile.email, newEmail, timestamp)
    if (!change) return
    setPending(change); setNow(timestamp); setPassword(''); setCode(''); setError(null); setSubmitted(false)
  }

  function verify(event: FormEvent) {
    event.preventDefault()
    if (disabled || !pending) return
    const result = verifySampleEmail(pending, code)
    if (result.status !== 'verified') {
      setPending(result.change); setError(result.status); document.getElementById('account-email-code')?.focus()
      return
    }
    const persisted = updatePreview({ email: pending.email, emailVerified: true })
    setPending(null); setNewEmail(''); setCode(''); setError(null)
    onComplete(persisted)
  }

  const issue = pending && now >= pending.expiresAt ? 'expired' : pending && pending.attempts >= 5 ? 'locked' : error
  const errorText = issue === 'expired' ? t.expiredCode : issue === 'locked' ? t.lockedCode : issue === 'invalid' ? t.invalidCode : ''
  return <AccountDialog id="account-email-dialog" title={t.emailTitle} lead={t.emailLead} icon="mail" focusId="account-new-email" onClose={onClose}>
    <p className="account-current-email">{t.currentEmail}: <strong dir="ltr">{profile.email}</strong></p>
    {!pending ? <form noValidate onSubmit={start}>
      <fieldset className="account-fields" disabled={disabled}>
        <TextField id="account-new-email" label={t.newEmail} type="email" inputMode="email" dir="ltr" value={newEmail} onChange={setNewEmail} autoComplete="email" error={submitted && !validAddress ? t.sameEmail : null} />
        {preview && <p className="account-inline-note">{t.passwordDemo}</p>}
        <PasswordField id="account-email-password" label={t.currentPassword} value={password} onChange={setPassword} autoComplete={preview ? 'off' : 'current-password'} error={submitted && password !== previewPassword ? t.currentError : null} />
      </fieldset>
      <div className="account-dialog-actions"><button className="home-outline-button" type="button" onClick={onClose}>{t.cancel}</button><button className="home-button" type="submit" disabled={disabled}>{t.sendCode}</button></div>
    </form> : <form noValidate onSubmit={verify}>
      <div className="account-verification"><p>{t.verifyingAddress}: <strong dir="ltr">{pending.email}</strong></p><p>{t.sampleCode}: <code dir="ltr">{pending.code}</code></p><p>{t.codeExpiry}</p></div>
      <fieldset className="account-fields" disabled={disabled}>
        <div className="hf-field"><label className="hf-label" htmlFor="account-email-code">{t.code}</label><CodeInput id="account-email-code" value={code} onChange={(value) => { setCode(value); setError(null) }} invalid={Boolean(errorText)} disabled={disabled} describedBy={`account-email-code-hint${errorText ? ' account-email-code-error' : ''}`} autoFocus /><p id="account-email-code-hint" className="hf-hint">{t.codeHint}</p>{errorText && <p id="account-email-code-error" className="account-error" role="alert">{errorText}</p>}</div>
      </fieldset>
      <button className="home-text-link account-resend" type="button" disabled={disabled || now < pending.resendAt} onClick={() => {
        const timestamp = Date.now()
        if (disabled || timestamp < pending.resendAt) return
        setPending(beginEmailChange(profile.email, pending.email, timestamp)); setNow(timestamp); setCode(''); setError(null)
      }}>{now < pending.resendAt ? `${t.resendWait} ${new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en').format(Math.ceil((pending.resendAt - now) / 1000))} ${t.seconds}` : t.resend}</button>
      <div className="account-dialog-actions"><button className="home-outline-button" type="button" onClick={onClose}>{t.cancel}</button><button className="home-button" type="submit" disabled={disabled || issue === 'expired' || pending.attempts >= 5}>{t.verifyEmail}</button></div>
    </form>}
  </AccountDialog>
}
