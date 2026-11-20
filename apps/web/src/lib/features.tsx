import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { MessageKey } from '@/i18n'
import { authFetch, getAuthState, subscribeAuth } from '@/lib/auth'

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

function storageKeyForUser(subject?: string): string {
  return subject ? `${FEATURE_STORAGE_KEY}.${subject}` : FEATURE_STORAGE_KEY
}

function normalizeFlags(saved: Record<string, unknown> | null | undefined): FeatureFlags {
  return Object.fromEntries(
    FEATURES.map(({ id }) => [id, typeof saved?.[id] === 'boolean' ? saved[id] : true]),
  ) as FeatureFlags
}

function readFlags(key: string): FeatureFlags {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      return normalizeFlags(JSON.parse(raw) as Record<string, unknown>)
    }
    // Seed new account-scoped key from legacy key if present
    if (key !== FEATURE_STORAGE_KEY) {
      const legacy = localStorage.getItem(FEATURE_STORAGE_KEY)
      if (legacy) {
        return normalizeFlags(JSON.parse(legacy) as Record<string, unknown>)
      }
    }
    return { ...defaults }
  } catch {
    return { ...defaults }
  }
}

function writeLocalFlags(key: string, flags: FeatureFlags): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(flags))
    return true
  } catch {
    return false
  }
}

const FeatureContext = createContext<{
  enabled: FeatureFlags
  setEnabled: (id: FeatureId, value: boolean) => void
  saveError: boolean
} | null>(null)

export function FeatureProvider({ children }: { children: ReactNode }) {
  const auth = useSyncExternalStore(subscribeAuth, getAuthState)
  const userKey = storageKeyForUser(auth.status === 'authenticated' ? auth.subject : undefined)
  const [enabledByKey, setEnabledByKey] = useState<{ key: string; flags: FeatureFlags }>(() => ({
    key: userKey,
    flags: readFlags(userKey),
  }))
  const [saveError, setSaveError] = useState(false)

  const enabled = enabledByKey.key === userKey ? enabledByKey.flags : readFlags(userKey)

  useEffect(() => {
    const syncStorage = (event: StorageEvent) => {
      if (event.key === userKey || event.key === null) {
        setEnabledByKey({ key: userKey, flags: readFlags(userKey) })
      }
    }
    window.addEventListener('storage', syncStorage)
    return () => window.removeEventListener('storage', syncStorage)
  }, [userKey])

  // Sync account feature preferences from PostgreSQL when authenticated (or local-anonymous)
  useEffect(() => {
    if (auth.status !== 'authenticated' && auth.status !== 'disabled') return
    let active = true
    void authFetch('/api/user/features')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { features?: Record<string, unknown> } | null) => {
        if (!active || !data?.features) return
        const remoteKeys = Object.keys(data.features)
        if (remoteKeys.length > 0) {
          const merged = normalizeFlags(data.features)
          writeLocalFlags(userKey, merged)
          setEnabledByKey({ key: userKey, flags: merged })
        } else {
          // First sign-in on this account: persist any existing local customization to the server
          const localFlags = readFlags(userKey)
          const hasCustom = FEATURES.some(({ id }) => localFlags[id] !== true)
          if (hasCustom) {
            void authFetch('/api/user/features', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ features: localFlags }),
            }).catch(() => {})
          }
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [auth.status, auth.subject, userKey])

  function setEnabled(id: FeatureId, value: boolean) {
    const current = enabledByKey.key === userKey ? enabledByKey.flags : readFlags(userKey)
    const next = { ...current, [id]: value }
    const ok = writeLocalFlags(userKey, next)
    setSaveError(!ok)
    setEnabledByKey({ key: userKey, flags: next })

    if (auth.status === 'authenticated' || auth.status === 'disabled') {
      void authFetch('/api/user/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: next }),
      }).catch(() => {
        setSaveError(true)
      })
    }
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
