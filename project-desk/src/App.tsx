import { useEffect } from 'react'
import { Search } from 'lucide-react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { SiteHeader } from '@/components/site-header'
import { SpeechSettings } from '@/components/speech-settings'
import { ThemePicker } from '@/components/theme-picker'
import { LOCALES, useI18n } from '@/i18n'
import { AboutPage } from '@/pages/about-page'
import { BoardPage } from '@/pages/board-page'
import { EnglishPage } from '@/pages/english-page'
import { ListeningPage } from '@/pages/listening-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { ReadingPage } from '@/pages/reading-page'

export default function App() {
  return (
    <BrowserRouter>
      <Frame />
    </BrowserRouter>
  )
}

function Frame() {
  const { t, locale, setLocale } = useI18n()
  const zh = locale === 'zh'
  const navigate = useNavigate()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        navigate('/english?tab=words')
        window.setTimeout(() => {
          document.getElementById('english-search')?.focus()
        }, 60)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  return (
    <div className="english-app relative z-10 flex min-h-svh flex-col lg:h-svh lg:flex-row lg:overflow-hidden">
      <SiteHeader />
      <div className="flex min-w-0 flex-1 flex-col lg:h-svh lg:overflow-y-auto">
        {/* Slim Top Workbench Status Bar */}
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-background/85 px-4 py-2 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{zh ? '状态：' : 'Status:'}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              {zh ? '记忆流就绪' : 'Memory Flow Ready'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigate('/english?tab=words')
                window.setTimeout(() => {
                  document.getElementById('english-search')?.focus()
                }, 60)
              }}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-card/80 px-3 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              <Search className="size-3.5" aria-hidden="true" />
              <span>{zh ? '快捷检索词库 (⌘+K)' : 'Quick search words (⌘+K)'}</span>
            </button>
            <SpeechSettings />
            <ThemePicker />
            <label className="sr-only" htmlFor="locale">
              {t('lang')}
            </label>
            <select
              id="locale"
              aria-label={t('lang')}
              value={locale}
              onChange={(event) => setLocale(event.target.value as 'en' | 'zh')}
              className="h-8 rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground shadow-2xs"
            >
              {LOCALES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        <main className="w-full flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-6 lg:pb-8">
          <Routes>
            <Route index element={<BoardPage />} />
            <Route path="english" element={<EnglishPage />} />
            <Route path="reading" element={<ReadingPage />} />
            <Route path="listening" element={<ListeningPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        <footer className="w-full px-4 pt-2 pb-24 sm:px-6 lg:px-8 lg:pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
            <p className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              <span>{t('footer')}</span>
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              SRS v4.2.8 · <span className="text-primary">{t('brand')}</span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
