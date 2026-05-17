import { useLocation } from "react-router-dom";
import SuperAdminSidebar from "../components/SuperAdminSidebar";
import SuperAdminTopbar from "../components/SuperAdminTopbar";
import { useUIStore } from "../store/ui";

const TITLES: Record<string, string> = {
  "/super-admin":                  "Dashboard",
  "/super-admin/companies":        "All Companies",
  "/super-admin/companies/new":    "Create Company",
  "/super-admin/features":         "Feature Management",
  "/super-admin/users":            "All Users",
  "/super-admin/logs":             "System Logs",
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const theme    = useUIStore((s) => s.theme);

  const title =
    TITLES[location.pathname] ??
    Object.entries(TITLES)
      .filter(([k]) => location.pathname.startsWith(k) && k !== "/super-admin")
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
    "Super Admin";

  return (
    <div className="sa-shell" data-theme={theme}>
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <SuperAdminTopbar title={title} />
        <main className="sa-main">{children}</main>
      </div>
    </div>
  );
}
