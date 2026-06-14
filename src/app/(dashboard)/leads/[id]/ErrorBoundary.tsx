'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold">Something went wrong</h3>
          <p className="text-xs font-semibold">
            {this.state.error?.message || 'An unexpected error occurred in the Outreach Assistant.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}