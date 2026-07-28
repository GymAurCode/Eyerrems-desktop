import { usePermissions } from "./usePermissions";

export function useModuleAccessV3(moduleSlug: string) {
  const { can, canAccessModule } = usePermissions();

  const canView = canAccessModule(moduleSlug);
  const canCreate = can(moduleSlug, "*", "add");
  const canEdit = can(moduleSlug, "*", "edit");
  const canDelete = can(moduleSlug, "*", "delete");
  const canExport = can(moduleSlug, "*", "view");
  const canApprove = false;

  return { canView, canCreate, canEdit, canDelete, canExport, canApprove };
}
