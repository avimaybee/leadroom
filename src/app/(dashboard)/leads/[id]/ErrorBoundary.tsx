'use client';

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

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
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-2xl space-y-3">
          <h3 className="text-label-14">Something went wrong</h3>
          <p className="text-copy-13">
            {this.state.error?.message || 'An unexpected error occurred in the Outreach Assistant.'}
          </p>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
            variant="destructive"
            size="xs"
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}