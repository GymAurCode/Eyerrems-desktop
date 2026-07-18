import { useUIStore } from "../store/ui";
import { useAuthStore } from "../store/auth";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LogOut, Building2, LayoutDashboard, ShoppingCart, Settings } from "lucide-react";

function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-base gap-4" data-theme={theme}>
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 my-4 mr-4 rounded-xl overflow-hidden"
        style={{
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <SuperAdminTopbar />
        <main className="flex-1 overflow-y-auto bg-base">{children}</main>
      </div>
    </div>
  );
}

function SuperAdminSidebar() {
  const user = useAuthStore((s) => s.user);
  const open = useUIStore((s) => s.sidebarOpen);
  const location = useLocation();

  const NAV_ITEMS = [
    { path: "/superadmin", label: "Dashboard", icon: LayoutDashboard },
    { path: "/superadmin/companies", label: "Companies", icon: ShoppingCart },
    { path: "/superadmin/settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden rounded-xl my-4 ml-4 bg-sidebar sidebar transition-[width] duration-250 ease-in-out"
      style={{
        width: open ? "224px" : "60px",
        height: "calc(100vh - 2rem)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center border-b border-theme px-3.5 shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
        >
          <Building2 size={14} className="text-white" />
        </div>
        {open && (
          <div className="ml-2.5 overflow-hidden whitespace-nowrap">
            <p className="text-xs font-semibold text-primary leading-none">SuperAdmin</p>
            <p className="text-[10px] text-muted mt-0.5">Master Console</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-px overflow-hidden">
        {open && (
          <p className="text-[10px] font-semibold text-muted uppercase tracking-widest px-2 mb-1.5">
            Menu
          </p>
        )}
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all"
              style={{
                background: isActive ? "rgba(59,130,246,0.12)" : "transparent",
                color: isActive ? "#3b82f6" : "#64748b",
              }}
              title={item.label}
            >
              <Icon size={18} className="shrink-0" />
              {open && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-theme px-2 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-theme flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">
              {user?.full_name?.[0]?.toUpperCase() || "S"}
            </span>
          </div>
          {open && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary truncate">{user?.email}</p>
              <p className="text-[10px] text-muted truncate">Super Admin</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function SuperAdminTopbar() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/superadmin/login", { replace: true });
  };

  return (
    <div className="h-14 flex items-center justify-between px-6 border-b border-theme bg-base">
      <div />
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors text-sm"
      >
        <LogOut size={16} />
        Logout
      </button>
    </div>
  );
}

export default SuperAdminLayout;
