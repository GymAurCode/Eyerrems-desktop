import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useUIStore } from "../store/ui";
import { useMailStore } from "../store/mail";
import { canAccess } from "../utils/permissions";
import { LayoutDashboard, Building2, Users, Wallet, ShieldCheck, Zap, Home, Wrench, HardHat, Bell, UserCog, MapPin, BarChart2, Brain, MessageSquare, Clock } from "lucide-react";
import { MODULE_COLORS } from "../config/moduleColors";

const NAV_ITEMS = [
  { path: "/",             label: "Dashboard",     icon: LayoutDashboard, roles: ["Admin","Accountant","Dealer","Staff","Manager"], feature: null, module: null     },
  { path: "/property",     label: "Properties",    icon: Building2,       roles: ["Admin","Staff","Dealer"],                        feature: "property_module",  module: "properties", tab: "overview" },
  { path: "/towns",        label: "Towns",         icon: MapPin,          roles: ["Admin","Staff","Dealer"],                        feature: "property_module",  module: "properties", tab: "units" },
  { path: "/crm",          label: "CRM",           icon: Users,           roles: ["Admin","Staff","Dealer","Accountant"],           feature: "crm_module",       module: "crm", tab: "leads" },
  { path: "/tenants",      label: "Tenants",       icon: Home,            roles: ["Admin","Staff","Accountant"],                    feature: "tenant_module",    module: "tenants", tab: "profile" },
  { path: "/maintenance",  label: "Maintenance",   icon: Wrench,          roles: ["Admin","Staff","Accountant"],                    feature: "tenant_module",    module: "maintenance" },
  { path: "/construction", label: "Construction",  icon: HardHat,         roles: ["Admin","Manager","Staff","Accountant"],          feature: "construction_module", module: null },
  { path: "/hr",           label: "HR",            icon: UserCog,         roles: ["Admin","Manager"],                               feature: "hr_module",        module: null },
  { path: "/finance",      label: "Finance",       icon: Wallet,          roles: ["Admin","Accountant"],                            feature: "finance_module",   module: "finance" },
  { path: "/reports",      label: "Reports",       icon: BarChart2,       roles: ["Admin","Accountant","Staff","Manager"],          feature: null,               module: "reports" },
  { path: "/ai",           label: "AI Intel",      icon: Brain,           roles: ["Admin"],                                         feature: null,               module: null },
  { path: "/communication",label: "Communication", icon: MessageSquare,   roles: ["Admin","Accountant","Dealer","Staff","Manager"], feature: "mail_module",      module: null },
  { path: "/reminders",    label: "Reminders",     icon: Bell,            roles: ["Admin","Accountant","Dealer","Staff","Manager"], feature: "reminders_module", module: null },
  { path: "/admin",        label: "Admin",         icon: ShieldCheck,     roles: ["Admin"],                                         feature: null,               module: null },
  { path: "/history",      label: "History",       icon: Clock,           roles: ["Admin"],                                         feature: null,               module: null },
];

const INACTIVE_TEXT_COLOR = "var(--sidebar-text)";

function getModuleKeyFromPath(path: string): string {
  if (path.startsWith("/property")) return "properties";
  if (path.startsWith("/towns")) return "towns";
  if (path.startsWith("/crm")) return "crm";
  if (path.startsWith("/tenant")) return "tenants";
  if (path.startsWith("/maintenance")) return "maintenance";
  if (path.startsWith("/construction")) return "construction";
  if (path.startsWith("/hr")) return "hr";
  if (path.startsWith("/finance")) return "finance";
  if (path.startsWith("/report")) return "reports";
  if (path.startsWith("/ai")) return "ai";
  if (path.startsWith("/communication")) return "communication";
  if (path.startsWith("/reminder")) return "reminders";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/history")) return "history";
  return "dashboard";
}

export default function Sidebar() {
  const user      = useAuthStore((s) => s.user);
  const hasFeature = useAuthStore((s) => s.hasFeature);
  const companyPermissions = useAuthStore((s) => s.companyPermissions);
  const open      = useUIStore((s) => s.sidebarOpen);
  const location  = useLocation();
  const mailStats = useMailStore((s) => s.stats);
  const mailUnread = mailStats?.inbox_unread ?? 0;

  const visible = NAV_ITEMS.filter((item) => {
    const roleOk = user
      ? item.roles.includes(user.role ?? "") || user.roles?.some((r) => item.roles.includes(r))
      : false;
    if (!roleOk) return false;
    if (item.feature && !hasFeature(item.feature)) return false;
    if (item.module && !canAccess(companyPermissions, item.module, item.tab)) return false;
    return true;
  });

  return (
    <aside
      className="h-screen sticky top-0 flex flex-col shrink-0 border-r border-theme bg-sidebar sidebar overflow-y-auto transition-[width] duration-250 ease-in-out"
      style={{ width: open ? "200px" : "54px" }}
    >
      {/* Logo header */}
      <div className="flex-shrink-0 flex items-center h-10 border-b border-theme px-3">
        <div
          className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
        >
          <Building2 size={10} className="text-white" />
        </div>
        {open && (
          <div className="ml-2 overflow-hidden whitespace-nowrap">
            <p className="text-[10px] font-semibold text-primary leading-none">EyerREMS</p>
            <p className="text-[8px] text-muted mt-0.5">Real Estate System</p>
          </div>
        )}
      </div>

      {/* Nav items — no scroll, compact */}
      <nav className="py-0.5">
        {open && (
          <p className="text-[9px] font-semibold text-muted uppercase tracking-widest px-2 pb-0.5 pt-0.5">
            Menu
          </p>
        )}

        <div className="px-1 space-y-[1px]">
          {visible.map(({ path, label, icon: Icon }) => {
            const isActive = path === "/"
              ? location.pathname === "/"
              : path.includes("?")
                ? location.pathname + location.search === path
                : location.pathname.startsWith(path);
            const badge = path === "/communication" && mailUnread > 0 ? mailUnread : 0;
            const itemModuleKey = getModuleKeyFromPath(path);
            const colors = MODULE_COLORS[itemModuleKey] ?? MODULE_COLORS.dashboard;

            return (
              <Link
                key={path}
                to={path}
                title={!open ? label : undefined}
                className="group sidebar-link no-underline"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '30px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontSize: '12px',
                  lineHeight: '1.3',
                  justifyContent: open ? 'flex-start' : 'center',
                  transition: 'background 0.15s, color 0.15s',
                  ...(isActive ? {
                    background: `${colors.primary}16`,
                    color: colors.primary,
                    fontWeight: 600,
                  } : {
                    background: 'transparent',
                    color: INACTIVE_TEXT_COLOR,
                    fontWeight: 400,
                  }),
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = `${colors.primary}12`;
                    el.style.color = colors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = 'transparent';
                    el.style.color = INACTIVE_TEXT_COLOR;
                  }
                }}
              >

                {/* Icon */}
                <span style={{
                  position: 'relative',
                  zIndex: 2,
                  color: isActive ? colors.primary : `${colors.primary}99`,
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  width: '16px',
                  height: '16px',
                  justifyContent: 'center',
                }}>
                  <Icon
                    size={11}
                    style={{
                      strokeWidth: 1.8,
                      transition: 'color 0.2s',
                      color: isActive ? colors.primary : `${colors.primary}99`,
                    }}
                  />
                </span>

                {/* Label */}
                {open && (
                  <span style={{
                    position: 'relative',
                    zIndex: 2,
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 400,
                    lineHeight: '1.3',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: isActive ? colors.primary : 'inherit',
                  }}>
                    {label}
                  </span>
                )}

                {/* Badge */}
                {open && badge > 0 && (
                  <span
                    className="px-1 py-[1px] rounded-full text-white text-[8px] font-semibold"
                    style={{ background: colors.primary, position: 'relative', zIndex: 2 }}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="mt-auto px-2 py-1 border-t border-theme flex-shrink-0">
        {open && user && (
          <div className="flex items-center gap-1.5 mb-1">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
            >
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-primary truncate">{user.full_name}</p>
              <p className="text-[8px] text-muted truncate">{user.role}</p>
            </div>
          </div>
        )}
        <div className={`flex items-center gap-1 text-[8px] text-muted ${open ? "" : "justify-center"}`}>
          <Zap size={7} className="text-blue-500 shrink-0" />
          {open && <span className="whitespace-nowrap">Powered by Eyercall</span>}
        </div>
      </div>
    </aside>
  );
}
