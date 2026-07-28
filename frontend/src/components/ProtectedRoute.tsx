import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

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

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
}) => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (!token) return <Navigate to="/login" replace />;

  if (isTokenExpired(token)) {
    useAuthStore.getState().logout();
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-base">
        <div className="text-muted text-sm font-medium animate-pulse">Loading session...</div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
export { ProtectedRoute };
