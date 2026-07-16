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

const MAX_RETRIES = 3;

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.retryCount += 1;
    if (this.retryCount >= MAX_RETRIES) {
      this.setState({ hasError: true, error: new Error('Still having trouble') });
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isExhausted = this.retryCount >= MAX_RETRIES;
      return (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-2xl space-y-3">
          <h3 className="text-label-14">Something went wrong</h3>
          <p className="text-copy-13">
            {isExhausted
              ? 'Still having trouble'
              : 'An unexpected error occurred in the Outreach Assistant.'}
          </p>
          {isExhausted ? (
            <Button onClick={() => window.location.reload()} variant="destructive" size="xs">
              Reload page
            </Button>
          ) : (
            <Button onClick={this.handleRetry} variant="destructive" size="xs">
              Try again
            </Button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}