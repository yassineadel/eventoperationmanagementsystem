import { createContext, useContext } from 'react'
import { strings, type Strings } from './strings'

export type Lang = 'en' | 'ar'
export type Theme = 'light' | 'dark'

export type Preferences = {
  lang: Lang
  theme: Theme
  setLang: (lang: Lang) => void
  setTheme: (theme: Theme) => void
}

export const PreferencesContext = createContext<Preferences>({
  lang: 'en',
  theme: 'light',
  setLang: () => {},
  setTheme: () => {},
})

export function usePreferences() {
  return useContext(PreferencesContext)
}

export function useStrings(): Strings {
  return strings[usePreferences().lang]
}
