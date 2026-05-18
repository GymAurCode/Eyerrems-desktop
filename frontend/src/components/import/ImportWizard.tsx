import { useEffect, useMemo, useState } from "react";
import {
  Download, Upload, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw,
  FileSpreadsheet, AlertCircle, History,
} from "lucide-react";
import { useBulkImport } from "../../hooks/useBulkImport";
import { importApi } from "../../lib/importApi";
import FileDropzone from "./FileDropzone";
import ImportPreviewTable from "./ImportPreviewTable";

const STEPS = ["Module", "Upload", "Preview", "Import"] as const;

export default function ImportWizard() {
  const imp = useBulkImport();
  const [previewFilter, setPreviewFilter] = useState<"all" | "valid" | "invalid">("all");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof importApi.history>>>([]);

  useEffect(() => {
    void imp.loadModules();
    void importApi.history().then(setHistory).catch(() => {});
  }, []);

  const selectedModule = imp.modules.find((m) => m.key === imp.moduleKey);
  const stepIndex =
    imp.step === "select" ? 0 :
    imp.step === "upload" ? 1 :
    imp.step === "preview" ? 2 :
    imp.step === "importing" || imp.step === "done" ? 3 : 0;

  const columnKeys = useMemo(() => {
    if (selectedModule) return selectedModule.columns.map((c) => c.key);
    if (imp.validation?.rows[0]) return Object.keys(imp.validation.rows[0].data);
    return [];
  }, [selectedModule, imp.validation]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof imp.modules>();
    for (const m of imp.modules) {
      const list = map.get(m.category) ?? [];
      list.push(m);
      map.set(m.category, list);
    }
    return map;
  }, [imp.modules]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-slide-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}>
            <Upload size={20} style={{ color: "#60a5fa" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Bulk Import</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Download templates · validate · preview · import safely
            </p>
          </div>
        </div>
        <button type="button" onClick={() => imp.reset()} className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Start over
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{
                background: i <= stepIndex ? "rgba(59,130,246,0.2)" : "var(--hover-bg)",
                color: i <= stepIndex ? "#60a5fa" : "var(--text-muted)",
                border: `1px solid ${i <= stepIndex ? "rgba(59,130,246,0.4)" : "var(--border)"}`,
              }}
            >
              {i + 1}
            </span>
            <span className="text-xs font-medium" style={{ color: i <= stepIndex ? "#60a5fa" : "var(--text-muted)" }}>
              {label}
            </span>
            {i < STEPS.length - 1 && <ArrowRight size={12} style={{ color: "var(--text-muted)", opacity: 0.4 }} />}
          </div>
        ))}
      </div>

      {imp.error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-xs"
          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={14} />
          {imp.error}
        </div>
      )}

      {/* Step 1: Module */}
      {(imp.step === "select" || imp.step === "upload") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1 detail-container p-4 space-y-4">
            <p className="detail-section-title">Select module</p>
            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {[...grouped.entries()].map(([cat, mods]) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    {cat}
                  </p>
                  {mods.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => { imp.setModuleKey(m.key); imp.setStep("upload"); }}
                      className="w-full text-left px-3 py-2 rounded-lg mb-1 text-xs transition-colors"
                      style={{
                        background: imp.moduleKey === m.key ? "rgba(59,130,246,0.12)" : "transparent",
                        border: imp.moduleKey === m.key ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                        color: imp.moduleKey === m.key ? "#60a5fa" : "var(--text-primary)",
                      }}
                    >
                      <span className="font-semibold">{m.label}</span>
                      <span className="block text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {m.description}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {selectedModule && (
              <>
                <p className="detail-section-title mt-2">Duplicate handling</p>
                <select
                  className="select-dark w-full text-xs"
                  value={imp.duplicateMode}
                  onChange={(e) => imp.setDuplicateMode(e.target.value as typeof imp.duplicateMode)}
                >
                  <option value="skip">Skip duplicates</option>
                  <option value="update">Update existing records</option>
                  <option value="create_only">Create new only (fail on duplicate)</option>
                </select>

                <p className="detail-section-title mt-2">Download template</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void imp.downloadTemplate("xlsx")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg"
                    style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <FileSpreadsheet size={12} /> XLSX
                  </button>
                  <button type="button" onClick={() => void imp.downloadTemplate("csv")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg"
                    style={{ background: "var(--hover-bg)", border: "1px solid var(--border)" }}>
                    <Download size={12} /> CSV
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="lg:col-span-2 detail-container p-5 space-y-4">
            <p className="detail-section-title">
              {selectedModule ? `Upload — ${selectedModule.label}` : "Upload file"}
            </p>
            {selectedModule && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Required columns:{" "}
                {selectedModule.columns.filter((c) => c.required).map((c) => c.label).join(", ") || "none"}
              </p>
            )}
            <FileDropzone
              file={imp.file}
              onFile={(f) => { imp.setFile(f); if (f) imp.setStep("upload"); }}
              disabled={!imp.moduleKey}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={!imp.file || imp.loading}
                onClick={() => void imp.validateFile()}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
              >
                {imp.loading ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Validate & preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {imp.step === "preview" && imp.validation && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total", value: imp.validation.total_rows, color: "#94a3b8" },
              { label: "Valid", value: imp.validation.valid_count, color: "#10b981" },
              { label: "Invalid", value: imp.validation.invalid_count, color: "#ef4444" },
              { label: "To import", value: imp.rowsToImport().length, color: "#60a5fa" },
            ].map(({ label, value, color }) => (
              <div key={label} className="detail-container p-4 text-center">
                <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>{label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {(["all", "valid", "invalid"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPreviewFilter(f)}
                className="px-3 py-1 text-xs rounded-lg capitalize"
                style={{
                  background: previewFilter === f ? "rgba(59,130,246,0.15)" : "var(--hover-bg)",
                  color: previewFilter === f ? "#60a5fa" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <ImportPreviewTable
            rows={imp.validation.rows}
            columns={columnKeys}
            excludedRows={imp.excludedRows}
            onToggleRow={imp.toggleRow}
            filter={previewFilter}
          />

          <div className="flex justify-between gap-3 flex-wrap">
            <button type="button" onClick={() => imp.setStep("upload")}
              className="flex items-center gap-1 px-4 py-2 text-xs rounded-lg border"
              style={{ borderColor: "var(--border)" }}>
              <ArrowLeft size={12} /> Back
            </button>
            <button
              type="button"
              disabled={imp.rowsToImport().length === 0 || imp.loading}
              onClick={() => void imp.executeImport()}
              className="btn-primary flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-50"
            >
              Import {imp.rowsToImport().length} rows
            </button>
          </div>
        </div>
      )}

      {/* Importing / Done */}
      {(imp.step === "importing" || imp.step === "done") && (
        <div className="detail-container p-8 text-center space-y-4">
          {imp.step === "importing" ? (
            <>
              <RefreshCw size={40} className="mx-auto animate-spin" style={{ color: "#60a5fa" }} />
              <p className="text-sm font-medium text-primary">Importing records…</p>
              <div className="h-2 rounded-full overflow-hidden max-w-md mx-auto" style={{ background: "var(--hover-bg)" }}>
                <div className="h-full transition-all" style={{ width: `${imp.progress}%`, background: "#3b82f6" }} />
              </div>
            </>
          ) : imp.result ? (
            <>
              <CheckCircle2 size={48} className="mx-auto" style={{ color: "#10b981" }} />
              <p className="text-lg font-bold text-primary">Import complete</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{imp.result.message}</p>
              <div className="flex justify-center gap-6 text-sm flex-wrap">
                <span style={{ color: "#10b981" }}>{imp.result.imported} created</span>
                <span style={{ color: "#60a5fa" }}>{imp.result.updated} updated</span>
                <span style={{ color: "#94a3b8" }}>{imp.result.skipped} skipped</span>
                {imp.result.failed > 0 && (
                  <span style={{ color: "#ef4444" }}>{imp.result.failed} failed</span>
                )}
              </div>
              {imp.result.failed > 0 && (
                <button
                  type="button"
                  onClick={() => void importApi.downloadErrors(imp.result!.batch_id)}
                  className="text-xs underline"
                  style={{ color: "#f87171" }}
                >
                  Download error report (CSV)
                </button>
              )}
              <button type="button" onClick={() => imp.reset()} className="btn-primary px-5 py-2 text-sm mt-2">
                Import another file
              </button>
            </>
          ) : null}
        </div>
      )}

      {/* History */}
      {history.length > 0 && imp.step === "select" && (
        <div className="detail-container p-4">
          <p className="detail-section-title flex items-center gap-2 mb-3">
            <History size={14} /> Recent imports
          </p>
          <div className="overflow-x-auto">
            <table className="erp-table w-full text-xs">
              <thead>
                <tr>
                  <th>Date</th><th>Module</th><th>File</th><th>Status</th><th>Imported</th><th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 8).map((b) => (
                  <tr key={b.id}>
                    <td>{new Date(b.created_at).toLocaleString()}</td>
                    <td className="capitalize">{b.module_key.replace(/_/g, " ")}</td>
                    <td className="max-w-[160px] truncate">{b.file_name}</td>
                    <td>{b.status}</td>
                    <td>{b.imported_rows}</td>
                    <td>
                      {b.failed_rows > 0 ? (
                        <button type="button" className="underline" style={{ color: "#f87171" }}
                          onClick={() => void importApi.downloadErrors(b.id)}>
                          {b.failed_rows}
                        </button>
                      ) : b.failed_rows}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
