import { useEffect, useState } from "react";
import { api } from "../lib/api";

export type ActivityItem = {
  type: "sale" | "property" | "client" | "lead" | "expense";
  title: string;
  amount: number | null;
  timestamp: string;
};

type State = {
  items: ActivityItem[];
  loading: boolean;
  error: string | null;
};

export function useActivity(limit = 8) {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get<ActivityItem[]>("/activity/recent", { params: { limit } })
      .then(({ data }) => {
        if (!cancelled) setState({ items: Array.isArray(data) ? data : [], loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err?.response?.data?.detail ?? "Failed to load activity";
          setState({ items: [], loading: false, error: typeof msg === "string" ? msg : "Failed to load activity" });
        }
      });
    return () => { cancelled = true; };
  }, [limit]);

  return state;
}
