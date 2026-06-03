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
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      {showHeader && (
        <thead>
          <tr style={{ height: 44, background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border-color)' }}>
            {Array.from({ length: columns + 1 }).map((_, i) => (
              <th key={i} style={{ padding: '0 16px' }}>
                <div className="skeleton" style={{ height: 12, width: `${60 + Math.random() * 30}%`, borderRadius: 4 }} />
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <tr
            key={rowIdx}
            style={{
              height: 56,
              borderBottom: rowIdx < rows - 1 ? '1px solid var(--border-color)' : 'none',
            }}
          >
            {Array.from({ length: columns }).map((_, colIdx) => (
              <td key={colIdx} style={{ padding: '0 16px' }}>
                <div className="skeleton" style={{ height: 16, width: `${60 + Math.random() * 40}%`, borderRadius: 4 }} />
              </td>
            ))}
            <td style={{ padding: '0 16px', width: 140 }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {[1, 2, 3, 4].map((_, j) => (
                  <div key={j} className="skeleton" style={{ width: 30, height: 30, borderRadius: 6 }} />
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
