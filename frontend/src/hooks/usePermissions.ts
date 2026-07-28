import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthStore } from "../store/auth";
import { checkPermissions, type PermissionCheckResult } from "../lib/rbacApi";

type PermMap = Record<string, Record<string, Record<string, boolean>>>;

let _cachedPerms: { data: PermissionCheckResult; at: number; token: string } | null = null;
const CACHE_TTL = 10_000;

export function usePermissions() {
  const token = useAuthStore((s) => s.token);
  const storeIsSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const prevTokenRef = useRef<string | null>(null);

  if (token !== prevTokenRef.current) {
    prevTokenRef.current = token;
    if (_cachedPerms && _cachedPerms.token !== token) {
      _cachedPerms = null;
    }
  }

  const [perms, setPerms] = useState<PermissionCheckResult | null>(() => {
    if (_cachedPerms && _cachedPerms.token === token && Date.now() - _cachedPerms.at < CACHE_TTL) {
      return _cachedPerms.data;
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (!token) return false;
    if (_cachedPerms && _cachedPerms.token === token && Date.now() - _cachedPerms.at < CACHE_TTL) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setPerms(null);
      return;
    }
    if (_cachedPerms && _cachedPerms.token === token && Date.now() - _cachedPerms.at < CACHE_TTL) {
      setPerms(_cachedPerms.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    checkPermissions()
      .then((data) => {
        _cachedPerms = { data, at: Date.now(), token };
        setPerms(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        if (storeIsSuperAdmin && token) {
          const fallback: PermissionCheckResult = {
            is_super_admin: true,
            permissions: { "*": { "*": { view: true, add: true, edit: true, delete: true } } },
          };
          _cachedPerms = { data: fallback, at: Date.now(), token };
          setPerms(fallback);
        }
      });
  }, [token, storeIsSuperAdmin]);

  const permissionMap: PermMap = perms?.permissions ?? {};
  const isSuperAdmin = perms?.is_super_admin ?? storeIsSuperAdmin;

  function hasFullAccess(): boolean {
    return isSuperAdmin || !!permissionMap["*"];
  }

  function can(moduleKeyOrPerm: string, tabKey?: string, action?: string): boolean {
    if (hasFullAccess()) return true;

    if (tabKey === undefined && action === undefined) {
      const parts = moduleKeyOrPerm.split(/[.:]/);
      if (parts.length === 2) {
        const [mod, act] = parts;
        const modulePerms = permissionMap[mod];
        if (!modulePerms) return false;
        if (act === "manage") {
          return Object.values(modulePerms).some((t) => t.view || t.add || t.edit || t.delete);
        }
        return Object.values(modulePerms).some((t) => t[act]);
      }
      if (parts.length === 1) {
        return !!permissionMap[parts[0]];
      }
      return false;
    }

    if (!tabKey || !action) return false;

    const tabPerms = permissionMap[moduleKeyOrPerm]?.[tabKey];
    if (tabPerms?.[action]) return true;

    const wildcardPerms = permissionMap[moduleKeyOrPerm]?.["*"];
    if (wildcardPerms?.[action]) return true;

    return false;
  }

  function canAny(moduleKey: string, tabKey: string, ...actions: string[]): boolean {
    return actions.some((a) => can(moduleKey, tabKey, a));
  }

  function canAll(moduleKey: string, tabKey: string, ...actions: string[]): boolean {
    return actions.every((a) => can(moduleKey, tabKey, a));
  }

  function canAccessModule(moduleKey: string): boolean {
    if (hasFullAccess()) return true;
    const modulePerms = permissionMap[moduleKey];
    if (!modulePerms) return false;
    if (modulePerms["*"]?.view) return true;
    return Object.values(modulePerms).some((tab) => tab.view);
  }

  function canAccessTab(moduleKey: string, tabKey: string): boolean {
    if (hasFullAccess()) return true;
    if (permissionMap[moduleKey]?.[tabKey]?.view) return true;
    if (permissionMap[moduleKey]?.["*"]?.view) return true;
    return false;
  }

  function hasRole(roleName: string): boolean {
    return false;
  }

  const canView = useCallback((moduleKey: string, tabKey?: string) =>
    can(moduleKey, tabKey ?? "*", "view"), [can]);

  const canAdd = useCallback((moduleKey: string, tabKey?: string) =>
    can(moduleKey, tabKey ?? "*", "add"), [can]);

  const canEdit = useCallback((moduleKey: string, tabKey?: string) =>
    can(moduleKey, tabKey ?? "*", "edit"), [can]);

  const canDelete = useCallback((moduleKey: string, tabKey?: string) =>
    can(moduleKey, tabKey ?? "*", "delete"), [can]);

  const refresh = useCallback(() => {
    const t = token;
    if (!t) return;
    _cachedPerms = null;
    setLoading(true);
    checkPermissions()
      .then((data) => {
        _cachedPerms = { data, at: Date.now(), token: t };
        setPerms(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [token]);

  return {
    can,
    canAny,
    canAll,
    canView,
    canAdd,
    canEdit,
    canDelete,
    hasRole,
    canAccessModule,
    canAccessTab,
    isSuperAdmin,
    permissions: permissionMap,
    roleId: perms?.role_id ?? null,
    refresh,
    loading,
  };
}
