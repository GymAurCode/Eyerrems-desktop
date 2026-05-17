import { create } from "zustand";
import { api } from "../lib/api";

type DashboardData = {
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
  fetchStats: () => Promise<void>;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  fetchStats: async () => {
    const { data } = await api.get("/dashboard/stats");
    set({ data });
  }
}));
