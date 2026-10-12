import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authApi } from '../../lib/authApi'
import { isCode, isEmail, isStrongPassword } from '../../lib/validation'
import { Alert, AuthLayout, BackArrow, CodeInput, FieldError, PasswordField, PasswordRules, SubmitButton, TextField } from '../Auth/AuthParts'
import { friendlyError, isServerMessage, serverFieldError } from '../Auth/authErrors'
import { useStrings } from '../Auth/preferences'

type IncomingState = { email?: string } | null

function ResetPassword() {
  const t = useStrings()
  const location = useLocation()
  const incomingEmail = (location.state as IncomingState)?.email ?? ''
  const emailMissing = !isEmail(incomingEmail)

  const [email, setEmail] = useState(incomingEmail)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [codeRejected, setCodeRejected] = useState(false)
  const [tooManyTries, setTooManyTries] = useState(false)
  const [passwordServerError, setPasswordServerError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const emailError = submitted && !isEmail(email) ? t.errEmail : null
  const codeError = codeRejected ? t.errResetCode : submitted && !isCode(code) ? t.errCode : null
  const passwordError = submitted && !isStrongPassword(password) ? t.errPasswordRules : passwordServerError

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setFormError(null)
    setTooManyTries(false)

    const firstInvalid = !isEmail(email)
      ? 'reset-email'
      : !isCode(code)
        ? 'reset-code'
        : !isStrongPassword(password)
          ? 'reset-password'
          : null
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus()
      return
    }

    setBusy(true)
    try {
      await authApi.resetPassword(email.trim(), code, password)
      setSaved(true)
    } catch (err) {
      if (isServerMessage(err, 'Invalid reset code', 'Reset code expired')) {
        setCodeRejected(true)
        document.getElementById('reset-code')?.focus()
      } else if (isServerMessage(err, 'Too many incorrect attempts')) {
        setTooManyTries(true)
      } else if (serverFieldError(err, 'newPassword')) {
        setPasswordServerError(serverFieldError(err, 'newPassword'))
      } else {
        setFormError(friendlyError(err, t))
      }
    } finally {
      setBusy(false)
    }
  }

  if (saved) {
    return (
      <AuthLayout title={t.savedTitle}>
        <Alert tone="success">{t.savedText}</Alert>
        <Link className="hf-primary" to="/login" state={{ email: email.trim(), notice: 'passwordSaved' }}>
          {t.goToSignIn}
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t.resetTitle} lead={t.resetLead}>
      <div aria-live="polite">
        {emailMissing && !submitted && <Alert tone="info">{t.resetNeedEmail}</Alert>}
        {formError && <Alert tone="error">{formError}</Alert>}
        {tooManyTries && (
          <Alert tone="error">
            <span>{t.errResetTooMany}</span>
            <Link to="/forgot-password" state={{ email: email.trim() }}>
              {t.requestNew}
            </Link>
          </Alert>
        )}
      </div>

      <form className="hf-form" onSubmit={handleSubmit} noValidate>
        <TextField
          id="reset-email"
          label={t.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={setEmail}
          error={emailError}
          disabled={busy}
        />
        <div className="hf-field">
          <label htmlFor="reset-code" className="hf-label">
            {t.resetCodeLabel}
          </label>
          <CodeInput
            id="reset-code"
            value={code}
            onChange={(v) => {
              setCode(v)
              setCodeRejected(false)
            }}
            invalid={Boolean(codeError)}
            describedBy={codeError ? 'reset-code-hint reset-code-error' : 'reset-code-hint'}
            disabled={busy}
          />
          <p id="reset-code-hint" className="hf-hint">
            {t.resetCodeHint}
          </p>
          {codeError && (
            <FieldError id="reset-code-error">
              {codeError}
              {codeRejected && (
                <>
                  {' '}
                  <Link to="/forgot-password" state={{ email: email.trim() }}>
                    {t.requestNew}
                  </Link>
                </>
              )}
            </FieldError>
          )}
        </div>
        <div className="hf-field">
          <PasswordField
            id="reset-password"
            label={t.newPassword}
            autoComplete="new-password"
            value={password}
            onChange={(v) => {
              setPassword(v)
              setPasswordServerError(null)
            }}
            error={passwordError}
            describedBy="reset-password-rules"
            disabled={busy}
          />
          <PasswordRules id="reset-password-rules" password={password} />
        </div>
        <SubmitButton busy={busy} busyLabel={t.saving}>
          {t.save}
        </SubmitButton>
      </form>

      <p className="hf-foot">
        <Link className="hf-back" to="/login" state={{ email: email.trim() }}>
          <BackArrow />
          {t.backToSignIn}
        </Link>
      </p>
    </AuthLayout>
  )
}

export default ResetPassword
