import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface PermissionContextType {
  permissions: string[];
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasAllPermissions: (...permissions: string[]) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      const response = await api.get('/auth/me/permissions');

      if (response.status === 200) {
        const data = response.data;
        setPermissions(data);
        // Cache permissions
        localStorage.setItem('permissions', JSON.stringify(data));
      } else {
        setPermissions([]);
        localStorage.removeItem('permissions');
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load cached permissions immediately
    const cached = localStorage.getItem('permissions');
    if (cached) {
      try {
        setPermissions(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse cached permissions');
      }
    }

    // Fetch fresh permissions
    fetchPermissions();
  }, []);

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (...perms: string[]): boolean => {
    return perms.some(p => permissions.includes(p));
  };

  const hasAllPermissions = (...perms: string[]): boolean => {
    return perms.every(p => permissions.includes(p));
  };

  const refreshPermissions = async () => {
    setLoading(true);
    await fetchPermissions();
  };

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        loading,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = (): PermissionContextType => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

// Convenience hook for checking a single permission
export const useHasPermission = (permission: string): boolean => {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
};

// Convenience hook for checking multiple permissions (OR logic)
export const useHasAnyPermission = (...permissions: string[]): boolean => {
  const { hasAnyPermission } = usePermissions();
  return hasAnyPermission(...permissions);
};

// Convenience hook for checking multiple permissions (AND logic)
export const useHasAllPermissions = (...permissions: string[]): boolean => {
  const { hasAllPermissions } = usePermissions();
  return hasAllPermissions(...permissions);
};
