import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, zh, type MessageKey } from '@/i18n/messages'

export type Locale = 'en' | 'zh'
export type { MessageKey }

const STORAGE_KEY = 'projectdesk.locale'

const tables: Record<Locale, Record<MessageKey, string>> = { en, zh }

/** English strings produced by validators, mapped so the UI can show them in the active language. */
const knownEnglish: Record<string, MessageKey> = {
  'Enter a title.': 'error.title',
  'Keep the title under 80 characters.': 'error.titleLong',
  'Keep the signal under 280 characters.': 'error.signalLong',
  'Keep the root cause under 280 characters.': 'error.findingLong',
  'Keep the lesson under 280 characters.': 'error.lessonLong',
  'Keep the priority under 120 characters.': 'error.priorityLong',
  'Score must be a whole number from 0 to 100.': 'error.score',
  'Metrics must be numbers, or left blank.': 'error.metrics',
  'A lesson is required before the next cycle.': 'error.lessonRequired',
  'Save this cycle before starting the next one.': 'error.saveFirst',
  'The next cycle could not be created.': 'error.nextFailed',
  'The cycle could not be saved.': 'error.saveFailed',
  'Enter a word.': 'error.word',
  'Keep the word under 80 characters.': 'error.wordLong',
  'Enter a meaning.': 'error.meaning',
  'Keep the meaning under 160 characters.': 'error.meaningLong',
  'Enter an example.': 'error.example',
  'Keep the example under 280 characters.': 'error.exampleLong',
  'Use the word in the example sentence.': 'error.exampleUse',
  'Write ten examples.': 'error.examples',
  'enter a word': 'error.word',
  'keep the word under 80 characters': 'error.wordLong',
  'enter a meaning': 'error.meaning',
  'keep the meaning under 160 characters': 'error.meaningLong',
  'enter an example': 'error.example',
  'keep the example under 280 characters': 'error.exampleLong',
  'use the word in the example sentence': 'error.exampleUse',
  'write ten examples': 'error.examples',
  'Enter a name.': 'error.name',
  'Keep the name under 80 characters.': 'error.nameLong',
  'Keep the note under 280 characters.': 'error.noteLong',
  'The lesson could not be saved.': 'knowledge.saveFailed',
  'The desk could not be reached.': 'desk.unreachable',
  'That change could not be saved.': 'desk.writeFailed',
  'The project could not be saved.': 'project.saveFailed',
  'The desk could not save this project.': 'project.saveFailed',
  'The loop could not save this cycle.': 'error.saveFailed',
  'Write what you learned before starting the next cycle.': 'error.lessonRequired',
  'The loop could not start the next cycle.': 'error.nextFailed',
  'Start time unknown': 'window.unknown',
  'Inside 24 hours': 'window.inside24',
  'Inside 48 hours': 'window.inside48',
  'Past 48 hours': 'window.past',
}

type I18nValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  localize: (message: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    /* private mode */
  }
  return 'en'
}

function fill(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private mode */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  const value = useMemo<I18nValue>(() => {
    const t = (key: MessageKey, vars?: Record<string, string | number>) =>
      fill(tables[locale][key] ?? en[key], vars)
    const localize = (message: string) => {
      if (locale === 'en') return message
      const key = knownEnglish[message]
      return key ? t(key) : message
    }
    return { locale, setLocale, t, localize }
  }, [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh', label: '中文' },
]
