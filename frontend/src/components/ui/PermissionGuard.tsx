import type { ReactNode } from "react";
import { usePermissions } from "../../hooks/usePermissions";

interface PermissionGuardProps {
  module: string;
  tab?: string | null;
  action?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({
  module,
  tab = null,
  action = "view",
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { can } = usePermissions();

  if (!can(module, action, tab)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
