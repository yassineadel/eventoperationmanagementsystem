import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { PreferencesContext, type Lang, type Theme } from './preferences'

// Language and theme are per-browser conveniences, so localStorage is enough.
// Reads and writes are guarded because storage can be blocked (private mode, policies).
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return allowed.includes(value as T) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore: the choice still applies for this visit
  }
}

function initialTheme(): Theme {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return readStored<Theme>('hafletna.theme', ['light', 'dark'], prefersDark ? 'dark' : 'light')
}

export default function PreferencesProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStored<Lang>('hafletna.lang', ['en', 'ar'], 'en'))
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  const value = useMemo(
    () => ({
      lang,
      theme,
      setLang: (next: Lang) => {
        setLangState(next)
        writeStored('hafletna.lang', next)
      },
      setTheme: (next: Theme) => {
        setThemeState(next)
        writeStored('hafletna.theme', next)
      },
    }),
    [lang, theme],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
