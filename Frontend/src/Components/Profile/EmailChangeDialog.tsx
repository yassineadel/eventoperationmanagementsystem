import { useEffect, useState, type FormEvent } from 'react'
import { usePreferences } from '../Auth/preferences'
import { CodeInput, TextField } from '../Auth/AuthParts'
import { isCode, isEmail } from '../../lib/validation'
import { profileApi } from '../../lib/profileApi'
import AccountDialog from './AccountDialog'
import { profileStrings } from './strings'
import { useProfile } from './profileContext'
import { useAccountAction } from './useAccountAction'

type PendingEmail = { email: string; expiresAt: number; resendAt: number }

export default function EmailChangeDialog({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const { profile, updateAccount } = useProfile()
  const action = useAccountAction()
  const [newEmail, setNewEmail] = useState('')
  const [pending, setPending] = useState<PendingEmail | null>(null)
  const [code, setCode] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [sent, setSent] = useState(false)
  const disabled = action.busy || Boolean(profile.deletionRequestedAt)
  const validAddress = isEmail(newEmail) && newEmail.trim().toLowerCase() !== profile.email.toLowerCase()

  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [pending])

  function requestCode(email: string) {
    setSent(false)
    void action.run((signal) => profileApi.requestEmail(email, signal), () => {
      const timestamp = Date.now()
      setPending({ email: email.trim().toLowerCase(), expiresAt: timestamp + 10 * 60_000, resendAt: timestamp + 60_000 })
      setNow(timestamp); setCode(''); setSubmitted(false); setSent(true)
      requestAnimationFrame(() => document.getElementById('account-email-code')?.focus())
    })
  }

  function start(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    setSubmitted(true)
    if (!validAddress) { document.getElementById('account-new-email')?.focus(); return }
    requestCode(newEmail)
  }

  function verify(event: FormEvent) {
    event.preventDefault()
    if (disabled || !pending) return
    setSubmitted(true); setSent(false)
    if (!isCode(code)) { document.getElementById('account-email-code')?.focus(); return }
    void action.run((signal) => profileApi.verifyEmail(code, signal), ({ user }) => {
      updateAccount({ ...user, phone: user.phone ?? '' })
      setCode(''); setPending(null); onComplete()
    })
  }

  const expired = Boolean(pending && now >= pending.expiresAt)
  const codeError = submitted && !isCode(code) ? t.codeHint : expired ? t.expiredCode : ''
  return <AccountDialog id="account-email-dialog" title={t.emailTitle} lead={t.emailLead} icon="mail" focusId="account-new-email" onClose={onClose} busy={action.busy}>
    <p className="account-current-email">{t.currentEmail}: <strong dir="ltr">{profile.email}</strong></p>
    {!pending ? <form noValidate onSubmit={start} aria-busy={action.busy}>
      <fieldset className="account-fields" disabled={disabled}>
        <TextField id="account-new-email" label={t.newEmail} type="email" inputMode="email" dir="ltr" value={newEmail} onChange={(value) => { setNewEmail(value); action.clearError() }} autoComplete="email" error={submitted && !validAddress ? t.sameEmail : null} />
      </fieldset>
      {action.errorText && <p className="account-error" role="alert">{action.errorText}</p>}
      <div className="account-dialog-actions"><button className="home-outline-button" type="button" disabled={action.busy} onClick={onClose}>{t.cancel}</button><button className="home-button" type="submit" disabled={disabled}>{action.busy ? t.sending : t.sendCode}</button></div>
    </form> : <form noValidate onSubmit={verify} aria-busy={action.busy}>
      <div className="account-verification"><p>{t.verifyingAddress}: <strong dir="ltr">{pending.email}</strong></p><p>{t.codeExpiry}</p></div>
      {sent && <p className="account-feedback" role="status">{t.codeSent}</p>}
      <fieldset className="account-fields" disabled={disabled}>
        <div className="hf-field"><label className="hf-label" htmlFor="account-email-code">{t.code}</label><CodeInput id="account-email-code" value={code} onChange={(value) => { setCode(value); action.clearError(); setSubmitted(false) }} invalid={Boolean(codeError || action.errorText)} disabled={disabled} describedBy={`account-email-code-hint${codeError ? ' account-email-code-error' : ''}`} autoFocus /><p id="account-email-code-hint" className="hf-hint">{t.codeHint}</p>{codeError && <p id="account-email-code-error" className="account-error" role="alert">{codeError}</p>}</div>
      </fieldset>
      {action.errorText && <p className="account-error" role="alert">{action.errorText}</p>}
      <button className="home-text-link account-resend" type="button" disabled={disabled || now < pending.resendAt} onClick={() => requestCode(pending.email)}>{now < pending.resendAt ? `${t.resendWait} ${new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en').format(Math.ceil((pending.resendAt - now) / 1000))} ${t.seconds}` : action.busy ? t.sending : t.resend}</button>
      <button className="home-text-link account-resend" type="button" disabled={action.busy} onClick={() => { setPending(null); setCode(''); setSubmitted(false); setSent(false); action.clearError() }}>{t.changeAddress}</button>
      <div className="account-dialog-actions"><button className="home-outline-button" type="button" disabled={action.busy} onClick={onClose}>{t.cancel}</button><button className="home-button" type="submit" disabled={disabled || expired}>{action.busy ? t.verifying : t.verifyEmail}</button></div>
    </form>}
  </AccountDialog>
}
