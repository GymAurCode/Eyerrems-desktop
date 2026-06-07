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

export function useAppBootstrap() {
  useEffect(() => {
    const store = useDataStore.getState();
    Promise.allSettled(FETCH_ALL.map((key) => (store as any)[key]()));
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
