import { useEffect } from "react";
import { useDataStore } from "../store/useDataStore";
import { useAuthStore } from "../store/auth";
import { setAuthReady } from "../lib/api";
import { checkPermissions } from "../lib/rbacApi";

const FETCH_ALL: (keyof import("../store/useDataStore").DataState & `fetch${string}`)[] = [
  "fetchProperties",
  "fetchUnits",
  "fetchLeases",
  "fetchTowns",
  "fetchLeads",
  "fetchClients",
  "fetchDealers",
  "fetchDeals",
  "fetchBookings",
  "fetchFollowUps",
  "fetchSiteVisits",
  "fetchAccounts",
  "fetchJournals",
  "fetchInvoices",
  "fetchPayments",
  "fetchCommissions",
  "fetchExpenses",
  "fetchBankTransactions",
  "fetchCashTransactions",
  "fetchDepartments",
  "fetchEmployees",
  "fetchAttendance",
  "fetchTenants",
  "fetchMaintenanceRequests",
  "fetchConstructionProjects",
  "fetchReminders",
];

const REFRESH_ALL: (keyof import("../store/useDataStore").DataState & `forceRefresh${string}`)[] = [
  "forceRefreshProperties",
  "forceRefreshLeads",
  "forceRefreshClients",
  "forceRefreshDeals",
  "forceRefreshAccounts",
  "forceRefreshEmployees",
];

const FETCH_TO_FLAG: Record<string, string> = {
  fetchProperties: "properties",
  fetchUnits: "units",
  fetchLeases: "leases",
  fetchTowns: "towns",
  fetchLeads: "leads",
  fetchClients: "clients",
  fetchDealers: "dealers",
  fetchDeals: "deals",
  fetchBookings: "bookings",
  fetchFollowUps: "followUps",
  fetchSiteVisits: "siteVisits",
  fetchAccounts: "accounts",
  fetchJournals: "journals",
  fetchInvoices: "invoices",
  fetchPayments: "payments",
  fetchCommissions: "commissions",
  fetchExpenses: "expenses",
  fetchBankTransactions: "bankTransactions",
  fetchCashTransactions: "cashTransactions",
  fetchDepartments: "departments",
  fetchEmployees: "employees",
  fetchAttendance: "attendance",
  fetchTenants: "tenants",
  fetchMaintenanceRequests: "maintenanceRequests",
  fetchConstructionProjects: "constructionProjects",
  fetchReminders: "reminders",
};

const FETCH_TO_MODULE: Record<string, string> = {
  fetchProperties: "properties",
  fetchUnits: "properties",
  fetchLeases: "properties",
  fetchTowns: "towns",
  fetchLeads: "crm",
  fetchClients: "crm",
  fetchDealers: "crm",
  fetchDeals: "crm",
  fetchBookings: "crm",
  fetchFollowUps: "crm",
  fetchSiteVisits: "crm",
  fetchAccounts: "finance",
  fetchJournals: "finance",
  fetchInvoices: "finance",
  fetchPayments: "finance",
  fetchCommissions: "finance",
  fetchExpenses: "finance",
  fetchBankTransactions: "finance",
  fetchCashTransactions: "finance",
  fetchDepartments: "hr",
  fetchEmployees: "hr",
  fetchAttendance: "hr",
  fetchTenants: "tenants",
  fetchMaintenanceRequests: "maintenance",
  fetchConstructionProjects: "construction",
  fetchReminders: "reminders",
};

function hasModuleViewAccess(permMap: Record<string, any>, moduleKey: string): boolean {
  if (permMap["*"]) return true;
  const modulePerms = permMap[moduleKey];
  if (!modulePerms) return false;
  return Object.values(modulePerms).some((t: any) => t.view);
}

function filterFetchesByPermission(keys: string[], permMap: Record<string, any>): string[] {
  return keys.filter(key => {
    const mod = FETCH_TO_MODULE[key];
    if (!mod) return true;
    return hasModuleViewAccess(permMap, mod);
  });
}

async function runBatchConcurrently(
  keys: string[],
  concurrency = 4,
) {
  for (let i = 0; i < keys.length; i += concurrency) {
    const batch = keys.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (key) => {
        const store = useDataStore.getState();
        try {
          await (store as any)[key]();
        } catch (err) {
          const flag = FETCH_TO_FLAG[key];
          if (flag) {
            useDataStore.setState(s => ({
              _fetched: { ...s._fetched, [flag]: true },
            }));
          }
        }
      }),
    );
  }
}

export function useAppBootstrap(token?: string | null, ready = false) {
  useEffect(() => {
    if (!token || !ready) return;

    const { isSuperAdmin } = useAuthStore.getState();

    if (isSuperAdmin) {
      runBatchConcurrently(FETCH_ALL, 4).finally(() => {
        setAuthReady(true);
      });
      return;
    }

    checkPermissions()
      .then(result => {
        const permMap = result.permissions ?? {};
        const allowed = filterFetchesByPermission(FETCH_ALL, permMap);
        return runBatchConcurrently(allowed, 4);
      })
      .catch(() => runBatchConcurrently(FETCH_ALL, 4))
      .finally(() => {
        setAuthReady(true);
      });
  }, [token, ready]);
}

export function useBackgroundRefresh(token?: string | null, intervalMs = 5 * 60 * 1000) {
  useEffect(() => {
    if (!token) return;

    const refresh = () => {
      const store = useDataStore.getState();
      const { isSuperAdmin } = useAuthStore.getState();
      if (isSuperAdmin) {
        Promise.allSettled(REFRESH_ALL.map((key) => (store as any)[key]()));
        return;
      }
      checkPermissions()
        .then(result => {
          const permMap = result.permissions ?? {};
          const allowed = filterFetchesByPermission(REFRESH_ALL, permMap);
          Promise.allSettled(allowed.map((key) => (store as any)[key]()));
        })
        .catch(() => {
          Promise.allSettled(REFRESH_ALL.map((key) => (store as any)[key]()));
        });
    };

    const interval = setInterval(refresh, intervalMs);
    return () => clearInterval(interval);
  }, [token, intervalMs]);
}
