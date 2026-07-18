import { create } from "zustand";
import { api } from "../lib/api";

export type DashboardData = {
  total_properties: number;
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  active_deals: number;
  income: number;
  expense: number;
};

type DashboardState = {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  loading: true,
  error: null,
  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<DashboardData>("/dashboard/stats");
      set({ data, loading: false });
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "Failed to load dashboard stats";
      set({ error: typeof msg === "string" ? msg : "Failed to load dashboard stats", loading: false });
    }
  }
}));
