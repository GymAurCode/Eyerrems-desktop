import { create } from "zustand";
import { crmApi, CrmDashboardData } from "../lib/crmApi";

type CrmDashboardState = {
  data: CrmDashboardData | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
};

export const useCrmDashboardStore = create<CrmDashboardState>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const data = await crmApi.getDashboard();
      set({ data, loading: false });
    } catch (e: any) {
      set({ error: e?.message || "Failed to load dashboard", loading: false });
    }
  },
}));
