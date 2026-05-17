/**
 * ledgerExport — PDF, Excel, and Print utilities for ledger tables.
 * Uses browser-native print for PDF/Print, and CSV download for Excel.
 * No external dependencies required.
 */
import type { LedgerRow } from "./LedgerTable";
import type { LedgerSummary } from "../../lib/ledgerApi";

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency", currency: "PKR", minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Print / PDF ───────────────────────────────────────────────────────────────

export function printLedger(
  title: string,
  rows: LedgerRow[],
  summary?: { total_debit: number; total_credit: number; opening_balance: number; closing_balance: number; entry_count: number } | null,
): void {
  const totalDebit  = rows.reduce((s, r) => s + r.debit,  0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const lastBalance = rows[rows.length - 1]?.running_balance ?? 0;

  const rowsHtml = rows.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
      <td>${i + 1}</td>
      <td style="font-family:monospace;font-size:10px">${r.tid}</td>
      <td>${fmtDate(r.entry_date)}</td>
      <td>${r.description}</td>
      <td style="font-family:monospace">${r.reference_no ?? "—"}</td>
      <td>${r.entry_type.replace(/_/g, " ")}</td>
      <td style="text-align:right;color:${r.debit > 0 ? "#dc2626" : "#9ca3af"}">${r.debit > 0 ? fmtCurrency(r.debit) : "—"}</td>
      <td style="text-align:right;color:${r.credit > 0 ? "#16a34a" : "#9ca3af"}">${r.credit > 0 ? fmtCurrency(r.credit) : "—"}</td>
      <td style="text-align:right;font-weight:700;color:${r.running_balance >= 0 ? "#1d4ed8" : "#dc2626"}">${fmtCurrency(r.running_balance)}</td>
      <td>${r.status}</td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; }
        h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .meta { font-size: 10px; color: #6b7280; margin-bottom: 16px; }
        .summary { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
        .summary-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 16px; min-width: 140px; }
        .summary-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 4px; }
        .summary-card .value { font-size: 14px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        thead tr { background: #f1f5f9; border-bottom: 2px solid #e2e8f0; }
        th { padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; white-space: nowrap; }
        td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        tfoot tr { background: #f8fafc; border-top: 2px solid #e2e8f0; font-weight: 700; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p class="meta">Generated: ${new Date().toLocaleString("en-PK")} · ${rows.length} entries</p>

      <div class="summary">
        <div class="summary-card">
          <div class="label">Opening Balance</div>
          <div class="value">${fmtCurrency(summary?.opening_balance ?? 0)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Total Debit</div>
          <div class="value" style="color:#dc2626">${fmtCurrency(totalDebit)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Total Credit</div>
          <div class="value" style="color:#16a34a">${fmtCurrency(totalCredit)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Closing Balance</div>
          <div class="value" style="color:${lastBalance >= 0 ? "#1d4ed8" : "#dc2626"}">${fmtCurrency(lastBalance)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th><th>TID</th><th>Date</th><th>Description</th>
            <th>Ref No</th><th>Type</th>
            <th style="text-align:right">Debit</th>
            <th style="text-align:right">Credit</th>
            <th style="text-align:right">Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="6" style="font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#475569">Totals</td>
            <td style="text-align:right;color:#dc2626">${fmtCurrency(totalDebit)}</td>
            <td style="text-align:right;color:#16a34a">${fmtCurrency(totalCredit)}</td>
            <td style="text-align:right;color:${lastBalance >= 0 ? "#1d4ed8" : "#dc2626"}">${fmtCurrency(lastBalance)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

export function exportLedgerPDF(
  title: string,
  rows: LedgerRow[],
  summary?: LedgerSummary | null,
): void {
  // Opens print dialog — user can save as PDF
  printLedger(title, rows, summary);
}

// ── Excel (CSV) ───────────────────────────────────────────────────────────────

export function exportLedgerExcel(title: string, rows: LedgerRow[]): void {
  const headers = ["#", "TID", "Date", "Description", "Reference No", "Type",
    "Debit", "Credit", "Running Balance", "Status"];

  const csvRows = [
    headers.join(","),
    ...rows.map((r, i) => [
      i + 1,
      r.tid,
      fmtDate(r.entry_date),
      `"${r.description.replace(/"/g, '""')}"`,
      r.reference_no ?? "",
      r.entry_type,
      r.debit,
      r.credit,
      r.running_balance,
      r.status,
    ].join(",")),
    // Totals row
    [
      "", "", "", "", "", "TOTALS",
      rows.reduce((s, r) => s + r.debit,  0),
      rows.reduce((s, r) => s + r.credit, 0),
      rows[rows.length - 1]?.running_balance ?? 0,
      "",
    ].join(","),
  ];

  const csv  = csvRows.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
