import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, AlertTriangle, LayoutDashboard, Calendar,
  DollarSign, Users, ShoppingCart, HardHat, Wallet, FileText, BarChart2,
  Shield, Bell, Milestone, Building2, Activity,
} from "lucide-react";
import { constructionApi, Project } from "../../lib/constructionApi";
import ModuleTabs from "../../components/ui/ModuleTabs";

import OverviewTab from "./tabs/OverviewTab";
import PlanningTab from "./tabs/PlanningTab";
import BudgetTab from "./tabs/BudgetTab";
import ResourcesTab from "./tabs/ResourcesTab";
import ProcurementTab from "./tabs/ProcurementTab";
import ExecutionTab from "./tabs/ExecutionTab";
import QualityTab from "./tabs/QualityTab";
import SafetyTab from "./tabs/SafetyTab";
import FinanceTab from "./tabs/FinanceTab";
import DocumentsTab from "./tabs/DocumentsTab";
import TimelineTab from "./tabs/TimelineTab";
import ReportsTab from "./tabs/ReportsTab";
import NotificationsTab from "./tabs/NotificationsTab";

const TABS = [
  { id: "overview",    label: "Overview",    icon: LayoutDashboard },
  { id: "planning",    label: "Planning",    icon: Calendar },
  { id: "budget",      label: "Budget",      icon: DollarSign },
  { id: "resources",   label: "Resources",   icon: Users },
  { id: "procurement", label: "Procurement", icon: ShoppingCart },
  { id: "execution",   label: "Execution",   icon: HardHat },
  { id: "quality",     label: "Quality",     icon: Shield },
  { id: "safety",      label: "Safety",      icon: AlertTriangle },
  { id: "finance",     label: "Finance",     icon: Wallet },
  { id: "documents",   label: "Documents",   icon: FileText },
  { id: "timeline",    label: "Timeline",    icon: Milestone },
  { id: "notifications", label: "Alerts",    icon: Bell },
  { id: "reports",     label: "Reports",     icon: BarChart2 },
] as const;
type TabId = typeof TABS[number]["id"];

const STATUS_COLOR: Record<string, string> = {
  planning: "#6366f1", active: "#10b981", on_hold: "#f59e0b",
  completed: "#3b82f6", cancelled: "#ef4444",
};

function Badge({ label }: { label: string }) {
  const c = STATUS_COLOR[label] ?? "#94a3b8";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: c + "20", color: c }}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await constructionApi.getProject(Number(id));
      setProject(p);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => { load(); };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="p-6">
      <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-xl">
        <AlertTriangle size={14} /> {error}
      </div>
      <button onClick={() => navigate("/construction/projects")}
        className="mt-4 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
        <ArrowLeft size={12} /> Back to projects
      </button>
    </div>
  );
  if (!project) return null;

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewTab project={project} onRefresh={handleRefresh} />;
      case "planning": return <PlanningTab projectId={project.id} onRefresh={handleRefresh} />;
      case "budget": return <BudgetTab projectId={project.id} onRefresh={handleRefresh} />;
      case "resources": return <ResourcesTab projectId={project.id} />;
      case "procurement": return <ProcurementTab projectId={project.id} />;
      case "execution": return <ExecutionTab projectId={project.id} onRefresh={handleRefresh} />;
      case "quality": return <QualityTab projectId={project.id} />;
      case "safety": return <SafetyTab projectId={project.id} />;
      case "finance": return <FinanceTab projectId={project.id} />;
      case "documents": return <DocumentsTab projectId={project.id} />;
      case "timeline": return <TimelineTab projectId={project.id} />;
      case "notifications": return <NotificationsTab projectId={project.id} />;
      case "reports": return <ReportsTab projectId={project.id} />;
      default: return <OverviewTab project={project} onRefresh={handleRefresh} />;
    }
  };

  const pct = project.progress_percentage ?? 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/construction/projects")}
            className="text-muted hover:text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-primary">{project.name}</h1>
              <Badge label={project.status} />
              <Badge label={project.current_phase ?? "planning"} />
            </div>
            <p className="text-xs text-muted mt-0.5">
              {project.project_code && <>#{project.project_code} &middot; </>}
              {project.location} &middot; Started {project.start_date}
              {project.expected_end && <> &middot; Expected {project.expected_end}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Activity size={12} />
            <span>{pct.toFixed(0)}%</span>
          </div>
          <button onClick={() => navigate("/construction/projects/" + project.id + "/view")}
            className="text-[10px] px-2 py-1 rounded-lg text-muted hover:text-primary border border-white/10 hover:border-white/20">
            Read-only
          </button>
        </div>
      </div>

      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{
            width: pct + "%",
            background: pct >= 80
              ? "linear-gradient(90deg,#10b981,#34d399)"
              : pct >= 40
                ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                : "linear-gradient(90deg,#3b82f6,#6366f1)"
          }} />
      </div>

      <ModuleTabs tabs={TABS.map(t => ({ value: t.id, label: t.label }))}
        activeTab={activeTab} onChange={(tab) => setActiveTab(tab as TabId)} />

      <div className="min-h-[400px]">
        {renderTab()}
      </div>
    </div>
  );
}
