import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

// ── Auth / guards ─────────────────────────────────────────────────────────────
import { useAuthStore } from "./store/auth";
import { useUIStore } from "./store/ui";
import { useCurrencyStore } from "./store/currency";
import { useRealtimeSocket } from "./hooks/useWebSocket";
import { useAppBootstrap, useBackgroundRefresh } from "./hooks/useAppBootstrap";
import ProtectedRoute from "./components/ProtectedRoute";
import FeatureGuard from "./components/FeatureGuard";
import ToastContainer from "./components/notifications/ToastContainer";
import { ErrorTrackerPanel } from "./components/ErrorTracker";
import { ErrorBoundary } from "./components/ErrorBoundary";
import UpdateNotification from "./components/UpdateNotification";

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
const AdvanceOptionsPage = lazy(() => import("./pages/AdvanceOptions"));

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
  "/towns":        "Town Management",
  "/crm":          "Clients",
  "/finance":      "Finance",
  "/tenants":      "Tenants",
  "/maintenance":  "Maintenance",
  "/admin":        "Administration",
  "/import":       "Bulk Import",
  "/admin-panel":  "Admin Panel - RBAC",
  "/construction": "Construction",
  "/hr":           "Human Resources",
  "/reminders":    "Reminders & Notifications",
  "/mail":         "Mail",
  "/communication": "Communication",
  "/ledger":       "Ledger Management",
  "/reports":      "Reports",
  "/ai":           "AI Intelligence",
  "/history":      "Activity History",
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
      className="app-shell flex h-screen overflow-hidden bg-base"
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
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
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

  useRealtimeSocket(token);
  useAppBootstrap();
  useBackgroundRefresh();

  useEffect(() => {
    if (token) {
      // Use bootstrap on initial load — hydrates user + stats + activity in one call.
      // Falls back to fetchMe if bootstrap fails (e.g. super-admin without stats access).
      bootstrap().catch(() => fetchMe().catch(() => undefined));
    }
  }, [token, bootstrap, fetchMe]);

  // Load currency setting after authentication
  useEffect(() => {
    if (token && companyId !== null) {
      loadCurrency().catch(() => undefined);
    }
  }, [token, companyId, loadCurrency]);

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

        {/* ── Company Dashboard ────────────────────────────────────────────── */}
        <Route path="/" element={
          <ProtectedRoute>
            <CompanyLayout><DashboardPage /></CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Property module ──────────────────────────────────────────────── */}
        <Route path="/property" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer"]}>
            <CompanyLayout>
              <FeatureGuard feature="property_module" fallback={<DisabledModule />}>
                <PropertyPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/property/:id" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer"]}>
            <CompanyLayout>
              <FeatureGuard feature="property_module" fallback={<DisabledModule />}>
                <PropertyViewPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Town Management module ───────────────────────────────────────── */}
        <Route path="/towns" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer"]}>
            <CompanyLayout>
              <FeatureGuard feature="property_module" fallback={<DisabledModule />}>
                <TownListPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/towns/:id" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer"]}>
            <CompanyLayout>
              <FeatureGuard feature="property_module" fallback={<DisabledModule />}>
                <TownDetailPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── CRM module ───────────────────────────────────────────────────── */}        <Route path="/crm" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                <CRMPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/crm/leads/:id" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                <LeadDetail />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/crm/clients/:id" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                <ClientDetail />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/crm/deals/:id" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                <DealDetail />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/crm/deals/:id/installment-plan" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                <InstallmentPlanBuilder />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/crm/dealers/:id" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                <DealerDetail />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/crm/bookings" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                <BookingsPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/crm/bookings/:id" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Dealer","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="crm_module" fallback={<DisabledModule />}>
                <BookingDetailPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Finance module ───────────────────────────────────────────────── */}
        <Route path="/finance" element={
          <ProtectedRoute allowedRoles={["Admin","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="finance_module" fallback={<DisabledModule />}>
                <ErrorBoundary>
                  <FinancePage />
                </ErrorBoundary>
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Ledger → Finance (unified workspace) ─────────────────────────── */}
        <Route path="/ledger" element={
          <ProtectedRoute allowedRoles={["Admin","Accountant"]}>
            <Navigate to="/finance" replace state={{ financeTab: "ledger" }} />
          </ProtectedRoute>
        } />

        {/* ── Tenant module ────────────────────────────────────────────────── */}
        <Route path="/tenants" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="tenant_module" fallback={<DisabledModule />}>
                <TenantPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/tenants/:id" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="tenant_module" fallback={<DisabledModule />}>
                <TenantDetailPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/maintenance" element={
          <ProtectedRoute allowedRoles={["Admin","Staff","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="tenant_module" fallback={<DisabledModule />}>
                <MaintenancePage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Admin ────────────────────────────────────────────────────────── */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={["Admin"]}>
            <CompanyLayout><AdminPage /></CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/import" element={
          <Navigate to="/reports?tab=import" replace />
        } />
        <Route path="/admin-panel" element={
          <ProtectedRoute allowedRoles={["Admin"]}>
            <CompanyLayout><AdminPanel /></CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Construction module ──────────────────────────────────────────── */}
        <Route path="/construction" element={
          <ProtectedRoute allowedRoles={["Admin","Manager","Staff","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="construction_module" fallback={<DisabledModule />}>
                <ConstructionDashboard />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/construction/projects" element={
          <ProtectedRoute allowedRoles={["Admin","Manager","Staff","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="construction_module" fallback={<DisabledModule />}>
                <ProjectList />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/construction/projects/:id" element={
          <ProtectedRoute allowedRoles={["Admin","Manager","Staff","Accountant"]}>
            <CompanyLayout>
              <FeatureGuard feature="construction_module" fallback={<DisabledModule />}>
                <ProjectDetails />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Advance Options ──────────────────────────────────────────────── */}
        <Route path="/advance-options" element={
          <ProtectedRoute allowedRoles={["Admin"]}>
            <CompanyLayout><AdvanceOptionsPage /></CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Reminders module ─────────────────────────────────────────────── */}
        <Route path="/reminders" element={
          <ProtectedRoute>
            <CompanyLayout>
              <FeatureGuard feature="reminders_module" fallback={<DisabledModule />}>
                <RemindersPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── HR module ────────────────────────────────────────────────────── */}
        <Route path="/hr" element={
          <ProtectedRoute allowedRoles={["Admin","Manager"]}>
            <CompanyLayout>
              <FeatureGuard feature="hr_module" fallback={<DisabledModule />}>
                <HRPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Mail module ──────────────────────────────────────────────────── */}
        <Route path="/mail" element={
          <ProtectedRoute>
            <CompanyLayout>
              <FeatureGuard feature="mail_module" fallback={<DisabledModule />}>
                <MailPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Communication Hub (Email + WhatsApp) ─────────────────────────── */}
        <Route path="/communication" element={
          <ProtectedRoute>
            <CompanyLayout>
              <FeatureGuard feature="mail_module" fallback={<DisabledModule />}>
                <CommunicationPage />
              </FeatureGuard>
            </CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Reports Center ───────────────────────────────────────────────── */}
        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={["Admin","Accountant","Staff","Manager"]}>
            <CompanyLayout><ReportsCenter /></CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/reports/run/:reportKey" element={
          <ProtectedRoute allowedRoles={["Admin","Accountant","Staff","Manager"]}>
            <CompanyLayout><ReportRunner /></CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/reports/installment-plan" element={
          <ProtectedRoute allowedRoles={["Admin","Accountant","Staff","Manager"]}>
            <CompanyLayout><InstallmentPlanReport /></CompanyLayout>
          </ProtectedRoute>
        } />
        <Route path="/reports/booking-form" element={
          <ProtectedRoute allowedRoles={["Admin","Accountant","Staff","Manager"]}>
            <CompanyLayout><BookingFormReport /></CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── AI Intelligence Center ────────────────────────────────────────── */}
        <Route path="/ai" element={
          <ProtectedRoute allowedRoles={["Admin"]}>
            <CompanyLayout><AIIntelligencePage /></CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Activity History ────────────────────────────────────────────── */}
        <Route path="/history" element={
          <ProtectedRoute allowedRoles={["Admin"]}>
            <CompanyLayout><HistoryPage /></CompanyLayout>
          </ProtectedRoute>
        } />

        {/* ── Fallback ─────────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to={token ? "/" : "/login"} replace />} />
      </Routes>
      </Suspense>
      <ToastContainer />
      <UpdateNotification />
      <ErrorTrackerPanel />
    </>
  );
}
