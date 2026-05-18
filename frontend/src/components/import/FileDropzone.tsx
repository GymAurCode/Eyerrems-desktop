import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";

const ACCEPT = ".csv,.xlsx,.xls";
const MAX_MB = 10;

interface FileDropzoneProps {
  file: File | null;
  onFile: (f: File | null) => void;
  disabled?: boolean;
}

export default function FileDropzone({ file, onFile, disabled }: FileDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const pick = useCallback(
    (f: File | null) => {
      if (!f) {
        onFile(null);
        return;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        alert(`File must be under ${MAX_MB} MB`);
        return;
      }
      const ext = f.name.toLowerCase().split(".").pop();
      if (!["csv", "xlsx", "xls"].includes(ext || "")) {
        alert("Only CSV or Excel files are allowed");
        return;
      }
      onFile(f);
    },
    [onFile],
  );

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
      style={{
        borderColor: dragOver ? "#60a5fa" : "var(--border)",
        background: dragOver ? "rgba(59,130,246,0.06)" : "var(--bg-surface2)",
      }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) pick(f);
      }}
    >
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <FileSpreadsheet size={28} style={{ color: "#10b981" }} />
          <div className="text-left">
            <p className="text-sm font-semibold text-primary">{file.name}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={() => onFile(null)}
            className="p-1.5 rounded-lg hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <>
          <Upload size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)", opacity: 0.5 }} />
          <p className="text-sm font-medium text-primary mb-1">Drag & drop your file here</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            CSV or Excel · max {MAX_MB} MB · up to 10,000 rows
          </p>
          <label className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs cursor-pointer">
            Browse files
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>
        </>
      )}
    </div>
  );
}
