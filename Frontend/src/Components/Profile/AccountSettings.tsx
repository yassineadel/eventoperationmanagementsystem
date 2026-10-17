import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { usePreferences } from '../Auth/preferences'
import { TextField } from '../Auth/AuthParts'
import Icon, { type IconName } from '../Homepage/components/Icon'
import { profileStrings } from './strings'
import { useProfile } from './profileContext'
import { canRequestDeletion } from './profileModel'
import PasswordChangeDialog from './PasswordChangeDialog'
import EmailChangeDialog from './EmailChangeDialog'

type Dialog = 'password' | 'email'
type SecurityMessage = 'passwordSuccess' | 'emailSuccess' | 'visitOnly' | ''

function SettingsCard({ id, title, lead, icon, danger, children }: { id: string; title: string; lead?: string; icon: IconName; danger?: boolean; children: ReactNode }) {
  return <section id={id} className={`account-card account-settings-card${danger ? ' account-card--danger' : ''}`} aria-labelledby={`${id}-title`}>
    <header className="account-card-heading"><span><Icon name={icon} size={22} /></span><div><h2 id={`${id}-title`}>{title}</h2>{lead && <p>{lead}</p>}</div></header>{children}
  </section>
}

function SecuritySettings({ onOpen, message }: { onOpen: (dialog: Dialog) => void; message: SecurityMessage }) {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const { profile, preview } = useProfile()
  const disabled = !preview || Boolean(profile.deletionRequestedAt)
  return <SettingsCard id="account-security" title={t.securityTitle} icon="lock">
    <div className="account-setting-row" id="account-password"><div className="account-setting-copy"><h3>{t.passwordLabel}</h3><p>{t.passwordSummary}</p></div>
      <button id="account-change-password" className="home-outline-button" type="button" aria-haspopup="dialog" aria-controls="account-password-dialog" disabled={disabled} onClick={() => onOpen('password')}>{t.passwordTitle}</button>
    </div>
    <div className="account-setting-row" id="account-email"><div className="account-setting-copy"><h3>{t.email}</h3>
      <div className="account-email-line"><bdi dir="ltr">{profile.email}</bdi><span className={`account-verification-badge${profile.emailVerified === true ? ' is-verified' : ''}`}>{profile.emailVerified === null ? t.verificationUnknown : profile.emailVerified ? t.verified : t.unverified}</span></div>
      <p>{t.emailSummary}</p></div>
      <button id="account-change-email" className="home-outline-button" type="button" aria-haspopup="dialog" aria-controls="account-email-dialog" disabled={disabled} onClick={() => onOpen('email')}>{t.emailTitle}</button>
    </div>
    <p className="account-feedback" role="status">{message && t[message]}</p>
  </SettingsCard>
}

function CommunicationSettings() {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const { profile, preview, updatePreview } = useProfile()
  const [choices, setChoices] = useState(profile.communications)
  const [message, setMessage] = useState<'saved' | 'visitOnly' | ''>('')
  const disabled = !preview || Boolean(profile.deletionRequestedAt)
  const dirty = choices.eventNews !== profile.communications.eventNews || choices.personalisedOffers !== profile.communications.personalisedOffers
  const options = [
    { id: 'eventNews' as const, title: t.eventNews, lead: t.eventNewsLead },
    { id: 'personalisedOffers' as const, title: t.offers, lead: t.offersLead },
  ]
  function submit(event: FormEvent) {
    event.preventDefault()
    if (disabled || !dirty) return
    setMessage(updatePreview({ communications: { ...choices } }) ? 'saved' : 'visitOnly')
  }
  return <SettingsCard id="account-communications" title={t.emailPreferencesTitle} lead={t.communicationsLead} icon="mail">
    {!preview ? <p className="account-inline-note">{t.preferencesUnavailable}</p> : <form onSubmit={submit}>
      <fieldset className="account-fields account-preferences-fields" disabled={disabled}><legend className="home-sr-only">{t.emailPreferencesTitle}</legend>{options.map((option) => <label className="account-toggle" key={option.id} htmlFor={`preference-${option.id}`}>
        <span><strong id={`preference-${option.id}-title`}>{option.title}</strong><span id={`preference-${option.id}-description`}>{option.lead}</span></span>
        <input id={`preference-${option.id}`} type="checkbox" role="switch" aria-labelledby={`preference-${option.id}-title`} aria-describedby={`preference-${option.id}-description`} checked={choices[option.id]} onChange={(event) => { setChoices({ ...choices, [option.id]: event.target.checked }); setMessage('') }} />
      </label>)}</fieldset>
      <div className="account-preferences-footer"><p>{t.essentialEmails}</p><button className="home-button" type="submit" disabled={disabled || !dirty}>{t.savePreferences}</button></div>
      <p className="account-feedback" role="status">{message && t[message]}</p>
    </form>}
  </SettingsCard>
}

function DeletionSettings() {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const { profile, preview, updatePreview } = useProfile()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState(false)
  const [message, setMessage] = useState<'deletionCancelled' | 'visitOnly' | ''>('')
  useEffect(() => { if (open) document.getElementById('account-delete-email')?.focus() }, [open])
  function close() { setOpen(false); setEmail(''); setAcknowledged(false); setError(false) }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!preview || profile.deletionRequestedAt) return
    if (!canRequestDeletion(profile.email, email, acknowledged)) {
      setError(true); document.getElementById(email.trim().toLowerCase() !== profile.email.toLowerCase() ? 'account-delete-email' : 'account-delete-ack')?.focus()
      return
    }
    const persisted = updatePreview({ deletionRequestedAt: new Date().toISOString() })
    close(); setMessage(persisted ? '' : 'visitOnly')
  }
  return <SettingsCard id="account-deletion" title={t.privacyTitle} icon="trash" danger>
    <div className="account-setting-row"><div className="account-setting-copy"><h3>{t.deletionTitle}</h3><p>{t.deletionLead}</p></div>
      {!profile.deletionRequestedAt && <button id="account-request-deletion" className="account-danger-button" type="button" disabled={!preview} aria-expanded={open} aria-controls={open ? 'account-deletion-confirmation' : undefined} onClick={() => {
        if (open) { document.getElementById('account-delete-email')?.focus(); return }
        setOpen(true); setMessage('')
      }}>{t.requestDeletionAction}</button>}
    </div>
    {profile.deletionRequestedAt ? <div className="account-deletion-confirmation"><p className="account-inline-note" role="status">{t.deletionPending}</p><button className="home-outline-button" type="button" disabled={!preview} onClick={() => setMessage(updatePreview({ deletionRequestedAt: null }) ? 'deletionCancelled' : 'visitOnly')}>{t.cancelDeletion}</button></div>
      : open && <form id="account-deletion-confirmation" className="account-deletion-confirmation" noValidate onSubmit={submit}>
        <p className="account-inline-note">{t.deletionConfirmLead}</p><fieldset className="account-fields" disabled={!preview}>
          <TextField id="account-delete-email" label={t.confirmEmail} type="email" inputMode="email" dir="ltr" value={email} onChange={(value) => { setEmail(value); setError(false) }} autoComplete="off" />
          <label className="account-acknowledgement"><input id="account-delete-ack" type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); setError(false) }} />{t.acknowledge}</label>
        </fieldset>{error && <p className="account-error" role="alert">{t.deletionError}</p>}<div className="account-actions"><button className="account-danger-button" type="submit" disabled={!preview}>{t.confirmDeletion}</button><button className="home-outline-button" type="button" onClick={() => { close(); document.getElementById('account-request-deletion')?.focus() }}>{t.cancel}</button></div>
      </form>}
    <p className="account-feedback" role="status">{message && t[message]}</p>
  </SettingsCard>
}

export default function AccountSettings() {
  const { profile } = useProfile()
  const { lang } = usePreferences()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [message, setMessage] = useState<SecurityMessage>('')
  return <div className="account-settings-stack">
    {profile.deletionRequestedAt && <p className="account-inline-note" role="status">{profileStrings[lang].deletionReadOnly}</p>}
    <SecuritySettings message={message} onOpen={(next) => { setMessage(''); setDialog(next) }} />
    <CommunicationSettings /><DeletionSettings />
    {dialog === 'password' && <PasswordChangeDialog onClose={() => setDialog(null)} onComplete={() => { setDialog(null); setMessage('passwordSuccess') }} />}
    {dialog === 'email' && <EmailChangeDialog onClose={() => setDialog(null)} onComplete={(persisted) => { setDialog(null); setMessage(persisted ? 'emailSuccess' : 'visitOnly') }} />}
  </div>
}
