import { create } from "zustand";
import { api, registerLogoutCallback, getAuthToken, setAuthToken } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type User = {
  id: number;
  email: string;
  full_name: string;
  role: string | null;
  roles: string[];
  permissions: string[];
  approval_status: string;
  status: string;
  is_active: boolean;
  is_approved: boolean;
  // Multi-tenant
  company_id: number | null;
  is_super_admin: boolean;
  features: Record<string, boolean>;
};

type AuthState = {
  token: string | null;
  user: User | null;
  permissions: string[];
  features: Record<string, boolean>;
  companyId: number | null;
  isSuperAdmin: boolean;

  // Bootstrap cache — avoids re-fetching on every route change
  _bootstrapFetchedAt: number | null;

  login: (email: string, password: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  /** Full bootstrap: user + stats + activity + unread count. Cached 30s. */
  bootstrap: () => Promise<BootstrapData | null>;
  logout: () => void;

  // Permission helpers
  hasPermission: (perm: string) => boolean;
  hasAnyPermission: (...perms: string[]) => boolean;
  isAdmin: () => boolean;

  // Feature helpers
  hasFeature: (key: string) => boolean;
};

export type BootstrapData = {
  user: User;
  stats: {
    total_properties: number;
    total_units: number;
    occupied_units: number;
    vacant_units: number;
    active_deals: number;
    income: number;
    expense: number;
  };
  activity: { type: string; title: string; amount: number | null; timestamp: string }[];
  unread_count: number;
  from_cache: boolean;
};

// ── In-memory bootstrap cache (30s TTL, survives route changes) ───────────────
let _bootstrapCache: BootstrapData | null = null;
let _bootstrapCacheAt = 0;
const BOOTSTRAP_TTL_MS = 30_000;

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getAuthToken(),
  user: null,
  permissions: [],
  features: {},
  companyId: null,
  isSuperAdmin: false,
  _bootstrapFetchedAt: null,

  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setAuthToken(data.access_token);
    if (data.company_id != null) {
      try {
        localStorage.setItem("company_id", String(data.company_id));
        sessionStorage.setItem("company_id", String(data.company_id));
      } catch {}
    }
    // Invalidate bootstrap cache on login
    _bootstrapCache = null;
    _bootstrapCacheAt = 0;
    set({
      token: data.access_token,
      companyId: data.company_id ?? null,
      isSuperAdmin: false,
      _bootstrapFetchedAt: null,
    });
    await useAuthStore.getState().fetchMe();
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get("/auth/me");
      set({
        user: data,
        permissions: data.permissions ?? [],
        features: data.features ?? {},
        companyId: data.company_id ?? null,
        isSuperAdmin: false,
      });
    } catch (err: any) {
      if (err.response?.status === 401) {
        get().logout();
      }
      throw err;
    }
  },

  bootstrap: async () => {
    // Return cached data if still fresh
    if (_bootstrapCache && Date.now() - _bootstrapCacheAt < BOOTSTRAP_TTL_MS) {
      return _bootstrapCache;
    }
    try {
      const { data } = await api.get<BootstrapData>("/bootstrap");
      // Hydrate auth state from bootstrap response
      set({
        user: data.user,
        permissions: data.user.permissions ?? [],
        features: data.user.features ?? {},
        companyId: data.user.company_id ?? null,
        isSuperAdmin: false,
        _bootstrapFetchedAt: Date.now(),
      });
      _bootstrapCache = data;
      _bootstrapCacheAt = Date.now();
      return data;
    } catch (err: any) {
      _bootstrapCache = null;
      _bootstrapCacheAt = 0;
      if (err.response?.status === 401) {
        get().logout();
      }
      throw err;
    }
  },

  logout: () => {
    setAuthToken(null);
    try {
      localStorage.removeItem("company_id");
      sessionStorage.removeItem("company_id");
    } catch {}
    _bootstrapCache = null;
    _bootstrapCacheAt = 0;
    set({
      token: null,
      user: null,
      permissions: [],
      features: {},
      companyId: null,
      isSuperAdmin: false,
      _bootstrapFetchedAt: null,
    });
  },

  // ── Permission helpers ──────────────────────────────────────────────────────

  hasPermission: (perm) => {
    const { user, permissions, isSuperAdmin } = get();
    if (isSuperAdmin) return true;
    if (user?.roles?.includes("Admin") || user?.role === "Admin") return true;
    return permissions.includes(perm);
  },

  hasAnyPermission: (...perms) => {
    const { user, permissions, isSuperAdmin } = get();
    if (isSuperAdmin) return true;
    if (user?.roles?.includes("Admin") || user?.role === "Admin") return true;
    return perms.some((p) => permissions.includes(p));
  },

  isAdmin: () => {
    const { user, isSuperAdmin } = get();
    if (isSuperAdmin) return true;
    return user?.roles?.includes("Admin") || user?.role === "Admin" || false;
  },

  // ── Feature helpers ─────────────────────────────────────────────────────────

  hasFeature: (key) => {
    const { features, isSuperAdmin } = get();
    if (isSuperAdmin) return true;          // super-admin sees everything
    if (!(key in features)) return true;    // unknown key → default allow
    return features[key] === true;
  },
}));

registerLogoutCallback(() => {
  useAuthStore.getState().logout();
});
