/**
 * LoadingState Component
 * Professional loading skeleton for tables
 */

import React from 'react';

interface LoadingStateProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export default function LoadingState({
  rows = 5,
  columns = 4,
  showHeader = true,
}: LoadingStateProps) {
  const SkeletonRow = ({ isHeader = false }: { isHeader?: boolean }) => (
    <tr className={isHeader ? 'bg-gray-800/50' : ''}>
      {Array.from({ length: columns }).map((_, colIndex) => (
        <td key={colIndex} className="px-4 py-3">
          <div 
            className={`animate-pulse bg-gray-700 rounded ${
              isHeader ? 'h-4' : 'h-5'
            }`}
            style={{
              width: `${Math.random() * 40 + 60}%`,
            }}
          />
        </td>
      ))}
    </tr>
  );

  return (
    <div className="animate-pulse">
      <table className="w-full">
        {showHeader && (
          <thead>
            <SkeletonRow isHeader />
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <SkeletonRow key={rowIndex} />
          ))}
        </tbody>
      </table>
    </div>
  );
}