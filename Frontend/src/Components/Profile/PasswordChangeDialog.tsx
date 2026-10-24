import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { PasswordField, PasswordRules } from '../Auth/AuthParts'
import AccountDialog from './AccountDialog'
import { profileStrings } from './strings'
import { useProfile } from './profileContext'
import { validatePasswordChange } from './profileModel'
import { useAccountAction } from './useAccountAction'
import { profileApi } from '../../lib/profileApi'

export default function PasswordChangeDialog({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const { profile } = useProfile()
  const action = useAccountAction()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const disabled = action.busy || Boolean(profile.deletionRequestedAt)
  const errors = validatePasswordChange(current, password, confirm)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) {
      document.getElementById(errors.current ? 'account-current-password' : errors.password ? 'account-new-password' : 'account-confirm-password')?.focus()
      return
    }
    void action.run((signal) => profileApi.changePassword(current, password, signal), () => {
      setCurrent(''); setPassword(''); setConfirm(''); onComplete()
    })
  }

  return <AccountDialog id="account-password-dialog" title={t.passwordTitle} lead={t.passwordLead} icon="lock" focusId="account-current-password" onClose={onClose} busy={action.busy}>
    <form noValidate onSubmit={submit} aria-busy={action.busy}>
      <fieldset className="account-fields" disabled={disabled}>
        <PasswordField id="account-current-password" label={t.currentPassword} value={current} onChange={(value) => { setCurrent(value); action.clearError() }} autoComplete="current-password" error={submitted && errors.current ? t.currentError : null} />
        <PasswordField id="account-new-password" label={t.newPassword} value={password} onChange={setPassword} autoComplete="new-password" describedBy="account-password-rules" error={submitted && errors.password ? t.passwordError : null} />
        <PasswordRules id="account-password-rules" password={password} />
        <PasswordField id="account-confirm-password" label={t.confirmPassword} value={confirm} onChange={setConfirm} autoComplete="new-password" error={submitted && errors.confirm ? t.confirmError : null} />
      </fieldset>
      {action.errorText && <p className="account-error" role="alert">{action.errorText}</p>}
      {action.error === 'googlePassword' && <Link className="home-text-link" to="/forgot-password">{lang === 'ar' ? 'نسيت كلمة المرور' : 'Forgot password'}</Link>}
      <div className="account-dialog-actions"><button className="home-outline-button" type="button" disabled={action.busy} onClick={onClose}>{t.cancel}</button><button className="home-button" type="submit" disabled={disabled}>{action.busy ? t.updatingPassword : t.changePassword}</button></div>
    </form>
  </AccountDialog>
}
