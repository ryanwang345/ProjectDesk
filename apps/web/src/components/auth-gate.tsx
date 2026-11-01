import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { WindLandscape } from '@/components/wind-landscape'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { getAuthState, initializeAuth, signIn, signOut, subscribeAuth } from '@/lib/auth'
import './auth-gate.css'

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useSyncExternalStore(subscribeAuth, getAuthState)
  const { locale } = useI18n()
  const zh = locale === 'zh'
  useEffect(() => { void initializeAuth() }, [])

  if (auth.status === 'authenticated' || auth.status === 'disabled') return children

  return (
    <main className="auth-screen">
      <WindLandscape />
      <div className="auth-screen-content">
        <header className="auth-masthead" aria-label="LinguaDesk">
          <span className="auth-masthead-dot" aria-hidden="true" />
          <span>LINGUADESK</span>
        </header>

        <section className="auth-card" aria-labelledby="sign-in-title">
          <div className="auth-card-icons">
            <BrandLogo className="auth-brand-logo" />
            <span className="auth-shield"><ShieldCheck size={20} strokeWidth={1.8} aria-hidden="true" /></span>
          </div>
          <h1 id="sign-in-title">{zh ? '欢迎使用 LinguaDesk' : 'Welcome to LinguaDesk'}</h1>
          <p className="auth-card-description">{zh ? '登录后继续你的学习之旅。' : 'Sign in to continue your learning journey.'}</p>

          <div className="auth-action">
            {auth.status === 'loading' ? (
              <p role="status" className="auth-loading">{zh ? '正在检查登录状态…' : 'Checking your session…'}</p>
            ) : auth.status === 'error' ? (
              <div className="auth-error-group">
                <p role="alert" className="auth-error">{auth.error}</p>
                <Button className="auth-signin-button" onClick={() => window.location.reload()}>{zh ? '重试' : 'Try again'}</Button>
              </div>
            ) : (
              <Button className="auth-signin-button" onClick={() => { void signIn() }}>
                <LogIn className="size-4" aria-hidden="true" />{zh ? '使用 Keycloak 登录' : 'Sign in with Keycloak'}
              </Button>
            )}
          </div>

          <div className="auth-card-footer">
            <span className="auth-status">
              <span className={`auth-status-dot${auth.status === 'error' ? ' auth-status-dot-error' : ''}`} aria-hidden="true" />
              {auth.status === 'error'
                ? (zh ? '登录暂不可用' : 'Sign-in unavailable')
                : auth.status === 'loading'
                  ? (zh ? '正在检查连接' : 'Checking connection')
                  : (zh ? '单点登录已启用' : 'Single sign-on active')}
            </span>
            <span>{zh ? '安全登录' : 'Secure sign-in'}</span>
          </div>
        </section>

        <footer className="auth-screen-footer">© LinguaDesk</footer>
      </div>
    </main>
  )
}

export function AccountMenu() {
  const auth = useSyncExternalStore(subscribeAuth, getAuthState)
  const { locale } = useI18n()
  if (auth.status !== 'authenticated') return null
  return (
    <div className="inline-flex min-w-0 items-center gap-2">
      <span className="hidden max-w-32 truncate text-xs text-muted-foreground xl:inline" title={auth.name}>{auth.name}</span>
      <Button variant="outline" size="sm" onClick={() => { void signOut() }}>
        <LogOut className="size-3.5" aria-hidden="true" />{locale === 'zh' ? '退出登录' : 'Sign out'}
      </Button>
    </div>
  )
}
