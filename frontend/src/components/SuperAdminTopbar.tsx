import { LogOut, PanelLeft, Sun, Moon, ShieldAlert } from "lucide-react";
import { useAuthStore } from "../store/auth";
import { useUIStore } from "../store/ui";

export default function SuperAdminTopbar({ title }: { title?: string }) {
  const logout        = useAuthStore((s) => s.logout);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleTheme   = useUIStore((s) => s.toggleTheme);
  const theme         = useUIStore((s) => s.theme);

  return (
    <header className="sa-topbar">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="sa-topbar-icon-btn"
        >
          <PanelLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} style={{ color: "var(--sa-accent)" }} />
          {title && (
            <h1 className="text-sm font-semibold sa-text-primary">{title}</h1>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <span className="sa-badge">Super Admin</span>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="sa-topbar-icon-btn"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
          style={{ color: "var(--sa-icon-color)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#f87171";
            (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--sa-icon-color)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <LogOut size={13} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
