import { create } from "zustand";
import { api, registerLogoutCallback, getAuthToken, setAuthToken, setAuthReady, isTokenExpired } from "../lib/api";

export type User = {
  id: number | string;
  email: string;
  full_name: string;
  role: string | null;
  role_name: string | null;
  role_id: number | null;
  approval_status: string;
  status: string;
  is_active: boolean;
  is_approved: boolean;
  company_id: number | null;
  is_super_admin: boolean;
  features: Record<string, boolean>;
};

type AuthState = {
  token: string | null;
  user: User | null;
  features: Record<string, boolean>;
  companyId: number | null;
  isSuperAdmin: boolean;
  companyPermissions: Record<string, { enabled: boolean; tabs: Record<string, boolean> }> | null;

  _bootstrapFetchedAt: number | null;

  login: (email: string, password: string) => Promise<void>;
  loginSuperAdmin: (email: string, password: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  bootstrap: () => Promise<BootstrapData | null>;
  logout: () => void;

  hasPermission: (perm: string) => boolean;
  hasAnyPermission: (...perms: string[]) => boolean;
  isAdmin: () => boolean;

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
  permissions: Record<string, { enabled: boolean; tabs: Record<string, boolean> }>;
  from_cache: boolean;
};

let _bootstrapCache: BootstrapData | null = null;
let _bootstrapCacheAt = 0;
const BOOTSTRAP_TTL_MS = 30_000;

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getAuthToken(),
  user: null,
  features: {},
  companyId: null,
  isSuperAdmin: false,
  companyPermissions: null,
  _bootstrapFetchedAt: null,

    login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setAuthToken(data.access_token);
    const isSuperAdmin = data.is_super_admin ?? false;
    if (data.company_id != null) {
      try {
        localStorage.setItem("company_id", String(data.company_id));
        sessionStorage.setItem("company_id", String(data.company_id));
      } catch {}
    } else {
      try {
        localStorage.removeItem("company_id");
        sessionStorage.removeItem("company_id");
      } catch {}
    }
    _bootstrapCache = null;
    _bootstrapCacheAt = 0;
    set({
      token: data.access_token,
      companyId: data.company_id ?? null,
      isSuperAdmin,
      _bootstrapFetchedAt: null,
    });
    // Update user partial with role info from login response
    const existingUser = get().user;
    if (data.role_name || data.role_id) {
      set({
        user: {
          ...(existingUser || { id: 0, email, full_name: '', status: 'active', is_approved: true, is_active: true, approval_status: 'approved', features: {} }),
          role_name: data.role_name ?? null,
          role_id: data.role_id ?? null,
          role: data.role_name ?? null,
        },
      });
    }
  },
  loginSuperAdmin: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setAuthToken(data.access_token);
    try {
      localStorage.removeItem("company_id");
      sessionStorage.removeItem("company_id");
    } catch {}
    _bootstrapCache = null;
    _bootstrapCacheAt = 0;
    set({
      token: data.access_token,
      companyId: null,
      isSuperAdmin: true,
      _bootstrapFetchedAt: null,
    });
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get("/auth/me");
      const roleName = data.role_name ?? data.role ?? null;
      set({
        user: { ...data, role: roleName, role_name: roleName },
        features: data.features ?? {},
        companyId: data.company_id ?? null,
        isSuperAdmin: data.is_super_admin ?? false,
      });
    } catch (err: any) {
      if (err.response?.status === 401) {
        get().logout();
      }
      throw err;
    }
  },

  bootstrap: async () => {
    if (_bootstrapCache && Date.now() - _bootstrapCacheAt < BOOTSTRAP_TTL_MS) {
      return _bootstrapCache;
    }
    try {
      const { data } = await api.get<BootstrapData>("/bootstrap");
      const userData = data.user;
      const isSuperAdmin = userData.is_super_admin ?? false;
      const roleName = userData.role_name ?? userData.role ?? null;
      set({
        user: { ...userData, role: roleName, role_name: roleName },
        features: userData.features ?? {},
        companyId: userData.company_id ?? null,
        isSuperAdmin,
        companyPermissions: data.permissions ?? null,
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
    const tok = getAuthToken();
    if (tok && !isTokenExpired(tok)) {
      api.post("/auth/logout").catch(() => {});
    }
    setAuthToken(null);
    setAuthReady(false);
    try {
      localStorage.removeItem("company_id");
      sessionStorage.removeItem("company_id");
    } catch {}
    _bootstrapCache = null;
    _bootstrapCacheAt = 0;
    set({
      token: null,
      user: null,
      features: {},
      companyId: null,
      isSuperAdmin: false,
      _bootstrapFetchedAt: null,
    });
  },

  hasPermission: (perm: string) => {
    const state = get();
    if (state.isSuperAdmin) return true;
    return true; // Overridden by usePermissions hook
  },
  hasAnyPermission: (...perms: string[]) => {
    return perms.some((p) => get().hasPermission(p));
  },

  isAdmin: () => {
    const { isSuperAdmin } = get();
    return isSuperAdmin;
  },

  hasFeature: (key) => {
    const { features, isSuperAdmin } = get();
    if (isSuperAdmin) return true;
    if (!(key in features)) return true;
    return features[key] === true;
  },
}));

registerLogoutCallback(() => {
  useAuthStore.getState().logout();
});
