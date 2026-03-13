import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[LifePilot] Component error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-[#FAF9F6] p-6">
          <div className="max-w-sm text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center text-2xl">⚡</div>
            <h2 className="text-xl font-bold text-stone-900 mb-2" style={{ fontFamily: "'Georgia', serif" }}>
              Something went wrong
            </h2>
            <p className="text-sm text-stone-600 mb-6">
              Life Pilot AI hit an unexpected error. Your data is safe — just reload to continue.
            </p>
            <button onClick={() => window.location.reload()}
              className="px-6 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800">
              Reload Life Pilot AI
            </button>
            {this.state.error && (
              <p className="mt-4 text-xs text-stone-400 break-all">{this.state.error.message}</p>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
