import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '@/i18n'
import { readTheme } from '@/lib/themes'
import { ThemeProvider } from '@/theme'
import App from '@/App.tsx'
import { AuthGate } from '@/components/auth-gate'
import '@/index.css'

document.documentElement.dataset.theme = readTheme()

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing.')

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <AuthGate><App /></AuthGate>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
)
