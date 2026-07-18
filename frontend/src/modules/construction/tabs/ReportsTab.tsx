import { useEffect, useState } from "react";
import {
  BarChart2, Download, FileText, Printer, FileSpreadsheet,
  CheckCircle, AlertTriangle,
} from "lucide-react";
import { constructionApi, ProjectReport } from "../../../lib/constructionApi";
import { formatCurrency } from "../../../lib/currency";

const REPORT_TYPES = [
  { key: "progress", label: "Project Progress Report", icon: "📊" },
  { key: "tasks", label: "Task Completion Report", icon: "✅" },
  { key: "budget", label: "Budget Report", icon: "💰" },
  { key: "cost_variance", label: "Cost Variance Report", icon: "📉" },
  { key: "materials", label: "Material Consumption Report", icon: "📦" },
  { key: "labor", label: "Labor Productivity Report", icon: "👷" },
  { key: "equipment", label: "Equipment Utilization Report", icon: "🔧" },
  { key: "procurement", label: "Procurement Report", icon: "🛒" },
  { key: "supplier", label: "Supplier Performance Report", icon: "🏭" },
  { key: "quality", label: "Quality Report", icon: "🔍" },
  { key: "safety", label: "Safety Report", icon: "🛡️" },
  { key: "financial", label: "Financial Report", icon: "💵" },
  { key: "delay", label: "Delay Analysis", icon: "⏰" },
  { key: "cashflow", label: "Cash Flow Report", icon: "💹" },
];

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold text-primary">{title}</p>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function ReportsTab({ projectId }: { projectId: number }) {
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    constructionApi.getReport(projectId)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleExport = async (type: string, format: string) => {
    setExporting(`${type}_${format}`);
    try {
      const blob = await constructionApi.exportReport(projectId, format, type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_report_${projectId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Export failed. The backend might not support this export type yet.");
    }
    finally { setExporting(null); }
  };

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Summary */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
            <span className="text-[10px] text-muted uppercase tracking-wider">Progress</span>
            <p className="text-lg font-bold text-blue-400">{(report.project.progress_percentage ?? 0).toFixed(1)}%</p>
          </div>
          <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
            <span className="text-[10px] text-muted uppercase tracking-wider">Tasks</span>
            <p className="text-lg font-bold text-emerald-400">{report.project.completed_tasks ?? 0}/{report.project.task_count ?? 0}</p>
          </div>
          <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
            <span className="text-[10px] text-muted uppercase tracking-wider">Budget Used</span>
            <p className="text-lg font-bold text-orange-400">
              {report.project.total_budget > 0
                ? `${((Number(report.project.actual_cost ?? 0) / Number(report.project.total_budget)) * 100).toFixed(1)}%`
                : "N/A"}
            </p>
          </div>
          <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
            <span className="text-[10px] text-muted uppercase tracking-wider">Delayed Tasks</span>
            <p className="text-lg font-bold text-red-400">{report.project.delayed_tasks ?? 0}</p>
          </div>
        </div>
      )}

      {/* Report Types */}
      <SectionCard title="Generate Reports">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {REPORT_TYPES.map(rt => (
            <div key={rt.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors"
              style={{ border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{rt.icon}</span>
                <span className="text-xs font-medium text-primary">{rt.label}</span>
              </div>
              <div className="flex items-center gap-1">
                {["pdf", "excel", "csv"].map(fmt => (
                  <button key={fmt} onClick={() => handleExport(rt.key, fmt)}
                    disabled={exporting === `${rt.key}_${fmt}`}
                    className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-white/10 disabled:opacity-30 transition-all"
                    title={`Export as ${fmt.toUpperCase()}`}>
                    {fmt === "pdf" && <FileText size={12} />}
                    {fmt === "excel" && <FileSpreadsheet size={12} />}
                    {fmt === "csv" && <Download size={12} />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Print Report */}
      <SectionCard title="Quick Print">
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Printer size={12} /> Print Report
          </button>
          <button onClick={() => handleExport("full", "pdf")} disabled={exporting === "full_pdf"}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
            <FileText size={12} /> {exporting === "full_pdf" ? "Exporting…" : "Export Full PDF"}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
