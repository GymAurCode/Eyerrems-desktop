import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth";

function isTokenExpired(token: string): boolean {
  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return true;
    const payload = JSON.parse(atob(payloadBase64));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

interface RoleUserGuardProps {
  children: React.ReactNode;
}

export default function RoleUserGuard({ children }: RoleUserGuardProps) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (token && isTokenExpired(token)) {
      useAuthStore.getState().logout();
    }
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  if (isTokenExpired(token)) return <Navigate to="/login" replace />;

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
