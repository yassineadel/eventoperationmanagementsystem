import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences, useStrings } from '../Auth/preferences'
import { TextField } from '../Auth/AuthParts'
import Icon from '../Homepage/components/Icon'
import { profileStrings } from './strings'
import { useProfile } from './profileContext'
import { validateDetails } from './profileModel'

export default function ProfileDetails() {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const auth = useStrings()
  const { profile, preview, updatePreview } = useProfile()
  const [name, setName] = useState(profile.fullName)
  const [phone, setPhone] = useState(profile.phone)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState<'saved' | 'visitOnly' | ''>('')
  const errors = validateDetails(name, phone)
  const disabled = !preview || Boolean(profile.deletionRequestedAt)
  const dirty = name.trim() !== profile.fullName || phone.trim() !== profile.phone
  function save(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    setSubmitted(true)
    setMessage('')
    if (errors.fullName || errors.phone) { document.getElementById(errors.fullName ? 'profile-name' : 'profile-phone')?.focus(); return }
    const persisted = updatePreview({ fullName: name.trim(), phone: phone.trim() })
    setName(name.trim()); setPhone(phone.trim()); setSubmitted(false)
    setMessage(persisted ? 'saved' : 'visitOnly')
  }
  return <section className="account-card" aria-labelledby="personal-details-title">
    <header className="account-card-heading"><span><Icon name="user" size={22} /></span><div><h2 id="personal-details-title">{t.personalDetails}</h2><p>{t.detailsLead}</p></div></header>
    {profile.deletionRequestedAt && <p className="account-inline-note">{t.deletionReadOnly}</p>}
    <form noValidate onSubmit={save}>
      <fieldset className="account-fields" disabled={disabled}>
        <TextField id="profile-name" label={t.fullName} value={name} onChange={(value) => { setName(value); setMessage('') }} autoComplete="name" error={submitted && errors.fullName ? auth.errName : null} />
        <TextField id="profile-phone" label={t.phone} type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(value) => { setPhone(value); setMessage('') }} autoComplete="tel-national" hint={t.phoneHint} error={submitted && errors.phone ? auth.errPhone : null} />
      </fieldset>
      <div className="account-email-summary"><span>{t.email}</span><strong dir="ltr">{profile.email}</strong><span className="account-email-status"><Icon name="mail" size={15} />{profile.emailVerified === null ? t.verificationUnknown : profile.emailVerified ? t.verified : t.unverified}</span><p>{t.emailHint}</p><Link className="home-text-link" to={`/profile/settings${preview ? '?preview=1' : ''}#account-email`}>{t.settings}<Icon name="arrow" size={16} /></Link></div>
      <div className="account-actions"><button className="home-button" type="submit" disabled={disabled || !dirty}>{t.save}</button><button className="home-outline-button" type="button" disabled={disabled || !dirty} onClick={() => { setName(profile.fullName); setPhone(profile.phone); setSubmitted(false); setMessage('') }}>{t.discard}</button></div>
      <p className="account-feedback" role="status">{message && t[message]}</p>
    </form>
  </section>
}
