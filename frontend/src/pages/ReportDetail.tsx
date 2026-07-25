import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, Printer, FileText, FileSpreadsheet,
  X, ChevronRight, Filter,
} from "lucide-react";
import { api } from "../lib/api";
import { downloadBlob } from "../utils/fileHelpers";
import {
  MODULES, PARAM_SCHEMAS, getReportBackendType,
  VIRTUAL_REPORT_FILTERS, VIRTUAL_REPORT_TITLES,
} from "../config/reports";
import type { ParamField } from "../config/reports";
import { useAuthStore } from "../store/auth";

interface FilterValues {
  [key: string]: any;
}

function getFilterSections(fields: ParamField[]): { label: string; fields: ParamField[] }[] {
  const sections: { label: string; fields: ParamField[] }[] = [];
  const idFields: ParamField[] = [];
  const dateFields: ParamField[] = [];
  const selectFields: ParamField[] = [];
  const otherFields: ParamField[] = [];

  for (const f of fields) {
    if (f.key === "entity_id" || (f.key.endsWith("_id") && f.type === "number")) {
      idFields.push(f);
    } else if (f.type === "date" || f.key.includes("date")) {
      dateFields.push(f);
    } else if (f.type === "select") {
      selectFields.push(f);
    } else {
      otherFields.push(f);
    }
  }

  if (idFields.length) sections.push({ label: "Scope", fields: idFields });
  if (dateFields.length) sections.push({ label: "Period", fields: dateFields });
  if (selectFields.length) sections.push({ label: "Status", fields: selectFields });
  if (otherFields.length) sections.push({ label: "Filters", fields: otherFields });

  return sections;
}

function renderField(
  field: ParamField,
  value: any,
  onChange: (key: string, val: any) => void,
) {
  const id = `field-${field.key}`;

  if (field.type === "select" && field.options) {
    return (
      <div key={field.key}>
        <label htmlFor={id} className="block text-xs font-medium text-[#5B6472] mb-1.5">{field.label}</label>
        <select
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="w-full h-9 px-3 text-sm bg-white border border-[#E3E6EB] rounded-[7px] text-[#172032] focus:outline-none focus:border-[#0E7C66] focus:ring-1 focus:ring-[#0E7C66]/20 transition-colors appearance-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='%239AA2B1' d='M4.646 5.646a.5.5 0 0 1 .708 0L8 8.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
            backgroundSize: "14px",
            paddingRight: "32px",
          }}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div key={field.key}>
        <label htmlFor={id} className="block text-xs font-medium text-[#5B6472] mb-1.5">{field.label}</label>
        <input
          id={id}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="w-full h-9 px-3 text-sm bg-white border border-[#E3E6EB] rounded-[7px] text-[#172032] focus:outline-none focus:border-[#0E7C66] focus:ring-1 focus:ring-[#0E7C66]/20 transition-colors"
        />
      </div>
    );
  }

  if (field.type === "date_range") {
    return (
      <div key={field.key}>
        <label className="block text-xs font-medium text-[#5B6472] mb-1.5">{field.label}</label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value?.from ?? ""}
            onChange={(e) => onChange(field.key, { ...(value || {}), from: e.target.value })}
            className="flex-1 h-9 px-3 text-sm bg-white border border-[#E3E6EB] rounded-[7px] text-[#172032] focus:outline-none focus:border-[#0E7C66] focus:ring-1 focus:ring-[#0E7C66]/20 transition-colors"
            placeholder="From"
          />
          <span className="text-xs text-[#9AA2B1]">to</span>
          <input
            type="date"
            value={value?.to ?? ""}
            onChange={(e) => onChange(field.key, { ...(value || {}), to: e.target.value })}
            className="flex-1 h-9 px-3 text-sm bg-white border border-[#E3E6EB] rounded-[7px] text-[#172032] focus:outline-none focus:border-[#0E7C66] focus:ring-1 focus:ring-[#0E7C66]/20 transition-colors"
            placeholder="To"
          />
        </div>
      </div>
    );
  }

  return (
    <div key={field.key}>
      <label htmlFor={id} className="block text-xs font-medium text-[#5B6472] mb-1.5">{field.label}</label>
      <input
        id={id}
        type={field.type === "number" ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={field.placeholder}
        className="w-full h-9 px-3 text-sm bg-white border border-[#E3E6EB] rounded-[7px] text-[#172032] placeholder-[#9AA2B1] focus:outline-none focus:border-[#0E7C66] focus:ring-1 focus:ring-[#0E7C66]/20 transition-colors"
      />
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const s = (value || "").toLowerCase();
  let bg = "#ECEDEF";
  let color = "#5B6472";
  if (["active", "paid", "completed", "confirmed", "occupied", "won", "approved"].includes(s)) {
    bg = "#E4F1EE"; color = "#0E7C66";
  } else if (["pending", "partial", "follow_up", "negotiation", "site_visit"].includes(s)) {
    bg = "#FEF3C7"; color = "#B8860B";
  } else if (["inactive", "vacant", "cancelled", "lost", "resigned", "overdue"].includes(s)) {
    bg = "#FEE2E2"; color = "#C0392B";
  }
  return (
    <span
      className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full leading-tight"
      style={{ backgroundColor: bg, color }}
    >
      {value}
    </span>
  );
}

async function extractErrorMsg(e: any, fallback: string): Promise<string> {
  if (e?.response?.data instanceof Blob) {
    try {
      const text = await e.response.data.text();
      try { return JSON.parse(text).detail ?? text; } catch { return text; }
    } catch { /* ignore */ }
  }
  return e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? fallback;
}

export default function ReportDetail() {
  const { module: moduleKey, reportType } = useParams();
  const navigate = useNavigate();

  const mod = useMemo(
    () => MODULES.find((m) => m.key === moduleKey),
    [moduleKey],
  );
  const rep = useMemo(
    () => mod?.reports.find((r) => r.key === reportType),
    [mod, reportType],
  );

  const paramFields = useMemo(
    () => (reportType ? PARAM_SCHEMAS[reportType] ?? [] : []),
    [reportType],
  );
  const sections = useMemo(() => getFilterSections(paramFields), [paramFields]);

  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [error, setError] = useState("");
  const [exportLoading, setExportLoading] = useState<"pdf" | "xlsx" | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [preparedFor, setPreparedFor] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [zoom, setZoom] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyRegNo, setCompanyRegNo] = useState("");

  const currentUser = useAuthStore((s) => s.user);
  const preparedByName = currentUser?.full_name || currentUser?.email || "";

  const reportRef = useMemo(() => {
    if (!reportType) return "";
    const now = new Date();
    const ds = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `REP-${reportType.slice(0, 4).toUpperCase()}-${ds}-${rand}`;
  }, [reportType, generated]);

  useEffect(() => {
    api.get("/reports/settings").then(({ data }) => {
      setCompanyName(data.company_name || "");
      setCompanyAddress(data.address || "");
      setCompanyPhone(data.phone || "");
      setCompanyEmail(data.email || "");
      setCompanyRegNo(data.reg_no || "");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setFilterValues({});
    setGenerated(false);
    setPreviewHtml("");
    setError("");
    setPreparedFor("");
    setReportNote("");
  }, [reportType]);

  const updateFilter = useCallback((key: string, val: any) => {
    setFilterValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const activeFilterCount = useMemo(
    () => Object.entries(filterValues).filter(([, v]) => {
      if (v === undefined || v === null || v === "") return false;
      if (typeof v === "object" && !v.from && !v.to) return false;
      return true;
    }).length,
    [filterValues],
  );

  const handleGenerate = useCallback(async () => {
    if (!rep || !reportType) return;
    setLoading(true);
    setError("");

    const backendType = getReportBackendType(reportType);
    const virtualFilters = VIRTUAL_REPORT_FILTERS[reportType] || {};

    const payload: Record<string, any> = {
      report_type: backendType,
      output_format: "html",
      filters: { ...virtualFilters },
      prepared_for: preparedFor,
      prepared_by: preparedByName,
      note: reportNote,
    };

    for (const [k, v] of Object.entries(filterValues)) {
      if (v === undefined || v === null || v === "") continue;
      if (typeof v === "object" && !v.from && !v.to) continue;
      if (k === "date_from" || k === "date_to" || k.endsWith("_from") || k.endsWith("_to")) {
        payload.filters[k] = v;
      } else if (typeof v === "object" && v.from) {
        payload.filters[`${k}_from`] = v.from;
        payload.filters[`${k}_to`] = v.to;
      } else if (k === "entity_id") {
        payload.entity_id = Number(v);
      } else {
        payload.filters[k] = v;
      }
    }

    try {
      const { data } = await api.post("/reports/download/html", payload, {
        responseType: "text",
      });
      setPreviewHtml(data);
      setGenerated(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }, [rep, reportType, filterValues, preparedFor, preparedByName, reportNote]);

  const handleExport = useCallback(
    async (format: "pdf" | "xlsx" | "print") => {
      if (!rep || !reportType) return;

      if (format === "print") {
        const openAndPrint = (html: string) => {
          const win = window.open("", "_blank", "width=800,height=600");
          if (!win) return;
          win.document.write(html);
          win.document.close();
          win.focus();
          setTimeout(() => { try { win.print(); } catch {} }, 500);
        };

        if (previewHtml) { openAndPrint(previewHtml); return; }

        const payload: Record<string, any> = {
          report_type: getReportBackendType(reportType),
          output_format: "html",
          filters: { ...(VIRTUAL_REPORT_FILTERS[reportType] || {}) },
          prepared_for: preparedFor,
          prepared_by: preparedByName,
          note: reportNote,
        };
        for (const [k, v] of Object.entries(filterValues)) {
          if (v === undefined || v === null || v === "") continue;
          if (k === "entity_id") { payload.entity_id = Number(v); }
          else { payload.filters[k] = v; }
        }
        try {
          const { data } = await api.post("/reports/download/html", payload, {
            responseType: "text",
          });
          openAndPrint(data);
        } catch (e: any) {
          setError(await extractErrorMsg(e, "Print failed"));
        }
        return;
      }

      setExportLoading(format);
      try {
        const backendType = getReportBackendType(reportType);
        const virtualFilters = VIRTUAL_REPORT_FILTERS[reportType] || {};

        const payload: Record<string, any> = {
          report_type: backendType,
          output_format: format,
          filters: { ...virtualFilters },
          prepared_for: preparedFor,
          prepared_by: preparedByName,
          note: reportNote,
        };

        for (const [k, v] of Object.entries(filterValues)) {
          if (v === undefined || v === null || v === "") continue;
          if (k === "entity_id") {
            payload.entity_id = Number(v);
          } else {
            payload.filters[k] = v;
          }
        }

        const mime = format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const { data } = await api.post(`/reports/download/${format}`, payload, {
          responseType: "blob",
        });
        downloadBlob(
          data,
          `${reportType}_${Date.now()}.${format}`,
          mime,
        );
      } catch (e: any) {
        setError(await extractErrorMsg(e, "Export failed"));
      } finally {
        setExportLoading(null);
      }
    },
    [rep, reportType, filterValues, previewHtml, preparedFor, preparedByName, reportNote],
  );

  const reportTitle = VIRTUAL_REPORT_TITLES[reportType ?? ""] || rep?.label || "Report";
  const moduleColor = mod?.color ?? "#0E7C66";
  const moduleColorSoft = mod?.colorSoft ?? "#E4F1EE";

  const sidebarContent = (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div className="border-b border-[#E3E6EB] pb-4 mb-2">
          <div className="text-xs font-semibold text-[#172032] uppercase tracking-wider mb-3">Letterhead</div>
          <div className="text-sm font-bold text-[#172032]">{companyName || "Company Name"}</div>
          {companyAddress && <div className="text-[11px] text-[#5B6472] mt-0.5">{companyAddress}</div>}
          {(companyPhone || companyEmail) && (
            <div className="text-[11px] text-[#5B6472]">
              {companyPhone && <span>Tel: {companyPhone}</span>}
              {companyPhone && companyEmail && <span> | </span>}
              {companyEmail && <span>{companyEmail}</span>}
            </div>
          )}
          {companyRegNo && <div className="text-[11px] text-[#5B6472]">Reg: {companyRegNo}</div>}
          <div className="text-[11px] font-mono text-[#0E7C66] mt-1.5">{reportRef}</div>
          <div className="mt-3 space-y-2.5">
            <div>
              <label className="block text-xs font-medium text-[#5B6472] mb-1">Prepared For</label>
              <input
                type="text"
                value={preparedFor}
                onChange={(e) => setPreparedFor(e.target.value)}
                placeholder="Client / recipient name"
                className="w-full h-8 px-3 text-sm bg-white border border-[#E3E6EB] rounded-[7px] text-[#172032] placeholder-[#9AA2B1] focus:outline-none focus:border-[#0E7C66] focus:ring-1 focus:ring-[#0E7C66]/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5B6472] mb-1">Prepared By</label>
              <input
                type="text"
                value={preparedByName}
                readOnly
                className="w-full h-8 px-3 text-sm bg-[#F4F5F7] border border-[#E3E6EB] rounded-[7px] text-[#5B6472]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5B6472] mb-1">Note</label>
              <textarea
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="Optional note for the report"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E3E6EB] rounded-[7px] text-[#172032] placeholder-[#9AA2B1] focus:outline-none focus:border-[#0E7C66] focus:ring-1 focus:ring-[#0E7C66]/20 transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="text-sm text-[#9AA2B1] text-center py-8">
            No filters available for this report
          </div>
        ) : (
          sections.map((sec) => (
            <div key={sec.label}>
              <div className="text-xs font-semibold text-[#172032] uppercase tracking-wider mb-3">
                {sec.label}
              </div>
              <div className="space-y-3.5">
                {sec.fields.map((f) => renderField(f, filterValues[f.key], updateFilter))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex-shrink-0 border-t border-[#E3E6EB] px-5 py-4 space-y-3 bg-white">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full h-10 rounded-[8px] text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
          style={{ backgroundColor: moduleColor }}
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Generating...</>
          ) : (
            "Generate report"
          )}
        </button>

        <div className="pt-2">
          <div className="text-[11px] font-medium text-[#9AA2B1] uppercase tracking-wider mb-2.5 text-center">
            Export
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleExport("print")}
              disabled={!generated}
              className="flex flex-col items-center gap-1 py-2.5 rounded-[8px] border border-[#E3E6EB] hover:border-[#172032] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer size={18} className="text-[#5B6472]" />
              <span className="text-[11px] font-medium text-[#5B6472]">Print</span>
            </button>
            <button
              onClick={() => handleExport("xlsx")}
              disabled={exportLoading === "xlsx"}
              className="flex flex-col items-center gap-1 py-2.5 rounded-[8px] border border-[#E3E6EB] hover:border-[#0E7C66] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exportLoading === "xlsx" ? (
                <Loader2 size={18} className="animate-spin text-[#0E7C66]" />
              ) : (
                <FileSpreadsheet size={18} className="text-[#0E7C66]" />
              )}
              <span className="text-[11px] font-medium text-[#0E7C66]">Excel</span>
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={exportLoading === "pdf"}
              className="flex flex-col items-center gap-1 py-2.5 rounded-[8px] border border-[#E3E6EB] hover:border-[#C0392B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exportLoading === "pdf" ? (
                <Loader2 size={18} className="animate-spin text-[#C0392B]" />
              ) : (
                <FileText size={18} className="text-[#C0392B]" />
              )}
              <span className="text-[11px] font-medium text-[#C0392B]">PDF</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col bg-[#F4F5F7]">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-white border-b border-[#E3E6EB]">
        <button
          onClick={() => navigate(moduleKey ? `/reports/${moduleKey}` : "/reports")}
          className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-[#F4F5F7] transition-colors focus-visible:outline-2 focus-visible:outline-[#0E7C66]"
        >
          <ArrowLeft size={18} className="text-[#5B6472]" />
        </button>
        <div className="flex items-center gap-2 text-sm text-[#5B6472]">
          <button
            onClick={() => navigate("/reports")}
            className="hover:text-[#172032] transition-colors"
          >
            Reports
          </button>
          {mod && (
            <>
              <ChevronRight size={12} className="text-[#9AA2B1]" />
              <span style={{ color: moduleColor }}>{mod.label}</span>
            </>
          )}
          {reportType && (
            <>
              <ChevronRight size={12} className="text-[#9AA2B1]" />
              <span className="text-[#172032] font-medium">{reportTitle}</span>
            </>
          )}
        </div>

        {/* Mobile filter toggle */}
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="ml-auto md:hidden flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-[7px] border border-[#E3E6EB] text-[#5B6472]"
        >
          <Filter size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full text-[10px] font-semibold text-white flex items-center justify-center"
              style={{ backgroundColor: moduleColor }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:flex-col w-[300px] flex-shrink-0 bg-white border-r border-[#E3E6EB]">
          {sidebarContent}
        </aside>

        {/* Mobile filters drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/20" onClick={() => setMobileFiltersOpen(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-[300px] bg-white flex flex-col shadow-xl">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E6EB]">
                <span className="text-sm font-semibold text-[#172032]">Filters</span>
                <button onClick={() => setMobileFiltersOpen(false)} className="p-1 hover:bg-[#F4F5F7] rounded-md">
                  <X size={18} className="text-[#5B6472]" />
                </button>
              </div>
              {sidebarContent}
            </div>
          </div>
        )}

        {/* Preview pane */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!generated ? (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <div>
                <FileText size={48} className="text-[#9AA2B1] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[#172032] font-heading">{reportTitle}</h3>
                <p className="text-sm text-[#5B6472] mt-1 max-w-md">
                  Set your filters and generate the report to see the preview.
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="mt-5 h-10 px-6 rounded-[8px] text-sm font-semibold text-white flex items-center gap-2 mx-auto transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: moduleColor }}
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Generating...</>
                  ) : (
                    "Generate report"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Preview header */}
              <div className="flex-shrink-0 px-6 pt-5 pb-3 bg-white border-b border-[#E3E6EB]">
                <div className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: moduleColor }}>
                  {mod?.label ?? "Module"} &middot; Report
                </div>
                <h2 className="text-xl font-bold text-[#172032] font-heading">{reportTitle}</h2>

                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="text-xs text-[#5B6472]">
                    Generated <span className="font-mono text-[#172032]">{new Date().toLocaleString()}</span>
                  </span>
                  {activeFilterCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-[#5B6472]">
                      <span className="text-[#9AA2B1]">&middot;</span>
                      {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} applied
                    </span>
                  )}
                </div>

                {activeFilterCount > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Object.entries(filterValues).map(([k, v]) => {
                      if (!v || (typeof v === "object" && !v.from && !v.to)) return null;
                      const field = paramFields.find((f) => f.key === k);
                      const label = field?.label ?? k;
                      let display = String(v);
                      if (typeof v === "object" && v.from) {
                        const from = v.from || "—";
                        const to = v.to || "—";
                        display = `${from} – ${to}`;
                      } else if (field?.type === "select" && field.options) {
                        const opt = field.options.find((o) => o.value === v);
                        display = opt?.label ?? v;
                      }
                      return (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: moduleColorSoft, color: moduleColor }}
                        >
                          {label}: {display}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Letterhead overlay in preview */}
              {(preparedFor || preparedByName || reportNote) && (
                <div className="flex-shrink-0 mx-6 mt-4 px-4 py-3 rounded-[7px] border border-[#E3E6EB] bg-white text-xs text-[#5B6472] flex flex-wrap gap-x-6 gap-y-1"
                     style={{borderLeftColor: moduleColor, borderLeftWidth: 3}}>
                  {companyName && <span className="font-semibold text-[#172032]">{companyName}</span>}
                  <span className="font-mono text-[#0E7C66]">{reportRef}</span>
                  {preparedFor && <span><strong>For:</strong> {preparedFor}</span>}
                  {preparedByName && <span><strong>By:</strong> {preparedByName}</span>}
                  {reportNote && <span className="w-full"><strong>Note:</strong> {reportNote}</span>}
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="flex-shrink-0 mx-6 mt-4 px-4 py-3 rounded-[7px] bg-[#FEE2E2] border border-[#FECACA] text-sm text-[#C0392B]">
                  {error}
                </div>
              )}

              {/* HTML preview via iframe for full style isolation */}
              <div className="flex-1 overflow-hidden px-6 py-4 report-viewer">
                <div className="h-full bg-white border border-[#E3E6EB] rounded-[10px] overflow-hidden flex flex-col print-area">
                  <div className="flex-1 overflow-auto" style={{ position: "relative" }}>
                    <div
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: "top center",
                        width: zoom < 1 ? `${100 / zoom}%` : "100%",
                        height: zoom < 1 ? `${100 / zoom}%` : "100%",
                        minHeight: zoom >= 1 ? `${100 / zoom}%` : undefined,
                      }}
                    >
                      <iframe
                        title="Report preview"
                        srcDoc={previewHtml}
                        className="w-full border-0"
                        style={{
                          height: zoom >= 1 ? `${100 / zoom}vh` : "100vh",
                          minHeight: "500px",
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-shrink-0 border-t border-[#E3E6EB] px-6 py-3 flex items-center justify-between text-xs text-[#9AA2B1]">
                    <span>Showing generated report</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F4F5F7] text-[#5B6472] font-bold"
                        title="Zoom out"
                      >&minus;</button>
                      <span className="font-mono text-[#5B6472] min-w-[3em] text-center">{Math.round(zoom * 100)}%</span>
                      <button
                        onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F4F5F7] text-[#5B6472] font-bold"
                        title="Zoom in"
                      >+</button>
                      <span className="mx-1 text-[#E3E6EB]">|</span>
                      <span className="font-mono text-[#5B6472]">{reportType}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
