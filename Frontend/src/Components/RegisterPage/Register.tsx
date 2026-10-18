import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, rememberRegistration, type RegisterInput } from '../../lib/authApi'
import { isEmail, isFullName, isPhone, isStrongPassword } from '../../lib/validation'
import {
  Alert,
  AuthLayout,
  Divider,
  GoogleButton,
  PasswordField,
  PasswordRules,
  SubmitButton,
  TextField,
} from '../Auth/AuthParts'
import { friendlyError, isServerMessage, serverFieldError } from '../Auth/authErrors'
import { useStrings } from '../Auth/preferences'

function Register() {
  const t = useStrings()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<Record<string, string | null>>({})
  const [emailTaken, setEmailTaken] = useState(false)

  const nameError = submitted && !isFullName(fullName) ? t.errName : serverErrors.fullName ?? null
  const emailError = emailTaken
    ? t.emailInUse
    : submitted && !isEmail(email)
      ? t.errEmail
      : serverErrors.email ?? null
  const phoneError = submitted && phone.trim() !== '' && !isPhone(phone) ? t.errPhone : serverErrors.phone ?? null
  const passwordError = submitted && !isStrongPassword(password) ? t.errPasswordRules : serverErrors.password ?? null

  function clearServer(field: string) {
    if (serverErrors[field]) setServerErrors((s) => ({ ...s, [field]: null }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setFormError(null)

    const firstInvalid = !isFullName(fullName)
      ? 'register-name'
      : !isEmail(email)
        ? 'register-email'
        : phone.trim() !== '' && !isPhone(phone)
          ? 'register-phone'
          : !isStrongPassword(password)
            ? 'register-password'
            : null
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus()
      return
    }

    const input: RegisterInput = {
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    }

    setBusy(true)
    try {
      await authApi.register(input)
      rememberRegistration(input)
      navigate('/verify-email', { state: { email: input.email } })
    } catch (err) {
      if (isServerMessage(err, 'Email already in use')) {
        setEmailTaken(true)
        document.getElementById('register-email')?.focus()
      } else {
        const fields = {
          fullName: serverFieldError(err, 'fullName'),
          email: serverFieldError(err, 'email'),
          phone: serverFieldError(err, 'phone'),
          password: serverFieldError(err, 'password'),
        }
        setServerErrors(fields)
        if (!Object.values(fields).some(Boolean)) setFormError(friendlyError(err, t))
      }
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t.registerTitle} lead={t.registerLead}>
      <GoogleButton />
      <Divider>{t.registerDivider}</Divider>

      <div aria-live="polite">{formError && <Alert tone="error">{formError}</Alert>}</div>

      <form className="hf-form" onSubmit={handleSubmit} noValidate>
        <TextField
          id="register-name"
          label={t.fullName}
          autoComplete="name"
          value={fullName}
          onChange={(v) => {
            setFullName(v)
            clearServer('fullName')
          }}
          error={nameError}
          disabled={busy}
        />
        <TextField
          id="register-email"
          label={t.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(v) => {
            setEmail(v)
            setEmailTaken(false)
            clearServer('email')
          }}
          error={emailError}
          disabled={busy}
        />
        <TextField
          id="register-phone"
          label={t.phone}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          dir="ltr"
          hint={t.phoneHint}
          value={phone}
          onChange={(v) => {
            setPhone(v)
            clearServer('phone')
          }}
          error={phoneError}
          disabled={busy}
        />
        <div className="hf-field">
          <PasswordField
            id="register-password"
            label={t.password}
            autoComplete="new-password"
            value={password}
            onChange={(v) => {
              setPassword(v)
              clearServer('password')
            }}
            error={passwordError}
            describedBy="register-password-rules"
            disabled={busy}
          />
          <PasswordRules id="register-password-rules" password={password} />
        </div>
        <SubmitButton busy={busy} busyLabel={t.creating}>
          {t.createAccount}
        </SubmitButton>
      </form>

      {emailTaken && (
        <p className="hf-row">
          <Link to="/login" state={{ email: email.trim() }}>
            {t.signInLink}
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/forgot-password" state={{ email: email.trim() }}>
            {t.forgotLink}
          </Link>
        </p>
      )}

      <p className="hf-foot">
        {t.haveAccount} <Link to="/login">{t.signInLink}</Link>
      </p>
    </AuthLayout>
  )
}

export default Register
