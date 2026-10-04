import { useState } from 'react'
import './Login.css'

function Login() {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="MainContainer">
      {/* ---------------- LEFT: marketing panel ---------------- */}
      <section className="LeftBox">
        <header className="Brand">
          <span className="BrandMark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4Z" />
              <path d="M9 8v8M15 8v8" />
            </svg>
          </span>
          <span className="BrandName">TicketsHouse</span>
        </header>

        {/* floating proof cards */}
        <div className="FloatCards" aria-hidden="true">
          <div className="FloatCard FloatCard--one">
            <span className="FloatIcon FloatIcon--gold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.2l5.9-.9L12 3Z" />
              </svg>
            </span>
            <span className="FloatText">
              <strong>Aurora Nights</strong>
              <small>Sat, Jun 14 · El Alamein</small>
            </span>
          </div>

          <div className="FloatCard FloatCard--two">
            <span className="FloatIcon FloatIcon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="7" y="2" width="10" height="20" rx="2" />
                <path d="M11 18h2" />
              </svg>
            </span>
            <span className="FloatText">
              <strong>2 e-tickets</strong>
              <small>Ready in your wallet</small>
            </span>
          </div>
        </div>

        <div className="Pitch">
          <h1 className="PitchTitle">Your next night out starts here.</h1>
          <p className="PitchLead">
            One account to book, store and manage every ticket — concerts, opera,
            festivals and more.
          </p>

          <ul className="Perks">
            <li>
              <span className="PerkIcon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="7" y="2" width="10" height="20" rx="2" />
                  <path d="M11 18h2" />
                </svg>
              </span>
              Instant e-tickets, straight to your phone
            </li>
            <li>
              <span className="PerkIcon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v5h5" />
                </svg>
              </span>
              Free refunds up to 7 days before
            </li>
            <li>
              <span className="PerkIcon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3 4 6.5v5c0 4.6 3.4 8.4 8 9.5 4.6-1.1 8-4.9 8-9.5v-5L12 3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              Verified tickets, buyer guarantee
            </li>
          </ul>

          <hr className="Divider" />

          
        </div>
      </section>

      {/* ---------------- RIGHT: auth panel ---------------- */}
      <section className="AuthBox">
        <p className="Eyebrow">Welcome back</p>
        <h2 className="AuthTitle">Log in to your account</h2>
        <p className="AuthSub">Pick up right where you left off.</p>

        <button type="button" className="GoogleBtn">
          <svg className="GoogleIcon" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5Z" />
            <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.7 7l7.6 5.9c4.4-4.1 6.8-10.2 6.8-17.4Z" />
            <path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1Z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48Z" />
          </svg>
          Continue with Google
        </button>

        <div className="OrDivider"><span>or use email</span></div>

        <form className="AuthForm" onSubmit={(e) => e.preventDefault()}>
          <label className="Field">
            <span className="FieldLabel">Email address</span>
            <span className="InputWrap">
              <svg className="InputIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <input type="email" name="email" placeholder="you@email.com" autoComplete="email" />
            </span>
          </label>

          <label className="Field">
            <span className="FieldLabel">Password</span>
            <span className="InputWrap">
              <svg className="InputIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="EyeBtn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </span>
          </label>

          <div className="FormRow">
            <label className="Remember">
              <input type="checkbox" defaultChecked />
              Keep me signed in
            </label>
            <a href="#forgot" className="LinkGreen">Forgot password?</a>
          </div>

          <button type="submit" className="SubmitBtn">Log in</button>
        </form>

        <p className="AuthFooter">
          New to TicketsHouse? <a href="#register" className="LinkGreen">Create an account</a>
        </p>
      </section>
    </div>
  )
}

export default Login
