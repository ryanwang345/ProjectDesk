import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { SiteHeader } from '@/components/site-header'
import { AboutPage } from '@/pages/about-page'
import { BoardPage } from '@/pages/board-page'
import { NotFoundPage } from '@/pages/not-found-page'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-svh flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          <Routes>
            <Route index element={<BoardPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">
          Saved in this browser. nginx serves the built files.
        </footer>
      </div>
    </BrowserRouter>
  )
}
