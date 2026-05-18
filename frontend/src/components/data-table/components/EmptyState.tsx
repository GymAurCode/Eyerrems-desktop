/**
 * EmptyState Component
 * Professional empty state for tables
 */

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
  // Determine the appropriate icon and messaging
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
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
        <DisplayIcon size={32} className="text-gray-500" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium text-gray-300 mb-2">
        {displayTitle}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-500 mb-6 max-w-md">
        {displayDescription}
      </p>

      {/* Action buttons */}
      {(hasSearch || hasFilters) && (
        <div className="flex items-center gap-3">
          {hasSearch && onClearSearch && (
            <button
              onClick={onClearSearch}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
            >
              <Search size={16} />
              Clear search
            </button>
          )}
          
          {hasFilters && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
            >
              <Filter size={16} />
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Custom content */}
      {children}
    </div>
  );
}