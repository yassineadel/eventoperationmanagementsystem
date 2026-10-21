import type { EventStatus, Language } from '../Homepage/types'
import { eventStatusLabels, eventUiStrings } from './eventUiStrings'
import './EventActions.css'

export default function EventStatusBadge({ status, lang, sample = true }: { status: EventStatus; lang: Language; sample?: boolean }) {
  const label = eventStatusLabels[status][lang]
  const description = `${sample ? eventUiStrings[lang].sampleStatus : eventUiStrings[lang].status}: ${label}`
  return <span className={`event-status event-status--${status}`} title={description} aria-label={description}>{label}</span>
}
