import { useState, useMemo, useCallback } from "react";
import {
  Upload, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw,
  AlertCircle, ShieldCheck, FileSpreadsheet, X,
} from "lucide-react";
import ImportPreviewTable from "./ImportPreviewTable";
import { api } from "../../lib/api";

interface MasterImportWizardProps {
  onClose: () => void;
}

export default function MasterImportWizard({ onClose }: MasterImportWizardProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update" | "create_only">("skip");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [activePreviewTab, setActivePreviewTab] = useState<"employees" | "properties" | "leads">("employees");
  const [dragOver, setDragOver] = useState(false);

  // Validation results
  const [validation, setValidation] = useState<{
    employees?: any;
    properties?: any;
    leads?: any;
  } | null>(null);

  // Row exclusion states
  const [excludedRows, setExcludedRows] = useState<Record<string, Set<number>>>({
    employees: new Set(),
    properties: new Set(),
    leads: new Set(),
  });

  const [previewFilter, setPreviewFilter] = useState<"all" | "valid" | "invalid">("all");
  const [importResult, setImportResult] = useState<any>(null);

  const toggleRow = (moduleKey: string, rowNumber: number) => {
    setExcludedRows((prev) => {
      const nextSet = new Set(prev[moduleKey]);
      if (nextSet.has(rowNumber)) nextSet.delete(rowNumber);
      else nextSet.add(rowNumber);
      return { ...prev, [moduleKey]: nextSet };
    });
  };

  const handleValidate = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    setProgress(30);
    try {
      const form = new FormData();
      form.append("duplicate_mode", duplicateMode);
      files.forEach((f) => {
        form.append("files", f);
      });

      const res = await api.post("/import/master-validate", form);
      const data = res.data;
      setValidation(data);
      setExcludedRows({
        employees: new Set(),
        properties: new Set(),
        leads: new Set(),
      });

      if (data.employees) setActivePreviewTab("employees");
      else if (data.properties) setActivePreviewTab("properties");
      else if (data.leads) setActivePreviewTab("leads");

      setStep("preview");
      setProgress(100);
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || "Failed to validate combined files.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!validation) return;
    setStep("importing");
    setLoading(true);
    setError("");
    setProgress(20);

    const payload = {
      employees_batch_id: validation.employees?.batch_id || null,
      properties_batch_id: validation.properties?.batch_id || null,
      leads_batch_id: validation.leads?.batch_id || null,
      duplicate_mode: duplicateMode,
    };

    try {
      setProgress(60);
      const res = await api.post("/import/master-execute", payload);
      const data = res.data;
      setImportResult(data);
      setStep("done");
      setProgress(100);
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || "Failed to execute combined import.";
      setError(errMsg);
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const activeColumns = useMemo(() => {
    if (!validation || !validation[activePreviewTab]) return [];
    const rows = validation[activePreviewTab]?.rows || [];
    if (rows.length > 0) {
      return Object.keys(rows[0].data);
    }
    return [];
  }, [validation, activePreviewTab]);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/25">
            <ShieldCheck size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-primary">Complete System Update</h2>
            <p className="text-[10px] text-muted">Imports leads, properties, and employees in dependency order.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded-lg border text-muted hover:text-primary transition-colors"
          style={{ borderColor: "var(--border)" }}
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-xs animate-shake"
          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="detail-container p-6 space-y-6 max-w-2xl mx-auto">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Duplicate handling</span>
            <select
              className="select-dark w-full text-xs py-2 px-3 rounded-xl border"
              style={{ borderColor: "var(--border)" }}
              value={duplicateMode}
              onChange={(e) => setDuplicateMode(e.target.value as any)}
            >
              <option value="skip">Skip duplicates</option>
              <option value="update">Update existing records</option>
              <option value="create_only">Create new only (fail on duplicate)</option>
            </select>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Upload Files</span>
            <div
              className="relative rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer"
              style={{
                borderColor: dragOver ? "#60a5fa" : "var(--border)",
                background: dragOver ? "rgba(59,130,246,0.06)" : "var(--bg-surface2)",
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files) {
                  setFiles(Array.from(e.dataTransfer.files));
                }
              }}
            >
              <input
                type="file"
                multiple
                accept=".zip,.csv,.xlsx"
                className="hidden"
                id="master-file-input"
                onChange={(e) => {
                  if (e.target.files) {
                    setFiles(Array.from(e.target.files));
                  }
                }}
              />
              <label htmlFor="master-file-input" className="cursor-pointer space-y-2 block">
                <Upload size={32} className="mx-auto text-muted opacity-60" />
                <p className="text-sm font-medium text-primary">Click to select or drag files here</p>
                <p className="text-xs text-muted">Supports the REMS Combined Template workbook, ZIP packages, or multiple CSV/XLSX files</p>
              </label>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Selected Files ({files.length})</span>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl border text-xs"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2 truncate">
                      <FileSpreadsheet size={16} className="text-emerald-400 shrink-0" />
                      <span className="font-semibold text-primary truncate">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted">{(f.size / 1024).toFixed(1)} KB</span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-muted hover:text-primary transition-colors p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={files.length === 0 || loading}
              onClick={handleValidate}
              className="btn-primary flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl disabled:opacity-50 w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  Validate Package
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && validation && (
        <div className="space-y-4">
          {/* Sheet detection status checklist */}
          <div className="flex flex-wrap gap-4 sm:gap-8 justify-center items-center py-3 px-4 rounded-2xl border"
            style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.15)" }}>
            <div className="flex items-center gap-2 text-xs font-black">
              <span className={validation.leads ? "text-emerald-400" : "text-muted"}>
                {validation.leads ? "✓ Leads Sheet Loaded" : "✗ Leads Sheet Missing"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-black">
              <span className={validation.properties ? "text-emerald-400" : "text-muted"}>
                {validation.properties ? "✓ Properties Sheet Loaded" : "✗ Properties Sheet Missing"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-black">
              <span className={validation.employees ? "text-emerald-400" : "text-muted"}>
                {validation.employees ? "✓ Employees Sheet Loaded" : "✗ Employees Sheet Missing"}
              </span>
            </div>
          </div>

          {/* Summary counters */}
          <div className="grid grid-cols-3 gap-3">
            {(["employees", "properties", "leads"] as const).map((key) => {
              const res = validation[key];
              if (!res) return null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActivePreviewTab(key)}
                  className={`p-4 rounded-xl text-left border transition-all ${
                    activePreviewTab === key ? "ring-1 ring-blue-500 border-blue-500" : "opacity-80 hover:opacity-100"
                  }`}
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: activePreviewTab === key ? "rgba(59,130,246,0.5)" : "var(--border)",
                  }}
                >
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted">{key}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-black text-primary">{res.total_rows} rows</span>
                    <span className="text-[10px] text-emerald-400 font-bold">{res.valid_count} valid</span>
                  </div>
                </button>
              );
            })}
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
            <p className="text-[10px] text-muted">Rows marked in red or checked will be excluded.</p>
          </div>

          {validation[activePreviewTab] ? (
            <ImportPreviewTable
              rows={validation[activePreviewTab]!.rows}
              columns={activeColumns}
              excludedRows={excludedRows[activePreviewTab]}
              onToggleRow={(rowNo) => toggleRow(activePreviewTab, rowNo)}
              filter={previewFilter}
            />
          ) : (
            <div className="detail-container p-6 text-center text-xs text-muted rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              No validation details for this module.
            </div>
          )}

          <div className="flex justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep("upload")}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border text-muted"
              style={{ borderColor: "var(--border)" }}
            >
              <ArrowLeft size={12} /> Back
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleExecute}
              className="btn-primary flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-xl"
            >
              Execute Combined Import
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === "importing" && (
        <div className="detail-container p-8 text-center space-y-4 rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <RefreshCw size={40} className="mx-auto animate-spin text-blue-400" />
          <p className="text-sm font-medium text-primary">Importing data package...</p>
          <div className="h-2 rounded-full overflow-hidden max-w-md mx-auto" style={{ background: "var(--hover-bg)" }}>
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === "done" && importResult && (
        <div className="detail-container p-8 text-center space-y-5 rounded-2xl border animate-scale-up" style={{ borderColor: "var(--border)" }}>
          <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
          <div>
            <h3 className="text-base font-extrabold text-primary">Import Complete</h3>
            <p className="text-xs text-muted mt-1">{importResult.message || "All records imported successfully."}</p>
          </div>

          <div className="max-w-md mx-auto grid grid-cols-3 gap-3 border-y py-4 my-2 text-xs" style={{ borderColor: "var(--border)" }}>
            {(["employees", "properties", "leads"] as const).map((key) => {
              const res = importResult[key];
              if (!res) return null;
              return (
                <div key={key} className="text-center">
                  <p className="font-bold text-primary capitalize">{key}</p>
                  <p className="text-[10px] text-emerald-400 mt-1 font-bold">{res.imported} Created</p>
                  <p className="text-[10px] text-blue-400 font-bold">{res.updated} Updated</p>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center gap-2">
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
