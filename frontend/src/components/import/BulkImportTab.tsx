import { useState } from "react";
import {
  Users, Building2, UserCog, Sparkles, X, Download, Upload,
} from "lucide-react";
import { importApi } from "../../lib/importApi";
import ImportWizard from "./ImportWizard";
import MasterImportWizard from "./MasterImportWizard";

export default function BulkImportTab() {
  const [activeWizardModule, setActiveWizardModule] = useState<string | null>(null);
  const [showMasterWizard, setShowMasterWizard] = useState(false);

  const handleDownloadTemplate = async (moduleKey: string) => {
    try {
      await importApi.downloadTemplate(moduleKey, "xlsx");
    } catch (e) {
      alert("Failed to download template");
    }
  };

  const handleDownloadCombinedTemplate = async () => {
    try {
      await importApi.downloadCombinedTemplate();
    } catch (e) {
      alert("Failed to download combined template");
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-4 space-y-8 animate-slide-up">
      {/* Header Info */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black tracking-tight text-primary">Bulk Data Import</h1>
        <p className="text-xs text-muted max-w-md mx-auto">
          Upload records to EyerREMS or pull system update templates to begin.
        </p>
      </div>

      {/* Grid of 4 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Card 1: Leads */}
        <div
          className="group flex flex-col justify-between p-6 rounded-2xl border transition-all duration-300 hover:border-blue-500/30 hover:shadow-xl"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)", transform: "translateY(0)" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/15 transition-all">
              <Users size={26} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-primary">Import Leads</h2>
              <p className="text-xs text-muted mt-1">Upload CRM leads in bulk</p>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={() => void handleDownloadTemplate("leads")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border text-muted hover:text-primary transition-all"
              style={{ borderColor: "var(--border)" }}
            >
              <Download size={13} />
              Template
            </button>
            <button
              type="button"
              onClick={() => setActiveWizardModule("leads")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-all shadow-md shadow-blue-500/10"
            >
              <Upload size={13} />
              Import File
            </button>
          </div>
        </div>

        {/* Card 2: Properties */}
        <div
          className="group flex flex-col justify-between p-6 rounded-2xl border transition-all duration-300 hover:border-emerald-500/30 hover:shadow-xl"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)", transform: "translateY(0)" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/15 transition-all">
              <Building2 size={26} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-primary">Import Properties</h2>
              <p className="text-xs text-muted mt-1">Upload real estate properties in bulk</p>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={() => void handleDownloadTemplate("properties")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border text-muted hover:text-primary transition-all"
              style={{ borderColor: "var(--border)" }}
            >
              <Download size={13} />
              Template
            </button>
            <button
              type="button"
              onClick={() => setActiveWizardModule("properties")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/10"
            >
              <Upload size={13} />
              Import File
            </button>
          </div>
        </div>

        {/* Card 3: Employees */}
        <div
          className="group flex flex-col justify-between p-6 rounded-2xl border transition-all duration-300 hover:border-purple-500/30 hover:shadow-xl"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)", transform: "translateY(0)" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-purple-500/10 border border-purple-500/20 group-hover:bg-purple-500/15 transition-all">
              <UserCog size={26} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-primary">Import Employees</h2>
              <p className="text-xs text-muted mt-1">Upload staff and employee records</p>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={() => void handleDownloadTemplate("employees")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border text-muted hover:text-primary transition-all"
              style={{ borderColor: "var(--border)" }}
            >
              <Download size={13} />
              Template
            </button>
            <button
              type="button"
              onClick={() => setActiveWizardModule("employees")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition-all shadow-md shadow-purple-500/10"
            >
              <Upload size={13} />
              Import File
            </button>
          </div>
        </div>

        {/* Card 4: Complete Update */}
        <div
          className="group flex flex-col justify-between p-6 rounded-2xl border transition-all duration-300 hover:border-amber-500/30 hover:shadow-xl"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)", transform: "translateY(0)" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 group-hover:bg-amber-500/15 transition-all">
              <Sparkles size={26} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-primary">Complete Update</h2>
              <p className="text-xs text-muted mt-1">Import Leads + Properties + Employees together.</p>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={handleDownloadCombinedTemplate}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border text-muted hover:text-primary transition-all"
              style={{ borderColor: "var(--border)" }}
            >
              <Download size={13} />
              Download Combined Template
            </button>
            <button
              type="button"
              onClick={() => setShowMasterWizard(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-md shadow-amber-500/10"
            >
              <Upload size={13} />
              Upload Files
            </button>
          </div>
        </div>
      </div>

      {/* ── Individual Module Wizard Modal Backdrop ────────────────────────── */}
      {activeWizardModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl animate-scale-up"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            {/* Close Button */}
            <button
              onClick={() => setActiveWizardModule(null)}
              className="absolute top-4 right-4 text-muted hover:text-primary transition-colors p-1"
            >
              <X size={18} />
            </button>
            <ImportWizard defaultModuleKey={activeWizardModule} onClose={() => setActiveWizardModule(null)} />
          </div>
        </div>
      )}

      {/* ── Master System Update Modal Backdrop ────────────────────────────── */}
      {showMasterWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl animate-scale-up"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowMasterWizard(false)}
              className="absolute top-4 right-4 text-muted hover:text-primary transition-colors p-1"
            >
              <X size={18} />
            </button>
            <MasterImportWizard onClose={() => setShowMasterWizard(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
