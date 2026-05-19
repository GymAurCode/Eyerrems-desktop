/**
 * ChartOfAccounts - Debug Version
 * Simple version to test if the component loads at all
 */

import React, { useEffect, useState } from "react";

export default function ChartOfAccountsDebug() {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      console.log('ChartOfAccountsDebug: Component mounting...');
      setMounted(true);
      console.log('ChartOfAccountsDebug: Component mounted successfully');
    } catch (err: any) {
      console.error('ChartOfAccountsDebug: Mount error:', err);
      setError(err.message || 'Unknown error');
    }
  }, []);

  if (error) {
    return (
      <div className="p-8 text-center bg-red-900/20 border border-red-500/30 rounded-lg">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Debug Error</h3>
        <p className="text-sm text-gray-400 mb-4">{error}</p>
        <button 
          onClick={() => setError(null)}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Clear Error
        </button>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-sm text-gray-400">Loading debug component...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-green-900/20 border border-green-500/30 rounded-lg">
      <h3 className="text-lg font-semibold text-green-400 mb-4">Chart of Accounts - Debug Mode</h3>
      <div className="space-y-4">
        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-sm font-semibold text-white mb-2">Component Status</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>✅ Component mounted successfully</li>
            <li>✅ No JavaScript errors detected</li>
            <li>✅ React rendering working</li>
          </ul>
        </div>
        
        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-sm font-semibold text-white mb-2">Next Steps</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>1. Check browser console for any errors</li>
            <li>2. Verify API endpoints are accessible</li>
            <li>3. Test with the robust ChartOfAccounts component</li>
          </ul>
        </div>

        <div className="bg-blue-900/30 p-4 rounded border border-blue-500/30">
          <h4 className="text-sm font-semibold text-blue-400 mb-2">Test API Call</h4>
          <TestAPICall />
        </div>
      </div>
    </div>
  );
}

function TestAPICall() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<string>('');

  const testAPI = async () => {
    setStatus('loading');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('/finance/accounts/tree', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setResult(`✅ API Success: ${data.length} accounts loaded`);
        setStatus('success');
      } else {
        setResult(`❌ API Error: ${response.status} ${response.statusText}`);
        setStatus('error');
      }
    } catch (error: any) {
      setResult(`❌ Network Error: ${error.message}`);
      setStatus('error');
    }
  };

  return (
    <div>
      <button
        onClick={testAPI}
        disabled={status === 'loading'}
        className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
      >
        {status === 'loading' ? 'Testing...' : 'Test API'}
      </button>
      {result && (
        <p className={`text-xs mt-2 ${status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
          {result}
        </p>
      )}
    </div>
  );
}