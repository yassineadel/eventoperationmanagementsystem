import { useEffect, useRef } from 'react'
import { categoryNames, cityNames, type HomeStrings } from '../strings'
import { defaultRecommendations } from '../recommendations'
import type { Category, Language, RecommendationPreferences } from '../types'
import Icon from './Icon'

export default function RecommendationDialog({ lang, t, preferences, onChange, onClose }: {
  lang: Language; t: HomeStrings; preferences: RecommendationPreferences;
  onChange: (next: RecommendationPreferences) => void; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [])

  function toggleInterest(category: Category) {
    const interests = preferences.interests.includes(category)
      ? preferences.interests.filter((item) => item !== category)
      : [...preferences.interests, category]
    onChange({ ...preferences, interests })
  }

  return (
    <dialog ref={dialog} className="home-event-dialog home-preferences-dialog" aria-labelledby="preferences-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
      <button className="home-dialog-close" onClick={onClose} aria-label={t.closePreferences}><Icon name="close" size={22} /></button>
      <div className="home-dialog-content">
        <h2 id="preferences-title">{t.personalise}</h2>
        <p>{t.recommendationsActive}</p>
        <fieldset className="home-interests"><legend>{t.interests}</legend><div className="home-interest-chips">
          {(Object.keys(categoryNames) as Category[]).map((category) => <button key={category} className="home-interest-chip" aria-pressed={preferences.interests.includes(category)} onClick={() => toggleInterest(category)}><Icon name={category} size={18} />{categoryNames[category][lang]}</button>)}
        </div></fieldset>
        <div className="home-recommendation-city"><label htmlFor="recommendation-city">{t.recommendationCity}</label><select id="recommendation-city" value={preferences.city} onChange={(event) => onChange({ ...preferences, city: event.target.value as RecommendationPreferences['city'] })}><option value="">{t.anyCity}</option>{Object.entries(cityNames).map(([id, name]) => <option key={id} value={id}>{name[lang]}</option>)}</select></div>
        <div className="home-preferences-actions"><button className="home-text-link" onClick={() => onChange(defaultRecommendations)}>{t.resetPreferences}</button><button className="home-button" onClick={onClose}>{t.savePreferences}</button></div>
      </div>
    </dialog>
  )
}
