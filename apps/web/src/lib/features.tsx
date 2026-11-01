import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { MessageKey } from '@/i18n'

export const FEATURES = [
  { id: 'learn', label: 'english.tabLearn', to: '/english' },
  { id: 'words', label: 'english.tabWords', to: '/english?tab=words' },
  { id: 'grammar', label: 'nav.grammar', to: '/grammar' },
  { id: 'puzzles', label: 'nav.puzzles', to: '/puzzles' },
  { id: 'reading', label: 'nav.reading', to: '/reading' },
  { id: 'listening', label: 'nav.listening', to: '/listening' },
  { id: 'radio', label: 'nav.radio', to: '/radio' },
  { id: 'me', label: 'english.tabMe', to: '/english?tab=me' },
  { id: 'desk', label: 'nav.desk', to: '/desk' },
  { id: 'about', label: 'nav.about', to: '/about' },
] as const satisfies ReadonlyArray<{ id: string; label: MessageKey; to: string }>

export type FeatureId = typeof FEATURES[number]['id']
type FeatureFlags = Record<FeatureId, boolean>
export const FEATURE_STORAGE_KEY = 'projectdesk.features.v1'
const defaults = Object.fromEntries(FEATURES.map(({ id }) => [id, true])) as FeatureFlags

function readFlags(): FeatureFlags {
  try {
    const saved = JSON.parse(localStorage.getItem(FEATURE_STORAGE_KEY) ?? '{}')
    return Object.fromEntries(FEATURES.map(({ id }) => [id, typeof saved?.[id] === 'boolean' ? saved[id] : true])) as FeatureFlags
  } catch { return { ...defaults } }
}

const FeatureContext = createContext<{
  enabled: FeatureFlags
  setEnabled: (id: FeatureId, value: boolean) => void
  saveError: boolean
} | null>(null)

export function FeatureProvider({ children }: { children: ReactNode }) {
  const [enabled, setFlags] = useState(readFlags)
  const [saveError, setSaveError] = useState(false)
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === FEATURE_STORAGE_KEY || event.key === null) setFlags(readFlags())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  function setEnabled(id: FeatureId, value: boolean) {
    const next = { ...enabled, [id]: value }
    try {
      localStorage.setItem(FEATURE_STORAGE_KEY, JSON.stringify(next))
      setSaveError(false)
      setFlags(next)
    } catch { setSaveError(true) }
  }
  return <FeatureContext.Provider value={{ enabled, setEnabled, saveError }}>{children}</FeatureContext.Provider>
}

export function useFeatures() {
  const context = useContext(FeatureContext)
  if (!context) throw new Error('FeatureProvider is required')
  return context
}

// Match React Router's case-insensitive, trailing-slash-tolerant paths.
// EnglishPage treats unrecognized tabs (including practice) as Learn.
export function featureForLocation(pathname: string, search: string): FeatureId | null {
  let decoded = pathname
  try { decoded = decodeURI(pathname) } catch { /* Invalid URLs go to the not-found page. */ }
  const path = decoded.toLowerCase().replace(/\/+$/, '') || '/'
  if (path === '/' || path === '/english') {
    const tab = new URLSearchParams(search).get('tab')
    return tab === 'words' || tab === 'reading' || tab === 'me' ? tab : 'learn'
  }
  const aliases: Record<string, FeatureId> = {
    '/words': 'words', '/vocabulary': 'words', '/me': 'me', '/board': 'desk',
  }
  return aliases[path] ?? FEATURES.find((feature) => feature.to === path)?.id ?? null
}
