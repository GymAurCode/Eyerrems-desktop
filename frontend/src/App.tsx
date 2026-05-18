import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";

// ── Auth / guards ─────────────────────────────────────────────────────────────
import { useAuthStore } from "./store/auth";
import { useUIStore } from "./store/ui";
import { useCurrencyStore } from "./store/currency";
import { useRealtimeSocket } from "./hooks/useWebSocket";
import ProtectedRoute from "./components/ProtectedRoute";
import SuperAdminRoute from "./components/SuperAdminRoute";
import FeatureGuard from "./components/FeatureGuard";
import ToastContainer from "./components/notifications/ToastContainer";

// ── Layouts ───────────────────────────────────────────────────────────────────
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import SuperAdminLayout from "./layouts/SuperAdminLayout";

// ── Public pages ──────────────────────────────────────────────────────────────
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";

// ── Company pages ─────────────────────────────────────────────────────────────
import DashboardPage from "./pages/Dashboard";
import PropertyPage from "./pages/Property";
import PropertyViewPage from "./pages/PropertyView";
import CRMPage from "./pages/CRM";
import LeadDetail from "./pages/crm/LeadDetail";
import ClientDetail from "./pages/crm/ClientDetail";
import DealDetail from "./pages/crm/DealDetail";
import InstallmentPlanBuilder from "./pages/crm/InstallmentPlanBuilder";
import FinancePage from "./pages/Finance";
import AdminPage from "./pages/Admin";
import AdminPanel from "./pages/AdminPanel";
import TenantPage from "./pages/Tenant";
import TenantDetailPage from "./pages/TenantDetail";
import MaintenancePage from "./pages/Maintenance";
import ConstructionDashboard from "./modules/construction/ConstructionDashboard";
import ProjectList from "./modules/construction/ProjectList";
import ProjectDetails from "./modules/construction/ProjectDetails";
import RemindersPage from "./pages/Reminders";
import HRPage from "./pages/HR";
import MailPage from "./pages/Mail";
// ── Communication Hub ─────────────────────────────────────────────────────────
import CommunicationPage from "./pages/Communication";
import TownListPage from "./pages/towns/TownList";
import TownDetailPage from "./pages/towns/TownDetail";
import BookingsPage from "./pages/Bookings";
import BookingDetailPage from "./pages/crm/bookings/BookingDetail";
// ── Reports Center ────────────────────────────────────────────────────────────
import ReportsCenter from "./pages/reports/ReportsCenter";
import ReportRunner from "./pages/reports/ReportRunner";
import InstallmentPlanReport from "./pages/reports/InstallmentPlanReport";
import BookingFormReport from "./pages/reports/BookingFormReport";
// ── AI Intelligence Center ────────────────────────────────────────────────────
import AIIntelligencePage from "./pages/AIIntelligence";
import ImportCenter from "./pages/ImportCenter";

// ── Super Admin pages ─────────────────────────────────────────────────────────
import SADashboard     from "./pages/superadmin/SADashboard";
import SACompanies     from "./pages/superadmin/SACompanies";
import SACreateCompany from "./pages/superadmin/SACreateCompany";
import SACompanyDetail from "./pages/superadmin/SACompanyDetail";
import SAFeatures      from "./pages/superadmin/SAFeatures";
import SAUsers         from "./pages/superadmin/SAUsers";
import SALogs          from "./pages/superadmin/SALogs";

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
};

function DisabledModule() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-center">
      <p className="text-2xl font-semibold mb-2">Module Disabled</p>
      <p className="text-gray-500">This module is not enabled for your company.</p>
    </div>
  );
}

// ── Company layout (existing sidebar + topbar) ────────────────────────────────
function CompanyLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const theme    = useUIStore((s) => s.theme);
  const base     = "/" + location.pathname.split("/")[1];
  const title    = PAGE_TITLES[base] ?? PAGE_TITLES[location.pathname] ?? "";
  return (
    <div className="app-shell flex h-screen overflow-hidden bg-base" data-theme={theme}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto bg-base">{children}</main>
      </div>
    </div>
  );
}

// ── Root redirect — sends super-admin to /super-admin, others to / ────────────
function RootRedirect() {
  const token        = useAuthStore((s) => s.token);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const user         = useAuthStore((s) => s.user);

  if (!token) return <Navigate to="/login" replace />;
  // Wait for user to load before deciding
  if (!user)  return null;
  if (isSuperAdmin) return <Navigate to="/super-admin" replace />;
  return <Navigate to="/" replace />;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const token    = useAuthStore((s) => s.token);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const fetchMe  = useAuthStore((s) => s.fetchMe);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const loadCurrency = useCurrencyStore((s) => s.loadCurrency);

  useRealtimeSocket(token);

  useEffect(() => {
    if (token) {
      // Use bootstrap on initial load — hydrates user + stats + activity in one call.
      // Falls back to fetchMe if bootstrap fails (e.g. super-admin without stats access).
      bootstrap().catch(() => fetchMe().catch(() => undefined));
    }
  }, [token, bootstrap, fetchMe]);

  // Load currency setting after authentication (skip for super-admin — no company context)
  useEffect(() => {
    if (token && !isSuperAdmin) {
      loadCurrency().catch(() => undefined);
    }
  }, [token, isSuperAdmin, loadCurrency]);

  return (
    <>
      <Routes>
        {/* ── Public ──────────────────────────────────────────────────────── */}
        <Route path="/login"  element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* ── Super Admin — completely separate UI ────────────────────────── */}
        <Route path="/super-admin" element={
          <SuperAdminRoute>
            <SuperAdminLayout><SADashboard /></SuperAdminLayout>
          </SuperAdminRoute>
        } />
        <Route path="/super-admin/companies" element={
          <SuperAdminRoute>
            <SuperAdminLayout><SACompanies /></SuperAdminLayout>
          </SuperAdminRoute>
        } />
        <Route path="/super-admin/companies/new" element={
          <SuperAdminRoute>
            <SuperAdminLayout><SACreateCompany /></SuperAdminLayout>
          </SuperAdminRoute>
        } />
        <Route path="/super-admin/companies/:id" element={
          <SuperAdminRoute>
            <SuperAdminLayout><SACompanyDetail /></SuperAdminLayout>
          </SuperAdminRoute>
        } />
        <Route path="/super-admin/companies/:id/features" element={
          <SuperAdminRoute>
            <SuperAdminLayout><SAFeatures /></SuperAdminLayout>
          </SuperAdminRoute>
        } />
        <Route path="/super-admin/companies/:id/users" element={
          <SuperAdminRoute>
            <SuperAdminLayout><SACompanyDetail /></SuperAdminLayout>
          </SuperAdminRoute>
        } />
        <Route path="/super-admin/features" element={
          <SuperAdminRoute>
            <SuperAdminLayout><SAFeatures /></SuperAdminLayout>
          </SuperAdminRoute>
        } />
        <Route path="/super-admin/users" element={
          <SuperAdminRoute>
            <SuperAdminLayout><SAUsers /></SuperAdminLayout>
          </SuperAdminRoute>
        } />
        <Route path="/super-admin/logs" element={
          <SuperAdminRoute>
            <SuperAdminLayout><SALogs /></SuperAdminLayout>
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
                <FinancePage />
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
          <ProtectedRoute allowedRoles={["Admin", "Manager"]}>
            <CompanyLayout><ImportCenter /></CompanyLayout>
          </ProtectedRoute>
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

        {/* ── Fallback ─────────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to={token ? "/" : "/login"} replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
