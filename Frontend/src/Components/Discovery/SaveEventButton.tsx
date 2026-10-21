import { useState } from 'react'
import type { Event, Language } from '../Homepage/types'
import Icon from '../Homepage/components/Icon'
import { useSavedEvents } from './savedEventsContext'
import { eventUiStrings } from './eventUiStrings'
import './EventActions.css'

export default function SaveEventButton({ event, lang, labelled = false }: { event: Event; lang: Language; labelled?: boolean }) {
  const { savedIds, toggleSaved } = useSavedEvents()
  const [announcement, setAnnouncement] = useState('')
  const saved = savedIds.includes(event.id)
  const t = eventUiStrings[lang]
  const action = `${saved ? t.removeSaved : t.saveEvent}: ${event.title[lang]}`
  function toggle() {
    const result = toggleSaved(event.id)
    setAnnouncement('full' in result ? t.savedLimit : result.saved ? result.persisted ? t.savedMessage : t.savedForVisit : result.persisted ? t.removedMessage : t.removedForVisit)
  }
  return <>
    <button type="button" className={`event-save-button${labelled ? ' event-save-button--labelled' : ''}`} onClick={toggle} aria-pressed={saved} aria-label={action} title={action}>
      <Icon name="bookmark" size={20} />{labelled && <span>{saved ? t.saved : t.saveEvent}</span>}
    </button>
    <span className="home-sr-only" role="status" aria-live="polite">{announcement}</span>
  </>
}
