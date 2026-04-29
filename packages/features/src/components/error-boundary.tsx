'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional label shown in the default fallback UI (e.g. "task detail") */
  label?: string;
  /** Called when an error is caught — useful for logging */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    // Log to console so errors aren't silently swallowed
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      const label = this.props.label ?? 'this section';
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Something went wrong in {label}.
          </p>
          <button
            onClick={this.handleReset}
            className="text-xs underline text-muted-foreground hover:text-foreground"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
