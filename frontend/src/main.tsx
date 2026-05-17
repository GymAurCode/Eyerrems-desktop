import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Apply persisted theme before first paint to avoid flash
const saved = (() => {
  try { return JSON.parse(localStorage.getItem("rems-ui") ?? "{}"); } catch { return {}; }
})();
const theme = saved?.state?.theme ?? "dark";
document.documentElement.classList.add(theme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
