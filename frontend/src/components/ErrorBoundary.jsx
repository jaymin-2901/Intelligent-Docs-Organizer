import React from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h2>📄 Document Viewer Error</h2>
            <p>Something went wrong while loading the document viewer.</p>
            
            <div className="error-actions">
              <button 
                className="error-btn retry-btn"
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  if (this.props.onRetry) {
                    this.props.onRetry();
                  }
                }}
              >
                🔄 Try Again
              </button>
              
              <button 
                className="error-btn close-btn"
                onClick={() => {
                  if (this.props.onClose) {
                    this.props.onClose();
                  }
                }}
              >
                ✕ Close
              </button>
            </div>
            
            {/* Debug info in development */}
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="error-details">
                <summary>🐛 Debug Information</summary>
                <pre className="error-stack">
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;