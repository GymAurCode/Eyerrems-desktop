import { useNavigate } from "react-router-dom";
import { useUIStore } from "../store/ui";

const YELLOW = "#f6ce3a";

function IconBtn({ onClick, label, children }: { onClick?: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 relative"
      style={{ color: "var(--text-secondary)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

export default function Topbar({ title }: { title?: string }) {
  const navigate = useNavigate();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  return (
    <header
      className="h-14 flex items-center justify-between px-4 border-b shrink-0"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* ── Left: Hamburger + Title ── */}
      <div className="flex items-center gap-3">
        <IconBtn onClick={toggleSidebar} label="Toggle sidebar">
          <i className="ti ti-menu-2 text-base" />
        </IconBtn>
        {title && (
          <h1
            className="text-[18px] font-medium leading-none"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h1>
        )}
      </div>

      {/* ── Right: Search + Theme + Bell + Add ── */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          <i className="ti ti-search text-sm" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search..."
            className="text-xs bg-transparent outline-none border-none w-[140px]"
            style={{ color: "var(--text-primary)" }}
          />
        </div>

        {/* Advance Options */}
        <IconBtn onClick={() => navigate("/advance-options")} label="Advance Options">
          <i className="ti ti-adjustments-horizontal text-base" />
        </IconBtn>

        {/* Theme toggle */}
        <IconBtn onClick={toggleTheme} label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
          <i className={`ti ti-${theme === "dark" ? "sun" : "moon"} text-base`} />
        </IconBtn>

        {/* Bell */}
        <IconBtn label="Notifications">
          <i className="ti ti-bell text-base" />
          <span
            className="absolute top-[6px] right-[6px] w-[6px] h-[6px] rounded-full"
            style={{ background: YELLOW }}
          />
        </IconBtn>

      </div>
    </header>
  );
}