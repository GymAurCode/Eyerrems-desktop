import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useUIStore } from "../store/ui";
import { useMailStore } from "../store/mail";
import { canAccess } from "../utils/permissions";
import { LayoutDashboard, Building2, Users, Wallet, ShieldCheck, Zap, Home, Wrench, HardHat, Bell, UserCog, Mail, MapPin, BarChart2, BookOpen, Brain, MessageSquare, Upload, Clock } from "lucide-react";
import logo from "../../assets/logo.png";

// ── Per-route color palette ───────────────────────────────────────────────────
// Each entry: icon color, active background, active text, hover background
// All values are CSS color strings — no Tailwind classes, so dark/light both work.

const NAV_COLORS: Record<string, {
  icon:     string;   // resting icon color
  iconHover: string;  // icon color on hover / active
  activeBg:  string;  // active item background
  hoverBg:   string;  // hover item background
}> = {
  "/":             { icon: "#FBBF24", iconHover: "#FBBF24", activeBg: "rgba(251,191,36,0.12)", hoverBg: "#1e2d3d" }, // Dashboard
  "/property":     { icon: "#34D399", iconHover: "#34D399", activeBg: "rgba(52,211,153,0.12)",    hoverBg: "#1e2d3d" }, // Properties
  "/towns":        { icon: "#22D3EE", iconHover: "#22D3EE", activeBg: "rgba(34,211,238,0.12)",    hoverBg: "#1e2d3d" }, // Towns
  "/crm":          { icon: "#C084FC", iconHover: "#C084FC", activeBg: "rgba(192,132,252,0.12)",    hoverBg: "#1e2d3d" }, // CRM
  "/tenants":      { icon: "#60A5FA", iconHover: "#60A5FA", activeBg: "rgba(96,165,250,0.12)",    hoverBg: "#1e2d3d" }, // Tenants
  "/maintenance":  { icon: "#FB923C", iconHover: "#FB923C", activeBg: "rgba(251,146,60,0.12)",    hoverBg: "#1e2d3d" }, // Maintenance
  "/construction": { icon: "#FBBF24", iconHover: "#FBBF24", activeBg: "rgba(251,191,36,0.12)",    hoverBg: "#1e2d3d" }, // Construction
  "/hr":           { icon: "#F472B6", iconHover: "#F472B6", activeBg: "rgba(244,114,182,0.12)",    hoverBg: "#1e2d3d" }, // HR
  "/finance":      { icon: "#4ADE80", iconHover: "#4ADE80", activeBg: "rgba(74,222,128,0.12)",    hoverBg: "#1e2d3d" }, // Finance
  "/reports":      { icon: "#2DD4BF", iconHover: "#2DD4BF", activeBg: "rgba(45,212,191,0.12)",    hoverBg: "#1e2d3d" }, // Reports
  "/ai":           { icon: "#A78BFA", iconHover: "#A78BFA", activeBg: "rgba(167,139,250,0.12)",    hoverBg: "#1e2d3d" }, // AI Intel
  "/communication":{ icon: "#38BDF8", iconHover: "#38BDF8", activeBg: "rgba(56,189,248,0.12)",    hoverBg: "#1e2d3d" }, // Communication
  "/reminders":    { icon: "#F87171", iconHover: "#F87171", activeBg: "rgba(248,113,113,0.12)",     hoverBg: "#1e2d3d" }, // Reminders
  "/admin":        { icon: "#94A3B8", iconHover: "#94A3B8", activeBg: "rgba(148,163,184,0.12)",     hoverBg: "#1e2d3d" }, // Admin
  "/reports?tab=import": { icon: "#4ADE80", iconHover: "#4ADE80", activeBg: "rgba(74,222,128,0.12)",  hoverBg: "#1e2d3d"  }, // Import
  "/import":       { icon: "#4ADE80", iconHover: "#4ADE80", activeBg: "rgba(74,222,128,0.12)",  hoverBg: "#1e2d3d"  }, // Import
  "/history":      { icon: "#A78BFA", iconHover: "#A78BFA", activeBg: "rgba(167,139,250,0.12)", hoverBg: "#1e2d3d"  }, // History
};

// Fallback for any path not in the map
const DEFAULT_COLOR = { icon: "#64748b", iconHover: "#3b82f6", activeBg: "rgba(59,130,246,0.12)", hoverBg: "rgba(59,130,246,0.07)" };

const NAV_ITEMS = [
  { path: "/",             label: "Dashboard",    icon: LayoutDashboard, roles: ["Admin","Accountant","Dealer","Staff","Manager"], feature: null, module: null     },
  { path: "/property",     label: "Properties",   icon: Building2,       roles: ["Admin","Staff","Dealer"],                        feature: "property_module",  module: "properties", tab: "overview" },
  { path: "/towns",        label: "Towns",        icon: MapPin,          roles: ["Admin","Staff","Dealer"],                        feature: "property_module",  module: "properties", tab: "units" },
  { path: "/crm",          label: "CRM",          icon: Users,           roles: ["Admin","Staff","Dealer","Accountant"],           feature: "crm_module",       module: "crm", tab: "leads" },
  { path: "/tenants",      label: "Tenants",      icon: Home,            roles: ["Admin","Staff","Accountant"],                    feature: "tenant_module",    module: "tenants", tab: "profile" },
  { path: "/maintenance",  label: "Maintenance",  icon: Wrench,          roles: ["Admin","Staff","Accountant"],                    feature: "tenant_module",    module: "maintenance" },
  { path: "/construction", label: "Construction", icon: HardHat,         roles: ["Admin","Manager","Staff","Accountant"],          feature: "construction_module", module: null },
  { path: "/hr",           label: "HR",           icon: UserCog,         roles: ["Admin","Manager"],                               feature: "hr_module",        module: null },
  { path: "/finance",      label: "Finance",      icon: Wallet,          roles: ["Admin","Accountant"],                            feature: "finance_module",   module: "finance" },
  { path: "/reports",      label: "Reports",      icon: BarChart2,       roles: ["Admin","Accountant","Staff","Manager"],          feature: null,               module: "reports" },
  { path: "/ai",           label: "AI Intel",     icon: Brain,           roles: ["Admin"],                                         feature: null,               module: null },
  { path: "/communication",label: "Communication", icon: MessageSquare,   roles: ["Admin","Accountant","Dealer","Staff","Manager"], feature: "mail_module",      module: null },
  { path: "/reminders",    label: "Reminders",    icon: Bell,            roles: ["Admin","Accountant","Dealer","Staff","Manager"], feature: "reminders_module", module: null },
  { path: "/admin",        label: "Admin",        icon: ShieldCheck,     roles: ["Admin"],                                         feature: null,               module: null },
  { path: "/history",      label: "History",      icon: Clock,           roles: ["Admin"],                                         feature: null,               module: null },
];

export default function Sidebar() {
  const user      = useAuthStore((s) => s.user);
  const hasFeature = useAuthStore((s) => s.hasFeature);
  const companyPermissions = useAuthStore((s) => s.companyPermissions);
  const open      = useUIStore((s) => s.sidebarOpen);
  const location  = useLocation();
  const mailStats = useMailStore((s) => s.stats);
  const mailUnread = mailStats?.inbox_unread ?? 0;

  console.log("[Sidebar Debug] user:", user?.email, "role:", user?.role, "roles:", user?.roles);
  console.log("[Sidebar Debug] companyPermissions:", JSON.stringify(companyPermissions).substring(0,100));
  console.log("[Sidebar Debug] hasFeature('property_module'):", hasFeature('property_module'));

  const visible = NAV_ITEMS.filter((item) => {
    // Role check
    const roleOk = user
      ? item.roles.includes(user.role ?? "") || user.roles?.some((r) => item.roles.includes(r))
      : false;
    if (!roleOk) { console.log("[Sidebar Debug] filtered out by role:", item.label, "user.role:", user?.role, "user.roles:", user?.roles); return false; }
    // Feature check — hide sidebar item if module is disabled
    if (item.feature && !hasFeature(item.feature)) { console.log("[Sidebar Debug] filtered out by feature:", item.label); return false; }
    // Company permissions check — hide if module/tab is restricted
    if (item.module && !canAccess(companyPermissions, item.module, item.tab)) { console.log("[Sidebar Debug] filtered out by permissions:", item.label, "module:", item.module, "tab:", item.tab); return false; }
    return true;
  });

  console.log("[Sidebar Debug] visible items:", visible.map(v => v.label));

  return (
    <aside
      className="h-screen sticky top-0 flex flex-col shrink-0 border-r border-theme bg-sidebar sidebar transition-[width] duration-250 ease-in-out overflow-hidden"
      style={{ width: open ? "200px" : "54px" }}
    >
      {/* Logo */}
      <div className="h-12 flex items-center border-b border-theme px-3 shrink-0">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
        >
          <Building2 size={12} className="text-white" />
        </div>
        {open && (
          <div className="ml-2 overflow-hidden whitespace-nowrap">
            <p className="text-[11px] font-semibold text-primary leading-none">EyerREMS</p>
            <p className="text-[9px] text-muted mt-0.5">Real Estate System</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-1.5 py-1.5 space-y-px overflow-hidden">
        {open && (
          <p className="text-[9px] font-semibold text-muted uppercase tracking-widest px-2 mb-1">
            Menu
          </p>
        )}
        {!open && <div className="h-2 mb-0.5" />}

        {visible.map(({ path, label, icon: Icon }) => {
          const active = path === "/"
            ? location.pathname === "/"
            : path.includes("?")
              ? location.pathname + location.search === path
              : location.pathname.startsWith(path) && !location.search.includes("tab=");
          const badge = path === "/communication" && mailUnread > 0 ? mailUnread : 0;
          const clr = NAV_COLORS[path] ?? NAV_COLORS[path.split("?")[0]] ?? DEFAULT_COLOR;

          return (
            <Link
              key={path}
              to={path}
              title={!open ? label : undefined}
              className={`group sidebar-link flex items-center gap-2 rounded-lg text-xs font-medium transition-all duration-200
                ${open ? "px-2 py-1" : "px-0 py-1 justify-center"} ${active ? 'sidebar-active' : ''}`}
              style={{ background: active ? clr.activeBg : "transparent" }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = clr.hoverBg;
                  const ic = (e.currentTarget as HTMLElement).querySelector(".nav-icon-box") as HTMLElement | null;
                  if (ic) {
                    ic.style.background = `${clr.iconHover}1a`;
                    ic.style.transform  = "scale(1.08)";
                  }
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  const ic = (e.currentTarget as HTMLElement).querySelector(".nav-icon-box") as HTMLElement | null;
                  if (ic) {
                    ic.style.background = `${clr.iconHover}0f`;
                    ic.style.transform  = "scale(1)";
                  }
                }
              }}
            >
              {/* Icon container — tinted badge, scales on active/hover */}
              <div
                className="nav-icon-box relative shrink-0 flex items-center justify-center rounded-md transition-all duration-200"
                style={{
                  width:      "22px",
                  height:     "22px",
                  background: active
                    ? `${clr.iconHover}22`
                    : `${clr.iconHover}0f`,
                  transform:  active ? "scale(1.08)" : "scale(1)",
                  boxShadow:  active
                    ? `0 0 0 1px ${clr.iconHover}30`
                    : "none",
                }}
              >
                <Icon
                  size={12}
                  style={{
                    color:       clr.icon,
                    transition:  "color 0.2s",
                    strokeWidth: 1.8,
                  }}
                />
                {badge > 0 && !open && (
                  <span
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full text-white text-[7px] font-bold flex items-center justify-center"
                    style={{ background: clr.iconHover }}
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              {open && (
                <>
                  <span className="flex-1 whitespace-nowrap text-xs">{label}</span>
                  {badge > 0 && (
                    <span className="px-1 py-0.5 rounded-full text-white text-[9px] font-semibold"
                      style={{ background: clr.iconHover }}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                  {active && badge === 0 && (
                    <span
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{
                        background: clr.iconHover,
                        boxShadow: `0 0 6px ${clr.iconHover}cc`,
                      }}
                    />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-1.5 border-t border-theme shrink-0">
        {open && user && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
            >
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-primary truncate">{user.full_name}</p>
              <p className="text-[9px] text-muted truncate">{user.role}</p>
            </div>
          </div>
        )}
        <div className={`flex items-center gap-1 text-[9px] text-muted ${open ? "" : "justify-center"}`}>
          <Zap size={8} className="text-blue-500 shrink-0" />
          {open && <span className="whitespace-nowrap">Powered by Eyercall</span>}
        </div>
      </div>
    </aside>
  );
}
