import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

/** Backend base URL for dev proxy (match `uvicorn --port`). */
function proxyConfig(target: string) {
  return {
    target,
    changeOrigin: true
  };
}

/**
 * Removes the `crossorigin` attribute from <script> and <link> tags in the
 * built index.html. Electron loads the app via file:// protocol — the
 * crossorigin attribute triggers CORS checks that always fail under file://,
 * silently blocking JS and CSS from loading (black screen, no errors).
 */
function removeCrossorigin(): Plugin {
  return {
    name: "remove-crossorigin",
    enforce: "post",
    transformIndexHtml(html) {
      return html
        .replace(/<script([^>]*)\scrossorigin([^>]*)>/g, "<script$1$2>")
        .replace(/<link([^>]*)\scrossorigin([^>]*)\/?>/g, "<link$1$2>");
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Must match `uvicorn` host:port (e.g. --port 8001 → http://127.0.0.1:8001)
  const proxyTarget = env.VITE_PROXY_TARGET || "http://127.0.0.1:8001";

  return {
    plugins: [react(), removeCrossorigin()],
    // Relative base so assets load correctly from file:// in packaged Electron.
    // Without this, Vite outputs /assets/... absolute paths which resolve to
    // the filesystem root under file:// and fail to load.
    base: "./",
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'query-vendor': ['@tanstack/react-query'],
            'chart-vendor': ['recharts'],
            'ui-vendor': ['lucide-react'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
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
