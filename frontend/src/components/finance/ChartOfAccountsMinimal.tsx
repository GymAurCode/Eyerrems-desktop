/**
 * ChartOfAccounts - Minimal Version
 * Stripped down version to isolate the error source
 */

import { useEffect, useState } from "react";
import { BookOpen, AlertCircle } from "lucide-react";

// Minimal account type
interface MinimalAccount {
  id: number;
  code: string;
  name: string;
  account_type: string;
  balance: number;
  is_active: boolean;
  children: MinimalAccount[];
}

// Simple API call without external dependencies
async function loadAccountsSimple(): Promise<MinimalAccount[]> {
  try {
    const response = await fetch('/api/finance/accounts/tree', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Simple API call failed:', error);
    throw error;
  }
}

// Simple currency formatter
function formatSimpleCurrency(amount: number): string {
  try {
    return `₨ ${Math.abs(amount).toLocaleString()}`;
  } catch {
    return `₨ ${Math.abs(amount)}`;
  }
}

// Minimal tree node component
function SimpleTreeNode({ 
  account, 
  level = 0,
  onSelect 
}: { 
  account: MinimalAccount; 
  level?: number;
  onSelect?: (account: MinimalAccount) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  
  const handleClick = () => {
    try {
      onSelect?.(account);
    } catch (error) {
      console.error('Select handler error:', error);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setExpanded(!expanded);
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  return (
    <div>
      <div 
        className="flex items-center gap-2 p-2 hover:bg-gray-800 cursor-pointer"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleClick}
      >
        {account.children.length > 0 && (
          <button 
            onClick={handleToggle}
            className="w-4 h-4 text-gray-400 hover:text-gray-200"
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
        
        <span className="font-mono text-xs text-gray-400">{account.code}</span>
        <span className="text-sm flex-1">{account.name}</span>
        
        {account.balance !== 0 && (
          <span className="text-xs font-semibold text-blue-400">
            {formatSimpleCurrency(account.balance)}
          </span>
        )}
        
        {!account.is_active && (
          <span className="text-xs px-2 py-1 bg-gray-700 text-gray-400 rounded">
            Inactive
          </span>
        )}
      </div>
      
      {expanded && account.children.map(child => (
        <SimpleTreeNode 
          key={child.id} 
          account={child} 
          level={level + 1}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export interface ChartOfAccountsProps {
  readOnly?: boolean;
}

export default function ChartOfAccountsMinimal({ readOnly = false }: ChartOfAccountsProps) {
  const [accounts, setAccounts] = useState<MinimalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MinimalAccount | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading accounts with minimal API...');
      
      const data = await loadAccountsSimple();
      console.log('Accounts loaded successfully:', data.length);
      
      setAccounts(data);
    } catch (err: any) {
      console.error('Load error:', err);
      setError(err.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelect = (account: MinimalAccount) => {
    try {
      console.log('Selected account:', account.name);
      setSelected(account);
    } catch (error) {
      console.error('Selection error:', error);
    }
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
        <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading Accounts</h3>
        <p className="text-sm text-gray-400 mb-4">{error}</p>
        <button 
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - Account Tree */}
      <div className="flex-1 border-r border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold">Chart of Accounts (Minimal)</h2>
          </div>
        </div>
        
        <div className="overflow-y-auto h-full">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-sm text-gray-400">Loading accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-8 text-center">
              <BookOpen size={32} className="mx-auto mb-4 text-gray-500 opacity-50" />
              <p className="text-sm text-gray-400">No accounts found</p>
            </div>
          ) : (
            <div className="p-2">
              {accounts.map(account => (
                <SimpleTreeNode 
                  key={account.id} 
                  account={account}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Account Details */}
      <div className="w-80 p-4">
        {selected ? (
          <div>
            <h3 className="text-lg font-semibold mb-2">{selected.name}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Code:</span>
                <span className="font-mono">{selected.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Type:</span>
                <span>{selected.account_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Balance:</span>
                <span className="font-semibold">
                  {formatSimpleCurrency(selected.balance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={selected.is_active ? 'text-green-400' : 'text-gray-400'}>
                  {selected.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400">
            <BookOpen size={32} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm">Select an account to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}