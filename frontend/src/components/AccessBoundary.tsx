import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AccessDenied } from '@/components/AccessDenied'
import { ErrorAlert } from '@/components/ErrorAlert'
import { ReloadNotice } from '@/components/ReloadNotice'
import { isChunkLoadError } from '@/lib/chunk-errors'
import { isForbidden } from '@/lib/api'
import { queryClient } from '@/lib/query-client'

interface Props {
  children: ReactNode
  /** When this changes (we pass the URL path) the boundary forgets its error. */
  resetKey: string
}

interface State {
  error: unknown
  hasError: boolean
}

/**
 * Catches errors thrown while rendering a page. A 403 from the API (react-query
 * is configured to throw it) shows the Access denied page; anything else shows its message.
 */
export class AccessBoundary extends Component<Props, State> {
  state: State = { error: null, hasError: false }

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (!isForbidden(error)) console.error(error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) this.reset()
  }

  /** Forget the error and let failed queries try again when the page re-renders. */
  reset = () => {
    void queryClient.resetQueries({ predicate: (q) => q.state.status === 'error' })
    this.setState({ error: null, hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (isForbidden(this.state.error)) return <AccessDenied />
    // A lazy page that failed to download stays failed (React caches it), so only a reload helps.
    if (isChunkLoadError(this.state.error)) return <ReloadNotice error={this.state.error} className="mx-auto mt-6 max-w-xl" />
    return (
      <div className="mx-auto max-w-xl pt-6">
        <ErrorAlert error={this.state.error} onRetry={this.reset} />
      </div>
    )
  }
}
