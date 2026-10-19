import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Brand } from '@/components/Brand'
import { ReloadNotice } from '@/components/ReloadNotice'

interface State {
  error: unknown
  hasError: boolean
}

/**
 * The last safety net, wrapped around the whole app. Without it, an error outside a page
 * (the menu, login, a failed script) leaves a blank white screen. It shows the brand and a
 * Reload button instead.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, hasError: false }

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-10">
        <Brand className="text-primary" />
        <ReloadNotice error={this.state.error} />
      </div>
    )
  }
}
