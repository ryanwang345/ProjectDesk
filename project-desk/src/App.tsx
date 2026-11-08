import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SiteHeader } from '@/components/site-header'
import { useI18n } from '@/i18n'
import { AboutPage } from '@/pages/about-page'
import { BoardPage } from '@/pages/board-page'
import { EnglishPage } from '@/pages/english-page'
import { NotFoundPage } from '@/pages/not-found-page'

export default function App() {
  return (
    <BrowserRouter>
      <Frame />
    </BrowserRouter>
  )
}

function Frame() {
  const { t } = useI18n()
  const english = useLocation().pathname === '/english'
  if (english) {
    return (
      <Routes>
        <Route path="english" element={<EnglishPage />} />
      </Routes>
    )
  }
  return (
    <div className="relative z-10 flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Routes>
          <Route index element={<BoardPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pt-6 pb-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-4 text-xs text-muted-foreground">
          <p>{t('footer')}</p>
          <p className="font-display text-sm tracking-tight text-primary">{t('brand')}</p>
        </div>
      </footer>
    </div>
  )
}
