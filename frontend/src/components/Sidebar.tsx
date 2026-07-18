import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useUIStore } from "../store/ui";

const YELLOW = "#f6ce3a";
const SIDEBAR_BG = "var(--bg-sidebar)";

const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      { path: "/",             label: "Dashboard",    icon: "ti-layout-dashboard" },
      { path: "/property",     label: "Properties",   icon: "ti-building" },
      { path: "/towns",        label: "Towns",        icon: "ti-map-pin" },
      { path: "/crm",          label: "CRM",          icon: "ti-users" },
      { path: "/tenants",      label: "Tenants",      icon: "ti-user-check" },
      { path: "/maintenance",  label: "Maintenance",  icon: "ti-tool" },
      { path: "/construction", label: "Construction", icon: "ti-building-skyscraper" },
    ],
  },
  {
    label: "Manage",
    items: [
      { path: "/hr",           label: "HR",           icon: "ti-briefcase" },
      { path: "/finance",      label: "Finance",      icon: "ti-currency-dollar" },
      { path: "/reports",      label: "Reports",      icon: "ti-chart-bar" },
    ],
  },
  {
    label: "Stock Ops",
    items: [
      { path: "/spreadsheet",  label: "Spreadsheet",  icon: "ti-table" },
    ],
  },
  {
    label: "Tools",
    items: [
      { path: "/ai",           label: "AI Intel",     icon: "ti-robot" },
      { path: "/communication",label: "Communication",icon: "ti-mail" },
      { path: "/reminders",    label: "Reminders",    icon: "ti-bell-ringing" },
      { path: "/activity",     label: "Activity",     icon: "ti-activity" },
      { path: "/history",      label: "History",      icon: "ti-history" },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/admin",        label: "Admin",        icon: "ti-settings" },
    ],
  },
];

function NavItem({ path, label, icon, badge }: { path: string; label: string; icon?: string; badge?: boolean }) {
  const location = useLocation();
  const isActive = path === "/"
    ? location.pathname === "/"
    : location.pathname.startsWith(path);

  return (
    <Link
      to={path}
        className="flex items-center gap-2 px-3 py-[3px] rounded-lg no-underline transition-all duration-150 group"
      style={{
        background: isActive ? "transparent" : "transparent",
        color: isActive ? YELLOW : "var(--sidebar-text)",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = "rgba(246,206,58,0.1)";
          (e.currentTarget as HTMLElement).style.color = "#c0efef";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)";
        }
      }}
    >
      <i
        className={`ti ${icon} text-sm`}
        style={{
          color: isActive ? YELLOW : "var(--sidebar-icon)",
          fontSize: "12px",
          width: "16px",
          textAlign: "center",
          flexShrink: 0,
        }}
      />
      <span
        className="text-[10px] font-medium flex-1"
        style={{
          color: "inherit",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
      {badge && (
        <span
          className="text-[10px] font-semibold px-[6px] py-[1px] rounded-full"
          style={{
            background: "rgba(246,206,58,0.25)",
            color: "#8ababa",
          }}
        >
          248
        </span>
      )}
      {isActive && (
        <span
          className="w-[6px] h-[6px] rounded-full shrink-0"
          style={{
            background: YELLOW,
            boxShadow: `0 0 6px ${YELLOW}`,
          }}
        />
      )}
    </Link>
  );
}

function MiniSidebar({ user, onSignOut }: { user: { full_name?: string } | null; onSignOut: () => void }) {
  const location = useLocation();
  return (
    <aside
      className="flex flex-col shrink-0 overflow-y-auto rounded-xl my-4 ml-4"
      style={{
        width: "56px",
        height: "calc(100vh - 2rem)",
        background: SIDEBAR_BG,
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      <div
        className="flex items-center justify-center h-12 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: YELLOW }}
        >
          <i className="ti ti-eye text-sm" style={{ color: "#001a1a" }} />
        </div>
      </div>
      <nav className="flex flex-col items-center gap-1 py-3 px-2">
        {NAV_SECTIONS.flatMap((s) => s.items).map((item) => {
          const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center justify-center w-8 h-8 rounded-lg no-underline transition-colors"
              style={{
                color: active ? YELLOW : "var(--sidebar-icon)",
                background: active ? "rgba(246,206,58,0.08)" : "transparent",
              }}
              title={item.label}
            >
              <i className={`ti ${item.icon} text-base`} style={{ fontSize: "15px" }} />
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-1 py-2 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={onSignOut}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"
          style={{ color: "#ef4444" }}
          title="Sign Out"
        >
          <i className="ti ti-logout text-sm" />
        </button>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ background: YELLOW, color: "#001a1a" }}
        >
          {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
        </div>
      </div>
      <div className="text-center pb-2 shrink-0">
        <p className="text-[8px] tracking-wider" style={{ color: "#3a7070" }}>
          POWERED BY <span style={{ color: "#14B8A6" }}>EYERCALL</span>
        </p>
      </div>
    </aside>
  );
}

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const open = useUIStore((s) => s.sidebarOpen);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [showSignOut, setShowSignOut] = useState(false);

  const confirmSignOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const sidebar = open ? (
    <aside
      className="flex flex-col shrink-0 rounded-xl my-4 ml-4"
      style={{
        width: "185px",
        height: "calc(100vh - 2rem)",
        background: SIDEBAR_BG,
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
        {/* ── Logo Area ── */}
      <div
          className="flex items-center gap-2 px-4 py-1.5 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: YELLOW }}
        >
          <i className="ti ti-eye text-sm" style={{ color: "#001a1a" }} />
        </div>
        <div className="overflow-hidden">
          <p
            className="text-[11px] font-semibold leading-none"
            style={{ color: "#e0f0f0" }}
          >
            EyerRems
          </p>
          <p
            className="text-[8px] font-medium uppercase tracking-wider mt-[1px]"
            style={{ color: "#5a9999" }}
          >
            Real Estate
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-1 px-2 space-y-1">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p
              className="text-[8px] font-semibold uppercase tracking-[0.12em] px-3 pb-[2px]"
              style={{ color: "rgba(90,153,153,0.4)" }}
            >
              {section.label}
            </p>
            <div className="space-y-[1px]">
              {section.items.map((item) => (
                <NavItem key={item.path} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User Footer ── */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-t shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ background: YELLOW, color: "#001a1a" }}
        >
          {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[9px] font-medium truncate"
            style={{ color: "#c0efef" }}
          >
            {user?.full_name || "User"}
          </p>
          <p
            className="text-[8px] truncate"
            style={{ color: "#5a9999" }}
          >
            {user?.role || "Admin"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSignOut(true)}
          className="w-[26px] h-[26px] rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors shrink-0"
          style={{ color: "#ef4444" }}
          title="Sign Out"
        >
          <i className="ti ti-logout" style={{ fontSize: "13px" }} />
        </button>
      </div>
      <div className="text-center pb-2 shrink-0">
        <p className="text-[8px] tracking-wider" style={{ color: "#3a7070" }}>
          POWERED BY <span style={{ color: "#14B8A6" }}>EYERCALL</span>
        </p>
      </div>
    </aside>
  ) : (
    <MiniSidebar user={user} onSignOut={() => setShowSignOut(true)} />
  );

  return (
    <>
      {sidebar}
      {showSignOut && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowSignOut(false)}
        >
          <div
            className="rounded-xl p-6 w-[320px] shadow-2xl"
            style={{
              background: "#041515",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(239,68,68,0.15)" }}
              >
                <i className="ti ti-alert-triangle text-2xl" style={{ color: "#ef4444" }} />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ color: "#f1f5f9" }}>
                Sign Out
              </h3>
              <p className="text-sm mb-6" style={{ color: "#94a3b8" }}>
                Are you sure you want to sign out?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSignOut(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "#94a3b8",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSignOut}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: "#ef4444", color: "#fff" }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}