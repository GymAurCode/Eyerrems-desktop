import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

// ── Auth / guards ─────────────────────────────────────────────────────────────
import { useAuthStore } from "./store/auth";
import { useUIStore } from "./store/ui";
import { useCurrencyStore } from "./store/currency";
import { useRealtimeSocket } from "./hooks/useWebSocket";
import { useReminderWebSocket } from "./hooks/useReminderWebSocket";
import { useAppBootstrap, useBackgroundRefresh } from "./hooks/useAppBootstrap";
import ProtectedRoute from "./components/ProtectedRoute";
import FeatureGuard from "./components/FeatureGuard";
import ModuleGuard from "./components/guards/ModuleGuard";
import RoleUserGuard from "./components/guards/RoleUserGuard";
import ToastContainer from "./components/notifications/ToastContainer";
import { useNotifStore } from "./store/notifications";
import { ErrorTrackerPanel } from "./components/ErrorTracker";
import { ErrorBoundary } from "./components/ErrorBoundary";
import UpdateNotification from "./components/UpdateNotification";
import NotificationCenter from "./components/reminders/NotificationCenter";

// ── Module theming ────────────────────────────────────────────────────────────
import { useModuleColor } from "./contexts/ModuleColorContext";

// ── Layouts ───────────────────────────────────────────────────────────────────
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

// ── Lazy-loaded route pages ───────────────────────────────────────────────────
const LoginPage = lazy(() => import("./pages/Login"));
const SignupPage = lazy(() => import("./pages/Signup"));
const SuperAdminLoginPage = lazy(() => import("./pages/SuperAdminLogin"));
const SuperAdminApp = lazy(() => import("./superadmin/SuperAdminApp"));
const DashboardPage = lazy(() => import("./pages/Dashboard"));
const PropertyPage = lazy(() => import("./pages/Property"));
const PropertyViewPage = lazy(() => import("./pages/PropertyView"));
const CRMPage = lazy(() => import("./pages/CRM"));
const LeadDetail = lazy(() => import("./pages/crm/LeadDetail"));
const ClientDetail = lazy(() => import("./pages/crm/ClientDetail"));
const DealDetail = lazy(() => import("./pages/crm/DealDetail"));
const DealerDetail = lazy(() => import("./pages/crm/DealerDetail"));
const InstallmentPlanBuilder = lazy(() => import("./pages/crm/InstallmentPlanBuilder"));
const FinancePage = lazy(() => import("./pages/Finance"));
const AdminPage = lazy(() => import("./pages/Admin"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const TenantPage = lazy(() => import("./pages/Tenant"));
const TenantDetailPage = lazy(() => import("./pages/TenantDetail"));
const MaintenancePage = lazy(() => import("./pages/Maintenance"));
const ConstructionDashboard = lazy(() => import("./modules/construction/ConstructionDashboard"));
const ProjectList = lazy(() => import("./modules/construction/ProjectList"));
const ProjectDetails = lazy(() => import("./modules/construction/ProjectDetails"));
const ProjectView = lazy(() => import("./modules/construction/ProjectView"));
const RemindersPage = lazy(() => import("./pages/Reminders"));
const HRPage = lazy(() => import("./pages/HR"));
const MailPage = lazy(() => import("./pages/Mail"));
const CommunicationPage = lazy(() => import("./pages/Communication"));
const TownListPage = lazy(() => import("./pages/towns/TownList"));
const TownDetailPage = lazy(() => import("./pages/towns/TownDetail"));
const BookingsPage = lazy(() => import("./pages/Bookings"));
const BookingDetailPage = lazy(() => import("./pages/crm/bookings/BookingDetail"));
const ReportsCenter = lazy(() => import("./pages/reports/ReportsCenter"));
const ReportRunner = lazy(() => import("./pages/reports/ReportRunner"));
const InstallmentPlanReport = lazy(() => import("./pages/reports/InstallmentPlanReport"));
const BookingFormReport = lazy(() => import("./pages/reports/BookingFormReport"));
const AIIntelligencePage = lazy(() => import("./pages/AIIntelligence"));
const ImportCenter = lazy(() => import("./pages/ImportCenter"));
const HistoryPage = lazy(() => import("./pages/History"));
const RecentActivityPage = lazy(() => import("./pages/RecentActivity"));
const SpreadsheetWorkspace = lazy(() => import("./spreadsheet/SpreadsheetWorkspace"));
const ProductSpreadsheetPage = lazy(() => import("./pages/ProductSpreadsheetPage"));
const AdvanceOptionsPage = lazy(() => import("./pages/AdvanceOptions"));
const SlugSetupPage = lazy(() => import("./pages/SlugSetup"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePassword"));

// ── Module loading spinner ────────────────────────────────────────────────────
function ModuleLoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted">Loading…</p>
      </div>
    </div>
  );
}

// ── Page titles ───────────────────────────────────────────────────────────────
const PAGE_TITLES: Record<string, string> = {
  "/":             "Dashboard",
  "/property":     "Properties",
  "/tenants":      "Tenants",
  "/leases":       "Leases",
  "/payments":     "Payments",
  "/maintenance":  "Maintenance",
  "/reports":      "Reports",
  "/team":         "Team",
  "/settings":     "Settings",
  "/towns":        "Town Management",
  "/crm":          "Clients",
  "/finance":      "Finance",
  "/admin":        "Administration",
  "/import":       "Bulk Import",
  "/admin-panel":  "Admin Panel - RBAC",
  "/construction": "Construction",
  "/hr":           "Human Resources",
  "/reminders":    "Reminders & Notifications",
  "/mail":         "Mail",
  "/communication": "Communication",
  "/ledger":       "Ledger Management",
  "/ai":           "AI Intelligence",
  "/history":      "Activity History",
  "/activity":     "Recent Activity",
  "/spreadsheet":   "Spreadsheet",
  "/products/spreadsheet": "Product Spreadsheet",
  "/advance-options": "Advance Options",
};

function DisabledModule() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-center">
      <p className="text-2xl font-semibold mb-2">Module Disabled</p>
      <p className="text-muted">This module is not enabled for your company.</p>
    </div>
  );
}

// ── Company layout (existing sidebar + topbar) ────────────────────────────────
function CompanyLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const theme    = useUIStore((s) => s.theme);
  const base     = "/" + location.pathname.split("/")[1];
  const title    = PAGE_TITLES[base] ?? PAGE_TITLES[location.pathname] ?? "";
  const moduleColor = useModuleColor();
  const { isSuperAdmin } = useAuthStore.getState();
  if (isSuperAdmin) {
    return <Navigate to="/superadmin" replace />;
  }
  return (
    <div
      className="app-shell flex h-screen overflow-hidden bg-base gap-4"
      data-theme={theme}
      style={{
        '--module-primary': moduleColor.primary,
        '--module-light': moduleColor.light,
        '--module-medium': moduleColor.medium,
        '--module-dark': moduleColor.dark,
        '--module-text': moduleColor.text,
      } as React.CSSProperties}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 my-4 mr-4 rounded-xl overflow-hidden"
        style={{
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto bg-base">{children}</main>
      </div>
    </div>
  );
}

// ── Root redirect — redirects to dashboard ────────────────────────────────────
function RootRedirect() {
  const token     = useAuthStore((s) => s.token);
  const user      = useAuthStore((s) => s.user);

  if (!token) return <Navigate to="/login" replace />;
  // Wait for user to load before deciding
  if (!user)  return null;
  return user?.is_super_admin ? <Navigate to="/superadmin" replace /> : <Navigate to="/" replace />;
}

function SuperAdminRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  if (!token) return <Navigate to="/superadmin/login" replace />;
  if (!user && !isSuperAdmin) return null;
  if (!isSuperAdmin && (!user || !user.is_super_admin)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const token    = useAuthStore((s) => s.token);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const fetchMe  = useAuthStore((s) => s.fetchMe);
  const companyId = useAuthStore((s) => s.companyId);
  const loadCurrency = useCurrencyStore((s) => s.loadCurrency);

  const [bootstrapped, setBootstrapped] = useState(false);

  useRealtimeSocket(token);
  const reminderWs = useReminderWebSocket();
  useAppBootstrap(token, bootstrapped);
  useBackgroundRefresh(token);

  useEffect(() => {
    if (token) {
      bootstrap()
        .then(() => setBootstrapped(true))
        .catch(() => fetchMe().then(() => setBootstrapped(true)).catch(() => undefined));
    } else {
      setBootstrapped(false);
    }
  }, [token, bootstrap, fetchMe]);

  useEffect(() => {
    if (token && companyId !== null) {
      loadCurrency().catch(() => undefined);
    }
  }, [token, companyId, loadCurrency]);

  const pushToast = useNotifStore((s) => s.pushToast);
  useEffect(() => {
    if (reminderWs.missedCount > 0) {
      pushToast({
        title: "Missed Reminders",
        message: `You have ${reminderWs.missedCount} missed reminder(s)`,
        priority: "high",
      });
      reminderWs.setMissedCount(0);
    }
  }, [reminderWs.missedCount, pushToast, reminderWs]);

  return (
    <>
      <Suspense fallback={<ModuleLoadingSpinner />}>
      <Routes>
        {/* ── Public ──────────────────────────────────────────────────────── */}
        <Route path="/login"  element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
        <Route path="/superadmin/*" element={
          <SuperAdminRoute>
            <SuperAdminApp />
          </SuperAdminRoute>
        } />

        {/* ── RBAC role user routes ────────────────────────────────────────── */}
        <Route path="/setup-slug" element={<SlugSetupPage />} />
        <Route path="/change-password" element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        } />

        {/* ── Company Dashboard ────────────────────────────────────────────── */}
        <Route path="/" element={
          <RoleUserGuard>
            <ProtectedRoute>
              <CompanyLayout><DashboardPage /></CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Property module ──────────────────────────────────────────────── */}
        <Route path="/property" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer"]}>
              <CompanyLayout>
                <FeatureGuard feature="property_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="properties"><PropertyPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/property/:id" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer"]}>
              <CompanyLayout>
                <FeatureGuard feature="property_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="properties"><PropertyViewPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Town Management module ───────────────────────────────────────── */}
        <Route path="/towns" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer"]}>
              <CompanyLayout>
                <FeatureGuard feature="property_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="properties"><TownListPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/towns/:id" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer"]}>
              <CompanyLayout>
                <FeatureGuard feature="property_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="properties"><TownDetailPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── CRM module ───────────────────────────────────────────────────── */}
        <Route path="/crm" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="crm"><CRMPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/crm/leads/:id" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="crm"><LeadDetail /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/crm/clients/:id" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="crm"><ClientDetail /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/crm/deals/:id" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="crm"><DealDetail /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/crm/deals/:id/installment-plan" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="crm"><InstallmentPlanBuilder /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/crm/dealers/:id" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="crm"><DealerDetail /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/crm/bookings" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="crm"><BookingsPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/crm/bookings/:id" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="crm"><BookingDetailPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        {/* ── Finance module ───────────────────────────────────────────────── */}
        <Route path="/finance" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="finance_module" fallback={<DisabledModule />}>
                  <ErrorBoundary>
                    <ModuleGuard module="finance"><FinancePage /></ModuleGuard>
                  </ErrorBoundary>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Ledger → Finance (unified workspace) ─────────────────────────── */}
        <Route path="/ledger" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Accountant"]}>
              <Navigate to="/finance" replace state={{ financeTab: "ledger" }} />
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Tenant module ────────────────────────────────────────────────── */}
        <Route path="/tenants" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="tenant_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="tenants"><TenantPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/tenants/:id" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="tenant_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="tenants"><TenantDetailPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/maintenance" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="tenant_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="maintenance"><MaintenancePage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Admin ────────────────────────────────────────────────────────── */}
        <Route path="/admin" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin"]}>
              <CompanyLayout><AdminPage /></CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/import" element={
          <Navigate to="/reports?tab=import" replace />
        } />
        <Route path="/admin-panel" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin"]}>
              <CompanyLayout><AdminPanel /></CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Construction module ──────────────────────────────────────────── */}
        <Route path="/construction" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Manager","Staff","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="construction_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="construction"><ConstructionDashboard /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/construction/projects" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Manager","Staff","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="construction_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="construction"><ProjectList /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/construction/projects/:id/view" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Manager","Staff","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="construction_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="construction"><ProjectView /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/construction/projects/:id" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Manager","Staff","Accountant"]}>
              <CompanyLayout>
                <FeatureGuard feature="construction_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="construction"><ProjectDetails /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Spreadsheet ──────────────────────────────────────────────────── */}
        <Route path="/spreadsheet" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff"]}>
              <div className="app-shell flex h-screen overflow-hidden bg-base gap-4"
                data-theme={useUIStore.getState().theme}
                style={{ '--module-primary': '#008080', '--module-light': 'rgba(0,128,128,0.1)', '--module-medium': '#006666', '--module-dark': '#004040', '--module-text': '#008080' } as React.CSSProperties}
              >
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 my-0 mr-0 overflow-hidden p-0"
                  style={{ background: "var(--bg-surface)" }}
                >
                  <main className="flex-1 overflow-hidden p-0">
                    <SpreadsheetWorkspace />
                  </main>
                </div>
              </div>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Product Spreadsheet ──────────────────────────────────────────── */}
        <Route path="/products/spreadsheet" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Staff"]}>
              <CompanyLayout>
                <ProductSpreadsheetPage />
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Advance Options ──────────────────────────────────────────────── */}
        <Route path="/advance-options" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin"]}>
              <CompanyLayout><AdvanceOptionsPage /></CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Reminders module ─────────────────────────────────────────────── */}
        <Route path="/reminders" element={
          <RoleUserGuard>
            <ProtectedRoute>
              <CompanyLayout>
                <FeatureGuard feature="reminders_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="reminders"><RemindersPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── HR module ────────────────────────────────────────────────────── */}
        <Route path="/hr" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Manager"]}>
              <CompanyLayout>
                <FeatureGuard feature="hr_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="hr"><HRPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Mail module ──────────────────────────────────────────────────── */}
        <Route path="/mail" element={
          <RoleUserGuard>
            <ProtectedRoute>
              <CompanyLayout>
                <FeatureGuard feature="mail_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="communication"><MailPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Communication Hub (Email + WhatsApp) ─────────────────────────── */}
        <Route path="/communication" element={
          <RoleUserGuard>
            <ProtectedRoute>
              <CompanyLayout>
                <FeatureGuard feature="mail_module" fallback={<DisabledModule />}>
                  <ModuleGuard module="communication"><CommunicationPage /></ModuleGuard>
                </FeatureGuard>
              </CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Reports Center ───────────────────────────────────────────────── */}
        <Route path="/reports" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Accountant","Staff","Manager"]}>
              <CompanyLayout><ModuleGuard module="reports"><ReportsCenter /></ModuleGuard></CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/reports/run/:reportKey" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Accountant","Staff","Manager"]}>
              <CompanyLayout><ModuleGuard module="reports"><ReportRunner /></ModuleGuard></CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/reports/installment-plan" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Accountant","Staff","Manager"]}>
              <CompanyLayout><ModuleGuard module="reports"><InstallmentPlanReport /></ModuleGuard></CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />
        <Route path="/reports/booking-form" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin","Accountant","Staff","Manager"]}>
              <CompanyLayout><ModuleGuard module="reports"><BookingFormReport /></ModuleGuard></CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── AI Intelligence Center ────────────────────────────────────────── */}
        <Route path="/ai" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin"]}>
              <CompanyLayout><ModuleGuard module="ai"><AIIntelligencePage /></ModuleGuard></CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Activity History ────────────────────────────────────────────── */}
        <Route path="/history" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin"]}>
              <CompanyLayout><ModuleGuard module="history"><HistoryPage /></ModuleGuard></CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Recent Activity ──────────────────────────────────────────────── */}
        <Route path="/activity" element={
          <RoleUserGuard>
            <ProtectedRoute allowedRoles={["Admin"]}>
              <CompanyLayout><RecentActivityPage /></CompanyLayout>
            </ProtectedRoute>
          </RoleUserGuard>
        } />

        {/* ── Fallback ─────────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to={token ? "/" : "/login"} replace />} />
      </Routes>
      </Suspense>
      <ToastContainer />
      <NotificationCenter
        notifications={reminderWs.notifications}
        onDismiss={reminderWs.dismiss}
        onDismissAll={reminderWs.dismissAll}
        connected={reminderWs.connected}
      />
      <UpdateNotification />
      <ErrorTrackerPanel />
    </>
  );
}
