import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Activity } from "lucide-react";
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
  { id: "overview", label: "Overview" },
  { id: "planning", label: "Planning" },
  { id: "budget", label: "Budget" },
  { id: "resources", label: "Resources" },
  { id: "procurement", label: "Procurement" },
  { id: "execution", label: "Execution" },
  { id: "quality", label: "Quality" },
  { id: "safety", label: "Safety" },
  { id: "finance", label: "Finance" },
  { id: "documents", label: "Documents" },
  { id: "timeline", label: "Timeline" },
  { id: "notifications", label: "Alerts" },
  { id: "reports", label: "Reports" },
] as const;
type TabId = typeof TABS[number]["id"];

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    constructionApi.getProject(Number(id))
      .then(setProject)
      .catch((e) => setError(e?.response?.data?.detail ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error || !project) return (
    <div className="p-6">
      <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-xl">
        <AlertTriangle size={14} /> {error || "Project not found"}
      </div>
      <button onClick={() => navigate("/construction/projects")}
        className="mt-4 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
        <ArrowLeft size={12} /> Back
      </button>
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewTab project={project} onRefresh={() => {}} />;
      case "planning": return <PlanningTab projectId={project.id} onRefresh={() => {}} />;
      case "budget": return <BudgetTab projectId={project.id} onRefresh={() => {}} />;
      case "resources": return <ResourcesTab projectId={project.id} />;
      case "procurement": return <ProcurementTab projectId={project.id} />;
      case "execution": return <ExecutionTab projectId={project.id} onRefresh={() => {}} />;
      case "quality": return <QualityTab projectId={project.id} />;
      case "safety": return <SafetyTab projectId={project.id} />;
      case "finance": return <FinanceTab projectId={project.id} />;
      case "documents": return <DocumentsTab projectId={project.id} />;
      case "timeline": return <TimelineTab projectId={project.id} />;
      case "notifications": return <NotificationsTab projectId={project.id} />;
      case "reports": return <ReportsTab projectId={project.id} />;
      default: return <OverviewTab project={project} onRefresh={() => {}} />;
    }
  };

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
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-500/20 text-blue-400">Read Only</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Activity size={12} />
          <span>{(project.progress_percentage ?? 0).toFixed(0)}%</span>
        </div>
      </div>
      <ModuleTabs tabs={TABS.map(t => ({ value: t.id, label: t.label }))} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as TabId)} />
      <div className="min-h-[400px]">{renderTab()}</div>
    </div>
  );
}
