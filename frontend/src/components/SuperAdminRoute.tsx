/**
 * SuperAdminRoute — only allows is_super_admin users.
 * Regular users are redirected to "/" (company dashboard).
 */
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";

export default function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const token        = useAuthStore((s) => s.token);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const user         = useAuthStore((s) => s.user);

  if (!token) return <Navigate to="/login" replace />;

  // User loaded but not super-admin → kick to company dashboard
  if (user && !isSuperAdmin) return <Navigate to="/" replace />;

  // Token exists but user not yet loaded → render children (fetchMe in progress)
  return <>{children}</>;
}
