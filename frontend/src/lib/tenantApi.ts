import { api } from "./api";

export interface Tenant { id: number; [key: string]: any; }
export interface TenantDetail extends Tenant { [key: string]: any; }
export interface TenantDashboard { [key: string]: any; }
export interface TenantAlert { [key: string]: any; }
export interface Maintenance { id: number; [key: string]: any; }
export interface MaintenanceAnalytics { [key: string]: any; }
export interface UnitTenantInfo { [key: string]: any; }
export interface RentRecord { id: number; [key: string]: any; }
export interface TenantLease { id: number; [key: string]: any; }
export interface WizardPayload { [key: string]: any; }

export const tenantApi = {
  list: async (params?: any): Promise<Tenant[]> => {
    const { data } = await api.get("/tenants/", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  get: async (id: number): Promise<TenantDetail> => {
    const { data } = await api.get(`/tenants/${id}`);
    return data;
  },
  create: async (payload: any): Promise<Tenant> => {
    const { data } = await api.post("/tenants/wizard", payload);
    return data;
  },
  dashboard: async (): Promise<TenantDashboard> => {
    const { data } = await api.get("/tenants/dashboard");
    return data;
  },
  alerts: async (): Promise<TenantAlert[]> => {
    const { data } = await api.get("/tenants/alerts");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  recordPayment: async (payload: any): Promise<void> => {
    await api.post("/tenants/payments", payload);
  },
  increaseRent: async (tenantId: number, leaseId: number, payload: any): Promise<void> => {
    await api.post(`/tenants/${tenantId}/leases/${leaseId}/increase-rent`, payload);
  },
  endLease: async (tenantId: number, leaseId: number): Promise<void> => {
    await api.post(`/tenants/${tenantId}/leases/${leaseId}/end`);
  },
  getUnitTenant: async (unitId: number): Promise<UnitTenantInfo> => {
    const { data } = await api.get("/tenants/maintenance/unit-tenant", { params: { unit_id: unitId } });
    return data;
  },
  remove: async (id: number): Promise<void> => {
    await api.delete(`/tenants/${id}`);
  },
  listMaintenance: async (params?: any): Promise<Maintenance[]> => {
    const { data } = await api.get("/tenants/maintenance/all", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  getMaintenance: async (id: number): Promise<Maintenance> => {
    const { data } = await api.get(`/tenants/maintenance/${id}`);
    return data;
  },
  createMaintenance: async (payload: any): Promise<Maintenance> => {
    const { data } = await api.post("/tenants/maintenance", payload);
    return data;
  },
  updateMaintenance: async (id: number, payload: any): Promise<Maintenance> => {
    const { data } = await api.patch(`/tenants/maintenance/${id}`, payload);
    return data;
  },
  deleteMaintenance: async (id: number): Promise<void> => {
    await api.delete(`/tenants/maintenance/${id}`);
  },
  maintenanceAnalytics: async (): Promise<MaintenanceAnalytics> => {
    const { data } = await api.get("/tenants/maintenance/analytics");
    return data;
  },
};
