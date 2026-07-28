import { api } from "./api";

export interface Role {
  id: number;
  company_id: number;
  name: string;
  description: string | null;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
  user_count: number;
}

export interface PermissionEntry {
  id?: number;
  role_id?: number;
  module_key: string;
  tab_key: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface CompanyUser {
  id: number;
  email: string;
  full_name: string;
  role_id: number | null;
  role_name: string | null;
  status: string;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
  last_login: string | null;
}

export interface AuditLogPage {
  total: number;
  page: number;
  per_page: number;
  logs: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  username: string | null;
  full_name: string | null;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  description: string | null;
  old_data: unknown;
  new_data: unknown;
  diff: unknown;
  ip_address: string | null;
  created_at: string;
}

export interface ModuleConfig {
  key: string;
  label: string;
  tabs: string[];
}

export interface PermissionCheckResult {
  is_super_admin: boolean;
  user_id?: number;
  role_id?: number | null;
  permissions: Record<string, Record<string, Record<string, boolean>>>;
}

// Roles
export async function fetchRoles(): Promise<Role[]> {
  const { data } = await api.get("/rbac/roles");
  return data;
}

export async function createRole(name: string, description?: string): Promise<Role> {
  const { data } = await api.post("/rbac/roles", { name, description });
  return data;
}

export async function updateRole(id: number, body: { name?: string; description?: string }): Promise<Role> {
  const { data } = await api.put(`/rbac/roles/${id}`, body);
  return data;
}

export async function deleteRole(id: number): Promise<void> {
  await api.delete(`/rbac/roles/${id}`);
}

// Permissions
export async function fetchPermissions(roleId: number): Promise<PermissionEntry[]> {
  const { data } = await api.get(`/rbac/roles/${roleId}/permissions`);
  return data;
}

export async function updatePermissions(roleId: number, permissions: { permissions: PermissionEntry[] }): Promise<void> {
  console.log("[rbacApi] updatePermissions: roleId=%s, count=%s, payload=%s", roleId, permissions.permissions.length, JSON.stringify(permissions.permissions));
  const { data } = await api.put(`/rbac/roles/${roleId}/permissions`, permissions);
  console.log("[rbacApi] updatePermissions response:", data);
}

// Users
export async function fetchCompanyUsers(params?: {
  search?: string;
  status?: string;
  role_id?: number;
  skip?: number;
  limit?: number;
}): Promise<CompanyUser[]> {
  const { data } = await api.get("/rbac/users", { params });
  return data;
}

export async function createCompanyUser(body: {
  email: string;
  full_name: string;
  password: string;
  role_id?: number | null;
  is_active?: boolean;
}): Promise<CompanyUser> {
  const { data } = await api.post("/rbac/users", body);
  return data;
}

export async function updateCompanyUser(
  id: number,
  body: { full_name?: string; email?: string; password?: string; role_id?: number | null; is_active?: boolean }
): Promise<CompanyUser> {
  const { data } = await api.put(`/rbac/users/${id}`, body);
  return data;
}

export async function deleteCompanyUser(id: number): Promise<void> {
  await api.delete(`/rbac/users/${id}`);
}

export async function toggleUserStatus(id: number): Promise<{ ok: boolean; is_active: boolean; message: string }> {
  const { data } = await api.post(`/rbac/users/${id}/toggle-status`);
  return data;
}

// Audit Logs
export async function fetchAuditLogs(params: {
  page?: number;
  per_page?: number;
  module?: string;
  action?: string;
  user_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
}): Promise<AuditLogPage> {
  const { data } = await api.get("/rbac/audit-logs", { params });
  return data;
}

// Module Config
export async function fetchModuleConfig(): Promise<ModuleConfig[]> {
  const { data } = await api.get("/rbac/module-config");
  return data;
}

// Permission Check
export async function checkPermissions(): Promise<PermissionCheckResult> {
  const { data } = await api.get("/rbac/check-permissions");
  return data;
}
