import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { usePreferences } from '../Auth/preferences'
import { useSession } from '../Auth/sessionContext'
import { TextField } from '../Auth/AuthParts'
import Icon, { type IconName } from '../Homepage/components/Icon'
import { profileStrings } from './strings'
import { useProfile } from './profileContext'
import { canRequestDeletion, deletionGraceEnds } from './profileModel'
import { profileApi } from '../../lib/profileApi'
import { useAccountAction } from './useAccountAction'
import PasswordChangeDialog from './PasswordChangeDialog'
import EmailChangeDialog from './EmailChangeDialog'

type Dialog = 'password' | 'email'
type SecurityMessage = 'passwordSuccess' | 'emailSuccess' | ''

function SettingsCard({ id, title, lead, icon, danger, children }: { id: string; title: string; lead?: string; icon: IconName; danger?: boolean; children: ReactNode }) {
  return <section id={id} className={`account-card account-settings-card${danger ? ' account-card--danger' : ''}`} aria-labelledby={`${id}-title`}>
    <header className="account-card-heading"><span><Icon name={icon} size={22} /></span><div><h2 id={`${id}-title`}>{title}</h2>{lead && <p>{lead}</p>}</div></header>{children}
  </section>
}

function SecuritySettings({ onOpen, message }: { onOpen: (dialog: Dialog) => void; message: SecurityMessage }) {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const { profile } = useProfile()
  const disabled = Boolean(profile.deletionRequestedAt)
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
  const { profile, updateAccount } = useProfile()
  const action = useAccountAction()
  const [draft, setDraft] = useState<boolean | null>(null)
  const [saved, setSaved] = useState(false)
  const ready = typeof profile.marketingOptIn === 'boolean'
  const choice = draft ?? profile.marketingOptIn ?? false
  const disabled = action.busy || Boolean(profile.deletionRequestedAt)
  const dirty = ready && choice !== profile.marketingOptIn
  function submit(event: FormEvent) {
    event.preventDefault()
    if (disabled || !dirty) return
    setSaved(false)
    void action.run((signal) => profileApi.preferences(choice, signal), ({ marketingOptIn }) => {
      updateAccount({ marketingOptIn }); setDraft(null); setSaved(true)
    })
  }
  return <SettingsCard id="account-communications" title={t.emailPreferencesTitle} lead={t.communicationsLead} icon="mail">
    {!ready ? <SettingsUnavailable /> : <form onSubmit={submit} aria-busy={action.busy}>
      <fieldset className="account-fields account-preferences-fields" disabled={disabled}><legend className="home-sr-only">{t.emailPreferencesTitle}</legend><label className="account-toggle" htmlFor="preference-marketing">
        <span><strong id="preference-marketing-title">{t.marketing}</strong><span id="preference-marketing-description">{t.marketingLead}</span></span>
        <input id="preference-marketing" type="checkbox" role="switch" aria-labelledby="preference-marketing-title" aria-describedby="preference-marketing-description" checked={choice} onChange={(event) => { setDraft(event.target.checked); setSaved(false); action.clearError() }} />
      </label></fieldset>
      <div className="account-preferences-footer"><p>{t.essentialEmails}</p><button className="home-button" type="submit" disabled={disabled || !dirty}>{action.busy ? t.saving : t.savePreferences}</button></div>
      {action.errorText && <p className="account-error" role="alert">{action.errorText}</p>}
      <p className="account-feedback" role="status">{saved && t.preferencesSaved}</p>
    </form>}
  </SettingsCard>
}

function SettingsUnavailable() {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const { refresh } = useSession()
  return <div className="account-inline-note"><p role="status">{t.settingsUnavailable}</p><button type="button" className="home-text-link" onClick={() => void refresh()}>{t.refreshAccount}</button></div>
}

function DeletionSettings() {
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const { profile, updateAccount } = useProfile()
  const { refresh } = useSession()
  const action = useAccountAction()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState(false)
  const [message, setMessage] = useState<'deletionCancelled' | 'deletionRequested' | ''>('')
  const [deadline, setDeadline] = useState<{ requestedAt: string; endsAt: string } | null>(null)
  const ready = typeof profile.marketingOptIn === 'boolean'
  const graceEnd = deadline && deadline.requestedAt === profile.deletionRequestedAt ? deadline.endsAt : deletionGraceEnds(profile.deletionRequestedAt)
  const date = (value: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(value))
  useEffect(() => { if (open) document.getElementById('account-delete-email')?.focus() }, [open])
  function close() { setOpen(false); setEmail(''); setAcknowledged(false); setError(false) }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready || action.busy || profile.deletionRequestedAt) return
    setMessage(''); action.clearError()
    if (!canRequestDeletion(profile.email, email, acknowledged)) {
      setError(true); document.getElementById(email.trim().toLowerCase() !== profile.email.toLowerCase() ? 'account-delete-email' : 'account-delete-ack')?.focus()
      return
    }
    void action.run((signal) => profileApi.requestDeletion(email, signal), (result) => {
      updateAccount({ deletionRequestedAt: result.deletionRequestedAt })
      setDeadline({ requestedAt: result.deletionRequestedAt, endsAt: result.deletesAt })
      close(); setMessage('deletionRequested')
      requestAnimationFrame(() => document.getElementById('account-cancel-deletion')?.focus())
    })
  }
  function cancelRequest() {
    if (action.busy) return
    setMessage('')
    void action.run((signal) => profileApi.cancelDeletion(signal), () => {
      updateAccount({ deletionRequestedAt: null }); setDeadline(null); setMessage('deletionCancelled')
      requestAnimationFrame(() => document.getElementById('account-request-deletion')?.focus())
    })
  }
  return <SettingsCard id="account-deletion" title={t.privacyTitle} icon="trash" danger>
    <div className="account-setting-row"><div className="account-setting-copy"><h3>{t.deletionTitle}</h3><p>{t.deletionLead}</p></div>
      {!profile.deletionRequestedAt && <button id="account-request-deletion" className="account-danger-button" type="button" disabled={!ready || action.busy} aria-expanded={open} aria-controls={open ? 'account-deletion-confirmation' : undefined} onClick={() => {
        if (open) { document.getElementById('account-delete-email')?.focus(); return }
        setOpen(true); setMessage(''); action.clearError()
      }}>{t.requestDeletionAction}</button>}
    </div>
    {!ready && !profile.deletionRequestedAt && <SettingsUnavailable />}
    {profile.deletionRequestedAt ? <div className="account-deletion-confirmation" aria-busy={action.busy}><p className="account-inline-note" role="status">{t.deletionPending}</p><dl className="account-deletion-dates"><div><dt>{t.deletionRequestedOn}</dt><dd><time dateTime={profile.deletionRequestedAt}>{date(profile.deletionRequestedAt)}</time></dd></div>{graceEnd && <div><dt>{t.deletionGraceEnd}</dt><dd><time dateTime={graceEnd}>{date(graceEnd)}</time></dd></div>}</dl><button id="account-cancel-deletion" className="home-outline-button" type="button" disabled={action.busy} onClick={cancelRequest}>{action.busy ? t.cancellingDeletion : t.cancelDeletion}</button></div>
      : open && <form id="account-deletion-confirmation" className="account-deletion-confirmation" noValidate onSubmit={submit} aria-busy={action.busy}>
        <p className="account-inline-note">{t.deletionConfirmLead}</p><fieldset className="account-fields" disabled={action.busy}>
          <TextField id="account-delete-email" label={t.confirmEmail} type="email" inputMode="email" dir="ltr" value={email} onChange={(value) => { setEmail(value); setError(false) }} autoComplete="off" />
          <label className="account-acknowledgement"><input id="account-delete-ack" type="checkbox" checked={acknowledged} aria-describedby={error ? 'account-deletion-error' : undefined} onChange={(event) => { setAcknowledged(event.target.checked); setError(false) }} />{t.acknowledge}</label>
        </fieldset>{error && <p id="account-deletion-error" className="account-error" role="alert">{t.deletionError}</p>}<div className="account-actions"><button className="account-danger-button" type="submit" disabled={action.busy}>{action.busy ? t.requestingDeletion : t.confirmDeletion}</button><button className="home-outline-button" type="button" disabled={action.busy} onClick={() => { close(); action.clearError(); document.getElementById('account-request-deletion')?.focus() }}>{t.cancel}</button></div>
      </form>}
    {action.errorText && <div><p className="account-error" role="alert">{action.errorText}</p><button className="home-text-link" type="button" disabled={action.busy} onClick={() => void refresh()}>{t.refreshAccount}</button></div>}
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
    {dialog === 'email' && <EmailChangeDialog onClose={() => setDialog(null)} onComplete={() => { setDialog(null); setMessage('emailSuccess') }} />}
  </div>
}
