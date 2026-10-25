import { useEffect, useRef, type ReactNode } from 'react'
import { usePreferences } from '../Auth/preferences'
import Icon, { type IconName } from '../Homepage/components/Icon'
import { profileStrings } from './strings'

export default function AccountDialog({ id, title, lead, icon, focusId, onClose, children, busy = false }: {
  id: string; title: string; lead: string; icon: IconName; focusId: string; onClose: () => void; children: ReactNode; busy?: boolean
}) {
  const { lang } = usePreferences()
  const dialog = useRef<HTMLDialogElement>(null)
  const backdropPress = useRef(false)

  useEffect(() => {
    const element = dialog.current!
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    element.querySelector<HTMLElement>(`#${focusId}`)?.focus({ preventScroll: true })
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [focusId])

  return <dialog ref={dialog} id={id} className="account-dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-lead`}
    aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
    onPointerDown={(event) => {
      const rect = event.currentTarget.getBoundingClientRect()
      backdropPress.current = event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
    }}
    onClick={(event) => {
      const rect = event.currentTarget.getBoundingClientRect()
      if (!busy && backdropPress.current && event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) onClose()
      backdropPress.current = false
    }}>
    <button className="account-dialog-close" type="button" disabled={busy} onClick={onClose} aria-label={profileStrings[lang].closeDialog}><Icon name="close" size={21} /></button>
    <header className="account-card-heading"><span><Icon name={icon} size={22} /></span><div><h2 id={`${id}-title`}>{title}</h2><p id={`${id}-lead`}>{lead}</p></div></header>
    {children}
  </dialog>
}
