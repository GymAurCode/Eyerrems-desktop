/**
 * Error Tracker Component
 * Comprehensive error tracking and reporting for debugging production issues
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Bug, Copy, Download } from 'lucide-react';

interface ErrorReport {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  component?: string;
  props?: any;
  state?: any;
}

class ErrorTracker {
  private static instance: ErrorTracker;
  private errors: ErrorReport[] = [];
  private listeners: ((errors: ErrorReport[]) => void)[] = [];

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  constructor() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename || window.location.href,
        line: event.lineno,
        column: event.colno,
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        url: window.location.href,
      });
    });

    // React error boundary integration
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Check if this looks like a React error
      const message = args.join(' ');
      if (message.includes('React') || message.includes('component') || message.includes('l is not a function')) {
        this.captureError({
          message: message,
          stack: new Error().stack,
          url: window.location.href,
          component: 'React Component',
        });
      }
      originalConsoleError.apply(console, args);
    };
  }

  captureError(errorData: {
    message: string;
    stack?: string;
    url: string;
    line?: number;
    column?: number;
    component?: string;
    props?: any;
    state?: any;
  }) {
    const error: ErrorReport = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      message: errorData.message,
      stack: errorData.stack,
      url: errorData.url,
      userAgent: navigator.userAgent,
      component: errorData.component,
      props: errorData.props,
      state: errorData.state,
    };

    this.errors.push(error);
    
    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.errors);
      } catch (e) {
        console.error('Error tracker listener failed:', e);
      }
    });

    // Log to console for debugging
    console.group('🐛 Error Captured');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('URL:', error.url);
    console.error('Component:', error.component);
    console.groupEnd();
  }

  getErrors(): ErrorReport[] {
    return [...this.errors];
  }

  clearErrors() {
    this.errors = [];
    this.listeners.forEach(listener => listener([]));
  }

  subscribe(listener: (errors: ErrorReport[]) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  exportErrors(): string {
    return JSON.stringify(this.errors, null, 2);
  }
}

export function useErrorTracker() {
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const tracker = ErrorTracker.getInstance();

  useEffect(() => {
    setErrors(tracker.getErrors());
    return tracker.subscribe(setErrors);
  }, [tracker]);

  return {
    errors,
    clearErrors: () => tracker.clearErrors(),
    exportErrors: () => tracker.exportErrors(),
    captureError: (error: any) => tracker.captureError({
      message: error.message || String(error),
      stack: error.stack,
      url: window.location.href,
    }),
  };
}

export function ErrorTrackerPanel() {
  const { errors, clearErrors, exportErrors } = useErrorTracker();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedError, setSelectedError] = useState<ErrorReport | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Copied to clipboard!');
    });
  };

  const downloadErrors = () => {
    const data = exportErrors();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (errors.length === 0) {
    return null;
  }

  return (
    <>
      {/* Error indicator */}
      <div 
        className="fixed bottom-4 right-4 z-50 cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <div className="bg-red-600 text-white p-3 rounded-full shadow-lg hover:bg-red-700 transition-colors">
          <div className="flex items-center gap-2">
            <Bug size={20} />
            <span className="text-sm font-medium">{errors.length}</span>
          </div>
        </div>
      </div>

      {/* Error panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-theme">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-red-400" size={20} />
                <h2 className="text-lg font-semibold text-white">Error Tracker</h2>
                <span className="bg-red-600 text-white px-2 py-1 rounded text-sm">
                  {errors.length} errors
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadErrors}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Download size={16} />
                  Export
                </button>
                <button
                  onClick={clearErrors}
                  className="px-3 py-1 bg-tertiary text-white rounded hover:bg-hover"
                >
                  Clear
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 bg-tertiary text-white rounded hover:bg-hover"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex h-96">
              {/* Error list */}
              <div className="w-1/2 border-r border-theme overflow-y-auto">
                {errors.map((error) => (
                  <div
                    key={error.id}
                    className={`p-3 border-b border-theme cursor-pointer hover:bg-hover ${
                      selectedError?.id === error.id ? 'bg-tertiary' : ''
                    }`}
                    onClick={() => setSelectedError(error)}
                  >
                    <div className="text-sm font-medium text-red-400 truncate">
                      {error.message}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {new Date(error.timestamp).toLocaleString()}
                    </div>
                    {error.component && (
                      <div className="text-xs text-blue-400 mt-1">
                        {error.component}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Error details */}
              <div className="w-1/2 p-4 overflow-y-auto">
                {selectedError ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">Error Message</h3>
                      <div className="bg-tertiary p-3 rounded text-sm text-red-400">
                        {selectedError.message}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-white">Stack Trace</h3>
                        <button
                          onClick={() => copyToClipboard(selectedError.stack || '')}
                          className="flex items-center gap-1 px-2 py-1 bg-tertiary text-white rounded text-xs hover:bg-gray-600"
                        >
                          <Copy size={12} />
                          Copy
                        </button>
                      </div>
                      <pre className="bg-tertiary p-3 rounded text-xs text-secondary overflow-x-auto">
                        {selectedError.stack || 'No stack trace available'}
                      </pre>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <h4 className="font-semibold text-white mb-1">Timestamp</h4>
                        <div className="text-muted">
                          {new Date(selectedError.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-white mb-1">URL</h4>
                        <div className="text-muted truncate">
                          {selectedError.url}
                        </div>
                      </div>
                      {selectedError.component && (
                        <div>
                          <h4 className="font-semibold text-white mb-1">Component</h4>
                          <div className="text-blue-400">
                            {selectedError.component}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted mt-8">
                    Select an error to view details
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ErrorTracker;