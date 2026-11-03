import { useEffect, useId, useRef, useState } from 'react'
import type { HomeStrings } from '../strings'
import { Link } from 'react-router-dom'
import { Brand } from './Navbar'

export default function Footer({ t, appearance = 'default' }: { t: HomeStrings; appearance?: 'default' | 'board' }) {
  const [info, setInfo] = useState<'terms' | 'privacy' | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => { if (info && !dialog.current?.open) dialog.current?.showModal() }, [info])
  if (appearance === 'default') return <footer className="home-footer home-container"><p><Link to="/">{t.brand}</Link><span> — {t.footerTagline}</span></p><p>© {new Date().getFullYear()} {t.brand}</p></footer>
  const openHelp = () => window.dispatchEvent(new Event('hafletna:open-help'))
  return <>
    <footer className="board-footer"><div className="home-container"><div className="board-footer-brand"><Brand name={t.brand} /><p>© {new Date().getFullYear()} {t.brand}. {t.rights}</p></div>
      <div className="board-footer-links"><button type="button" onClick={openHelp}>{t.help}</button><button type="button" aria-haspopup="dialog" onClick={() => setInfo('terms')}>{t.terms}</button><button type="button" aria-haspopup="dialog" onClick={() => setInfo('privacy')}>{t.privacy}</button><button type="button" onClick={openHelp}>{t.contact}</button></div>
    </div></footer>
    {info && <dialog ref={dialog} className="board-info-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); setInfo(null) }} onClick={(event) => { if (event.target === event.currentTarget) setInfo(null) }}>
      <h2 id={titleId}>{info === 'terms' ? t.terms : t.privacy}</h2><p>{info === 'terms' ? t.footerTermsLead : t.footerPrivacyLead}</p><div><Link className="home-text-link" to={info === 'terms' ? '/events' : '/profile'} onClick={() => setInfo(null)}>{info === 'terms' ? t.events : t.accountLabel}</Link><button type="button" className="home-button" onClick={() => setInfo(null)}>{t.closeInfo}</button></div>
    </dialog>}
  </>
}
