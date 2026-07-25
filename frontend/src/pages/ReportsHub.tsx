import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronRight, FileText } from "lucide-react";
import { MODULES } from "../config/reports";
import type { ModuleDef, ReportDef } from "../config/reports";

function ModuleSection({ mod, onSelect }: { mod: ModuleDef; onSelect: (rep: ReportDef) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-3 h-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: mod.color }}
        />
        <span className="text-sm font-semibold text-[#172032]">{mod.label}</span>
        <span className="text-xs text-[#9AA2B1] ml-1">({mod.reports.length})</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {mod.reports.map((rep) => (
          <button
            key={rep.key}
            onClick={() => onSelect(rep)}
            className="group relative bg-white rounded-[10px] border border-[#E3E6EB] p-4 text-left transition-all duration-200 hover:border-[#B8BCC8] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-[#0E7C66] focus-visible:outline-offset-2"
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[10px]"
              style={{ backgroundColor: mod.color }}
            />
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: mod.colorSoft, color: mod.color }}
              >
                <mod.icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#172032] leading-tight">{rep.label}</div>
                <div className="text-xs text-[#5B6472] mt-1 leading-relaxed line-clamp-2">{rep.description}</div>
              </div>
              <ChevronRight
                size={16}
                className="text-[#9AA2B1] mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              />
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E3E6EB]">
              <span className="text-[11px] text-[#9AA2B1]">Last generated</span>
              <span className="text-[11px] font-mono text-[#5B6472]">—</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReportsHub() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const filteredModules = useMemo(() => {
    const q = search.toLowerCase();
    let modules = MODULES;
    if (activeTab) {
      modules = modules.filter((m) => m.key === activeTab);
    }
    if (q) {
      modules = modules
        .map((m) => ({
          ...m,
          reports: m.reports.filter(
            (r) => r.label.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
          ),
        }))
        .filter((m) => m.reports.length > 0);
    }
    return modules;
  }, [search, activeTab]);

  const handleSelect = (rep: ReportDef) => {
    const mod = MODULES.find((m) => m.reports.some((r) => r.key === rep.key));
    if (mod) {
      navigate(`/reports/${mod.key}/${rep.key}`);
    }
  };

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-[#172032] font-heading">Reports</h1>
            <p className="text-sm text-[#5B6472] mt-1">Generate and manage reports across all modules</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 mt-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA2B1] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-[#E3E6EB] rounded-[7px] text-[#172032] placeholder-[#9AA2B1] focus:outline-none focus:border-[#0E7C66] focus:ring-1 focus:ring-[#0E7C66]/20 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-8 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab(null)}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-[7px] whitespace-nowrap transition-colors ${
              activeTab === null
                ? "bg-[#172032] text-white"
                : "bg-white text-[#5B6472] border border-[#E3E6EB] hover:border-[#B8BCC8]"
            }`}
          >
            All modules
          </button>
          {MODULES.map((mod) => (
            <button
              key={mod.key}
              onClick={() => setActiveTab(mod.key)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-[7px] whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                activeTab === mod.key
                  ? "text-white"
                  : "bg-white text-[#5B6472] border border-[#E3E6EB] hover:border-[#B8BCC8]"
              }`}
              style={
                activeTab === mod.key
                  ? { backgroundColor: mod.color }
                  : {}
              }
            >
              <mod.icon size={14} />
              {mod.label}
            </button>
          ))}
        </div>

        {filteredModules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText size={40} className="text-[#9AA2B1] mb-3" />
            <p className="text-sm text-[#5B6472]">No reports found</p>
            {search && (
              <p className="text-xs text-[#9AA2B1] mt-1">
                Try adjusting your search or filter
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {filteredModules.map((mod) => (
              <ModuleSection key={mod.key} mod={mod} onSelect={handleSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
