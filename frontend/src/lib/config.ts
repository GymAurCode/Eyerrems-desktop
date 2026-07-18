const API_URL = import.meta.env.VITE_API_URL || "";

export const uploadsUrl = (path: string) => `${API_URL}/uploads/${path}`;

export function buildWsUrl(token: string): string {
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}
