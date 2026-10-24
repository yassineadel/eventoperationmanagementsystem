import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences, useStrings } from '../Auth/preferences'
import { TextField } from '../Auth/AuthParts'
import Icon from '../Homepage/components/Icon'
import { profileStrings } from './strings'
import { useProfile } from './profileContext'
import { validateDetails } from './profileModel'
import { profileApi } from '../../lib/profileApi'
import { useAccountAction } from './useAccountAction'

export default function ProfileDetails() {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const auth = useStrings()
  const { profile, updateAccount } = useProfile()
  const action = useAccountAction()
  const [nameDraft, setName] = useState<string | null>(null)
  const [phoneDraft, setPhone] = useState<string | null>(null)
  const name = nameDraft ?? profile.fullName
  const phone = phoneDraft ?? profile.phone
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState<'saved' | ''>('')
  const errors = validateDetails(name, phone)
  const disabled = action.busy || Boolean(profile.deletionRequestedAt)
  const dirty = name.trim() !== profile.fullName || phone.trim() !== profile.phone
  function save(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    setSubmitted(true)
    setMessage('')
    if (errors.fullName || errors.phone) { document.getElementById(errors.fullName ? 'profile-name' : 'profile-phone')?.focus(); return }
    void action.run((signal) => profileApi.updateDetails(name, phone, signal), ({ user }) => {
      updateAccount({ ...user, phone: user.phone ?? '' })
      setName(null); setPhone(null); setSubmitted(false); setMessage('saved')
    })
  }
  return <section className="account-card" aria-labelledby="personal-details-title">
    <header className="account-card-heading"><span><Icon name="user" size={22} /></span><div><h2 id="personal-details-title">{t.personalDetails}</h2><p>{t.detailsLead}</p></div></header>
    {profile.deletionRequestedAt && <p className="account-inline-note">{t.deletionReadOnly}</p>}
    <form noValidate onSubmit={save} aria-busy={action.busy}>
      <fieldset className="account-fields" disabled={disabled}>
        <TextField id="profile-name" label={t.fullName} value={name} onChange={(value) => { setName(value); setMessage(''); action.clearError() }} autoComplete="name" error={submitted && errors.fullName ? auth.errName : null} />
        <TextField id="profile-phone" label={t.phone} type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(value) => { setPhone(value); setMessage(''); action.clearError() }} autoComplete="tel-national" hint={t.phoneHint} error={submitted && errors.phone ? auth.errPhone : null} />
      </fieldset>
      <div className="account-email-summary"><span>{t.email}</span><strong dir="ltr">{profile.email}</strong><span className="account-email-status"><Icon name="mail" size={15} />{profile.emailVerified === null ? t.verificationUnknown : profile.emailVerified ? t.verified : t.unverified}</span><p>{t.emailHint}</p><Link className="home-text-link" to="/profile/settings#account-email">{t.settings}<Icon name="arrow" size={16} /></Link></div>
      <div className="account-actions"><button className="home-button" type="submit" disabled={disabled || !dirty}>{action.busy ? t.saving : t.save}</button><button className="home-outline-button" type="button" disabled={disabled || !dirty} onClick={() => { setName(null); setPhone(null); setSubmitted(false); setMessage(''); action.clearError() }}>{t.discard}</button></div>
      {action.errorText && <p className="account-error" role="alert">{action.errorText}</p>}
      <p className="account-feedback" role="status">{message && t[message]}</p>
    </form>
  </section>
}
