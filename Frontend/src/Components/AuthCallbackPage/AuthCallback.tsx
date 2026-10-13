import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../../lib/authApi'
import { Alert, AuthLayout } from '../Auth/AuthParts'
import { useStrings } from '../Auth/preferences'

// Google sign-in returns here after the backend has set the session cookie.
// We confirm the session with /me, then continue into the site.
function AuthCallback() {
  const t = useStrings()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    authApi
      .me()
      .then(() => {
        if (!cancelled) navigate('/', { replace: true })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <AuthLayout title={failed ? t.loginTitle : t.callbackWorking}>
      <div aria-live="polite">
        {failed ? (
          <>
            <Alert tone="error">{t.callbackFailed}</Alert>
            <Link className="hf-primary" to="/login">
              {t.signIn}
            </Link>
          </>
        ) : (
          <p className="hf-lead">{t.callbackWorking}…</p>
        )}
      </div>
    </AuthLayout>
  )
}

export default AuthCallback
