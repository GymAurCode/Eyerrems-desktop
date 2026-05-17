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

  // Token exists but user not yet loaded → show loading spinner
  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0f1d]">
        <div className="text-slate-400 text-sm font-medium animate-pulse">Loading session...</div>
      </div>
    );
  }

  // User loaded but not super-admin → kick to company dashboard
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
