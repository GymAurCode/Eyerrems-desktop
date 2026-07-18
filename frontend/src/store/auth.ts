import { create } from "zustand";
import { api, registerLogoutCallback, getAuthToken, setAuthToken, setAuthReady } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type User = {
  id: number | string;
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
  // RBAC role user fields
  user_type?: "role_user" | "admin";
  role_name?: string | null;
  company_slug?: string | null;
  slug_locked?: boolean;
  must_change_password?: boolean;
  rbac_permissions?: Record<string, Record<string, boolean>>;
};

type AuthState = {
  token: string | null;
  user: User | null;
  permissions: string[];
  features: Record<string, boolean>;
  companyId: number | null;
  isSuperAdmin: boolean;
  companyPermissions: Record<string, { enabled: boolean; tabs: Record<string, boolean> }> | null;

  // Bootstrap cache — avoids re-fetching on every route change
  _bootstrapFetchedAt: number | null;

  login: (email: string, password: string) => Promise<void>;
  loginSuperAdmin: (email: string, password: string) => Promise<void>;
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
  permissions: Record<string, { enabled: boolean; tabs: Record<string, boolean> }>;
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
  companyPermissions: null,
  _bootstrapFetchedAt: null,

  login: async (email, password) => {
    let data: any;
    let isRbacLogin = false;
    try {
      const res = await api.post("/auth/login", { email, password });
      data = res.data;
    } catch (err: any) {
      if (err.response?.status !== 401) throw err;
      try {
        try { localStorage.removeItem("company_id"); sessionStorage.removeItem("company_id"); } catch {}
        const res = await api.post("/api/rbac/login", { email, password });
        data = res.data;
        isRbacLogin = true;
      } catch {
        throw err;
      }
    }
    setAuthToken(data.access_token);
    if (isRbacLogin) {
      const u = data.user;
      try {
        localStorage.removeItem("company_id");
        sessionStorage.removeItem("company_id");
      } catch {}
      _bootstrapCache = null;
      _bootstrapCacheAt = 0;
      const rbacPermissions = u.permissions ?? {};
      set({
        token: data.access_token,
        user: {
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          role: u.role_name ?? "role_user",
          roles: [],
          permissions: [],
          approval_status: "approved",
          status: "active",
          is_active: true,
          is_approved: true,
          company_id: null,
          is_super_admin: false,
          features: {},
          user_type: "role_user",
          role_name: u.role_name,
          company_slug: u.company_slug,
          slug_locked: u.slug_locked,
          must_change_password: u.must_change_password,
          rbac_permissions: rbacPermissions,
        },
        companyId: null,
        isSuperAdmin: false,
        _bootstrapFetchedAt: null,
      });
    } else {
      const role = data.role ?? "company_admin";
      const isSuperAdmin = role === "superadmin";
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
      // User data is loaded by App's bootstrap()/fetchMe() via the [token] useEffect.
      // DO NOT call fetchMe() here — it races with bootstrap() from App.tsx and can
      // trigger logout() if either request transiently fails, clearing the token for
      // all subsequent requests.
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
      set({
        user: data,
        permissions: data.permissions ?? [],
        features: data.features ?? {},
        companyId: data.company_id ?? null,
        isSuperAdmin: data.is_super_admin ?? false,
      });
    } catch (err: any) {
      if (err.response?.status === 401) {
        try {
          const { data } = await api.get("/api/rbac/me");
          const rbacPermissions = data.permissions ?? {};
          set({
            user: {
              id: data.id,
              email: data.email,
              full_name: data.full_name,
              role: data.role_name ?? "role_user",
              roles: [],
              permissions: [],
              approval_status: "approved",
              status: "active",
              is_active: data.is_active ?? true,
              is_approved: true,
              company_id: null,
              is_super_admin: false,
              features: {},
              user_type: "role_user",
              role_name: data.role_name,
              company_slug: data.company_slug,
              slug_locked: data.slug_locked,
              must_change_password: data.must_change_password,
              rbac_permissions: rbacPermissions,
            },
            permissions: [],
            features: {},
            companyId: null,
            isSuperAdmin: false,
            _bootstrapFetchedAt: null,
          });
          return;
        } catch {
          get().logout();
          throw err;
        }
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
      set({
        user: data.user,
        permissions: data.user.permissions ?? [],
        features: data.user.features ?? {},
        companyId: data.user.company_id ?? null,
        isSuperAdmin: false,
        companyPermissions: data.permissions ?? null,
        _bootstrapFetchedAt: Date.now(),
      });
      _bootstrapCache = data;
      _bootstrapCacheAt = Date.now();
      return data;
    } catch (err: any) {
      _bootstrapCache = null;
      _bootstrapCacheAt = 0;
      if (err.response?.status !== 401) throw err;
      try {
        const { data } = await api.get("/api/rbac/me");
        const rbacPermissions = data.permissions ?? {};
        set({
          user: {
            id: data.id,
            email: data.email,
            full_name: data.full_name,
            role: data.role_name ?? "role_user",
            roles: [],
            permissions: [],
            approval_status: "approved",
            status: "active",
            is_active: data.is_active ?? true,
            is_approved: true,
            company_id: null,
            is_super_admin: false,
            features: {},
            user_type: "role_user",
            role_name: data.role_name,
            company_slug: data.company_slug,
            slug_locked: data.slug_locked,
            must_change_password: data.must_change_password,
            rbac_permissions: rbacPermissions,
          },
          permissions: [],
          features: {},
          companyId: null,
          isSuperAdmin: false,
          _bootstrapFetchedAt: Date.now(),
        });
        return null;
      } catch {
        get().logout();
        throw err;
      }
    }
  },

  logout: () => {
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
