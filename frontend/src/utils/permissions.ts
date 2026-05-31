export type CompanyPermissions = Record<
  string,
  { enabled: boolean; tabs: Record<string, boolean> }
>;

export function canAccess(
  permissions: CompanyPermissions | null | undefined,
  module: string,
  tab?: string,
): boolean {
  // If permissions not loaded or empty, show everything
  if (!permissions || Object.keys(permissions).length === 0) return true;
  // If module not in permissions at all, show it
  const mod = permissions[module];
  if (!mod) return true;
  // If module is explicitly disabled
  if (!mod.enabled) return false;
  // If checking a tab that's not defined, show it
  if (tab) {
    if (mod.tabs === undefined || mod.tabs[tab] === undefined) return true;
    return mod.tabs[tab];
  }
  return true;
}
