export function usePermissions() {
  const can = () => true;
  const canAny = () => true;
  const canAll = () => true;
  const hasRole = () => true;
  const canAccessModule = () => true;
  const canAccessTab = () => true;
  const isAdmin = true;

  return { can, canAny, canAll, hasRole, canAccessModule, canAccessTab, isAdmin, permissions: ["*"], roles: ["Admin"] };
}
