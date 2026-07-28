import type { ReactNode } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import AccessDeniedPage from "../../pages/AccessDenied";

const ModuleLoadingSpinner = () => (
  <div className="flex h-40 items-center justify-center">
    <div
      className="w-6 h-6 border-2 rounded-full animate-spin"
      style={{ borderColor: "var(--border)", borderTopColor: "var(--accent-primary)" }}
    />
  </div>
);

interface ModuleGuardProps {
  module: string;
  tabKey?: string;
  action?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export default function ModuleGuard({ module: moduleKey, tabKey, action, fallback, children }: ModuleGuardProps) {
  const { can, canAccessModule, loading } = usePermissions();

  if (loading) {
    return <ModuleLoadingSpinner />;
  }

  if (!canAccessModule(moduleKey)) {
    return fallback ?? <AccessDeniedPage />;
  }

  if (tabKey && action && !can(moduleKey, tabKey, action)) {
    return fallback ?? <AccessDeniedPage />;
  }

  return <>{children}</>;
}
