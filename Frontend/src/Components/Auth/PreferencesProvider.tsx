import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { PreferencesContext, type Lang, type Theme } from './preferences'

// Language is a per-browser convenience, so localStorage is enough.
// Hafletna has one fixed light identity, so the theme is always 'light'.
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

export default function PreferencesProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStored<Lang>('hafletna.lang', ['en', 'ar'], 'en'))
  const theme: Theme = 'light'

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
      setTheme: () => {},
    }),
    [lang],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
