import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    // ChunkLoadError: the browser tried to fetch a dynamically imported module
    // that no longer exists (typically after a new deployment). React.lazy caches
    // the rejected import() promise, so resetting state alone won't retry —
    // we must reload the page to get the fresh entry point and chunk manifest.
    // Limit to 1 reload to prevent infinite loops on broken builds.
    const isChunkError =
      this.state.error?.name === 'ChunkLoadError' ||
      this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
      this.state.error?.message?.includes('Loading chunk') ||
      this.state.error?.message?.includes('Importing a module script failed');

    if (isChunkError) {
      const reloadKey = '__chunkReloadCount';
      const reloadCount = Number(sessionStorage.getItem(reloadKey) || '0');
      if (reloadCount < 1) {
        sessionStorage.setItem(reloadKey, String(reloadCount + 1));
        window.location.reload();
        return;
      }
      // Max retries reached — clear counter and show error UI
      sessionStorage.removeItem(reloadKey);
    }

    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-secondary-50 dark:bg-primary-950 flex items-center justify-center p-8">
          <div className="card max-w-md w-full text-center space-y-6">
            <div className="text-4xl">⚠️</div>
            <h2 className="font-fraunces text-xl font-semibold text-secondary-800 dark:text-secondary-100">
              Something went wrong
            </h2>
            <p className="text-secondary-600 dark:text-secondary-400 text-sm">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button onClick={this.handleRetry} className="btn btn-primary">
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
