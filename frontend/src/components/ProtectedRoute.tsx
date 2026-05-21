import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  // Legacy role-based props (backward compatible)
  allowedRoles?: string[];
  // New permission-based props (for future use)
  permission?: string;
  anyPermissions?: string[];
  allPermissions?: string[];
  fallback?: React.ReactNode;
  redirectTo?: string;
}

/**
 * ProtectedRoute - Renders children only if user is authenticated and authorized
 * 
 * Supports both legacy role-based and new permission-based authorization:
 * 
 * Legacy (role-based):
 * <ProtectedRoute allowedRoles={["Admin", "Manager"]}>
 *   <HRPage />
 * </ProtectedRoute>
 * 
 * New (permission-based - for future use):
 * <ProtectedRoute permission="hr.view">
 *   <HRPage />
 * </ProtectedRoute>
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  permission,
  anyPermissions,
  allPermissions,
  fallback = null,
  redirectTo = '/login',
}) => {
  const token        = useAuthStore((s) => s.token);
  const user         = useAuthStore((s) => s.user);

  // Not authenticated
  if (!token) return <Navigate to="/login" replace />;

  // Token exists but user not yet loaded → show loading spinner
  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#07090e]">
        <div className="text-slate-400 text-sm font-medium animate-pulse">Loading session...</div>
      </div>
    );
  }

  // If no authorization rules specified, just check authentication
  if (!allowedRoles && !permission && !anyPermissions && !allPermissions) {
    return <>{children}</>;
  }

  // Legacy role-based authorization
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role;
    const userRoles = user?.roles ?? [];
    const hasRole = userRole
      ? allowedRoles.includes(userRole) || userRoles.some((r) => allowedRoles.includes(r))
      : false;
    if (!hasRole) {
      if (redirectTo) return <Navigate to={redirectTo} replace />;
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};

// Default export for backward compatibility
export default ProtectedRoute;

// Named exports for future use
export { ProtectedRoute };

interface PermissionGateProps {
  children: React.ReactNode;
  permission?: string;
  anyPermissions?: string[];
  allPermissions?: string[];
  fallback?: React.ReactNode;
}

/**
 * PermissionGate - Conditionally renders children based on permissions
 * Does not redirect, just hides/shows content
 * 
 * Usage (when PermissionProvider is set up):
 * <PermissionGate permission="hr.create">
 *   <button>Add Employee</button>
 * </PermissionGate>
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  permission,
  anyPermissions,
  allPermissions,
  fallback = null,
}) => {
  // TODO: Integrate with PermissionContext when ready
  // For now, show all content
  // Uncomment below when PermissionProvider is set up:
  /*
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions();

  if (loading) {
    return null;
  }

  let hasAccess = true;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (anyPermissions && anyPermissions.length > 0) {
    hasAccess = hasAnyPermission(...anyPermissions);
  } else if (allPermissions && allPermissions.length > 0) {
    hasAccess = hasAllPermissions(...allPermissions);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
  */
  
  return <>{children}</>;
};

/**
 * RequirePermission - Shows access denied message if permission not met
 * 
 * Usage (when PermissionProvider is set up):
 * <RequirePermission permission="hr.view">
 *   <HRContent />
 * </RequirePermission>
 */
export const RequirePermission: React.FC<{
  permission: string;
  children: React.ReactNode;
}> = ({ permission, children }) => {
  // TODO: Integrate with PermissionContext when ready
  // For now, show all content
  // Uncomment below when PermissionProvider is set up:
  /*
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You don't have permission to access this resource.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Required permission: <code className="bg-gray-100 px-2 py-1 rounded">{permission}</code>
          </p>
        </div>
      </div>
    );
  }
  */

  return <>{children}</>;
};
