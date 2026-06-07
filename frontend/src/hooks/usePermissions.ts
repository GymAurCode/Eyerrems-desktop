import { useAuthStore } from "../store/auth";

interface PermissionActionMap {
  view?: boolean;
  add?: boolean;
  edit?: boolean;
  delete?: boolean;
  [key: string]: boolean | undefined;
}

interface PermissionsMap {
  [moduleOrTab: string]: PermissionActionMap;
}

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  const isAdmin = user?.role === "Admin" || user?.roles?.includes("Admin") || false;
  const permissions: PermissionsMap = (user as any)?.rbac_permissions || {};

  const can = (module: string, action: string = "view", tab: string | null = null): boolean => {
    if (isAdmin) return true;

    const key = tab ? `${module}.${tab}` : module;
    const perm = permissions[key] || permissions[module];

    if (!perm) return false;

    const actionMap: Record<string, string> = {
      view: "view", read: "view",
      add: "add", create: "add",
      edit: "edit", update: "edit",
      delete: "delete", remove: "delete",
    };

    return perm[actionMap[action] || action] === true;
  };

  const canAccessModule = (module: string) => can(module, "view");

  const canAccessTab = (module: string, tab: string) => can(module, "view", tab);

  return { can, canAccessModule, canAccessTab, isAdmin, permissions };
}
