import { useNavigate } from "react-router-dom";
import { HelpCircle, LogOut, PanelLeft, Sun, Moon, Settings } from "lucide-react";
import { useAuthStore } from "../store/auth";
import { useUIStore } from "../store/ui";
import NotificationBell from "./notifications/NotificationBell";

const ROLE_COLORS: Record<string, string> = {
  Admin:      "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Accountant: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Dealer:     "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Staff:      "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Manager:    "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function IconBtn({ onClick, label, children }: { onClick?: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150"
      style={{ color: "var(--text-secondary)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
      {children}
    </button>
  );
}

export default function Topbar({ title }: { title?: string }) {
  const user          = useAuthStore((s) => s.user);
  const logout        = useAuthStore((s) => s.logout);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleTheme   = useUIStore((s) => s.toggleTheme);
  const theme         = useUIStore((s) => s.theme);
  const roleClass     = user?.role ? (ROLE_COLORS[user.role] ?? ROLE_COLORS.Staff) : "";

  const navigate = useNavigate();

  return (
    <>
      <header className="h-14 flex items-center justify-between px-4 border-b border-theme shrink-0 bg-surface"
        style={{ backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          <IconBtn onClick={toggleSidebar} label="Toggle sidebar">
            <PanelLeft size={16} />
          </IconBtn>
          {title && <h1 className="text-sm font-semibold text-primary">{title}</h1>}
        </div>

        <div className="flex items-center gap-1.5">
          {user && (
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wide ${roleClass}`}>
              {user.role}
            </span>
          )}

          {/* Adv Options Page */}
          <button type="button" onClick={() => navigate("/advance-options")}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-200 font-medium"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
            }}>
            <Settings size={13} />
            <span>Adv. Options</span>
          </button>

          <IconBtn onClick={toggleTheme} label="Toggle theme">
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </IconBtn>

          <NotificationBell />
          <IconBtn label="Help"><HelpCircle size={15} /></IconBtn>

          <button type="button" onClick={() => logout()}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all duration-200"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#f87171";
              (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}>
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </header>
    </>
  );
}
