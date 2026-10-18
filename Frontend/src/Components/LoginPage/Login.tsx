import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { authApi } from '../../lib/authApi'
import { isEmail } from '../../lib/validation'
import { Alert, AuthLayout, Divider, GoogleButton, PasswordField, SubmitButton, TextField } from '../Auth/AuthParts'
import { friendlyError } from '../Auth/authErrors'
import { useStrings } from '../Auth/preferences'
import type { StringKey } from '../Auth/strings'
import { useSession } from '../Auth/sessionContext'
import { accountReturnPath } from '../../lib/sessionUser'

type IncomingState = { email?: string; notice?: 'passwordSaved' | 'verified' } | null
type Problem = { key: StringKey } | { text: string }

function Login() {
  const t = useStrings()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const session = useSession()
  const returnTo = accountReturnPath(params.get('returnTo'))
  const incoming = location.state as IncomingState

  const [email, setEmail] = useState(incoming?.email ?? '')
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  // The backend redirects a failed Google sign-in to /login?error=blocked
  const [problem, setProblem] = useState<Problem | null>(
    params.get('error') === 'blocked' ? { key: 'googleBlocked' } : null,
  )

  const emailError = submitted && !isEmail(email) ? t.errEmail : null
  const passwordError = submitted && !password ? t.errPasswordRequired : null
  const notice = incoming?.notice === 'passwordSaved' ? t.passwordSavedNotice : incoming?.notice === 'verified' ? t.verifiedNotice : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setProblem(null)

    if (!isEmail(email) || !password) {
      document.getElementById(!isEmail(email) ? 'login-email' : 'login-password')?.focus()
      return
    }

    setBusy(true)
    try {
      const { user } = await authApi.login(email.trim(), password)
      session.acceptUser(user)
      navigate(returnTo, { replace: true })
    } catch (err) {
      // Never say which of the two was wrong
      if (err instanceof ApiError && err.status === 401 && err.message === 'Invalid credentials') {
        setProblem({ key: 'loginFailed' })
      } else {
        setProblem({ text: friendlyError(err, t) })
      }
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t.loginTitle} lead={t.loginLead}>
      {notice && !problem && <Alert tone="success">{notice}</Alert>}
      <GoogleButton returnTo={returnTo} />
      <Divider>{t.loginDivider}</Divider>

      <div aria-live="polite">{problem && <Alert tone="error">{'key' in problem ? t[problem.key] : problem.text}</Alert>}</div>

      <form className="hf-form" onSubmit={handleSubmit} noValidate>
        <TextField
          id="login-email"
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
        <PasswordField
          id="login-password"
          label={t.password}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={passwordError}
          disabled={busy}
          labelAside={
            <Link to="/forgot-password" state={{ email: email.trim() }}>
              {t.forgotLink}
            </Link>
          }
        />
        <SubmitButton busy={busy} busyLabel={t.signingIn}>
          {t.signIn}
        </SubmitButton>
      </form>

      <p className="hf-foot">
        {t.newHere} <Link to="/register">{t.createAccountLink}</Link>
      </p>
    </AuthLayout>
  )
}

export default Login
