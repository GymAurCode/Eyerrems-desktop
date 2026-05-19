import { useEffect, useMemo, useState } from "react";
import {
  Download, Upload, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw,
  FileSpreadsheet, AlertCircle, X,
} from "lucide-react";
import { useBulkImport } from "../../hooks/useBulkImport";
import { importApi } from "../../lib/importApi";
import FileDropzone from "./FileDropzone";
import ImportPreviewTable from "./ImportPreviewTable";

export default function ImportWizard({ defaultModuleKey, onClose }: { defaultModuleKey?: string; onClose?: () => void } = {}) {
  const imp = useBulkImport();
  const [previewFilter, setPreviewFilter] = useState<"all" | "valid" | "invalid">("all");

  useEffect(() => {
    void imp.loadModules();
    if (defaultModuleKey) {
      imp.setModuleKey(defaultModuleKey);
      imp.setStep("upload");
    }
  }, [defaultModuleKey]);

  const selectedModule = imp.modules.find((m) => m.key === imp.moduleKey);

  const columnKeys = useMemo(() => {
    if (selectedModule) return selectedModule.columns.map((c) => c.key);
    if (imp.validation?.rows[0]) return Object.keys(imp.validation.rows[0].data);
    return [];
  }, [selectedModule, imp.validation]);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/25">
            <Upload size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-primary">
              {selectedModule ? `Import ${selectedModule.label}` : "Import Data"}
            </h2>
            <p className="text-[10px] text-muted">Upload and validate your file before committing to the database.</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg border text-muted hover:text-primary transition-colors"
            style={{ borderColor: "var(--border)" }}
          >
            Cancel
          </button>
        )}
      </div>

      {imp.error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-xs animate-shake"
          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={14} />
          {imp.error}
        </div>
      )}

      {/* Step 1: Upload */}
      {(imp.step === "select" || imp.step === "upload") && (
        <div className="detail-container p-6 space-y-6 max-w-2xl mx-auto">
          {selectedModule && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Duplicate handling</span>
              <select
                className="select-dark w-full text-xs py-2 px-3 rounded-xl border"
                style={{ borderColor: "var(--border)" }}
                value={imp.duplicateMode}
                onChange={(e) => imp.setDuplicateMode(e.target.value as typeof imp.duplicateMode)}
              >
                <option value="skip">Skip duplicates</option>
                <option value="update">Update existing records</option>
                <option value="create_only">Create new only (fail on duplicate)</option>
              </select>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Upload File</span>
            <FileDropzone
              file={imp.file}
              onFile={(f) => { imp.setFile(f); if (f) imp.setStep("upload"); }}
              disabled={!imp.moduleKey}
            />
          </div>

          {selectedModule && (
            <p className="text-[10px] text-muted text-center leading-normal">
              Expected columns: {selectedModule.columns.map((c) => c.label).join(", ")}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!imp.file || imp.loading}
              onClick={() => void imp.validateFile()}
              className="btn-primary flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl disabled:opacity-50 w-full sm:w-auto"
            >
              {imp.loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  Validate & Preview
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {imp.step === "preview" && imp.validation && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Rows", value: imp.validation.total_rows, color: "#94a3b8" },
              { label: "Valid", value: imp.validation.valid_count, color: "#10b981" },
              { label: "Invalid", value: imp.validation.invalid_count, color: "#ef4444" },
              { label: "To Import", value: imp.rowsToImport().length, color: "#60a5fa" },
            ].map(({ label, value, color }) => (
              <div key={label} className="detail-container p-4 text-center rounded-2xl border" style={{ borderColor: "var(--border)" }}>
                <p className="text-2xl font-black" style={{ color }}>{value}</p>
                <p className="text-[10px] uppercase tracking-wider mt-1 text-muted">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1.5">
              {(["all", "valid", "invalid"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPreviewFilter(f)}
                  className="px-3 py-1 text-xs rounded-xl capitalize border font-medium"
                  style={{
                    background: previewFilter === f ? "rgba(59,130,246,0.12)" : "transparent",
                    color: previewFilter === f ? "#60a5fa" : "var(--text-muted)",
                    borderColor: previewFilter === f ? "rgba(59,130,246,0.25)" : "var(--border)",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted">Toggle rows to exclude them from the import.</p>
          </div>

          <ImportPreviewTable
            rows={imp.validation.rows}
            columns={columnKeys}
            excludedRows={imp.excludedRows}
            onToggleRow={imp.toggleRow}
            filter={previewFilter}
          />

          <div className="flex justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => imp.setStep("upload")}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border text-muted"
              style={{ borderColor: "var(--border)" }}
            >
              <ArrowLeft size={12} /> Back
            </button>
            <button
              type="button"
              disabled={imp.rowsToImport().length === 0 || imp.loading}
              onClick={() => void imp.executeImport()}
              className="btn-primary flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-xl disabled:opacity-50"
            >
              Import {imp.rowsToImport().length} Rows
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {imp.step === "importing" && (
        <div className="detail-container p-8 text-center space-y-4 rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <RefreshCw size={40} className="mx-auto animate-spin text-blue-400" />
          <p className="text-sm font-medium text-primary">Importing records...</p>
          <div className="h-2 rounded-full overflow-hidden max-w-md mx-auto" style={{ background: "var(--hover-bg)" }}>
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${imp.progress}%` }} />
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {imp.step === "done" && imp.result && (
        <div className="detail-container p-8 text-center space-y-5 rounded-2xl border animate-scale-up" style={{ borderColor: "var(--border)" }}>
          <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
          <div>
            <h3 className="text-base font-extrabold text-primary">Import Complete</h3>
            <p className="text-xs text-muted mt-1">{imp.result.message}</p>
          </div>
          <div className="flex justify-center gap-6 text-xs flex-wrap border-y py-4" style={{ borderColor: "var(--border)" }}>
            <span className="text-emerald-400 font-bold">{imp.result.imported} created</span>
            <span className="text-blue-400 font-bold">{imp.result.updated} updated</span>
            <span className="text-muted font-bold">{imp.result.skipped} skipped</span>
            {imp.result.failed > 0 && (
              <span className="text-red-400 font-bold">{imp.result.failed} failed</span>
            )}
          </div>
          {imp.result.failed > 0 && (
            <button
              type="button"
              onClick={() => void importApi.downloadErrors(imp.result!.batch_id)}
              className="text-xs underline text-red-400 hover:text-red-300 block mx-auto"
            >
              Download error report (CSV)
            </button>
          )}
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-primary px-6 py-2.5 text-xs font-bold rounded-xl"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
