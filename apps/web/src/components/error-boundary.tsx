import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled render error caught by ErrorBoundary:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="mx-auto my-8 max-w-lg rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center text-foreground">
          <div className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <svg
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground">页面加载出现异常</h3>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {this.state.error?.message || '组件渲染过程中遇到了未知错误'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs transition hover:opacity-90"
            >
              重新尝试加载
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
