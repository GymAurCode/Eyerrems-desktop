/**
 * ReportLayout — Universal black & white report template.
 *
 * SECTIONS:
 *   1. Header (company name + report no / issued date)
 *   2. Title block (editable category eyebrow + report title)
 *   3. Meta strip (Period, Branch, Prepared By, Total Records)
 *   4. Main data table (locked — reflects real data)
 *   5. Summary cards (locked — auto-calculated)
 *   6. Notes (optional, editable)
 *   7. Sign-off block (static labels + signature lines)
 *   8. Footer (fixed watermark — never editable)
 *
 * MODES:
 *   - EDITING: pass onChange handlers to make fields editable
 *   - VIEW/PRINT: omit onChange handlers to render all fields as static text
 */

import React from "react";
import { ReportColumn } from "./types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReportLayoutColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  format?: "text" | "number" | "currency" | "date" | "badge";
  badgeMap?: Record<string, string>;
}

export interface ReportLayoutSummary {
  label: string;
  value: string | number;
}

export interface ReportLayoutProps {
  /* ── Auto-generated / locked ── */
  companyName: string;
  reportNumber: string;
  issuedDate: string;
  totalRecords: number;

  /* ── Editable (pass onChange to make field editable) ── */
  category: string;
  onCategoryChange?: (val: string) => void;
  reportTitle: string;
  onReportTitleChange?: (val: string) => void;
  period: string;
  onPeriodChange?: (val: string) => void;
  branch: string;
  onBranchChange?: (val: string) => void;
  preparedBy: string;
  onPreparedByChange?: (val: string) => void;
  notes?: string;
  onNotesChange?: (val: string) => void;

  /* ── Table data (locked) ── */
  columns: ReportLayoutColumn[];
  rows: Record<string, any>[];

  /* ── Summary (locked) ── */
  summaryCards?: ReportLayoutSummary[];

  /* ── Optional children (rendered between table and notes) ── */
  children?: React.ReactNode;

  /* ── Extra class ── */
  className?: string;
  style?: React.CSSProperties;
}

// ── Styles (B&W only) ────────────────────────────────────────────────────────

const S = {
  page: {
    background: "#ffffff",
    color: "#000000",
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "12px",
    lineHeight: 1.5,
    maxWidth: "210mm",
    margin: "0 auto",
    padding: "20px 24px",
    border: "1px solid #ddd",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    position: "relative" as const,
  },
  header: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    paddingBottom: "12px",
    borderBottom: "2px solid #000",
    marginBottom: "16px",
  },
  companyName: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: "20px",
    fontWeight: 700,
    color: "#000",
    letterSpacing: "0.3px",
  },
  headerRight: {
    textAlign: "right" as const,
    fontSize: "10px",
    color: "#555",
    fontFamily: "'Courier New', Courier, monospace",
  },
  headerRightLabel: {
    color: "#888",
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 600,
    fontSize: "9px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  titleBlock: {
    textAlign: "center" as const,
    padding: "12px 0",
    marginBottom: "14px",
  },
  eyebrow: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "10px",
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    marginBottom: "4px",
  },
  title: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: "22px",
    fontWeight: 700,
    color: "#000",
    lineHeight: 1.2,
  },
  metaStrip: {
    display: "grid" as const,
    gridTemplateColumns: "repeat(4, 1fr)" as const,
    gap: "1px",
    background: "#ccc",
    border: "1px solid #ccc",
    marginBottom: "16px",
  },
  metaCell: {
    background: "#f9f9f9",
    padding: "6px 10px",
  },
  metaLabel: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "9px",
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "0.4px",
    marginBottom: "2px",
  },
  metaValue: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "12px",
    fontWeight: 500,
    color: "#000",
  },
  metaInput: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "12px",
    fontWeight: 500,
    color: "#000",
    background: "#fff",
    border: "1px solid #ccc",
    padding: "2px 6px",
    width: "100%",
    boxSizing: "border-box" as const,
    outline: "none",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginBottom: "16px",
  },
  tableHeader: {
    background: "#000",
    color: "#fff",
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.3px",
    padding: "7px 8px",
    border: "1px solid #000",
    textAlign: "left" as const,
  },
  tableCell: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "11px",
    color: "#000",
    padding: "5px 8px",
    border: "1px solid #ccc",
  },
  summaryRow: {
    display: "flex" as const,
    gap: "1px",
    background: "#ccc",
    marginBottom: "16px",
  },
  summaryCard: {
    flex: 1,
    background: "#f9f9f9",
    padding: "10px 14px",
    textAlign: "center" as const,
  },
  summaryValue: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: "16px",
    fontWeight: 700,
    color: "#000",
  },
  summaryLabel: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "9px",
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "0.4px",
    marginTop: "2px",
  },
  notesSection: {
    marginBottom: "20px",
    padding: "10px 12px",
    border: "1px solid #ccc",
    background: "#fafafa",
  },
  notesLabel: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "9px",
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "0.4px",
    marginBottom: "4px",
  },
  notesText: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "11px",
    color: "#333",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap" as const,
  },
  notesTextarea: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "11px",
    color: "#333",
    lineHeight: 1.6,
    width: "100%",
    minHeight: "48px",
    border: "1px solid #ccc",
    padding: "6px",
    background: "#fff",
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
    outline: "none",
  },
  signoff: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    padding: "20px 0 12px",
    marginBottom: "16px",
  },
  signoffBlock: {
    textAlign: "center" as const,
    minWidth: "160px",
  },
  signoffLine: {
    width: "140px",
    borderTop: "1px solid #000",
    margin: "24px auto 6px",
  },
  signoffLabel: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "10px",
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "0.4px",
  },
  footer: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingTop: "10px",
    borderTop: "1px solid #ccc",
    fontSize: "9px",
    color: "#999",
  },
  footerLeft: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  },
  footerRight: {
    fontFamily: "'Courier New', Courier, monospace",
    fontWeight: 600,
    color: "#bbb",
    letterSpacing: "0.3px",
  },
  input: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "22px",
    fontWeight: 700,
    color: "#000",
    textAlign: "center" as const,
    border: "none",
    borderBottom: "1px dashed #ccc",
    background: "transparent",
    width: "100%",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  inputSm: {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: "10px",
    fontWeight: 600,
    color: "#888",
    textAlign: "center" as const,
    border: "none",
    borderBottom: "1px dashed #ccc",
    background: "transparent",
    width: "100%",
    outline: "none",
    boxSizing: "border-box" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCellValue(value: any, col: ReportLayoutColumn): string {
  if (value === null || value === undefined) return "—";
  if (col.format === "currency") {
    const n = typeof value === "number" ? value : Number(value);
    return isNaN(n) ? String(value) : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (col.format === "number") {
    const n = typeof value === "number" ? value : Number(value);
    return isNaN(n) ? String(value) : n.toLocaleString("en-US");
  }
  if (col.format === "date" && value) {
    try { return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); } catch {}
  }
  if (col.format === "badge" && col.badgeMap) {
    return col.badgeMap[String(value)] || String(value);
  }
  return String(value);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportLayout({
  companyName,
  reportNumber,
  issuedDate,
  totalRecords,
  category,
  onCategoryChange,
  reportTitle,
  onReportTitleChange,
  period,
  onPeriodChange,
  branch,
  onBranchChange,
  preparedBy,
  onPreparedByChange,
  notes,
  onNotesChange,
  columns,
  rows,
  summaryCards,
  children,
  className = "",
  style,
}: ReportLayoutProps) {
  const isEditable = !!onReportTitleChange;

  return (
    <>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .report-layout { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0.4in !important; max-width: none !important; }
          .report-layout-no-break { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className={`report-layout ${className}`} style={{ ...S.page, ...style }}>
        {/* ════════════ 1. HEADER ════════════ */}
        <div style={S.header}>
          <div>
            <div style={S.companyName}>{companyName || "Your Company"}</div>
          </div>
          <div style={S.headerRight}>
            <div style={S.headerRightLabel}>Report No.</div>
            <div style={{ marginBottom: 4 }}>{reportNumber || "—"}</div>
            <div style={S.headerRightLabel}>Issued Date</div>
            <div>{issuedDate || "—"}</div>
          </div>
        </div>

        {/* ════════════ 2. TITLE BLOCK ════════════ */}
        <div style={S.titleBlock} className="report-layout-no-break">
          {onCategoryChange ? (
            <input
              style={S.inputSm}
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              placeholder="CATEGORY"
            />
          ) : (
            <div style={S.eyebrow}>{category || " "}</div>
          )}
          {onReportTitleChange ? (
            <input
              style={S.input}
              value={reportTitle}
              onChange={(e) => onReportTitleChange(e.target.value)}
              placeholder="Report Title"
            />
          ) : (
            <div style={S.title}>{reportTitle || " "}</div>
          )}
        </div>

        {/* ════════════ 3. META STRIP ════════════ */}
        <div style={S.metaStrip} className="report-layout-no-break">
          <MetaCell label="Period" value={period} onChange={onPeriodChange} isEditable={isEditable && !!onPeriodChange} />
          <MetaCell label="Branch" value={branch} onChange={onBranchChange} isEditable={isEditable && !!onBranchChange} />
          <MetaCell label="Prepared By" value={preparedBy} onChange={onPreparedByChange} isEditable={isEditable && !!onPreparedByChange} />
          <MetaCell label="Total Records" value={String(totalRecords)} locked />
        </div>

        {/* ════════════ 4. MAIN DATA TABLE ════════════ */}
        {columns.length > 0 && (
          <table style={S.table} className="report-layout-no-break">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={{ ...S.tableHeader, textAlign: col.align || "left" }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ ...S.tableCell, textAlign: "center", color: "#999", padding: "20px 8px" }}>
                    No records found
                  </td>
                </tr>
              ) : (
                rows.map((row, ri) => (
                  <tr key={ri}>
                    {columns.map((col) => (
                      <td key={col.key} style={{ ...S.tableCell, textAlign: col.align || "left" }}>
                        {formatCellValue(row[col.key], col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* ════════════ 5. SUMMARY CARDS ════════════ */}
        {summaryCards && summaryCards.length > 0 && (
          <div style={S.summaryRow} className="report-layout-no-break">
            {summaryCards.map((card, i) => (
              <div key={i} style={S.summaryCard}>
                <div style={S.summaryValue}>
                  {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                </div>
                <div style={S.summaryLabel}>{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ════════════ Custom children ════════════ */}
        {children}

        {/* ════════════ 6. NOTES ════════════ */}
        {onNotesChange ? (
          <div style={S.notesSection}>
            <div style={S.notesLabel}>Notes</div>
            <textarea
              style={S.notesTextarea}
              value={notes || ""}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Add notes..."
            />
          </div>
        ) : notes ? (
          <div style={S.notesSection} className="report-layout-no-break">
            <div style={S.notesLabel}>Notes</div>
            <div style={S.notesText}>{notes}</div>
          </div>
        ) : null}

        {/* ════════════ 7. SIGN-OFF ════════════ */}
        <div style={S.signoff} className="report-layout-no-break">
          <div style={S.signoffBlock}>
            <div style={S.signoffLine} />
            <div style={S.signoffLabel}>Authorized Signature</div>
          </div>
          <div style={S.signoffBlock}>
            <div style={S.signoffLine} />
            <div style={S.signoffLabel}>Verified By</div>
          </div>
        </div>

        {/* ════════════ 8. FOOTER ════════════ */}
        <div style={S.footer}>
          <span style={S.footerLeft}>
            {companyName || "Your Company"} Real Estate Management System &middot; Confidential
          </span>
          <span style={S.footerRight}>Generated by EyeRems</span>
        </div>
      </div>
    </>
  );
}

// ── MetaCell sub-component ────────────────────────────────────────────────────

function MetaCell({
  label,
  value,
  onChange,
  isEditable,
  locked,
}: {
  label: string;
  value: string;
  onChange?: (val: string) => void;
  isEditable?: boolean;
  locked?: boolean;
}) {
  return (
    <div style={S.metaCell}>
      <div style={S.metaLabel}>{label}</div>
      {locked ? (
        <div style={{ ...S.metaValue, color: "#555" }}>{value}</div>
      ) : isEditable && onChange ? (
        <input
          style={S.metaInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label}`}
        />
      ) : (
        <div style={S.metaValue}>{value || "—"}</div>
      )}
    </div>
  );
}
