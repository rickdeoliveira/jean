import { Component, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  fallbackRender?: (props: {
    error: Error
    resetErrorBoundary: () => void
  }) => ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /**
   * When any value in this array changes (Object.is comparison), the boundary
   * auto-resets if it is currently in the error state. Lets parents recover
   * from a render crash by changing identity (e.g. tab id) without forcing a
   * full remount of the children.
   */
  resetKeys?: unknown[]
}

interface State {
  hasError: boolean
  error: Error | null
}

function shallowDiffer(
  prev: unknown[] | undefined,
  next: unknown[] | undefined
): boolean {
  if (prev === next) return false
  if (!prev || !next) return true
  if (prev.length !== next.length) return true
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true
  }
  return false
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  override componentDidUpdate(prevProps: Props): void {
    if (
      this.state.hasError &&
      shallowDiffer(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.handleReset()
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallbackRender && this.state.error) {
        return this.props.fallbackRender({
          error: this.state.error,
          resetErrorBoundary: this.handleReset,
        })
      }
      if (this.props.fallback) {
        return this.props.fallback
      }

      const isDev = import.meta.env.DEV

      return (
        <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Something went wrong
            </h2>
            {isDev && this.state.error && (
              <p className="text-sm text-muted-foreground font-mono max-w-md break-words">
                {this.state.error.message}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
