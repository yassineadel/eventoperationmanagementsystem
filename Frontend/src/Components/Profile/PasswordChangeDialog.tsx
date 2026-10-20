import { useState, type FormEvent } from 'react'
import { usePreferences } from '../Auth/preferences'
import { PasswordField, PasswordRules } from '../Auth/AuthParts'
import AccountDialog from './AccountDialog'
import { profileStrings } from './strings'
import { useProfile } from './profileContext'
import { validatePasswordChange } from './profileModel'

export default function PasswordChangeDialog({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const { profile, preview } = useProfile()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const disabled = !preview || Boolean(profile.deletionRequestedAt)
  const errors = validatePasswordChange(current, password, confirm)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) {
      document.getElementById(errors.current ? 'account-current-password' : errors.password ? 'account-new-password' : 'account-confirm-password')?.focus()
      return
    }
    // This validates a preview only. No password or hash is stored or sent.
    setCurrent(''); setPassword(''); setConfirm('')
    onComplete()
  }

  return <AccountDialog id="account-password-dialog" title={t.passwordTitle} lead={t.passwordLead} icon="lock" focusId="account-current-password" onClose={onClose}>
    {preview && <p className="account-inline-note">{t.passwordDemo}</p>}
    <form noValidate onSubmit={submit}>
      <fieldset className="account-fields" disabled={disabled}>
        <PasswordField id="account-current-password" label={t.currentPassword} value={current} onChange={setCurrent} autoComplete={preview ? 'off' : 'current-password'} error={submitted && errors.current ? t.currentError : null} />
        <PasswordField id="account-new-password" label={t.newPassword} value={password} onChange={setPassword} autoComplete={preview ? 'off' : 'new-password'} describedBy="account-password-rules" error={submitted && errors.password ? t.passwordError : null} />
        <PasswordRules id="account-password-rules" password={password} />
        <PasswordField id="account-confirm-password" label={t.confirmPassword} value={confirm} onChange={setConfirm} autoComplete={preview ? 'off' : 'new-password'} error={submitted && errors.confirm ? t.confirmError : null} />
      </fieldset>
      <div className="account-dialog-actions"><button className="home-outline-button" type="button" onClick={onClose}>{t.cancel}</button><button className="home-button" type="submit" disabled={disabled}>{t.changePassword}</button></div>
    </form>
  </AccountDialog>
}
