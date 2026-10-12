import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authApi, clearPendingRegistration, pendingRegistrationFor } from '../../lib/authApi'
import { isCode, isEmail } from '../../lib/validation'
import { Alert, AuthLayout, CodeInput, FieldError, SubmitButton, TextField } from '../Auth/AuthParts'
import { friendlyError, isServerMessage } from '../Auth/authErrors'
import { useStrings } from '../Auth/preferences'

type IncomingState = { email?: string } | null
type Resend = 'idle' | 'sending' | 'sent' | 'needsRegister' | 'alreadyVerified' | { error: string }

function VerifyEmail() {
  const t = useStrings()
  const location = useLocation()
  const incomingEmail = (location.state as IncomingState)?.email ?? ''
  const emailKnown = isEmail(incomingEmail)

  const [email, setEmail] = useState(incomingEmail)
  const [code, setCode] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [codeRejected, setCodeRejected] = useState(false)
  const [mustRestart, setMustRestart] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [resend, setResend] = useState<Resend>('idle')

  const emailError = !emailKnown && submitted && !isEmail(email) ? t.errEmail : null
  const codeError = codeRejected ? t.errCodeWrong : submitted && !isCode(code) ? t.errCode : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setFormError(null)
    setMustRestart(false)

    if (!isEmail(email) || !isCode(code)) {
      document.getElementById(!isEmail(email) ? 'verify-email' : 'verify-code')?.focus()
      return
    }

    setBusy(true)
    try {
      await authApi.verifyEmail(email.trim(), code)
      clearPendingRegistration()
      setVerified(true)
    } catch (err) {
      if (isServerMessage(err, 'Invalid verification code', 'Verification code expired')) {
        setCodeRejected(true)
        document.getElementById('verify-code')?.focus()
      } else if (isServerMessage(err, 'Too many incorrect attempts', 'Registration data expired')) {
        setMustRestart(true)
      } else {
        setFormError(friendlyError(err, t))
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    const pending = pendingRegistrationFor(email)
    if (!pending) {
      setResend('needsRegister')
      return
    }
    setResend('sending')
    try {
      await authApi.register(pending)
      setCode('')
      setCodeRejected(false)
      setResend('sent')
    } catch (err) {
      setResend(isServerMessage(err, 'Email already in use') ? 'alreadyVerified' : { error: friendlyError(err, t) })
    }
  }

  if (verified) {
    return (
      <AuthLayout title={t.verifyTitle}>
        <Alert tone="success">{t.verified}</Alert>
        <Link className="hf-primary" to="/login" state={{ email: email.trim(), notice: 'verified' }}>
          {t.goToSignIn}
        </Link>
      </AuthLayout>
    )
  }

  const lead = emailKnown ? (
    <>
      {t.verifySentTo}{' '}
      <strong dir="ltr">{incomingEmail}</strong>. {t.verifyLeadEnd}
    </>
  ) : (
    t.verifyNoEmail
  )

  return (
    <AuthLayout title={t.verifyTitle} lead={lead}>
      {emailKnown && (
        <p className="hf-subrow">
          <Link to="/register">{t.wrongEmail}</Link>
        </p>
      )}

      <div aria-live="polite">
        {formError && <Alert tone="error">{formError}</Alert>}
        {mustRestart && (
          <Alert tone="error">
            <span>{t.errCodeRestart}</span>
            <Link to="/register">{t.registerAgain}</Link>
          </Alert>
        )}
        {resend === 'sent' && <Alert tone="info">{t.resent}</Alert>}
        {resend === 'needsRegister' && (
          <Alert tone="info">
            <span>{t.resendNeedsRegister}</span>
            <Link to="/register">{t.registerAgain}</Link>
          </Alert>
        )}
        {resend === 'alreadyVerified' && (
          <Alert tone="info">
            <span>{t.alreadyVerified}</span>
            <Link to="/login" state={{ email: email.trim() }}>
              {t.goToSignIn}
            </Link>
          </Alert>
        )}
        {typeof resend === 'object' && <Alert tone="error">{resend.error}</Alert>}
      </div>

      <form className="hf-form" onSubmit={handleSubmit} noValidate>
        {!emailKnown && (
          <TextField
            id="verify-email"
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
        )}
        <div className="hf-field">
          <label htmlFor="verify-code" className="hf-label">
            {t.codeLabel}
          </label>
          <CodeInput
            id="verify-code"
            value={code}
            onChange={(v) => {
              setCode(v)
              setCodeRejected(false)
            }}
            invalid={Boolean(codeError)}
            describedBy={codeError ? 'verify-code-hint verify-code-error' : 'verify-code-hint'}
            disabled={busy}
            autoFocus={emailKnown}
          />
          <p id="verify-code-hint" className="hf-hint">
            {t.codeHint}
          </p>
          {codeError && <FieldError id="verify-code-error">{codeError}</FieldError>}
        </div>
        <SubmitButton busy={busy} busyLabel={t.verifying}>
          {t.verifyBtn}
        </SubmitButton>
      </form>

      <p className="hf-row">
        <span>{t.didntGet}</span>
        <button
          type="button"
          className="hf-textbtn"
          onClick={handleResend}
          disabled={resend === 'sending' || resend === 'sent' || busy}
        >
          {resend === 'sending' ? t.sendingShort : resend === 'sent' ? t.codeSent : t.resend}
        </button>
      </p>
    </AuthLayout>
  )
}

export default VerifyEmail
