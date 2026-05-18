import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useUIStore } from "../store/ui";
import { useMailStore } from "../store/mail";
import { LayoutDashboard, Building2, Users, Wallet, ShieldCheck, Zap, Home, Wrench, HardHat, Bell, UserCog, Mail, MapPin, BarChart2, BookOpen, Brain, MessageSquare, Upload } from "lucide-react";
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
  "/":             { icon: "#64748b", iconHover: "#3b82f6", activeBg: "rgba(59,130,246,0.12)",  hoverBg: "rgba(59,130,246,0.07)"  }, // Blue — Dashboard
  "/property":     { icon: "#64748b", iconHover: "#06b6d4", activeBg: "rgba(6,182,212,0.12)",   hoverBg: "rgba(6,182,212,0.07)"   }, // Cyan — Properties
  "/towns":        { icon: "#64748b", iconHover: "#0ea5e9", activeBg: "rgba(14,165,233,0.12)",  hoverBg: "rgba(14,165,233,0.07)"  }, // Sky — Towns
  "/crm":          { icon: "#64748b", iconHover: "#a855f7", activeBg: "rgba(168,85,247,0.12)",  hoverBg: "rgba(168,85,247,0.07)"  }, // Purple — CRM
  "/tenants":      { icon: "#64748b", iconHover: "#f59e0b", activeBg: "rgba(245,158,11,0.12)",  hoverBg: "rgba(245,158,11,0.07)"  }, // Amber — Tenants
  "/maintenance":  { icon: "#64748b", iconHover: "#f97316", activeBg: "rgba(249,115,22,0.12)",  hoverBg: "rgba(249,115,22,0.07)"  }, // Orange — Maintenance
  "/construction": { icon: "#64748b", iconHover: "#d97706", activeBg: "rgba(217,119,6,0.12)",   hoverBg: "rgba(217,119,6,0.07)"   }, // Yellow-Amber — Construction
  "/hr":           { icon: "#64748b", iconHover: "#ec4899", activeBg: "rgba(236,72,153,0.12)",  hoverBg: "rgba(236,72,153,0.07)"  }, // Pink — HR
  "/finance":      { icon: "#64748b", iconHover: "#10b981", activeBg: "rgba(16,185,129,0.12)",  hoverBg: "rgba(16,185,129,0.07)"  }, // Emerald — Finance
  "/reports":      { icon: "#64748b", iconHover: "#f97316", activeBg: "rgba(249,115,22,0.12)",  hoverBg: "rgba(249,115,22,0.07)"  }, // Orange — Reports
  "/ai":           { icon: "#64748b", iconHover: "#6366f1", activeBg: "rgba(99,102,241,0.12)",  hoverBg: "rgba(99,102,241,0.07)"  }, // Indigo — AI Intel
  "/communication":{ icon: "#64748b", iconHover: "#25D366", activeBg: "rgba(37,211,102,0.12)", hoverBg: "rgba(37,211,102,0.07)"  }, // WhatsApp Green — Communication
  "/reminders":    { icon: "#64748b", iconHover: "#8b5cf6", activeBg: "rgba(139,92,246,0.12)", hoverBg: "rgba(139,92,246,0.07)"  }, // Violet — Reminders
  "/admin":        { icon: "#64748b", iconHover: "#ef4444", activeBg: "rgba(239,68,68,0.12)",   hoverBg: "rgba(239,68,68,0.07)"   }, // Red — Admin
  "/import":       { icon: "#64748b", iconHover: "#22c55e", activeBg: "rgba(34,197,94,0.12)",  hoverBg: "rgba(34,197,94,0.07)"  }, // Green — Import
};

// Fallback for any path not in the map
const DEFAULT_COLOR = { icon: "#64748b", iconHover: "#3b82f6", activeBg: "rgba(59,130,246,0.12)", hoverBg: "rgba(59,130,246,0.07)" };

const NAV_ITEMS = [
  { path: "/",             label: "Dashboard",    icon: LayoutDashboard, roles: ["Admin","Accountant","Dealer","Staff","Manager"], feature: null },
  { path: "/property",     label: "Properties",   icon: Building2,       roles: ["Admin","Staff","Dealer"],                        feature: "property_module" },
  { path: "/towns",        label: "Towns",        icon: MapPin,          roles: ["Admin","Staff","Dealer"],                        feature: "property_module" },
  { path: "/crm",          label: "CRM",          icon: Users,           roles: ["Admin","Staff","Dealer","Accountant"],           feature: "crm_module" },
  { path: "/tenants",      label: "Tenants",      icon: Home,            roles: ["Admin","Staff","Accountant"],                    feature: "tenant_module" },
  { path: "/maintenance",  label: "Maintenance",  icon: Wrench,          roles: ["Admin","Staff","Accountant"],                    feature: "tenant_module" },
  { path: "/construction", label: "Construction", icon: HardHat,         roles: ["Admin","Manager","Staff","Accountant"],          feature: "construction_module" },
  { path: "/hr",           label: "HR",           icon: UserCog,         roles: ["Admin","Manager"],                               feature: "hr_module" },
  { path: "/finance",      label: "Finance",      icon: Wallet,          roles: ["Admin","Accountant"],                            feature: "finance_module" },
  { path: "/reports",      label: "Reports",      icon: BarChart2,       roles: ["Admin","Accountant","Staff","Manager"],          feature: null },
  { path: "/ai",           label: "AI Intel",     icon: Brain,           roles: ["Admin"],                                         feature: null },
  { path: "/communication",label: "Communication", icon: MessageSquare,   roles: ["Admin","Accountant","Dealer","Staff","Manager"], feature: "mail_module" },
  { path: "/reminders",    label: "Reminders",    icon: Bell,            roles: ["Admin","Accountant","Dealer","Staff","Manager"], feature: "reminders_module" },
  { path: "/admin",        label: "Admin",        icon: ShieldCheck,     roles: ["Admin"],                                         feature: null },
  { path: "/import",       label: "Bulk Import",  icon: Upload,          roles: ["Admin", "Manager"],                              feature: null },
];

export default function Sidebar() {
  const user      = useAuthStore((s) => s.user);
  const hasFeature = useAuthStore((s) => s.hasFeature);
  const open      = useUIStore((s) => s.sidebarOpen);
  const location  = useLocation();
  const mailStats = useMailStore((s) => s.stats);
  const mailUnread = mailStats?.inbox_unread ?? 0;

  const visible = NAV_ITEMS.filter((item) => {
    // Role check
    const roleOk = user
      ? item.roles.includes(user.role ?? "") || user.roles?.some((r) => item.roles.includes(r))
      : false;
    if (!roleOk) return false;
    // Feature check — hide sidebar item if module is disabled
    if (item.feature && !hasFeature(item.feature)) return false;
    return true;
  });

  return (
    <aside
      className="h-screen sticky top-0 flex flex-col shrink-0 border-r border-theme bg-sidebar transition-[width] duration-250 ease-in-out overflow-hidden"
      style={{ width: open ? "224px" : "60px" }}
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
            <p className="text-xs font-semibold text-primary leading-none">EyerREMS</p>
            <p className="text-[10px] text-muted mt-0.5">Real Estate System</p>
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
        {!open && <div className="h-3 mb-1" />}

        {visible.map(({ path, label, icon: Icon }) => {
          const active = path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(path);
          const badge = path === "/communication" && mailUnread > 0 ? mailUnread : 0;
          const clr = NAV_COLORS[path] ?? DEFAULT_COLOR;

          return (
            <Link
              key={path}
              to={path}
              title={!open ? label : undefined}
              className={`group flex items-center gap-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${open ? "px-2.5 py-1.5" : "px-0 py-1.5 justify-center"}`}
              style={{
                background: active ? clr.activeBg : "transparent",
                color: active ? clr.iconHover : "var(--text-secondary)",
              }}
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
                className="nav-icon-box relative shrink-0 flex items-center justify-center rounded-lg transition-all duration-200"
                style={{
                  width:      "26px",
                  height:     "26px",
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
                  size={14}
                  style={{
                    color:       active ? clr.iconHover : `${clr.iconHover}99`,
                    transition:  "color 0.2s",
                    strokeWidth: 2,
                  }}
                />
                {badge > 0 && !open && (
                  <span
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
                    style={{ background: clr.iconHover }}
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              {open && (
                <>
                  <span className="flex-1 whitespace-nowrap">{label}</span>
                  {badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-white text-[10px] font-semibold"
                      style={{ background: clr.iconHover }}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                  {active && badge === 0 && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
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
      <div className="px-3 py-2 border-t border-theme shrink-0">
        {open && user && (
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
            >
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary truncate">{user.full_name}</p>
              <p className="text-[10px] text-muted truncate">{user.role}</p>
            </div>
          </div>
        )}
        <div className={`flex items-center gap-1 text-[10px] text-muted ${open ? "" : "justify-center"}`}>
          <Zap size={10} className="text-blue-500 shrink-0" />
          {open && <span className="whitespace-nowrap">Powered by Eyercall</span>}
        </div>
      </div>
    </aside>
  );
}
