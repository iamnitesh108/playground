import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  /** Renders when a child throws; `retry` re-mounts the children. */
  fallback: (error: Error, retry: () => void) => ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/** Keeps one broken lesson (or a stale chunk after a deploy) from blanking the whole app. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack)
  }

  private retry = () => this.setState({ error: null })

  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.retry) : this.props.children
  }
}
