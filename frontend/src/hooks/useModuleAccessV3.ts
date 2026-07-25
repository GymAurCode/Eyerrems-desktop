export function useModuleAccessV3(moduleSlug: string) {
  return {
    canView: true, canCreate: true, canEdit: true,
    canDelete: true, canExport: true, canApprove: true,
  };
}
