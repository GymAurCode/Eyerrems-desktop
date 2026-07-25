import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { api } from "../../lib/api";
import { downloadBlob } from "../../utils/fileHelpers";
import AppDialog from "../ui/AppDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  reportType: string;
  entityId?: number;
  title?: string;
}

export default function ReportDialog({
  open,
  onClose,
  reportType,
  entityId,
  title = "Generate Report",
}: Props) {
  const [loading, setLoading] = useState<"pdf" | "xlsx" | "print" | null>(null);
  const [error, setError] = useState("");

  const generate = async (format: "pdf" | "xlsx" | "print") => {
    setLoading(format);
    setError("");
    try {
      if (format === "print") {
        const { data } = await api.post(
          "/reports/download/html",
          {
            report_type: reportType,
            entity_id: entityId,
            output_format: "html",
          },
          { responseType: "text" }
        );
        const win = window.open("", "_blank", "width=800,height=600");
        if (win) {
          win.document.write(data);
          win.document.close();
          win.focus();
          setTimeout(() => { try { win.print(); } catch {} }, 500);
        }
      } else {
        const ext = format;
        const mime =
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const { data } = await api.post(
          `/reports/download/${format}`,
          {
            report_type: reportType,
            entity_id: entityId,
            output_format: format,
          },
          { responseType: "blob" }
        );
        downloadBlob(data, `${reportType}_${entityId || ""}_${Date.now()}.${ext}`, mime);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to generate report");
    } finally {
      setLoading(null);
    }
  };

  return (
    <AppDialog
      isOpen={open}
      onClose={onClose}
      title={title}
      subtitle="Choose the output format for this report"
      icon={<Download size={16} />}
    >
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {/* PDF */}
          <button
            onClick={() => generate("pdf")}
            disabled={loading !== null}
            className="flex flex-col items-center gap-2 p-5 rounded-xl border border-theme hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "pdf" ? (
              <Loader2 size={24} className="animate-spin text-indigo-400" />
            ) : (
              <FileText size={24} className="text-red-400" />
            )}
            <span className="text-xs font-medium text-primary">
              {loading === "pdf" ? "Generating..." : "PDF"}
            </span>
            <span className="text-[11px] text-muted">Download</span>
          </button>

          {/* Excel */}
          <button
            onClick={() => generate("xlsx")}
            disabled={loading !== null}
            className="flex flex-col items-center gap-2 p-5 rounded-xl border border-theme hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "xlsx" ? (
              <Loader2 size={24} className="animate-spin text-emerald-400" />
            ) : (
              <FileSpreadsheet size={24} className="text-emerald-400" />
            )}
            <span className="text-xs font-medium text-primary">
              {loading === "xlsx" ? "Generating..." : "Excel"}
            </span>
            <span className="text-[11px] text-muted">Download .xlsx</span>
          </button>

          {/* Print */}
          <button
            onClick={() => generate("print")}
            disabled={loading !== null}
            className="flex flex-col items-center gap-2 p-5 rounded-xl border border-theme hover:border-blue-500/50 hover:bg-blue-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "print" ? (
              <Loader2 size={24} className="animate-spin text-blue-400" />
            ) : (
              <Printer size={24} className="text-blue-400" />
            )}
            <span className="text-xs font-medium text-primary">
              {loading === "print" ? "Loading..." : "Print"}
            </span>
            <span className="text-[11px] text-muted">Browser Print</span>
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
