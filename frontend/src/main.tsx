import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Apply persisted theme before first paint to avoid flash
const saved = (() => {
  try { return JSON.parse(localStorage.getItem("rems-ui") ?? "{}"); } catch { return {}; }
})();
const theme = saved?.state?.theme ?? "dark";
document.documentElement.classList.add(theme);

// Production error capture
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    window.electronAPI?.log("error", `Uncaught Error: ${event.message}`, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    window.electronAPI?.log("error", `Unhandled Rejection: ${reason}`, {
      stack: reason?.stack || (reason instanceof Error ? reason.stack : undefined),
    });
  });

  window.electronAPI?.log("info", "Renderer process starting up");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/*
      HashRouter is required for Electron production builds.
      BrowserRouter uses the HTML5 History API which breaks under file:// protocol —
      the router sees the full file path as the URL and matches no routes, causing
      a silent black screen. HashRouter uses the URL hash (#/login, #/dashboard)
      which works correctly in both file:// and http:// environments.
    */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
