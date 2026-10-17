import type { EventStatus, Language } from '../Homepage/types'
import { eventStatusLabels, eventUiStrings } from './eventUiStrings'
import './EventActions.css'

export default function EventStatusBadge({ status, lang }: { status: EventStatus; lang: Language }) {
  const label = eventStatusLabels[status][lang]
  const description = `${eventUiStrings[lang].sampleStatus}: ${label}`
  return <span className={`event-status event-status--${status}`} title={description} aria-label={description}>{label}</span>
}
