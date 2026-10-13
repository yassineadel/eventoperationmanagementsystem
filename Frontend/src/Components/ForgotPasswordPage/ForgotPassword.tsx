import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authApi } from '../../lib/authApi'
import { isEmail } from '../../lib/validation'
import { Alert, AuthLayout, BackArrow, SubmitButton, TextField } from '../Auth/AuthParts'
import { friendlyError, isServerMessage } from '../Auth/authErrors'
import { useStrings } from '../Auth/preferences'

type IncomingState = { email?: string } | null

// The backend answers "No account found with this email" for unknown addresses.
// We treat that exactly like success so the page never reveals who has an account.
async function requestResetCode(email: string) {
  try {
    await authApi.forgotPassword(email)
  } catch (err) {
    if (!isServerMessage(err, 'No account found')) throw err
  }
}

function ForgotPassword() {
  const t = useStrings()
  const location = useLocation()
  const [email, setEmail] = useState((location.state as IncomingState)?.email ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [resent, setResent] = useState<'idle' | 'sending' | 'sent'>('idle')

  const emailError = submitted && !isEmail(email) ? t.errEmail : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setFormError(null)
    if (!isEmail(email)) {
      document.getElementById('forgot-email')?.focus()
      return
    }

    setBusy(true)
    try {
      await requestResetCode(email.trim())
      setSent(true)
    } catch (err) {
      setFormError(friendlyError(err, t))
    } finally {
      setBusy(false)
    }
  }

  async function handleSendAgain() {
    setResent('sending')
    setFormError(null)
    try {
      await requestResetCode(email.trim())
      setResent('sent')
    } catch (err) {
      setFormError(friendlyError(err, t))
      setResent('idle')
    }
  }

  const backLink = (
    <p className="hf-foot">
      <Link className="hf-back" to="/login" state={{ email: email.trim() }}>
        <BackArrow />
        {t.backToSignIn}
      </Link>
    </p>
  )

  if (sent) {
    return (
      <AuthLayout
        title={t.verifyTitle}
        lead={
          <>
            {t.sentPrefix} <strong dir="ltr">{email.trim()}</strong>
            {t.sentSuffix}
          </>
        }
      >
        <div aria-live="polite">
          {formError && <Alert tone="error">{formError}</Alert>}
          {resent === 'sent' && <Alert tone="info">{t.sentAgain}</Alert>}
        </div>
        <Link className="hf-primary" to="/reset-password" state={{ email: email.trim() }}>
          {t.enterResetCode}
        </Link>
        <p className="hf-row">
          <span>{t.didntGet}</span>
          <button type="button" className="hf-textbtn" onClick={handleSendAgain} disabled={resent !== 'idle'}>
            {resent === 'sending' ? t.sendingShort : resent === 'sent' ? t.codeSent : t.sendAgain}
          </button>
        </p>
        <p className="hf-row" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="hf-textbtn"
            onClick={() => {
              setSent(false)
              setResent('idle')
              setSubmitted(false)
            }}
          >
            {t.differentEmail}
          </button>
        </p>
        {backLink}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t.forgotTitle} lead={t.forgotLead}>
      <div aria-live="polite">{formError && <Alert tone="error">{formError}</Alert>}</div>
      <form className="hf-form" onSubmit={handleSubmit} noValidate>
        <TextField
          id="forgot-email"
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
        <SubmitButton busy={busy} busyLabel={t.sendingShort}>
          {t.sendCode}
        </SubmitButton>
      </form>
      {backLink}
    </AuthLayout>
  )
}

export default ForgotPassword
