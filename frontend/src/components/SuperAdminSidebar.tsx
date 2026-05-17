import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useUIStore } from "../store/ui";
import {
  LayoutDashboard, Building2, PlusCircle, ToggleLeft,
  Users, ScrollText, Zap, ShieldAlert,
} from "lucide-react";

const NAV: { path: string; label: string; icon: React.ElementType; section?: string }[] = [
  { path: "/super-admin",               label: "Dashboard",       icon: LayoutDashboard, section: "Overview" },
  { path: "/super-admin/companies",     label: "All Companies",   icon: Building2,       section: "Tenants" },
  { path: "/super-admin/companies/new", label: "Create Company",  icon: PlusCircle },
  { path: "/super-admin/features",      label: "Manage Features", icon: ToggleLeft },
  { path: "/super-admin/users",         label: "All Users",       icon: Users,           section: "System" },
  { path: "/super-admin/logs",          label: "System Logs",     icon: ScrollText },
];

export default function SuperAdminSidebar() {
  const user     = useAuthStore((s) => s.user);
  const open     = useUIStore((s) => s.sidebarOpen);
  const location = useLocation();

  return (
    <aside
      className="sa-sidebar"
      style={{ width: open ? "224px" : "60px" }}
    >
      {/* Logo */}
      <div className="sa-sidebar-header">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--sa-btn-gradient)" }}
        >
          <ShieldAlert size={14} className="text-white" />
        </div>
        {open && (
          <div className="ml-2.5 overflow-hidden whitespace-nowrap">
            <p className="sa-sidebar-title">Super Admin</p>
            <p className="sa-sidebar-subtitle">System Control</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {!open && <div className="h-5 mb-2" />}

        {NAV.map(({ path, label, icon: Icon, section }, idx) => {
          const prevSection = idx > 0 ? NAV[idx - 1].section : undefined;
          const showDivider = section && section !== prevSection && idx > 0;
          const exact  = path === "/super-admin";
          const active = exact
            ? location.pathname === "/super-admin"
            : location.pathname.startsWith(path) && path !== "/super-admin";

          return (
            <div key={path}>
              {showDivider && open && (
                <p className="sa-sidebar-section-label">{section}</p>
              )}
              {showDivider && !open && <div className="h-3" />}

              <Link
                to={path}
                title={!open ? label : undefined}
                className={`sa-nav-link ${active ? "active" : ""} ${open ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"}`}
              >
                <Icon
                  size={17}
                  style={{
                    color: active ? "var(--sa-accent-light)" : "var(--sa-icon-color)",
                    flexShrink: 0,
                  }}
                />
                {open && (
                  <>
                    <span className="flex-1 whitespace-nowrap">{label}</span>
                    <span className="sa-nav-dot" />
                  </>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sa-sidebar-footer">
        {open && user && (
          <div className="flex items-center gap-2 mb-2.5">
            <div className="sa-avatar-sm">{user.full_name.charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate sa-text-primary">{user.full_name}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--sa-accent)" }}>
                Super Admin
              </p>
            </div>
          </div>
        )}
        <div className={`flex items-center gap-1 sa-footer-text ${open ? "" : "justify-center"}`}>
          <Zap size={10} style={{ color: "var(--sa-accent)", flexShrink: 0 }} />
          {open && <span className="whitespace-nowrap">Powered by Eyercall</span>}
        </div>
      </div>
    </aside>
  );
}
