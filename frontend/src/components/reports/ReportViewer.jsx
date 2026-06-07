import React, { useState, useCallback } from 'react'

const formatValue = (val, col) => {
  if (val === null || val === undefined || val === '') return '—'
  if (col.format === 'currency') {
    const n = Number(val)
    if (isNaN(n)) return val
    return `PKR ${n.toLocaleString('en-PK')}`
  }
  if (col.format === 'date') {
    if (!val) return '—'
    try {
      return new Date(val).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    } catch { return val }
  }
  if (col.format === 'number') {
    const n = Number(val)
    if (isNaN(n)) return val
    return n.toLocaleString('en-PK')
  }
  return String(val)
}

const BADGE_COLORS_DEFAULT = {
  green: { bg: '#D1FAE5', color: '#065F46' },
  amber: { bg: '#FEF3C7', color: '#92400E' },
  red: { bg: '#FEE2E2', color: '#991B1B' },
  blue: { bg: '#DBEAFE', color: '#1E40AF' },
  gray: { bg: '#F3F4F6', color: '#374151' },
}

function BadgeCell({ value, badgeColors }) {
  const v = String(value).toUpperCase()
  const colors = { ...BADGE_COLORS_DEFAULT, ...badgeColors }
  let style = BADGE_COLORS_DEFAULT.gray
  for (const [key, val] of Object.entries(colors)) {
    if (v === key.toUpperCase()) { style = val; break }
  }
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, padding: '2px 8px',
      borderRadius: 99, background: style.bg, color: style.color,
      fontWeight: 500, whiteSpace: 'nowrap',
    }}>{value}</span>
  )
}

function SkeletonRow({ cols }) {
  return (
    <tr>
      {cols.map((_, i) => (
        <td key={i} style={{ padding: '0 14px', height: 48 }}>
          <div style={{
            height: 14, borderRadius: 4,
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }} />
        </td>
      ))}
    </tr>
  )
}

export default function ReportViewer({
  reportTitle = '',
  reportSubtitle = '',
  companyName = '',
  columns = [],
  data = [],
  summaryRows,
  loading = false,
  error = null,
  onExportPDF,
  onExportExcel,
  headerInfo,
}) {
  const [exporting, setExporting] = useState(null)

  const handleExportPDF = useCallback(async () => {
    if (!data || data.length === 0) return
    setExporting('pdf')
    try {
      if (onExportPDF) { await onExportPDF(); return }
      const { default: jsPDF } = await import('jspdf')
      await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      doc.setFontSize(10)
      doc.setTextColor(107, 114, 128)
      doc.text(companyName || 'Real Estate ERP', 14, 12)
      doc.setFontSize(16)
      doc.setTextColor(17, 24, 39)
      doc.setFont(undefined, 'bold')
      doc.text(reportTitle, 14, 20)
      doc.setFontSize(9)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(107, 114, 128)
      if (reportSubtitle) doc.text(reportSubtitle, 14, 26)
      doc.text(`Generated: ${new Date().toLocaleString('en-PK')}`, 14, 31)
      doc.setDrawColor(229, 231, 235)
      doc.line(14, 35, doc.internal.pageSize.width - 14, 35)
      const tableColumns = columns.map(c => ({ header: c.label, dataKey: c.key }))
      const tableRows = data.map(row => {
        const formatted = {}
        columns.forEach(col => {
          let val = row[col.key]
          if (val === null || val === undefined) { formatted[col.key] = '—' }
          else if (col.format === 'currency') {
            formatted[col.key] = `PKR ${Number(val).toLocaleString('en-PK')}`
          } else if (col.format === 'date' && val) {
            try {
              formatted[col.key] = new Date(val).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
              })
            } catch { formatted[col.key] = String(val) }
          } else { formatted[col.key] = String(val) }
        })
        return formatted
      })
      doc.autoTable({
        columns: tableColumns, body: tableRows, startY: 40,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        footStyles: { fillColor: [243, 244, 246], fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
        didDrawPage: (pageData) => {
          const pageCount = doc.internal.getNumberOfPages()
          doc.setFontSize(8)
          doc.setTextColor(156, 163, 175)
          doc.text(
            `Page ${pageData.pageNumber} of ${pageCount}`,
            doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8,
            { align: 'center' }
          )
        }
      })
      if (summaryRows && summaryRows.length > 0) {
        const footData = summaryRows.map(sr => {
          const formatted = {}
          columns.forEach(col => { formatted[col.key] = sr[col.key] || '' })
          return formatted
        })
        doc.autoTable({
          columns: tableColumns, body: footData, startY: doc.lastAutoTable.finalY + 2,
          styles: { fontSize: 8, cellPadding: 3, fontStyle: 'bold' },
          headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold' },
          margin: { left: 14, right: 14 },
        })
      }
      const filename = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('[Report] PDF export error:', err)
      alert('PDF export failed. Please try again.')
    } finally { setExporting(null) }
  }, [data, columns, reportTitle, reportSubtitle, companyName, summaryRows, onExportPDF])

  const handleExportExcel = useCallback(async () => {
    if (!data || data.length === 0) return
    setExporting('excel')
    try {
      if (onExportExcel) { await onExportExcel(); return }
      const XLSX = await import('xlsx')
      const wsData = []
      wsData.push([companyName || 'Real Estate ERP'])
      wsData.push([reportTitle])
      if (reportSubtitle) wsData.push([reportSubtitle])
      wsData.push([`Generated: ${new Date().toLocaleString('en-PK')}`])
      wsData.push([])
      wsData.push(columns.map(c => c.label))
      data.forEach(row => {
        wsData.push(columns.map(col => {
          const val = row[col.key]
          if (val === null || val === undefined) return ''
          if (col.format === 'currency') return Number(val) || 0
          if (col.format === 'date' && val) {
            try { return new Date(val).toLocaleDateString('en-GB') } catch { return val }
          }
          return val
        }))
      })
      if (summaryRows && summaryRows.length > 0) {
        wsData.push([])
        summaryRows.forEach(sr => {
          wsData.push(columns.map(col => sr[col.key] || ''))
        })
      }
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = columns.map(col => ({ wch: Math.max(col.label.length + 4, 18) }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, reportTitle.substring(0, 31))
      const filename = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (err) {
      console.error('[Report] Excel export error:', err)
      alert('Excel export failed. Please try again.')
    } finally { setExporting(null) }
  }, [data, columns, reportTitle, reportSubtitle, companyName, summaryRows, onExportExcel])

  const hasData = data && data.length > 0

  return (
    <div style={{
      background: 'white', color: '#111827', fontFamily: "'Inter', sans-serif",
      padding: 32, minHeight: 400, borderRadius: 12, border: '1px solid #E5E7EB',
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* ── Report Header ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{companyName || 'Real Estate ERP'}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
            Generated: {new Date().toLocaleString('en-PK')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#111827' }}>{reportTitle}</div>
          {reportSubtitle && (
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{reportSubtitle}</div>
          )}
        </div>
      </div>
      <div style={{ height: 1, background: '#E5E7EB', margin: '16px 0' }} />

      {/* ── Header Info Block ─────────────────────────────────────────── */}
      {headerInfo && Object.keys(headerInfo).length > 0 && (
        <div style={{
          background: '#F9FAFB', borderRadius: 8, padding: '12px 16px',
          marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px',
        }}>
          {Object.entries(headerInfo).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase',
                whiteSpace: 'nowrap', minWidth: 80,
              }}>{key}:</span>
              <span style={{ fontSize: 13, color: '#111827' }}>{String(val)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Error State ────────────────────────────────────────────── */}
      {error && (
        <div style={{
          border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px',
          marginBottom: 16, background: '#FEF2F2', display: 'flex',
          alignItems: 'center', gap: 8, fontSize: 13, color: '#991B1B',
        }}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>Failed to load report: {error}</span>
          <button onClick={() => window.location.reload()} style={{
            padding: '4px 12px', borderRadius: 6, border: '1px solid #FCA5A5',
            background: 'white', color: '#991B1B', fontSize: 12, cursor: 'pointer',
          }}>Try Again</button>
        </div>
      )}

      {/* ── Table Wrapper ──────────────────────────────────────────── */}
      <div style={{
        width: '100%', overflowX: 'auto',
        border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          {/* ── Column Headers ─────────────────────────────── */}
          <thead>
            <tr style={{
              background: '#1F2937', color: 'white', fontSize: 11,
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {columns.map((col, i) => (
                <th key={col.key || i} style={{
                  height: 42, padding: '0 14px',
                  textAlign: col.align || 'left',
                  whiteSpace: 'nowrap', width: col.width || 'auto',
                }}>{col.label}</th>
              ))}
            </tr>
          </thead>

          {/* ── Empty State ────────────────────────────────── */}
          {!loading && !hasData && !error && (
            <tbody>
              <tr>
                <td colSpan={columns.length || 1} style={{
                  height: 200, textAlign: 'center', verticalAlign: 'middle',
                  color: '#6B7280', fontSize: 13,
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                  No data found for the selected filters.
                </td>
              </tr>
            </tbody>
          )}

          {/* ── Loading Skeleton ────────────────────────────── */}
          {loading && (
            <tbody>
              {[1,2,3,4,5].map(i => (
                <SkeletonRow key={i} cols={columns} />
              ))}
            </tbody>
          )}

          {/* ── Data Rows ───────────────────────────────────── */}
          {!loading && hasData && (
            <tbody>
              {data.map((row, ri) => (
                <tr key={ri} style={{
                  height: 48, borderBottom: '1px solid #F3F4F6',
                  transition: 'background 0.1s',
                  background: ri % 2 === 0 ? '#FAFAFA' : 'white',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF' }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = ri % 2 === 0 ? '#FAFAFA' : 'white'
                  }}
                >
                  {columns.map((col, ci) => {
                    const val = row[col.key]
                    return (
                      <td key={ci} style={{
                        padding: '0 14px', color: '#111827',
                        verticalAlign: 'middle',
                        textAlign: col.align || 'left',
                        fontWeight: col.format === 'currency' ? 500 : 'normal',
                      }}>
                        {col.format === 'badge' ? (
                          <BadgeCell value={val} badgeColors={col.badgeColors} />
                        ) : (
                          formatValue(val, col)
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          )}

          {/* ── Summary Rows ────────────────────────────────── */}
          {!loading && summaryRows && summaryRows.length > 0 && hasData && (
            <tfoot>
              {summaryRows.map((sr, sri) => (
                <tr key={sri} style={{
                  background: '#F3F4F6', fontWeight: 600, color: '#111827',
                  borderTop: '2px solid #E5E7EB', height: 48,
                }}>
                  {columns.map((col, ci) => (
                    <td key={ci} style={{
                      padding: '0 14px', verticalAlign: 'middle',
                      textAlign: col.align || 'left',
                    }}>
                      {formatValue(sr[col.key], col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Bottom Action Bar ──────────────────────────────────────── */}
      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <button
          onClick={handleExportPDF}
          disabled={!hasData || exporting === 'pdf'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: '#1F2937', color: 'white', border: 'none',
            cursor: !hasData || exporting === 'pdf' ? 'not-allowed' : 'pointer',
            opacity: !hasData ? 0.5 : 1,
          }}
        >
          {exporting === 'pdf' ? '⋯' : '📄'} Export PDF
        </button>
        <button
          onClick={handleExportExcel}
          disabled={!hasData || exporting === 'excel'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: '#065F46', color: 'white', border: 'none',
            cursor: !hasData || exporting === 'excel' ? 'not-allowed' : 'pointer',
            opacity: !hasData ? 0.5 : 1,
          }}
        >
          {exporting === 'excel' ? '⋯' : '📊'} Export Excel
        </button>
        <button
          onClick={() => window.print()}
          disabled={!hasData}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: 'transparent', border: '1px solid #E5E7EB',
            color: '#374151', cursor: !hasData ? 'not-allowed' : 'pointer',
            opacity: !hasData ? 0.5 : 1,
          }}
        >
          🖨️ Print
        </button>
      </div>
    </div>
  )
}
