import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../Auth/sessionContext'
import { usePreferences } from '../Auth/preferences'
import Icon from '../Homepage/components/Icon'
import { profileStrings } from './strings'
import './AccountMenu.css'

export default function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  const { user, signOut } = useSession()
  const { lang } = usePreferences()
  const t = profileStrings[lang]
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) { if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false) }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  function close() { setOpen(false); onNavigate() }
  async function logout() {
    setBusy(true); setFailed(false)
    try { await signOut(); close(); navigate('/') } catch { setFailed(true) } finally { setBusy(false) }
  }
  if (!user) return <Link className="home-account-entry" to="/profile" onClick={onNavigate}><Icon name="user" size={19} /><span>{t.account}</span></Link>
  return <div className="home-account-controls" ref={container}>
    <button ref={trigger} className="home-account-trigger" aria-label={`${t.accountMenu}: ${user.fullName}`} aria-expanded={open} aria-controls="home-account-dropdown" onClick={() => setOpen(!open)}><span className="home-account-avatar" aria-hidden="true">{Array.from(user.fullName)[0]}</span><span>{user.fullName.split(/\s+/)[0]}</span><Icon name="settings" size={16} /></button>
    {open && <div id="home-account-dropdown" className="home-account-dropdown" role="group" aria-label={t.account}>
      <p><strong>{user.fullName}</strong><bdi dir="ltr">{user.email}</bdi></p>
      <Link to="/profile" onClick={close}><Icon name="user" size={17} />{t.profile}</Link>
      <Link to="/profile/settings" onClick={close}><Icon name="settings" size={17} />{t.settings}</Link>
      <Link to="/events?saved=1" onClick={close}><Icon name="bookmark" size={17} />{t.savedEvents}</Link>
      <button type="button" disabled={busy} onClick={() => void logout()}><Icon name="logout" size={17} />{busy ? t.signingOut : t.signOut}</button>
      {failed && <p className="home-account-error" role="alert">{t.signOutError}</p>}
    </div>}
  </div>
}
