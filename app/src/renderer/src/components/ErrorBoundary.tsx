import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="error-boundary-fallback">
          <AlertTriangle size={28} />
          <h3>{this.props.fallbackLabel ?? 'Something went wrong'}</h3>
          <p>{this.state.error.message}</p>
          <button className="secondary-button" onClick={this.handleReset}>
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
