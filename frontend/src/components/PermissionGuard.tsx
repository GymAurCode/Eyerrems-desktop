/**
 * PermissionGuard — conditionally render children if user has permission.
 *
 * Usage:
 *   <PermissionGuard permission="hr.create">
 *     <button>Add Employee</button>
 *   </PermissionGuard>
 *
 *   // Require any of multiple permissions:
 *   <PermissionGuard anyOf={["finance.view", "finance.create"]}>
 *     ...
 *   </PermissionGuard>
 */
import { ReactNode } from "react";
import { useAuthStore } from "../store/auth";

type Props = {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
};

export default function PermissionGuard({
  permission,
  anyOf,
  children,
  fallback = null,
}: Props) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  let allowed = true;

  if (permission) {
    allowed = hasPermission(permission);
  } else if (anyOf && anyOf.length > 0) {
    allowed = hasAnyPermission(...anyOf);
  }

  return allowed ? <>{children}</> : <>{fallback}</>;
}
