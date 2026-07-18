import { api } from "./api";

export interface LookupValue {
  id: number;
  category: string;
  label: string;
  value: string;
  [key: string]: any;
}

export interface SeedPreviewItem {
  category: string;
  label: string;
  value: string;
  sort_order: number;
  is_default: boolean;
}

export const lookupApi = {
  getByCategory: async (category: string): Promise<LookupValue[]> => {
    const { data } = await api.get(`/lookups/${category}`);
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  getAll: async (includeUsage = false): Promise<Record<string, LookupValue[]>> => {
    const { data } = await api.get("/lookups", { params: { include_usage: includeUsage || undefined } });
    return data ?? {};
  },
  create: async (payload: any): Promise<LookupValue> => {
    const { data } = await api.post("/lookups", payload);
    return data;
  },
  update: async (id: number, payload: any): Promise<void> => {
    await api.patch(`/lookups/${id}`, payload);
  },
  remove: async (id: number): Promise<void> => {
    await api.delete(`/lookups/${id}`);
  },
  seedDefaults: async (): Promise<{ inserted: number; message: string }> => {
    const { data } = await api.post("/lookups/seed-defaults");
    return data;
  },
  getSeedDefaults: async (): Promise<SeedPreviewItem[]> => {
    const { data } = await api.get("/lookups/seed-defaults");
    return Array.isArray(data) ? data : [];
  },
};
