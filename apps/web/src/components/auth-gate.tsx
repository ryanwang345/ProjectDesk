import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { CheckCircle2, LogIn, LogOut, ShieldCheck, UserPlus } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { WindLandscape } from '@/components/wind-landscape'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { getAuthState, initializeAuth, registerAccount, signIn, signOut, subscribeAuth } from '@/lib/auth'
import './auth-gate.css'

type AuthMode = 'signin' | 'register'

function initialAuthMode(): AuthMode {
  if (typeof window !== 'undefined' && window.location.pathname === '/register') {
    return 'register'
  }
  return 'signin'
}

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useSyncExternalStore(subscribeAuth, getAuthState)
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const [mode, setMode] = useState<AuthMode>(initialAuthMode)

  useEffect(() => {
    void initializeAuth()
  }, [])

  useEffect(() => {
    const syncFromPath = () => {
      setMode(window.location.pathname === '/register' ? 'register' : 'signin')
    }
    window.addEventListener('popstate', syncFromPath)
    return () => window.removeEventListener('popstate', syncFromPath)
  }, [])

  function switchMode(next: AuthMode) {
    setMode(next)
    if (typeof window !== 'undefined') {
      const targetPath = next === 'register' ? '/register' : '/'
      if (window.location.pathname === '/' || window.location.pathname === '/register') {
        window.history.replaceState(null, '', targetPath)
      }
    }
  }

  if (auth.status === 'authenticated' || auth.status === 'disabled') return children

  const isRegister = mode === 'register'

  return (
    <main className="auth-screen">
      <WindLandscape />
      <div className="auth-screen-content">
        <header className="auth-masthead" aria-label="LinguaDesk">
          <span className="auth-masthead-dot" aria-hidden="true" />
          <span>LINGUADESK</span>
        </header>

        <section className="auth-card" aria-labelledby="sign-in-title">
          <div className="auth-card-top">
            <div className="auth-card-icons">
              <BrandLogo className="auth-brand-logo" />
              <span className="auth-shield">
                {isRegister ? (
                  <UserPlus size={19} strokeWidth={1.8} aria-hidden="true" />
                ) : (
                  <ShieldCheck size={20} strokeWidth={1.8} aria-hidden="true" />
                )}
              </span>
            </div>

            <div className="auth-mode-tabs" role="tablist" aria-label={zh ? '登录或注册切换' : 'Sign in or register'}>
              <button
                type="button"
                role="tab"
                aria-selected={!isRegister}
                className={`auth-mode-tab${!isRegister ? ' is-active' : ''}`}
                onClick={() => switchMode('signin')}
              >
                {zh ? '登录' : 'Sign in'}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isRegister}
                className={`auth-mode-tab${isRegister ? ' is-active' : ''}`}
                onClick={() => switchMode('register')}
              >
                {zh ? '注册账号' : 'Register'}
              </button>
            </div>
          </div>

          <h1 id="sign-in-title">
            {isRegister
              ? (zh ? '创建 LinguaDesk 账号' : 'Create your account')
              : (zh ? '欢迎使用 LinguaDesk' : 'Welcome to LinguaDesk')}
          </h1>
          <p className="auth-card-description">
            {isRegister
              ? (zh
                  ? '通过 Keycloak 创建统一学习账号，安全同步生词本、FSRS 记忆进度与听说读写记录。'
                  : 'Create a Keycloak account to unlock personalized FSRS vocabulary, reading, listening, and 680 News study history.')
              : (zh ? '登录后继续你的学习之旅。' : 'Sign in to continue your learning journey.')}
          </p>

          {isRegister && auth.status !== 'error' && (
            <ul className="auth-register-perks" aria-label={zh ? '账号权益' : 'Account benefits'}>
              <li>
                <CheckCircle2 className="auth-perk-icon" aria-hidden="true" />
                <span>{zh ? '填写用户名、邮箱与密码即可完成注册' : 'Quick setup with username, email & password'}</span>
              </li>
              <li>
                <CheckCircle2 className="auth-perk-icon" aria-hidden="true" />
                <span>{zh ? '多设备自动同步词库与雅思模考记录' : 'Sync vocabulary cards & IELTS progress across devices'}</span>
              </li>
              <li>
                <CheckCircle2 className="auth-perk-icon" aria-hidden="true" />
                <span>{zh ? '支持 PKCE 安全协议与单点登录 (SSO)' : 'Protected by Keycloak OIDC & PKCE security'}</span>
              </li>
            </ul>
          )}

          <div className="auth-action">
            {auth.status === 'loading' ? (
              <p role="status" className="auth-loading">{zh ? '正在检查登录状态…' : 'Checking your session…'}</p>
            ) : auth.status === 'error' ? (
              <div className="auth-error-group">
                <p role="alert" className="auth-error">{auth.error}</p>
                <Button className="auth-signin-button" onClick={() => window.location.reload()}>{zh ? '重试' : 'Try again'}</Button>
              </div>
            ) : isRegister ? (
              <div className="auth-button-stack">
                <Button className="auth-signin-button" onClick={() => { void registerAccount() }}>
                  <UserPlus className="size-4" aria-hidden="true" />
                  {zh ? '前往 Keycloak 创建账号' : 'Register with Keycloak'}
                </Button>
                <p className="auth-switch-hint">
                  {zh ? '已经有账号了？' : 'Already have an account?'}{' '}
                  <button type="button" className="auth-switch-link" onClick={() => switchMode('signin')}>
                    {zh ? '直接登录' : 'Sign in'}
                  </button>
                </p>
              </div>
            ) : (
              <div className="auth-button-stack">
                <Button className="auth-signin-button" onClick={() => { void signIn() }}>
                  <LogIn className="size-4" aria-hidden="true" />{zh ? '使用 Keycloak 登录' : 'Sign in with Keycloak'}
                </Button>
                <Button variant="outline" className="auth-secondary-button" onClick={() => switchMode('register')}>
                  <UserPlus className="size-4" aria-hidden="true" />{zh ? '注册新账号' : 'Create an account'}
                </Button>
              </div>
            )}
          </div>

          <div className="auth-card-footer">
            <span className="auth-status">
              <span className={`auth-status-dot${auth.status === 'error' ? ' auth-status-dot-error' : ''}`} aria-hidden="true" />
              {auth.status === 'error'
                ? (zh ? '登录暂不可用' : 'Sign-in unavailable')
                : auth.status === 'loading'
                  ? (zh ? '正在检查连接' : 'Checking connection')
                  : isRegister
                    ? (zh ? '自助注册已开启' : 'Keycloak registration active')
                    : (zh ? '单点登录已启用' : 'Single sign-on active')}
            </span>
            <span>{zh ? '安全认证' : 'Secure sign-in'}</span>
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
