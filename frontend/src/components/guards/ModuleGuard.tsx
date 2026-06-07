import { usePermissions } from "../../hooks/usePermissions";
import AccessDeniedPage from "../../pages/AccessDenied";

interface ModuleGuardProps {
  module: string;
  children: React.ReactNode;
}

export default function ModuleGuard({ module, children }: ModuleGuardProps) {
  const { canAccessModule } = usePermissions();

  if (!canAccessModule(module)) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
}
