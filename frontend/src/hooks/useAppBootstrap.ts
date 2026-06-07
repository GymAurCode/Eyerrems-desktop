import { useEffect } from "react";
import { useDataStore } from "../store/useDataStore";

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

export function useAppBootstrap() {
  useEffect(() => {
    runBatchConcurrently(FETCH_ALL, 4);
  }, []);
}

export function useBackgroundRefresh(intervalMs = 5 * 60 * 1000) {
  useEffect(() => {
    const interval = setInterval(() => {
      const store = useDataStore.getState();
      Promise.allSettled(REFRESH_ALL.map((key) => (store as any)[key]()));
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
}
