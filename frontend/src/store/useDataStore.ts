import { create } from "zustand";
import { propApi } from "../lib/propertyApi";
import { crmApi, type Lead, type Client, type Dealer, type Deal } from "../lib/crmApi";
import {
  accountsApi, journalsApi, invoicesApi, paymentsApi,
  commissionsApi, expensesApi, bankCashApi,
  type Account, type Invoice, type Payment, type Commission,
  type Expense, type Journal,
} from "../lib/financeApi";
import {
  departmentsApi, employeesApi, attendanceApi,
  type Department, type Employee,
} from "../lib/hrApi";
import { tenantApi } from "../lib/tenantApi";
import { townApi } from "../lib/townApi";
import { remindersApi } from "../lib/remindersApi";
import { bookingApi } from "../lib/bookingApi";
import { constructionApi } from "../lib/constructionApi";
import { useNotifStore } from "./notifications";

// ── Types ───────────────────────────────────────────────────────────────────

type FetchedFlags = {
  properties: boolean;
  units: boolean;
  leases: boolean;
  towns: boolean;
  leads: boolean;
  clients: boolean;
  dealers: boolean;
  deals: boolean;
  bookings: boolean;
  followUps: boolean;
  siteVisits: boolean;
  accounts: boolean;
  journals: boolean;
  invoices: boolean;
  payments: boolean;
  commissions: boolean;
  expenses: boolean;
  bankTransactions: boolean;
  cashTransactions: boolean;
  departments: boolean;
  employees: boolean;
  attendance: boolean;
  tenants: boolean;
  maintenanceRequests: boolean;
  constructionProjects: boolean;
  reminders: boolean;
};

// ── Store ───────────────────────────────────────────────────────────────────

export type DataState = {
  // Property
  properties: any[];
  units: any[];
  leases: any[];
  towns: any[];
  // CRM
  leads: Lead[];
  clients: Client[];
  dealers: Dealer[];
  deals: Deal[];
  bookings: any[];
  followUps: any[];
  siteVisits: any[];
  // Finance
  accounts: Account[];
  journals: Journal[];
  invoices: Invoice[];
  payments: Payment[];
  commissions: Commission[];
  expenses: Expense[];
  bankTransactions: any[];
  cashTransactions: any[];
  // HR
  departments: Department[];
  employees: Employee[];
  attendance: any[];
  // Other
  tenants: any[];
  maintenanceRequests: any[];
  constructionProjects: any[];
  reminders: any[];

  _fetched: FetchedFlags;

  // Property actions
  fetchProperties: () => Promise<any[]>;
  fetchUnits: () => Promise<any[]>;
  fetchLeases: () => Promise<any[]>;
  fetchTowns: () => Promise<any[]>;

  // CRM actions
  fetchLeads: () => Promise<Lead[]>;
  fetchClients: () => Promise<Client[]>;
  fetchDealers: () => Promise<Dealer[]>;
  fetchDeals: () => Promise<Deal[]>;
  fetchBookings: () => Promise<any[]>;
  fetchFollowUps: () => Promise<any[]>;
  fetchSiteVisits: () => Promise<any[]>;

  // Finance actions
  fetchAccounts: () => Promise<Account[]>;
  fetchJournals: () => Promise<Journal[]>;
  fetchInvoices: () => Promise<Invoice[]>;
  fetchPayments: () => Promise<Payment[]>;
  fetchCommissions: () => Promise<Commission[]>;
  fetchExpenses: () => Promise<Expense[]>;
  fetchBankTransactions: () => Promise<any[]>;
  fetchCashTransactions: () => Promise<any[]>;

  // HR actions
  fetchDepartments: () => Promise<Department[]>;
  fetchEmployees: () => Promise<Employee[]>;
  fetchAttendance: () => Promise<any[]>;

  // Other actions
  fetchTenants: () => Promise<any[]>;
  fetchMaintenanceRequests: () => Promise<any[]>;
  fetchConstructionProjects: () => Promise<any[]>;
  fetchReminders: () => Promise<any[]>;

  // Force refresh controllers
  forceRefreshProperties: () => Promise<any[]>;
  forceRefreshLeads: () => Promise<Lead[]>;
  forceRefreshClients: () => Promise<Client[]>;
  forceRefreshDeals: () => Promise<Deal[]>;
  forceRefreshAccounts: () => Promise<Account[]>;
  forceRefreshEmployees: () => Promise<Employee[]>;

  // Optimistic CRUD helpers
  addLead: (data: Partial<Lead>) => Promise<Lead>;
  updateLead: (id: number, updates: Partial<Lead>) => Promise<void>;
  deleteLead: (id: number) => Promise<void>;
  addClient: (data: Partial<Client>) => Promise<Client>;
  updateClient: (id: number, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: number) => Promise<void>;
  addDealer: (data: Partial<Dealer>) => Promise<Dealer>;
  updateDealer: (id: number, updates: Partial<Dealer>) => Promise<void>;
  deleteDealer: (id: number) => Promise<void>;
  addDeal: (data: Partial<Deal>) => Promise<Deal>;
  updateDeal: (id: number, updates: Partial<Deal>) => Promise<void>;
  deleteDeal: (id: number) => Promise<void>;
  addAccount: (data: Partial<Account>) => Promise<Account>;
  updateAccount: (id: number, updates: Partial<Account>) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
  addInvoice: (data: Partial<Invoice>) => Promise<Invoice>;
  addPayment: (data: Partial<Payment>) => Promise<void>;
  addExpense: (data: Partial<Expense>) => Promise<Expense>;
  updateExpense: (id: number, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;
  addEmployee: (data: Partial<Employee>) => Promise<Employee>;
  updateEmployee: (id: number, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: number) => Promise<void>;
};

let tempIdCounter = 0;
function tempId() {
  return -(Date.now() + (++tempIdCounter));
}

export const useDataStore = create<DataState>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  properties: [],
  units: [],
  leases: [],
  towns: [],
  leads: [],
  clients: [],
  dealers: [],
  deals: [],
  bookings: [],
  followUps: [],
  siteVisits: [],
  accounts: [],
  journals: [],
  invoices: [],
  payments: [],
  commissions: [],
  expenses: [],
  bankTransactions: [],
  cashTransactions: [],
  departments: [],
  employees: [],
  attendance: [],
  tenants: [],
  maintenanceRequests: [],
  constructionProjects: [],
  reminders: [],

  _fetched: {
    properties: false,
    units: false,
    leases: false,
    towns: false,
    leads: false,
    clients: false,
    dealers: false,
    deals: false,
    bookings: false,
    followUps: false,
    siteVisits: false,
    accounts: false,
    journals: false,
    invoices: false,
    payments: false,
    commissions: false,
    expenses: false,
    bankTransactions: false,
    cashTransactions: false,
    departments: false,
    employees: false,
    attendance: false,
    tenants: false,
    maintenanceRequests: false,
    constructionProjects: false,
    reminders: false,
  },

  // ── Property ───────────────────────────────────────────────────────────────

  fetchProperties: async () => {
    if (get()._fetched.properties) return get().properties;
    const data = await propApi.getProperties();
    set(s => ({ properties: data, _fetched: { ...s._fetched, properties: true } }));
    return data;
  },

  fetchUnits: async () => {
    if (get()._fetched.units) return get().units;
    const data = await propApi.getUnits();
    set(s => ({ units: data, _fetched: { ...s._fetched, units: true } }));
    return data;
  },

  fetchLeases: async () => {
    if (get()._fetched.leases) return get().leases;
    const data = await propApi.getLeases();
    set(s => ({ leases: data, _fetched: { ...s._fetched, leases: true } }));
    return data;
  },

  fetchTowns: async () => {
    if (get()._fetched.towns) return get().towns;
    const data = await townApi.listTowns();
    set(s => ({ towns: data, _fetched: { ...s._fetched, towns: true } }));
    return data;
  },

  // ── CRM ────────────────────────────────────────────────────────────────────

  fetchLeads: async () => {
    if (get()._fetched.leads) return get().leads;
    const data = await crmApi.getLeads();
    set(s => ({ leads: data, _fetched: { ...s._fetched, leads: true } }));
    return data;
  },

  fetchClients: async () => {
    if (get()._fetched.clients) return get().clients;
    const data = await crmApi.getClients();
    set(s => ({ clients: data, _fetched: { ...s._fetched, clients: true } }));
    return data;
  },

  fetchDealers: async () => {
    if (get()._fetched.dealers) return get().dealers;
    const data = await crmApi.getDealers();
    set(s => ({ dealers: data, _fetched: { ...s._fetched, dealers: true } }));
    return data;
  },

  fetchDeals: async () => {
    if (get()._fetched.deals) return get().deals;
    const data = await crmApi.getDeals();
    set(s => ({ deals: data, _fetched: { ...s._fetched, deals: true } }));
    return data;
  },

  fetchBookings: async () => {
    if (get()._fetched.bookings) return get().bookings;
    const res = await bookingApi.list();
    const data = Array.isArray(res) ? res : (res as any).items ?? [];
    set(s => ({ bookings: data, _fetched: { ...s._fetched, bookings: true } }));
    return data;
  },

  fetchFollowUps: async () => {
    if (get()._fetched.followUps) return get().followUps;
    const data = await crmApi.getFollowUps();
    set(s => ({ followUps: data, _fetched: { ...s._fetched, followUps: true } }));
    return data;
  },

  fetchSiteVisits: async () => {
    if (get()._fetched.siteVisits) return get().siteVisits;
    const data = await crmApi.getSiteVisits();
    set(s => ({ siteVisits: data, _fetched: { ...s._fetched, siteVisits: true } }));
    return data;
  },

  // ── Finance ────────────────────────────────────────────────────────────────

  fetchAccounts: async () => {
    if (get()._fetched.accounts) return get().accounts;
    const data = await accountsApi.list();
    set(s => ({ accounts: data, _fetched: { ...s._fetched, accounts: true } }));
    return data;
  },

  fetchJournals: async () => {
    if (get()._fetched.journals) return get().journals;
    const data = await journalsApi.list();
    set(s => ({ journals: data, _fetched: { ...s._fetched, journals: true } }));
    return data;
  },

  fetchInvoices: async () => {
    if (get()._fetched.invoices) return get().invoices;
    const data = await invoicesApi.list();
    set(s => ({ invoices: data, _fetched: { ...s._fetched, invoices: true } }));
    return data;
  },

  fetchPayments: async () => {
    if (get()._fetched.payments) return get().payments;
    const data = await paymentsApi.list();
    set(s => ({ payments: data, _fetched: { ...s._fetched, payments: true } }));
    return data;
  },

  fetchCommissions: async () => {
    if (get()._fetched.commissions) return get().commissions;
    const data = await commissionsApi.list();
    set(s => ({ commissions: data, _fetched: { ...s._fetched, commissions: true } }));
    return data;
  },

  fetchExpenses: async () => {
    if (get()._fetched.expenses) return get().expenses;
    const data = await expensesApi.list();
    set(s => ({ expenses: data, _fetched: { ...s._fetched, expenses: true } }));
    return data;
  },

  fetchBankTransactions: async () => {
    if (get()._fetched.bankTransactions) return get().bankTransactions;
    const data = await bankCashApi.bankTransactions();
    set(s => ({ bankTransactions: data, _fetched: { ...s._fetched, bankTransactions: true } }));
    return data;
  },

  fetchCashTransactions: async () => {
    if (get()._fetched.cashTransactions) return get().cashTransactions;
    const data = await bankCashApi.cashTransactions();
    set(s => ({ cashTransactions: data, _fetched: { ...s._fetched, cashTransactions: true } }));
    return data;
  },

  // ── HR ─────────────────────────────────────────────────────────────────────

  fetchDepartments: async () => {
    if (get()._fetched.departments) return get().departments;
    const data = await departmentsApi.list();
    set(s => ({ departments: data, _fetched: { ...s._fetched, departments: true } }));
    return data;
  },

  fetchEmployees: async () => {
    if (get()._fetched.employees) return get().employees;
    const data = await employeesApi.list();
    set(s => ({ employees: data, _fetched: { ...s._fetched, employees: true } }));
    return data;
  },

  fetchAttendance: async () => {
    if (get()._fetched.attendance) return get().attendance;
    const data = await attendanceApi.list();
    set(s => ({ attendance: data, _fetched: { ...s._fetched, attendance: true } }));
    return data;
  },

  // ── Other ──────────────────────────────────────────────────────────────────

  fetchTenants: async () => {
    if (get()._fetched.tenants) return get().tenants;
    const data = await tenantApi.list();
    set(s => ({ tenants: data, _fetched: { ...s._fetched, tenants: true } }));
    return data;
  },

  fetchMaintenanceRequests: async () => {
    if (get()._fetched.maintenanceRequests) return get().maintenanceRequests;
    const data = await tenantApi.list();
    set(s => ({ maintenanceRequests: data, _fetched: { ...s._fetched, maintenanceRequests: true } }));
    return data;
  },

  fetchConstructionProjects: async () => {
    if (get()._fetched.constructionProjects) return get().constructionProjects;
    const data = await constructionApi.listProjects();
    set(s => ({ constructionProjects: data, _fetched: { ...s._fetched, constructionProjects: true } }));
    return data;
  },

  fetchReminders: async () => {
    if (get()._fetched.reminders) return get().reminders;
    const data = await remindersApi.list();
    set(s => ({ reminders: data, _fetched: { ...s._fetched, reminders: true } }));
    return data;
  },

  // ── Force Refresh ──────────────────────────────────────────────────────────

  forceRefreshProperties: async () => {
    const data = await propApi.getProperties();
    set(s => ({ properties: data, _fetched: { ...s._fetched, properties: true } }));
    return data;
  },

  forceRefreshLeads: async () => {
    const data = await crmApi.getLeads();
    set(s => ({ leads: data, _fetched: { ...s._fetched, leads: true } }));
    return data;
  },

  forceRefreshClients: async () => {
    const data = await crmApi.getClients();
    set(s => ({ clients: data, _fetched: { ...s._fetched, clients: true } }));
    return data;
  },

  forceRefreshDeals: async () => {
    const data = await crmApi.getDeals();
    set(s => ({ deals: data, _fetched: { ...s._fetched, deals: true } }));
    return data;
  },

  forceRefreshAccounts: async () => {
    const data = await accountsApi.list();
    set(s => ({ accounts: data, _fetched: { ...s._fetched, accounts: true } }));
    return data;
  },

  forceRefreshEmployees: async () => {
    const data = await employeesApi.list();
    set(s => ({ employees: data, _fetched: { ...s._fetched, employees: true } }));
    return data;
  },

  // ── Optimistic CRUD: Leads ─────────────────────────────────────────────────

  addLead: async (leadData) => {
    const tid = tempId();
    const newLead = { ...leadData, id: tid, created_at: new Date().toISOString() } as any;
    set(s => ({ leads: [newLead, ...s.leads] }));
    try {
      const saved = await crmApi.createLead(leadData);
      set(s => ({ leads: s.leads.map(l => l.id === tid ? saved : l) }));
      return saved;
    } catch {
      set(s => ({ leads: s.leads.filter(l => l.id !== tid) }));
      throw new Error("Failed to save lead");
    }
  },

  updateLead: async (id, updates) => {
    const prev = get().leads;
    set(s => ({ leads: s.leads.map(l => l.id === id ? { ...l, ...updates } : l) }));
    try {
      await crmApi.updateLead(id, updates);
    } catch {
      set({ leads: prev });
      throw new Error("Failed to update lead");
    }
  },

  deleteLead: async (id) => {
    const prev = get().leads;
    set(s => ({ leads: s.leads.filter(l => l.id !== id) }));
    try {
      await crmApi.deleteLead(id);
    } catch {
      set({ leads: prev });
      throw new Error("Failed to delete lead");
    }
  },

  // ── Optimistic CRUD: Clients ───────────────────────────────────────────────

  addClient: async (data) => {
    const tid = tempId();
    const newItem = { ...data, id: tid, created_at: new Date().toISOString() } as any;
    set(s => ({ clients: [newItem, ...s.clients] }));
    try {
      const saved = await crmApi.createClient(data);
      set(s => ({ clients: s.clients.map(c => c.id === tid ? saved : c) }));
      return saved;
    } catch {
      set(s => ({ clients: s.clients.filter(c => c.id !== tid) }));
      throw new Error("Failed to save client");
    }
  },

  updateClient: async (id, updates) => {
    const prev = get().clients;
    set(s => ({ clients: s.clients.map(c => c.id === id ? { ...c, ...updates } : c) }));
    try {
      await crmApi.updateClient(id, updates);
    } catch {
      set({ clients: prev });
      throw new Error("Failed to update client");
    }
  },

  deleteClient: async (id) => {
    const prev = get().clients;
    set(s => ({ clients: s.clients.filter(c => c.id !== id) }));
    try {
      await crmApi.deleteClient(id);
    } catch {
      set({ clients: prev });
      throw new Error("Failed to delete client");
    }
  },

  // ── Optimistic CRUD: Dealers ───────────────────────────────────────────────

  addDealer: async (data) => {
    const tid = tempId();
    const newItem = { ...data, id: tid, created_at: new Date().toISOString() } as any;
    set(s => ({ dealers: [newItem, ...s.dealers] }));
    try {
      const saved = await crmApi.createDealer(data);
      set(s => ({ dealers: s.dealers.map(d => d.id === tid ? saved : d) }));
      return saved;
    } catch {
      set(s => ({ dealers: s.dealers.filter(d => d.id !== tid) }));
      throw new Error("Failed to save dealer");
    }
  },

  updateDealer: async (id, updates) => {
    const prev = get().dealers;
    set(s => ({ dealers: s.dealers.map(d => d.id === id ? { ...d, ...updates } : d) }));
    try {
      await crmApi.updateDealer(id, updates);
    } catch {
      set({ dealers: prev });
      throw new Error("Failed to update dealer");
    }
  },

  deleteDealer: async (id) => {
    const prev = get().dealers;
    set(s => ({ dealers: s.dealers.filter(d => d.id !== id) }));
    try {
      await crmApi.deleteDealer(id);
    } catch {
      set({ dealers: prev });
      throw new Error("Failed to delete dealer");
    }
  },

  // ── Optimistic CRUD: Deals ─────────────────────────────────────────────────

  addDeal: async (data) => {
    const tid = tempId();
    const newItem = { ...data, id: tid, created_at: new Date().toISOString() } as any;
    set(s => ({ deals: [newItem, ...s.deals] }));
    try {
      const saved = await crmApi.createDeal(data);
      set(s => ({ deals: s.deals.map(d => d.id === tid ? saved : d) }));
      return saved;
    } catch {
      set(s => ({ deals: s.deals.filter(d => d.id !== tid) }));
      throw new Error("Failed to save deal");
    }
  },

  updateDeal: async (id, updates) => {
    const prev = get().deals;
    set(s => ({ deals: s.deals.map(d => d.id === id ? { ...d, ...updates } : d) }));
    try {
      await crmApi.updateDeal(id, updates);
    } catch {
      set({ deals: prev });
      throw new Error("Failed to update deal");
    }
  },

  deleteDeal: async (id) => {
    const prev = get().deals;
    set(s => ({ deals: s.deals.filter(d => d.id !== id) }));
    try {
      await crmApi.deleteDeal(id);
    } catch {
      set({ deals: prev });
      throw new Error("Failed to delete deal");
    }
  },

  // ── Optimistic CRUD: Accounts ──────────────────────────────────────────────

  addAccount: async (data) => {
    const tid = tempId();
    const newItem = { ...data, id: tid, created_at: new Date().toISOString() } as any;
    set(s => ({ accounts: [...s.accounts, newItem] }));
    try {
      const saved = await accountsApi.create(data);
      useNotifStore.getState().pushToast({ title: "Success", message: "Account created", type: "success" });
      set(s => ({ accounts: s.accounts.map(a => a.id === tid ? saved : a) }));
      return saved;
    } catch {
      set(s => ({ accounts: s.accounts.filter(a => a.id !== tid) }));
      useNotifStore.getState().pushToast({ title: "Error", message: "Failed to save account", type: "error" });
      throw new Error("Failed to save account");
    }
  },

  updateAccount: async (id, updates) => {
    const prev = get().accounts;
    set(s => ({ accounts: s.accounts.map(a => a.id === id ? { ...a, ...updates } : a) }));
    try {
      await accountsApi.update(id, updates);
      useNotifStore.getState().pushToast({ title: "Success", message: "Account updated", type: "success" });
    } catch {
      set({ accounts: prev });
      useNotifStore.getState().pushToast({ title: "Error", message: "Failed to update account", type: "error" });
      throw new Error("Failed to update account");
    }
  },

  deleteAccount: async (id) => {
    const prev = get().accounts;
    set(s => ({ accounts: s.accounts.filter(a => a.id !== id) }));
    try {
      await accountsApi.delete(id);
      useNotifStore.getState().pushToast({ title: "Success", message: "Account deleted", type: "success" });
    } catch {
      set({ accounts: prev });
      useNotifStore.getState().pushToast({ title: "Error", message: "Failed to delete account", type: "error" });
      throw new Error("Failed to delete account");
    }
  },

  // ── Optimistic CRUD: Invoices ────────────────────────────────────────────

  addInvoice: async (data) => {
    const tid = tempId();
    const newItem = { ...data, id: tid, created_at: new Date().toISOString() } as any;
    set(s => ({ invoices: [newItem, ...s.invoices] }));
    try {
      const saved = await invoicesApi.create(data);
      useNotifStore.getState().pushToast({ title: "Success", message: "Invoice created", type: "success" });
      set(s => ({ invoices: s.invoices.map(i => i.id === tid ? saved : i) }));
      return saved;
    } catch {
      set(s => ({ invoices: s.invoices.filter(i => i.id !== tid) }));
      useNotifStore.getState().pushToast({ title: "Error", message: "Failed to save invoice", type: "error" });
      throw new Error("Failed to save invoice");
    }
  },

  // ── Optimistic CRUD: Payments ────────────────────────────────────────────

  addPayment: async (data) => {
    const tid = tempId();
    const newItem = { ...data, id: tid, created_at: new Date().toISOString() } as any;
    set(s => ({ payments: [newItem, ...s.payments] }));
    try {
      await paymentsApi.create(data);
      useNotifStore.getState().pushToast({ title: "Success", message: "Payment recorded", type: "success" });
      set(s => ({ payments: s.payments.map(p => (p as any).id === tid ? { ...p, _synced: true } : p) }));
    } catch {
      set(s => ({ payments: s.payments.filter(p => (p as any).id !== tid) }));
      useNotifStore.getState().pushToast({ title: "Error", message: "Failed to save payment", type: "error" });
      throw new Error("Failed to save payment");
    }
  },

  // ── Optimistic CRUD: Expenses ──────────────────────────────────────────────

  addExpense: async (data) => {
    const tid = tempId();
    const newItem = { ...data, id: tid, created_at: new Date().toISOString() } as any;
    set(s => ({ expenses: [newItem, ...s.expenses] }));
    try {
      const saved = await expensesApi.create(data);
      useNotifStore.getState().pushToast({ title: "Success", message: "Expense created", type: "success" });
      set(s => ({ expenses: s.expenses.map(e => e.id === tid ? saved : e) }));
      return saved;
    } catch {
      set(s => ({ expenses: s.expenses.filter(e => e.id !== tid) }));
      useNotifStore.getState().pushToast({ title: "Error", message: "Failed to save expense", type: "error" });
      throw new Error("Failed to save expense");
    }
  },

  updateExpense: async (id, updates) => {
    const prev = get().expenses;
    set(s => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, ...updates } : e) }));
    try {
      await expensesApi.update(id, updates);
      useNotifStore.getState().pushToast({ title: "Success", message: "Expense updated", type: "success" });
    } catch {
      set({ expenses: prev });
      useNotifStore.getState().pushToast({ title: "Error", message: "Failed to update expense", type: "error" });
      throw new Error("Failed to update expense");
    }
  },

  deleteExpense: async (id) => {
    const prev = get().expenses;
    set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }));
    try {
      await expensesApi.delete(id);
      useNotifStore.getState().pushToast({ title: "Success", message: "Expense deleted", type: "success" });
    } catch {
      set({ expenses: prev });
      useNotifStore.getState().pushToast({ title: "Error", message: "Failed to delete expense", type: "error" });
      throw new Error("Failed to delete expense");
    }
  },

  // ── Optimistic CRUD: Employees ─────────────────────────────────────────────

  addEmployee: async (data) => {
    const tid = tempId();
    const newItem = { ...data, id: tid, created_at: new Date().toISOString() } as any;
    set(s => ({ employees: [newItem, ...s.employees] }));
    try {
      const saved = await employeesApi.create(data);
      useNotifStore.getState().pushToast({ title: "Success", message: "Employee created", type: "success" });
      set(s => ({ employees: s.employees.map(e => e.id === tid ? saved : e) }));
      return saved;
    } catch {
      set(s => ({ employees: s.employees.filter(e => e.id !== tid) }));
      useNotifStore.getState().pushToast({ title: "Error", message: "Failed to save employee", type: "error" });
      throw new Error("Failed to save employee");
    }
  },

  updateEmployee: async (id, updates) => {
    const prev = get().employees;
    set(s => ({ employees: s.employees.map(e => e.id === id ? { ...e, ...updates } : e) }));
    try {
      await employeesApi.update(id, updates);
      useNotifStore.getState().pushToast({ title: "Success", message: "Employee updated", type: "success" });
    } catch {
      set({ employees: prev });
      useNotifStore.getState().pushToast({ title: "Error", message: "Failed to update employee", type: "error" });
      throw new Error("Failed to update employee");
    }
  },

  deleteEmployee: async (id) => {
    const prev = get().employees;
    set(s => ({ employees: s.employees.filter(e => e.id !== id) }));
    try {
      await employeesApi.delete(id);
      useNotifStore.getState().pushToast({ title: "Success", message: "Employee deleted", type: "success" });
    } catch {
      set({ employees: prev });
      useNotifStore.getState().pushToast({ title: "Error", message: "Failed to delete employee", type: "error" });
      throw new Error("Failed to delete employee");
    }
  },
}));
