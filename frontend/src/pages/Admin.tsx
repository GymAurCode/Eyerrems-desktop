import { useState } from "react";
import { Info, Shield, Users, Clock } from "lucide-react";
import ModuleTabs from "../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../config/moduleColors";
import DetailTab from "../modules/Admin/tabs/DetailTab";
import RolesTab from "../modules/Admin/tabs/RolesTab";
import UsersTab from "../modules/Admin/tabs/UsersTab";
import AuditLogsTab from "../modules/Admin/tabs/AuditLogsTab";
import { usePermissions } from "../hooks/usePermissions";

const ALL_TABS = [
  { key: "detail", label: "Detail", icon: Info },
  { key: "roles", label: "Roles", icon: Shield },
  { key: "users", label: "Users", icon: Users },
  { key: "audit-logs", label: "Audit Logs", icon: Clock },
] as const;

type TabKey = typeof ALL_TABS[number]["key"];

export default function AdminPage() {
  const [tab, setTab] = useState<TabKey>("detail");
  const { canAccessModule } = usePermissions();

  const visibleTabs = ALL_TABS.filter((t) => {
    if (t.key === "detail") return true;
    return canAccessModule("admin");
  });

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold text-primary">Administration</h1>
        <p className="text-xs text-muted mt-0.5">Manage company details, roles, users, and view audit logs</p>
      </div>

      <ModuleTabs
        tabs={visibleTabs.map((t) => ({ label: t.label, value: t.key, icon: t.icon }))}
        activeTab={tab}
        onChange={(v) => setTab(v as TabKey)}
        moduleColor={MODULE_COLORS.admin.primary}
      />

      {tab === "detail" && <DetailTab />}
      {tab === "roles" && <RolesTab />}
      {tab === "users" && <UsersTab />}
      {tab === "audit-logs" && <AuditLogsTab />}
    </div>
  );
}
