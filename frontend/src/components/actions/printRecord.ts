/**
 * Opens a minimal printable view for a single record.
 */
export function printRecord(title: string, fields: { label: string; value: string }[]) {
  const rows = fields
    .map(
      (f) =>
        `<tr><td style="padding:6px 12px;font-weight:600;color:#64748b;white-space:nowrap">${f.label}</td>` +
        `<td style="padding:6px 12px">${f.value || "—"}</td></tr>`
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}
    h1{font-size:18px;margin:0 0 16px}table{border-collapse:collapse;width:100%}
    tr{border-bottom:1px solid #e2e8f0}</style></head><body>
    <h1>${title}</h1><table>${rows}</table></body></html>`;
  const w = window.open("", "_blank", "width=720,height=640");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
