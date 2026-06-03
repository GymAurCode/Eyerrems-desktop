import React from 'react';
import { Database, Search, Filter } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  hasFilters?: boolean;
  hasSearch?: boolean;
  onClearFilters?: () => void;
  onClearSearch?: () => void;
  children?: React.ReactNode;
}

export default function EmptyState({
  title,
  description,
  icon: Icon,
  hasFilters = false,
  hasSearch = false,
  onClearFilters,
  onClearSearch,
  children,
}: EmptyStateProps) {
  const getDefaultContent = () => {
    if (hasSearch || hasFilters) {
      return {
        icon: Search,
        title: 'No results found',
        description: 'Try adjusting your search or filters to find what you\'re looking for.',
      };
    }
    return {
      icon: Database,
      title: 'No data available',
      description: 'There are no items to display at this time.',
    };
  };

  const defaultContent = getDefaultContent();
  const DisplayIcon = Icon || defaultContent.icon;
  const displayTitle = title || defaultContent.title;
  const displayDescription = description || defaultContent.description;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 240,
      padding: '48px 16px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        background: 'var(--bg-surface2)',
      }}>
        <DisplayIcon size={28} style={{ color: 'var(--text-secondary)' }} />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
        {displayTitle}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, maxWidth: 400 }}>
        {displayDescription}
      </p>

      {(hasSearch || hasFilters) && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          {hasSearch && onClearSearch && (
            <button onClick={onClearSearch} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', fontSize: 13, borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: 'transparent', color: 'var(--text-primary)',
              cursor: 'pointer',
            }}>
              <Search size={14} /> Clear search
            </button>
          )}
          {hasFilters && onClearFilters && (
            <button onClick={onClearFilters} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', fontSize: 13, borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: 'transparent', color: 'var(--text-primary)',
              cursor: 'pointer',
            }}>
              <Filter size={14} /> Clear filters
            </button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
