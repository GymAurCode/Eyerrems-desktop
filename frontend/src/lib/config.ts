const API_URL =
  typeof window !== "undefined" && window.REMS_CONFIG?.API_URL
    ? window.REMS_CONFIG.API_URL
    : import.meta.env.VITE_API_URL || "";

export const uploadsUrl = (path: string) => `${API_URL}/uploads/${path}`;

export function buildWsUrl(token: string): string {
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}
