import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** Backend base URL for dev proxy (match `uvicorn --port`). */
function proxyConfig(target: string) {
  return {
    target,
    changeOrigin: true
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Must match `uvicorn` host:port (e.g. --port 8001 → http://127.0.0.1:8001)
  const proxyTarget = env.VITE_PROXY_TARGET || "http://127.0.0.1:8001";

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT) || 5173,
      proxy: {
        "/auth": proxyConfig(proxyTarget),
        "/dashboard": proxyConfig(proxyTarget),
        "/properties": proxyConfig(proxyTarget),
        "/tenants": proxyConfig(proxyTarget),
        "/crm": proxyConfig(proxyTarget),
        "/finance": proxyConfig(proxyTarget),
        "/settings": proxyConfig(proxyTarget),
        "/admin": proxyConfig(proxyTarget),
        "/activity": proxyConfig(proxyTarget),
        "/construction": proxyConfig(proxyTarget),
        "/hr": proxyConfig(proxyTarget),
        "/reminders": proxyConfig(proxyTarget),
        "/mail": proxyConfig(proxyTarget),
        "/uploads": proxyConfig(proxyTarget),
        "/health": proxyConfig(proxyTarget),
        "/docs": proxyConfig(proxyTarget),
        "/openapi.json": proxyConfig(proxyTarget),
        "/redoc": proxyConfig(proxyTarget),
        "/ws": { ...proxyConfig(proxyTarget), ws: true }
      }
    }
  };
});
