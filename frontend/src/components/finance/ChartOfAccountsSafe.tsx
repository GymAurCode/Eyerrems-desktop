/**
 * ChartOfAccounts - Safe Version with Error Boundary
 * Wraps the original component with error handling to prevent crashes
 */

import React from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import ChartOfAccounts, { ChartOfAccountsProps } from './ChartOfAccounts';
import { AlertCircle } from 'lucide-react';

function ChartOfAccountsFallback() {
  return (
    <div className="rounded-xl overflow-hidden p-8 text-center"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
      <h3 className="text-lg font-semibold text-red-400 mb-2">Chart of Accounts Error</h3>
      <p className="text-sm text-gray-400 mb-4">
        There was an error loading the chart of accounts. This might be due to a temporary issue.
      </p>
      <div className="flex gap-2 justify-center">
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

export default function ChartOfAccountsSafe(props: ChartOfAccountsProps) {
  return (
    <ErrorBoundary 
      fallback={<ChartOfAccountsFallback />}
      onError={(error, errorInfo) => {
        // Log specific finance module errors
        console.error('ChartOfAccounts Error:', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
        });
        
        // You could send this to an error reporting service
        // reportError('finance_module_error', { error, errorInfo });
      }}
    >
      <ChartOfAccounts {...props} />
    </ErrorBoundary>
  );
}