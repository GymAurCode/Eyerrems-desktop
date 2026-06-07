import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth";

interface RoleUserGuardProps {
  children: React.ReactNode;
}

export default function RoleUserGuard({ children }: RoleUserGuardProps) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (!token) return <Navigate to="/login" replace />;

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-base">
        <div className="text-muted text-sm font-medium animate-pulse">Loading session...</div>
      </div>
    );
  }

  const isRoleUser = (user as any)?.user_type === "role_user";
  if (!isRoleUser) return <>{children}</>;

  const slugLocked = (user as any)?.slug_locked !== false;
  const mustChangePassword = (user as any)?.must_change_password === true;

  if (!slugLocked) return <Navigate to="/setup-slug" replace />;

  if (mustChangePassword) return <Navigate to="/change-password" replace />;

  return <>{children}</>;
}
