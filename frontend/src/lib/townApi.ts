import { api } from "./api";

export interface Town { id: number; name: string; [key: string]: any; }
export interface TownFull extends Town { blocks?: BlockWithPlots[]; [key: string]: any; }
export interface Block { id: number; name: string; town_id: number; [key: string]: any; }
export interface BlockWithPlots extends Block { units?: TownUnit[]; [key: string]: any; }
export interface TownUnit { id: number; block_id: number; unit_no: string; type: string; status: string; [key: string]: any; }
export type UnitType = "flat" | "shop" | "plot" | "villa" | "office";
export type UnitCategory = "residential" | "commercial" | "mixed";
export type UnitStatus = "available" | "booked" | "sold" | "rented" | "under_construction";
export const UNIT_TYPE_LABELS: Record<string, string> = { flat: "Flat", shop: "Shop", plot: "Plot", villa: "Villa", office: "Office" };
export const UNIT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: "Available", color: "#10b981" },
  booked: { label: "Booked", color: "#f59e0b" },
  sold: { label: "Sold", color: "#ef4444" },
  rented: { label: "Rented", color: "#3b82f6" },
  under_construction: { label: "Under Construction", color: "#8b5cf6" },
};
export const UNIT_CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  residential: { label: "Residential", color: "#10b981" },
  commercial: { label: "Commercial", color: "#f59e0b" },
  mixed: { label: "Mixed", color: "#8b5cf6" },
};

export const townApi = {
  listTowns: async (): Promise<any[]> => {
    const { data } = await api.get("/towns");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  createTown: async (payload: any): Promise<any> => {
    const { data } = await api.post("/towns", payload);
    return data;
  },
  updateTown: async (id: number, payload: any): Promise<void> => {
    await api.patch(`/towns/${id}`, payload);
  },
  deleteTown: async (id: number): Promise<void> => {
    await api.delete(`/towns/${id}`);
  },
  getTownFull: async (id: number): Promise<any> => {
    const { data } = await api.get(`/towns/${id}/full`);
    return data;
  },
  getFinanceSummary: async (id: number): Promise<any> => {
    const { data } = await api.get(`/towns/${id}/finance`);
    return data;
  },
  listUnits: async (params?: any): Promise<any[]> => {
    const { data } = await api.get("/towns/units/all", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  countUnits: async (params?: any): Promise<number> => {
    const { data } = await api.get("/towns/units/count", { params });
    return typeof data === "number" ? data : data.count ?? 0;
  },
  getUnit: async (id: number): Promise<any> => {
    const { data } = await api.get(`/towns/units/${id}`);
    return data;
  },
  createUnit: async (payload: any): Promise<any> => {
    const { data } = await api.post("/towns/units", payload);
    return data;
  },
  updateUnit: async (id: number, payload: any): Promise<void> => {
    await api.patch(`/towns/units/${id}`, payload);
  },
  deleteUnit: async (id: number): Promise<void> => {
    await api.delete(`/towns/units/${id}`);
  },
  createBlock: async (payload: any): Promise<any> => {
    const { data } = await api.post("/towns/blocks", payload);
    return data;
  },
  updateBlock: async (id: number, payload: any): Promise<void> => {
    await api.patch(`/towns/blocks/${id}`, payload);
  },
  deleteBlock: async (id: number): Promise<void> => {
    await api.delete(`/towns/blocks/${id}`);
  },
};
