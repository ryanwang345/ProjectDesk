import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Search, Sparkles } from 'lucide-react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from '@/components/error-boundary'
import { FloatingRadioMiniPlayer } from '@/components/floating-radio-mini-player'
import { GlobalHoverDictionary, useHoverDictionaryToggle } from '@/components/global-hover-dictionary'
import { SiteHeader } from '@/components/site-header'
import { SpeechSettings } from '@/components/speech-settings'
import { ThemePicker } from '@/components/theme-picker'
import { LOCALES, useI18n } from '@/i18n'
import { getSystemVersion } from '@/lib/api'
import { cn } from '@/lib/utils'

// Lazy-load route pages for code-splitting and faster initial bundle loading
const EnglishPage = lazy(() => import('@/pages/english-page').then((m) => ({ default: m.EnglishPage })))
const BoardPage = lazy(() => import('@/pages/board-page').then((m) => ({ default: m.BoardPage })))
const GrammarPage = lazy(() => import('@/pages/grammar-page').then((m) => ({ default: m.GrammarPage })))
const ListeningPage = lazy(() => import('@/pages/listening-page').then((m) => ({ default: m.ListeningPage })))
const ReadingPage = lazy(() => import('@/pages/reading-page').then((m) => ({ default: m.ReadingPage })))
const RadioNewsPage = lazy(() => import('@/pages/radio-news-page').then((m) => ({ default: m.RadioNewsPage })))
const AboutPage = lazy(() => import('@/pages/about-page').then((m) => ({ default: m.AboutPage })))
const NotFoundPage = lazy(() => import('@/pages/not-found-page').then((m) => ({ default: m.NotFoundPage })))

function PageLoadingFallback() {
  return (
    <div className="flex h-72 w-full flex-col items-center justify-center gap-3">
      <div className="flex items-center gap-2.5 rounded-full border border-border/80 bg-card/60 px-4 py-2 text-xs text-muted-foreground shadow-2xs backdrop-blur-xs">
        <span className="size-2 animate-ping rounded-full bg-primary" />
        <span className="font-mono text-[11px] tracking-wide text-foreground/80">Loading module...</span>
      </div>
    </div>
  )
}

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
  const { enabled: hoverDictEnabled, toggle: toggleHoverDict } = useHoverDictionaryToggle()
  const [apiVersion, setApiVersion] = useState<string | null>(null)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = true
    getSystemVersion()
      .then((info) => {
        if (!active) return
        setApiVersion(info.version || 'dev')
        setApiOnline(info.status === 'ok')
      })
      .catch(() => {
        if (!active) return
        setApiVersion('offline')
        setApiOnline(false)
      })
    return () => {
      active = false
    }
  }, [])

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
      <div ref={scrollContainerRef} className="flex min-w-0 flex-1 flex-col lg:h-svh lg:overflow-y-auto">
        {/* Slim Top Workbench Status Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border/70 bg-background/85 px-3 py-1.5 backdrop-blur-md sm:px-6 sm:py-2 lg:px-8">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span>{zh ? '状态：' : 'Status:'}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              {zh ? '记忆流就绪' : 'Memory Flow Ready'}
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-border/80 bg-card/60 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground md:inline-flex">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  apiOnline === true ? 'bg-emerald-500' : apiOnline === false ? 'bg-destructive' : 'bg-primary animate-pulse',
                )}
                aria-hidden="true"
              />
              <span>Web {__APP_VERSION__}</span>
              <span className="text-border">/</span>
              <span>API {apiVersion ? (apiVersion.startsWith('v') ? apiVersion : `v${apiVersion}`) : '...'}</span>
            </span>
          </div>

          <div className="flex w-full flex-wrap items-center justify-between gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
            <button
              type="button"
              onClick={() => {
                navigate('/english?tab=words')
                window.setTimeout(() => {
                  document.getElementById('english-search')?.focus()
                }, 60)
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground sm:gap-2 sm:px-3"
            >
              <Search className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">{zh ? '检索词库' : 'Search'}</span>
              <span className="hidden sm:inline">{zh ? '快捷检索词库 (⌘+K)' : 'Quick search words (⌘+K)'}</span>
            </button>
            <button
              type="button"
              onClick={toggleHoverDict}
              title={zh ? '切换全局单词悬浮查词功能' : 'Toggle Global Word Hover Dictionary'}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition sm:gap-1.5 sm:px-3',
                hoverDictEnabled
                  ? 'border-primary/40 bg-primary/15 text-primary shadow-2xs hover:bg-primary/20'
                  : 'border-border bg-card/60 text-muted-foreground hover:text-foreground',
              )}
            >
              <Sparkles className="size-3 shrink-0 text-primary" aria-hidden="true" />
              <span className="sm:hidden">
                {zh ? (hoverDictEnabled ? '查词 开' : '查词 关') : hoverDictEnabled ? 'Dict ON' : 'Dict OFF'}
              </span>
              <span className="hidden sm:inline">
                {zh
                  ? hoverDictEnabled
                    ? '悬浮查词 开'
                    : '悬浮查词 关'
                  : hoverDictEnabled
                    ? 'Hover Dict ON'
                    : 'Hover Dict OFF'}
              </span>
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
              className="h-8 rounded-full border border-border bg-card px-2 text-xs font-medium text-foreground shadow-2xs sm:px-2.5"
            >
              {LOCALES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        <main className="w-full flex-1 px-4 py-5 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8 lg:py-6 lg:pb-8">
          <ErrorBoundary>
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                <Route index element={<EnglishPage />} />
                <Route path="english" element={<EnglishPage />} />
                <Route path="grammar" element={<GrammarPage />} />
                <Route path="reading" element={<ReadingPage />} />
                <Route path="listening" element={<ListeningPage />} />
                <Route path="radio" element={<RadioNewsPage />} />
                <Route path="desk" element={<BoardPage />} />
                <Route path="board" element={<BoardPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>

        <footer className="w-full px-4 pt-2 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8 lg:pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
            <div className="inline-flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  apiOnline === true ? 'bg-emerald-500' : apiOnline === false ? 'bg-destructive' : 'bg-primary animate-pulse',
                )}
                aria-hidden="true"
              />
              <span>{zh ? '数据保存在 Postgres · Nginx 边缘缓存 · Go 高性能引擎' : t('footer')}</span>
            </div>
            <div className="inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <span className="rounded bg-muted/60 px-1.5 py-0.5 text-foreground/85">Web: {__APP_VERSION__}</span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5',
                  apiOnline === true ? 'bg-muted/60 text-foreground/85' : 'bg-destructive/20 text-destructive',
                )}
              >
                API: {apiVersion ? (apiVersion.startsWith('v') ? apiVersion : `v${apiVersion}`) : '...'}
              </span>
              <span>·</span>
              <span className="text-primary">SRS v4.2.8</span>
            </div>
          </div>
        </footer>
      </div>
      <FloatingRadioMiniPlayer scrollContainerRef={scrollContainerRef} />
      <GlobalHoverDictionary />
    </div>
  )
}
