import axios from "axios";

const TOKEN_KEY = "auth_token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

let logoutCallback: (() => void) | null = null;
let _authReady = false;

export function setAuthReady(ready: boolean) {
  _authReady = ready;
}

export function registerLogoutCallback(cb: () => void) {
  logoutCallback = cb;
}

function isTokenExpired(token: string): boolean {
  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return true;
    const payload = JSON.parse(atob(payloadBase64));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    if (isTokenExpired(token)) {
      setAuthToken(null);
      if (logoutCallback) logoutCallback();
      return Promise.reject({ __cancelled: true, message: "Token expired" });
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AUTH_ENDPOINTS = ["/auth/", "/bootstrap"];

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return AUTH_ENDPOINTS.some((p) => url.startsWith(p));
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && logoutCallback) {
      // Only auto-logout if auth was previously established (_authReady)
      // AND the failing endpoint is an auth-protecting endpoint (not a data fetch).
      // Data endpoints that return 401 (should be 403) should not nuke the session.
      if (_authReady && isAuthEndpoint(err.config?.url)) {
        logoutCallback();
      }
    }
    return Promise.reject(err);
  }
);
