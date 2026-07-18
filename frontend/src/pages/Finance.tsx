import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  BarChart3, BookOpen, DollarSign, TrendingUp, Zap, CreditCard,
  Banknote, Receipt, FileText, Plus, RefreshCw, ArrowUpRight,
  ArrowDownRight, Wallet, Activity, Layers, Eye, Printer, Edit2, Trash2,
  ChevronRight, ChevronDown, X, Download, Filter, Check, AlertTriangle,
  Loader2, Building2, Users, Target, PiggyBank, Landmark, Calendar,
  Settings, Shield, Upload, Percent, Hash
} from "lucide-react";
import { formatCurrency } from "../lib/currency";
import { api } from "../lib/api";
import { AppTable, removeEmptyParams } from "../components/data-table";
import {
  accountsApi, journalsApi, invoicesApi, paymentsApi,
  commissionsApi, expensesApi, bankCashApi,
  dashboardApi, syncApi, ledgerApi, auditApi,
  type Account, type Invoice, type Payment, type Commission,
  type Expense, type Journal,
  type TrialBalance, type ProfitLoss, type DashboardResponse,
  type AccountTreeNode, type SyncStatus,
} from "../lib/financeApi";
import { crmApi } from "../lib/crmApi";
import { useNotifStore } from "../store/notifications";

import { useDataStore } from "../store/useDataStore";
import ConfirmDialog from "../components/actions/ConfirmDialog";
import ChartOfAccounts from "../components/finance/ChartOfAccountsSimple";
import { ErrorBoundary } from "../components/ErrorBoundary";
import UnifiedLedgersTab from "../components/finance/UnifiedLedgersTab";
import OperationsTab from "../components/finance/OperationsTab";
import CommissionWorkflow from "../components/finance/CommissionWorkflow";
import AttachmentPanel from "../components/attachments/AttachmentPanel";
import { attachmentApi } from "../lib/attachmentApi";
import FileUpload from "../components/ui/FileUpload";
import ModuleTabs from "../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../config/moduleColors";
import AppDialog from "../components/ui/AppDialog";
import InvoicesTab from "../components/finance/InvoicesTab";
import MakePaymentDialog from "../components/finance/MakePaymentDialog";
import { CreateInvoiceDialog } from "../components/finance/FinanceDialogs";
import PaymentHistory from "../components/finance/PaymentHistory";
import AddExpenseDialog from "../components/finance/CreateExpenseDialog";
import CreateJournalDialog from "../components/finance/CreateJournalDialog";
import JournalsTab from "../components/finance/JournalsTab";

type Tab = "dashboard" | "accounts" | "journals" | "invoices" | "payments"
       | "bank" | "cash" | "commissions" | "expenses" | "ledger" | "reports" | "operations";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard",   label: "Dashboard",   icon: BarChart3 },
  { id: "accounts",    label: "Accounts",    icon: BookOpen },
  { id: "journals",    label: "Journals",    icon: FileText },
  { id: "invoices",    label: "Invoices",    icon: DollarSign },
  { id: "payments",    label: "Payments",    icon: TrendingUp },
  { id: "bank",        label: "Bank",        icon: CreditCard },
  { id: "cash",        label: "Cash",        icon: Banknote },
  { id: "commissions", label: "Commissions", icon: Zap },
  { id: "expenses",    label: "Expenses",    icon: Receipt },
  { id: "ledger",      label: "Ledger",      icon: BookOpen },
  { id: "reports",     label: "Reports",     icon: BarChart3 },
  { id: "operations",  label: "Operations",  icon: Layers },
];

const TAB_ITEMS = TABS.map((t) => ({ label: t.label, value: t.id, icon: t.icon }));

const ACCENT = MODULE_COLORS.finance.primary;

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status, variant }: { status: string; variant?: string }) {
  const map: Record<string, [string, string]> = {
    paid: ["rgba(16,185,129,0.15)", "#10b981"],
    unpaid: ["rgba(239,68,68,0.15)", "#ef4444"],
    partial: ["rgba(59,130,246,0.15)", "#3b82f6"],
    pending: ["rgba(245,158,11,0.15)", "#f59e0b"],
    overdue: ["rgba(239,68,68,0.15)", "#ef4444"],
    earned: ["rgba(59,130,246,0.15)", "#3b82f6"],
    approved: ["rgba(16,185,129,0.15)", "#10b981"],
    submitted: ["rgba(245,158,11,0.15)", "#f59e0b"],
    active: ["rgba(16,185,129,0.15)", "#10b981"],
    inactive: ["rgba(148,163,184,0.1)", "#94a3b8"],
    MANUAL: ["rgba(148,163,184,0.15)", "#94a3b8"],
    CRM: ["rgba(59,130,246,0.15)", "#3b82f6"],
    PROPERTY: ["rgba(16,185,129,0.15)", "#10b981"],
    EXPENSE: ["rgba(239,68,68,0.15)", "#ef4444"],
    PAYROLL: ["rgba(139,92,246,0.15)", "#8b5cf6"],
  };
  const key = variant && map[variant] ? variant : Object.keys(map).find(k => status?.toLowerCase().includes(k)) || status;
  const [bg, color] = map[key] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ background: bg, color }}>{status}</span>
  );
}

function SourceBadge({ source }: { source?: string | null }) {
  if (!source || source === "MANUAL") return null;
  return <StatusBadge status={source} variant={source} />;
}

function BalanceDisplay({ value, positive }: { value: number; positive?: boolean }) {
  const isNeg = value < 0;
  const color = isNeg ? "#ef4444" : positive ? "#10b981" : "var(--text-primary)";
  return (
    <span style={{ color }} className="font-semibold">
      {isNeg ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
    </span>
  );
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label} {required && <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ ...props }: any) {
  return (
    <input className="dialog-input w-full text-xs" {...props} />
  );
}

function Select({ children, ...props }: any) {
  return (
    <select className="dialog-select w-full text-xs" {...props}>{children}</select>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={24} className="animate-spin" style={{ color: ACCENT }} />
      <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>Loading...</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub, action }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && <Icon size={32} style={{ color: "var(--text-muted)" }} className="mb-3" />}
      <p className="text-sm font-medium text-primary mb-1">{title}</p>
      {sub && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dlg, setDlg] = useState<string | null>(null);
  const accounts = useDataStore((s) => s.accounts);

  useEffect(() => {
    const fromState = (location.state as { financeTab?: Tab } | null)?.financeTab;
    if (fromState) setTab(fromState);
  }, [location.state]);

  const load = useCallback(async () => {
    await useDataStore.getState().forceRefreshAccounts();
  }, []);

  return (
    <ErrorBoundary>
      <div className="p-6 space-y-5 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-primary">Finance & Accounting</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Double-entry accounting · real-time ledger</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setDlg("account")} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><Plus size={13} /> Account</button>
            <button onClick={() => setDlg("invoice")} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><DollarSign size={13} /> Invoice</button>
            <button onClick={() => setDlg("payment")} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><TrendingUp size={13} /> Payment</button>
            <button onClick={() => setDlg("expense")} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><Receipt size={13} /> Expense</button>
            <button onClick={() => setDlg("journal")} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><FileText size={13} /> Journal</button>
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <ModuleTabs tabs={TAB_ITEMS} activeTab={tab} onChange={(v) => setTab(v as Tab)} moduleColor={ACCENT} />

        <ErrorBoundary fallback={<div className="p-8 text-center"><h3 className="text-lg font-semibold text-red-400 mb-2">Tab Error</h3><p className="text-sm text-muted">This tab encountered an error. Please refresh.</p></div>}>
          <div>
            {tab === "dashboard" && <DashboardTab />}
            {tab === "accounts" && (
              <ErrorBoundary fallback={<div className="p-8 text-center"><h3 className="text-lg font-semibold text-red-400 mb-2">Chart of Accounts Error</h3><button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded">Refresh</button></div>}>
                <ChartOfAccounts />
              </ErrorBoundary>
            )}
            {tab === "journals" && <JournalsTab accounts={accounts} />}
            {tab === "invoices" && <InvoicesTab accounts={accounts} onRefresh={load} />}
            {tab === "payments" && <PaymentHistory onRecordPayment={() => setDlg("payment")} />}
            {tab === "bank" && <BankCashTab instrument="bank" accounts={accounts} setDlg={setDlg} />}
            {tab === "cash" && <BankCashTab instrument="cash" accounts={accounts} setDlg={setDlg} />}
            {tab === "commissions" && <CommissionsTab accounts={accounts} onRefresh={load} />}
            {tab === "expenses" && <ExpensesTab accounts={accounts} />}
            {tab === "ledger" && <UnifiedLedgersTab />}
            {tab === "reports" && <ReportsTab accounts={accounts} />}
            {tab === "operations" && <ErrorBoundary fallback={<div className="p-8 text-center"><h3 className="text-lg font-semibold text-red-400 mb-2">Operations Error</h3></div>}><OperationsTabWrapper /></ErrorBoundary>}
          </div>
        </ErrorBoundary>

        <AppDialogs dlg={dlg} setDlg={setDlg} accounts={accounts} onRefresh={load} />
      </div>
    </ErrorBoundary>
  );
}

// ── Operations Tab Wrapper (fixes crash) ─────────────────────────────────────

function OperationsTabWrapper() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <LoadingSpinner />;
  return <OperationsTab />;
}

// ── Dialogs Manager ──────────────────────────────────────────────────────────

function AppDialogs({ dlg, setDlg, accounts, onRefresh }: any) {
  const pushToast = useNotifStore((s) => s.pushToast);
  return (
    <>
      <CreateAccountDialog isOpen={dlg === "account"} onClose={() => setDlg(null)} onSubmit={async (d) => { await accountsApi.create(d); pushToast({ title: "Account Created", message: `Account "${d.name}" created successfully`, type: "success" }); await onRefresh(); }} />
      <CreateInvoiceDialog isOpen={dlg === "invoice"} onClose={() => setDlg(null)} onSubmit={async (d: any) => { const inv = await invoicesApi.create({ ...d, line_items: [{ description: d.description || "Invoice", amount: d.amount }], invoice_date: new Date().toISOString() }); pushToast({ title: "Invoice Created", message: `Invoice #${inv.id} created successfully`, type: "success" }); await onRefresh(); return inv.id; }} />
      <MakePaymentDialog isOpen={dlg === "payment" || (typeof dlg === "string" && dlg.startsWith("pay:"))} onClose={() => setDlg(null)} onSubmit={async (d: any) => { const p = await paymentsApi.create(d); pushToast({ title: "Payment Recorded", message: `Payment #${p.id} recorded successfully`, type: "success" }); await onRefresh(); return p.id; }} preselectedInvoiceId={typeof dlg === "string" && dlg.startsWith("pay:") ? Number(dlg.split(":")[1]) : undefined} accounts={accounts} />
      <AddExpenseDialog isOpen={dlg === "expense"} onClose={() => setDlg(null)} onSubmit={async (d) => { const e = await expensesApi.create(d); pushToast({ title: "Expense Added", message: `Expense #${e.id} added successfully`, type: "success" }); await onRefresh(); return e.id; }} accounts={accounts} />
      <CommissionWorkflow isOpen={dlg === "commission"} onClose={() => setDlg(null)} onSuccess={onRefresh} />
      <CreateJournalDialog isOpen={dlg === "journal"} onClose={() => setDlg(null)} onSubmit={async (d) => { const j = await journalsApi.create(d); pushToast({ title: "Journal Posted", message: `Journal #${j.id} posted successfully`, type: "success" }); await onRefresh(); return j.id; }} accounts={accounts} />
      <BankCashDialog isOpen={["bank_payment","bank_receipt","cash_payment","cash_receipt"].includes(dlg ?? "")} type={dlg as any} onClose={() => setDlg(null)} onSubmit={async (d) => {
        let result: any;
        let txnLabel = "";
        if (dlg === "bank_payment") { result = await bankCashApi.bankPayment(d); txnLabel = "Bank Payment"; }
        if (dlg === "bank_receipt") { result = await bankCashApi.bankReceipt(d); txnLabel = "Bank Receipt"; }
        if (dlg === "cash_payment") { result = await bankCashApi.cashPayment(d); txnLabel = "Cash Payment"; }
        if (dlg === "cash_receipt") { result = await bankCashApi.cashReceipt(d); txnLabel = "Cash Receipt"; }
        pushToast({ title: `${txnLabel} Recorded`, message: `${txnLabel} recorded successfully`, type: "success" });
        await onRefresh();
        return result?.id;
      }} accounts={accounts} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardTab() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [cashFlow, setCashFlow] = useState<any[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<any>(null);
  const [bankCashPos, setBankCashPos] = useState<any[]>([]);
  const [recentJournals, setRecentJournals] = useState<Journal[]>([]);
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const inc = () => { if (!cancelled) setLoaded(v => v + 1); };
    Promise.allSettled([
      dashboardApi.get().then(v => { if (!cancelled) setDashboard(v); inc(); }),
      dashboardApi.monthlyIncomeExpense(6).then(v => { if (!cancelled) setMonthlyData(v); inc(); }),
      dashboardApi.cashFlow(30).then(v => { if (!cancelled) setCashFlow(v); inc(); }),
      dashboardApi.invoiceStatus().then(v => { if (!cancelled) setInvoiceStatus(v); inc(); }),
      dashboardApi.bankCashPositions().then(v => { if (!cancelled) setBankCashPos(v); inc(); }),
      journalsApi.list({ limit: 10 }).then(v => { if (!cancelled) setRecentJournals(v.data ?? v); inc(); }),
      journalsApi.trialBalance().then(v => { if (!cancelled) setTrialBalance(v); inc(); }),
    ]).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const kpiCards = useMemo(() => dashboard ? [
    { ...dashboard.bank_balance, icon: CreditCard, color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    { ...dashboard.cash_balance, icon: Banknote, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    { ...dashboard.total_income, icon: TrendingUp, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    { ...dashboard.total_expenses, icon: Receipt, color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    { ...dashboard.net_profit, icon: PiggyBank, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    { ...dashboard.pending_receivables, icon: Wallet, color: "#f59e0b", bg: "rgba(255,158,11,0.12)" },
    { ...dashboard.overdue_invoices, icon: AlertTriangle, color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    { ...dashboard.commission_payable, icon: Users, color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  ] : [], [dashboard]);

  const isLoading = loaded < 7;

  const chartMax = useMemo(() => {
    if (monthlyData.length === 0) return 1;
    return Math.max(...monthlyData.map((x: any) => Math.max(Number(x.income), Number(x.expense))), 1);
  }, [monthlyData]);

  const cashFlowRange = useMemo(() => {
    if (cashFlow.length === 0) return { min: 0, max: 0, range: 1 };
    const vals = cashFlow.map((x: any) => Number(x.balance));
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    return { min: mn, max: mx, range: mx - mn || 1 };
  }, [cashFlow]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpiCards.map((kpi, i) => (
          <div key={i} className="stat-card p-3" style={{ borderColor: kpi.color + "33" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: kpi.bg }}>
                <kpi.icon size={13} style={{ color: kpi.color }} />
              </div>
              {kpi.change_vs_last_month !== 0 && (
                <span className={`flex items-center gap-0.5 text-[9px] font-medium ${kpi.trend_up ? "text-emerald-400" : "text-red-400"}`}>
                  {kpi.trend_up ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
                  {Math.abs(Number(kpi.change_vs_last_month)).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-base font-bold text-primary">
              <BalanceDisplay value={Number(kpi.value)} positive={kpi.trend_up} />
            </p>
            <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Income vs Expenses (Last 6 Months)</p>
            <LoadingBoundary loading={isLoading} height={200}>
              {monthlyData.length === 0 ? (
                <EmptyState title="No data" icon={BarChart3} />
              ) : (
                <div className="space-y-2 mt-3">
                  {monthlyData.map((m: any, i: number) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
                        <span>{m.month}</span>
                        <span>{formatCurrency(Number(m.income))} / {formatCurrency(Number(m.expense))}</span>
                      </div>
                      <div className="flex gap-0.5 h-5">
                        <div className="flex-1 rounded-sm" style={{ background: "rgba(16,185,129,0.15)", overflow: "hidden" }}>
                          <div className="h-full rounded-sm transition-all" style={{ width: `${(Number(m.income) / chartMax) * 100}%`, background: "#10b981" }} />
                        </div>
                        <div className="flex-1 rounded-sm" style={{ background: "rgba(239,68,68,0.15)", overflow: "hidden" }}>
                          <div className="h-full rounded-sm transition-all" style={{ width: `${(Number(m.expense) / chartMax) * 100}%`, background: "#ef4444" }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </LoadingBoundary>
          </div>
        </div>

        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Cash Flow (Last 30 Days)</p>
            <LoadingBoundary loading={isLoading} height={200}>
              {cashFlow.length === 0 ? (
                <EmptyState title="No data" icon={TrendingUp} />
              ) : (
                <div className="mt-3">
                  <div className="flex items-end gap-0.5 h-20">
                    {cashFlow.map((p: any, i: number) => {
                      const h = ((Number(p.balance) - cashFlowRange.min) / cashFlowRange.range) * 100;
                      return (
                        <div key={i} className="flex-1 relative group">
                          <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-[8px] px-1 py-0.5 rounded whitespace-nowrap z-10">
                            {p.date}: {formatCurrency(Number(p.balance))}
                          </div>
                          <div className="w-full rounded-sm transition-all cursor-pointer"
                            style={{ height: `${Math.max(h, 2)}%`, background: Number(p.balance) >= 0 ? "#10b981" : "#ef4444", opacity: 0.7 }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>
                    <span>{cashFlow[0]?.date}</span>
                    <span>{cashFlow[cashFlow.length - 1]?.date}</span>
                  </div>
                </div>
              )}
            </LoadingBoundary>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Profit & Loss Summary</p>
            <LoadingBoundary loading={!dashboard} height={120}>
              {dashboard && (
                <div className="space-y-2 mt-2">
                  <p className="text-[10px] font-semibold text-emerald-400">Income</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted">Property Sales (4500)</span><span className="text-emerald-400">{formatCurrency(0)}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Rent Income (4100)</span><span className="text-emerald-400">{formatCurrency(0)}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Commission (4200)</span><span className="text-emerald-400">{formatCurrency(0)}</span></div>
                  </div>
                  <div className="pt-2 border-t border-theme flex justify-between text-xs font-semibold">
                    <span className="text-muted">Net Profit</span>
                    <span className={Number(dashboard.net_profit.value) >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {formatCurrency(Number(dashboard.net_profit.value))}
                    </span>
                  </div>
                </div>
              )}
            </LoadingBoundary>
          </div>
        </div>

        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Invoice Status</p>
            <LoadingBoundary loading={!invoiceStatus} height={120}>
              {invoiceStatus && (
                <div className="space-y-2 mt-2">
                  {invoiceStatus.statuses?.map((s: any) => (
                    <div key={s.status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full"
                          style={{ background: s.status === "paid" ? "#10b981" : s.status === "partial" ? "#3b82f6" : s.status === "overdue" ? "#ef4444" : "#f59e0b" }} />
                        <span className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{s.status}</span>
                      </div>
                      <span className="text-xs font-medium">{formatCurrency(Number(s.amount))} ({s.count})</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-theme text-xs font-semibold flex justify-between">
                    <span className="text-muted">Outstanding</span>
                    <span style={{ color: "#ef4444" }}>{formatCurrency(Number(invoiceStatus.total_outstanding || 0))}</span>
                  </div>
                </div>
              )}
            </LoadingBoundary>
          </div>
        </div>

        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Cash & Bank Positions</p>
            <LoadingBoundary loading={bankCashPos.length === 0} height={120}>
              <div className="space-y-2 mt-2">
                {bankCashPos.map((pos: any) => (
                  <div key={pos.account_id} className="flex items-center justify-between p-2 rounded-lg"
                    style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.1)" }}>
                    <div>
                      <p className="text-xs font-medium text-primary">{pos.name}</p>
                      <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{pos.code}</p>
                    </div>
                    <div className="text-right">
                      <BalanceDisplay value={Number(pos.balance)} positive />
                      <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                        {pos.last_transaction_date ? new Date(pos.last_transaction_date).toLocaleDateString() : "No activity"}
                      </p>
                    </div>
                  </div>
                ))}
                {bankCashPos.length === 0 && <EmptyState title="No accounts" icon={Landmark} />}
              </div>
            </LoadingBoundary>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="detail-container">
          <div className="detail-section">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} style={{ color: ACCENT }} />
              <p className="detail-section-title mb-0">Recent Transactions</p>
            </div>
            <LoadingBoundary loading={isLoading} height={200}>
              {recentJournals.length === 0 ? (
                <EmptyState title="No transactions yet" sub="Post a journal entry to see activity" icon={FileText} />
              ) : (
                <div className="space-y-0">
                  {recentJournals.map((j) => {
                  const drTotal = j.entries?.reduce((s: number, e: any) => s + Number(e.debit), 0) || 0;
                  const crTotal = j.entries?.reduce((s: number, e: any) => s + Number(e.credit), 0) || 0;
                  const isExpense = j.reference_type === "expense";
                  const isIncome = j.reference_type === "invoice" || j.reference_type === "payment" || j.reference_type === "rent_payment";
                  return (
                    <div key={j.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: isExpense ? "rgba(239,68,68,0.12)" : isIncome ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.12)" }}>
                        {isExpense ? <ArrowDownRight size={13} style={{ color: "#ef4444" }} /> :
                         isIncome ? <ArrowUpRight size={13} style={{ color: "#10b981" }} /> :
                         <FileText size={13} style={{ color: "#3b82f6" }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-primary truncate">
                          {j.entries?.map((e: any) => e.account_name).filter(Boolean).join(", ") || j.description}
                        </p>
                        <p className="text-[9px] mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                          {new Date(j.date).toLocaleDateString()}
                          {j.source && <SourceBadge source={j.source} />}
                          <span className="font-mono">JE-{String(j.id).padStart(4, "0")}</span>
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold">
                        {drTotal > 0 && <span className="text-red-400">DR {formatCurrency(drTotal)}</span>}
                        {crTotal > 0 && <span className="text-emerald-400 ml-1">CR {formatCurrency(crTotal)}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            </LoadingBoundary>
          </div>
        </div>

        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Trial Balance</p>
            <LoadingBoundary loading={!trialBalance} height={120}>
              {trialBalance && (
                <div className="space-y-0.5 max-h-52 overflow-y-auto mt-2">
                  {trialBalance.rows?.filter((r: any) => r.debit > 0 || r.credit > 0).slice(0, 12).map((row: any) => (
                    <div key={row.account_id} className="flex justify-between items-center py-1">
                      <span className="text-[10px] truncate pr-2" style={{ color: "var(--text-secondary)" }}>{row.code} {row.name}</span>
                      <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: row.debit > 0 ? "#3b82f6" : "#10b981" }}>
                        {row.debit > 0 ? `DR ${formatCurrency(row.debit)}` : `CR ${formatCurrency(row.credit)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2 mt-2 flex justify-between text-[10px] font-semibold" style={{ borderTop: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-muted)" }}>DR / CR</span>
                <span className="text-primary">{formatCurrency(trialBalance?.total_debit ?? 0)} / {formatCurrency(trialBalance?.total_credit ?? 0)}</span>
              </div>
              {trialBalance && Number(trialBalance.total_debit) !== Number(trialBalance.total_credit) && (
                <div className="mt-2 p-2 rounded-lg text-[10px]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                  ⚠ DR ({formatCurrency(trialBalance.total_debit)}) ≠ CR ({formatCurrency(trialBalance.total_credit)})
                </div>
              )}
            </LoadingBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingBoundary({ loading, children, height }: any) {
  if (loading) return <div style={{ height: height || 60 }} className="flex items-center justify-center"><Loader2 size={16} className="animate-spin" style={{ color: ACCENT }} /></div>;
  return children;
}





// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// BANK / CASH TAB
// ═══════════════════════════════════════════════════════════════════════════════

function BankCashTab({ instrument, accounts, setDlg }: any) {
  const isBank = instrument === "bank";
  const color = isBank ? "#3b82f6" : "#10b981";
  const Icon = isBank ? CreditCard : Banknote;
  const bgColor = isBank ? "rgba(59,130,246,0.08)" : "rgba(16,185,129,0.08)";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (isBank ? bankCashApi.bankTransactions() : bankCashApi.cashTransactions())
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [isBank]);

  return (
    <div className="space-y-4">
      <div className="detail-container">
        <div className="detail-section">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bgColor }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary capitalize">{instrument} Account</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Derived from journal entries</p>
            </div>
          </div>
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="stat-card p-3">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Current Balance</p>
                <p className="text-2xl font-bold" style={{ color }}>{formatCurrency(data.current_balance || 0)}</p>
              </div>
              <div className="stat-card p-3">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Opening Balance</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(data.opening_balance || 0)}</p>
              </div>
              <div className="stat-card p-3">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total In</p>
                <p className="text-lg font-bold text-emerald-400">{formatCurrency(data.total_in || 0)}</p>
              </div>
              <div className="stat-card p-3">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total Out</p>
                <p className="text-lg font-bold text-red-400">{formatCurrency(data.total_out || 0)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {data && data.transactions && data.transactions.length > 0 && (
        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Transactions</p>
            <div className="space-y-0 mt-2">
              {data.transactions.map((tx: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: tx.debit > 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
                    {tx.debit > 0 ? <ArrowUpRight size={11} style={{ color: "#10b981" }} /> : <ArrowDownRight size={11} style={{ color: "#ef4444" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-primary truncate">{tx.description}</p>
                    <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>
                      {tx.reference_type ? `${tx.reference_type} · ` : ""}{tx.date ? new Date(tx.date).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    {tx.debit > 0 && <p className="text-[10px] text-emerald-400 font-medium">+{formatCurrency(tx.debit)}</p>}
                    {tx.credit > 0 && <p className="text-[10px] text-red-400 font-medium">-{formatCurrency(tx.credit)}</p>}
                    <p className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>Bal: {formatCurrency(tx.balance)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(!data || !data.transactions || data.transactions.length === 0) && !loading && (
        <EmptyState title="No transactions" icon={Icon} sub="Record a payment or receipt to see activity here" />
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setDlg(`${instrument}_payment`)} className="detail-container p-4 text-left transition-all hover:scale-[1.01]"
          style={{ border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.08)" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "#ef4444" }}>Record Payment</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Money going out</p>
        </button>
        <button onClick={() => setDlg(`${instrument}_receipt`)} className="detail-container p-4 text-left transition-all hover:scale-[1.01]"
          style={{ border: "1px solid rgba(16,185,129,0.15)", background: "rgba(16,185,129,0.08)" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "#10b981" }}>Record Receipt</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Money coming in</p>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMISSIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function CommissionsTab({ accounts, onRefresh }: { accounts: Account[]; onRefresh: () => Promise<void> }) {
  const pushToast = useNotifStore((s) => s.pushToast);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealers, setDealers] = useState<{ id: number; name: string }[]>([]);
  const [params, setParams] = useState({ page: 1, pageSize: 10, search: "", filter: "", startDate: "", endDate: "", propertyType: "", status: "" });

  useEffect(() => {
    crmApi.getDealers().then((d) => setDealers(d.map((x: any) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);

  const fetchCommissions = useCallback(async (currentParams: typeof params) => {
    setLoading(true); setError(null);
    try {
      const sanitized = removeEmptyParams({ limit: currentParams.pageSize, skip: (currentParams.page - 1) * currentParams.pageSize, payment_status: currentParams.status });
      const res = await api.get<Commission[]>("/finance/commissions", { params: sanitized });
      setCommissions(res.data);
      setTotal(res.data.length < currentParams.pageSize ? (currentParams.page - 1) * currentParams.pageSize + res.data.length : 1000);
    } catch (e: any) { setError(e.message || "Failed to load commissions"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchCommissions(params); }, [params, fetchCommissions]);

  const handleMarkPaid = async (c: Commission) => {
    try {
      await commissionsApi.markPaid(c.id);
      pushToast({ title: "Commission Paid", message: `Commission #${c.id} marked as paid`, type: "success" });
      syncApi.commissionPaid({
        commission_id: c.id,
        dealer_name: c.dealer_name || "Unknown",
        amount: c.amount,
      }).catch(() => {});
      await onRefresh();
      fetchCommissions(params);
    } catch (e) { console.error(e); }
  };

  const unpaidTotal = commissions.filter((c) => c.type === "earned" && c.payment_status !== "paid").reduce((s, c) => s + c.amount, 0);

  const commissionColumns = [
    { key: "id", label: "COM-ID", className: "font-mono text-[10px] text-blue-400 font-semibold", render: (val: number) => `COM-${String(val).padStart(4, "0")}` },
    { key: "dealer_name", label: "Dealer", render: (val: any, row: Commission) => <span className="text-xs text-primary">{row.dealer_name || `Dealer #${row.dealer_id}`}</span> },
    { key: "deal_code", label: "Deal Ref", render: (val: any) => val || "—" },
    { key: "property_name", label: "Property", render: (val: any, row: Commission) => <span className="text-xs">{row.property_name || `#${row.property_id}`}</span> },
    { key: "sale_amount", label: "Sale Value", className: "text-right text-xs", render: (val: any) => val ? formatCurrency(val) : "—" },
    { key: "commission_rate", label: "Rate", className: "text-right text-xs", render: (val: any) => val ? `${val}%` : "—" },
    { key: "amount", label: "Amount", className: "text-right font-semibold", render: (val: number) => formatCurrency(val) },
    { key: "payment_status", label: "Status", render: (val: any, row: Commission) => <StatusBadge status={row.payment_status || "unpaid"} /> },
    { key: "date", label: "Date", render: (val: string) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card p-3">
          <p className="text-xs text-muted">Total Commissions</p>
          <p className="text-xl font-bold text-primary">{commissions.length}</p>
        </div>
        <div className="stat-card p-3">
          <p className="text-xs text-muted">Unpaid Earned</p>
          <p className="text-xl font-bold" style={{ color: "#f59e0b" }}>{formatCurrency(unpaidTotal)}</p>
        </div>
        <div className="stat-card p-3">
          <p className="text-xs text-muted">Dealers</p>
          <p className="text-xl font-bold text-primary">{dealers.length}</p>
        </div>
      </div>

      <AppTable
        storageKey="rems_finance_commissions"
        title="Commissions"
        subtitle="Manage agent/dealer sales commissions and payout cycles"
        data={commissions} columns={commissionColumns}
        rowActions={[{ key: "mark_paid", label: "Mark Paid", icon: DollarSign, onClick: (r: Commission) => void handleMarkPaid(r), hidden: (r: Commission) => !(r.type === "earned" && r.payment_status !== "paid") }]}
        loading={loading} error={error} onRetry={() => fetchCommissions(params)}
        pagination={{ page: params.page, pageSize: params.pageSize, total }}
        onPageChange={(config) => setParams((prev) => ({ ...prev, ...config }))}
        onFilterChange={(filters) => setParams((prev) => ({ ...prev, ...filters }))}
        showStatusFilter={true}
        statusOptions={[{ label: "All Statuses", value: "" }, { label: "Unpaid", value: "unpaid" }, { label: "Paid", value: "paid" }]}
        showTypeFilter={false}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ExpensesTab({ accounts }: { accounts: Account[] }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState({ page: 1, pageSize: 10, search: "", filter: "", startDate: "", endDate: "", propertyType: "", status: "" });
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const fetchExpenses = useCallback(async (currentParams: typeof params) => {
    setLoading(true); setError(null);
    try {
      const sanitized = removeEmptyParams({ limit: currentParams.pageSize, offset: (currentParams.page - 1) * currentParams.pageSize, search: currentParams.search, startDate: currentParams.startDate, endDate: currentParams.endDate });
      const res = await api.get<Expense[]>("/finance/expenses", { params: sanitized });
      setExpenses(res.data);
      setTotal(Number(res.headers["x-total-count"] || res.data.length));
    } catch (e: any) { setError(e.message || "Failed to load expenses"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchExpenses(params); }, [params, fetchExpenses]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await expensesApi.delete(deleteTarget.id);
      pushToast({ title: "Expense Deleted", message: `Expense #${deleteTarget.id} deleted successfully`, type: "success" });
      setDeleteTarget(null);
      fetchExpenses(params);
    } catch (e: any) {
      pushToast({ title: "Error", message: e?.response?.data?.detail || "Failed to delete expense", priority: "urgent" });
      setDeleteTarget(null);
    }
  };

  const expenseColumns = [
    { key: "id", label: "#", className: "font-mono text-[10px]" },
    { key: "account_name", label: "Account", render: (val: any, row: Expense) => `${row.account_code || ""} ${row.account_name || ""}` || `Account #${row.account_id}` },
    { key: "description", label: "Description", className: "text-xs max-w-[150px] truncate" },
    { key: "vendor_name", label: "Vendor", render: (val: any) => val || "—" },
    { key: "amount", label: "Amount", className: "font-semibold text-red-400 text-right", render: (val: number) => formatCurrency(val) },
    { key: "payment_status", label: "Payment Status", render: (val: any) => <StatusBadge status={val || "pending"} /> },
    { key: "approval_status", label: "Approval", render: (val: any) => <StatusBadge status={val || "submitted"} /> },
    { key: "paid_from", label: "Paid From", render: (val: string) => <StatusBadge status={val} /> },
    { key: "date", label: "Date", render: (val: string) => new Date(val).toLocaleDateString() },
  ];

  return (
    <>
    <AppTable
      storageKey="rems_finance_expenses"
      title="Expenses"
      subtitle="Track corporate operating expenditures"
      data={expenses} columns={expenseColumns}
      rowActions={[
        { key: "approve", label: "Approve", icon: Check, onClick: async (r: Expense) => { await expensesApi.approve(r.id); pushToast({ title: "Expense Approved", message: `Expense #${r.id} approved`, type: "success" }); fetchExpenses(params); }, hidden: (r: Expense) => r.approval_status === "approved" },
        { key: "delete", label: "Delete", icon: Trash2, variant: "danger" as const, onClick: (r: Expense) => setDeleteTarget(r) },
      ]}
      loading={loading} error={error} onRetry={() => fetchExpenses(params)}
      pagination={{ page: params.page, pageSize: params.pageSize, total }}
      onPageChange={(config) => setParams((prev) => ({ ...prev, ...config }))}
      onFilterChange={(filters) => setParams((prev) => ({ ...prev, ...filters }))}
      showStatusFilter={false} showTypeFilter={false}
    />
      {deleteTarget && (
        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete Expense"
          message={`Are you sure you want to delete expense #${deleteTarget.id}? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS TAB — FIXED: Wrapped, lazy-loaded, async-safe
// ═══════════════════════════════════════════════════════════════════════════════

function ReportsTab({ accounts }: { accounts: Account[] }) {
  const [report, setReport] = useState<string>("trial_balance");
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [profitLoss, setProfitLoss] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [cashFlow, setCashFlow] = useState<any>(null);
  const [receivablesAging, setReceivablesAging] = useState<any>(null);
  const [propertyIncome, setPropertyIncome] = useState<any>(null);
  const [dealerCommission, setDealerCommission] = useState<any>(null);
  const [dayBook, setDayBook] = useState<any>(null);
  const [cashBook, setCashBook] = useState<any>(null);
  const [bankBook, setBankBook] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("monthly");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params: any = {};
        if (dateRange.start) params.start_date = dateRange.start;
        if (dateRange.end) params.end_date = dateRange.end;

        const [tb, pl, bs, cf, ra, pi, dc, dbk, cbk, bkb] = await Promise.allSettled([
          journalsApi.trialBalance(),
          journalsApi.profitLoss(params),
          journalsApi.balanceSheet(),
          journalsApi.cashFlow(params),
          journalsApi.receivablesAging(),
          journalsApi.propertyIncome(),
          journalsApi.dealerCommission(params),
          journalsApi.dayBook(params),
          journalsApi.cashBook(params),
          journalsApi.bankBook(params),
        ]);
        if (cancelled) return;
        if (tb.status === "fulfilled") setTrialBalance(tb.value);
        if (pl.status === "fulfilled") setProfitLoss(pl.value);
        if (bs.status === "fulfilled") setBalanceSheet(bs.value);
        if (cf.status === "fulfilled") setCashFlow(cf.value);
        if (ra.status === "fulfilled") setReceivablesAging(ra.value);
        if (pi.status === "fulfilled") setPropertyIncome(pi.value);
        if (dc.status === "fulfilled") setDealerCommission(dc.value);
        if (dbk.status === "fulfilled") setDayBook(dbk.value);
        if (cbk.status === "fulfilled") setCashBook(cbk.value);
        if (bkb.status === "fulfilled") setBankBook(bkb.value);

        if (!cancelled) {
          if (["invoice_outstanding", "invoice_aging", "invoice_monthly"].includes(report)) {
            if (report === "invoice_outstanding") invoicesApi.outstandingReport().then(setInvoiceOutstanding).catch(() => {});
            if (report === "invoice_aging") invoicesApi.agingReport().then(setInvoiceAging).catch(() => {});
            if (report === "invoice_monthly") invoicesApi.monthlyRevenueReport().then(setInvoiceMonthly).catch(() => {});
          }
        }
      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [period, dateRange, report]);

  const [invoiceOutstanding, setInvoiceOutstanding] = useState<any>(null);
  const [invoiceAging, setInvoiceAging] = useState<any>(null);
  const [invoiceMonthly, setInvoiceMonthly] = useState<any>(null);

  const reports = [
    { id: "trial_balance", label: "Trial Balance", icon: BookOpen },
    { id: "profit_loss", label: "P&L Statement", icon: TrendingUp },
    { id: "balance_sheet", label: "Balance Sheet", icon: Landmark },
    { id: "cash_flow", label: "Cash Flow", icon: DollarSign },
    { id: "day_book", label: "Day Book", icon: FileText },
    { id: "cash_book", label: "Cash Book", icon: Banknote },
    { id: "bank_book", label: "Bank Book", icon: CreditCard },
    { id: "receivables", label: "Receivables Aging", icon: Wallet },
    { id: "property_income", label: "Property Income", icon: Building2 },
    { id: "dealer_commission", label: "Dealer Commission", icon: Users },
    { id: "invoice_outstanding", label: "Outstanding Invoices", icon: DollarSign },
    { id: "invoice_aging", label: "Invoice Aging", icon: AlertTriangle },
    { id: "invoice_monthly", label: "Monthly Revenue", icon: TrendingUp },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <ErrorBoundary fallback={<div className="p-8 text-center text-red-400">Report Error — please refresh</div>}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {reports.map((r) => (
            <button key={r.id} onClick={() => setReport(r.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${report === r.id ? "text-white" : ""}`}
              style={{ background: report === r.id ? ACCENT : "var(--bg-card)", border: "1px solid var(--border)", color: report === r.id ? "#fff" : "var(--text-primary)" }}>
              <r.icon size={12} /> {r.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <select className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom</option>
          </select>
          {period === "custom" && (
            <>
              <input type="date" className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                value={dateRange.start} onChange={e => setDateRange(d => ({ ...d, start: e.target.value }))} />
              <input type="date" className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                value={dateRange.end} onChange={e => setDateRange(d => ({ ...d, end: e.target.value }))} />
            </>
          )}
        </div>

        {report === "trial_balance" && trialBalance && (
          <div className="detail-container">
            <div className="detail-section">
              <p className="detail-section-title">Trial Balance</p>
              <p className="text-[10px] text-muted mb-3">All accounts with DR/CR balances</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-2 text-muted">Code</th>
                      <th className="text-left py-2 text-muted">Account</th>
                      <th className="text-left py-2 text-muted">Type</th>
                      <th className="text-right py-2 text-muted">Debit</th>
                      <th className="text-right py-2 text-muted">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.rows?.filter((r: any) => r.debit > 0 || r.credit > 0).map((row: any) => (
                      <tr key={row.account_id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td className="py-1.5 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{row.code}</td>
                        <td className="py-1.5 text-primary">{row.name}</td>
                        <td className="py-1.5"><StatusBadge status={row.type} /></td>
                        <td className="py-1.5 text-right" style={{ color: row.debit > 0 ? "#3b82f6" : "var(--text-muted)" }}>{row.debit > 0 ? formatCurrency(row.debit) : "—"}</td>
                        <td className="py-1.5 text-right" style={{ color: row.credit > 0 ? "#10b981" : "var(--text-muted)" }}>{row.credit > 0 ? formatCurrency(row.credit) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--border)" }}>
                      <td colSpan={3} className="py-2 font-semibold text-primary">Totals</td>
                      <td className="py-2 text-right font-semibold" style={{ color: "#3b82f6" }}>{formatCurrency(trialBalance.total_debit)}</td>
                      <td className="py-2 text-right font-semibold" style={{ color: "#10b981" }}>{formatCurrency(trialBalance.total_credit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {Number(trialBalance.total_debit) !== Number(trialBalance.total_credit) && (
                <div className="mt-3 p-2 rounded-lg text-[10px]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                  ⚠ WARNING: Trial Balance does NOT balance! DR ({formatCurrency(trialBalance.total_debit)}) ≠ CR ({formatCurrency(trialBalance.total_credit)})
                </div>
              )}
            </div>
          </div>
        )}

        {report === "profit_loss" && profitLoss && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="detail-container">
              <div className="detail-section">
                <p className="detail-section-title">Income</p>
                <div className="space-y-2 mt-2">
                  {profitLoss.income?.filter((r: any) => r.amount > 0).map((r: any) => (
                    <div key={r.account_id} className="flex justify-between text-xs py-1" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ color: "var(--text-secondary)" }}>{r.code} — {r.name}</span>
                      <span className="text-emerald-400 font-medium">{formatCurrency(r.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 text-xs font-semibold">
                    <span className="text-muted">Total Income</span>
                    <span className="text-emerald-400">{formatCurrency(profitLoss.total_income)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="detail-container">
              <div className="detail-section">
                <p className="detail-section-title">Expenses</p>
                <div className="space-y-2 mt-2">
                  {profitLoss.expenses?.filter((r: any) => r.amount > 0).map((r: any) => (
                    <div key={r.account_id} className="flex justify-between text-xs py-1" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ color: "var(--text-secondary)" }}>{r.code} — {r.name}</span>
                      <span className="text-red-400 font-medium">{formatCurrency(r.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 text-xs font-semibold">
                    <span className="text-muted">Total Expenses</span>
                    <span className="text-red-400">{formatCurrency(profitLoss.total_expenses)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 detail-container">
              <div className="detail-section">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-primary">Net Profit</p>
                    <p className="text-[10px] text-muted">Margin: {profitLoss.total_income > 0 ? ((Number(profitLoss.net_profit) / Number(profitLoss.total_income)) * 100).toFixed(1) : 0}%</p>
                  </div>
                  <span className={`text-lg font-bold ${Number(profitLoss.net_profit) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatCurrency(profitLoss.net_profit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {report === "balance_sheet" && balanceSheet && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {["assets", "liabilities", "equity"].map((section) => {
              const data = balanceSheet[section];
              const colors: any = { assets: "#3b82f6", liabilities: "#f59e0b", equity: "#10b981" };
              return (
                <div key={section} className="detail-container">
                  <div className="detail-section">
                    <p className="detail-section-title capitalize">{section}</p>
                    <div className="space-y-1 mt-2">
                      {data?.accounts?.map((a: any) => (
                        <div key={a.code} className="flex justify-between text-xs py-0.5">
                          <span style={{ color: "var(--text-secondary)" }}>{a.code} {a.name}</span>
                          <span className="font-medium" style={{ color: colors[section] }}>{formatCurrency(a.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-2 text-xs font-semibold" style={{ borderTop: "1px solid var(--border)" }}>
                        <span className="text-muted">Total {section}</span>
                        <span style={{ color: colors[section] }}>{formatCurrency(data?.total || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="lg:col-span-3 detail-container">
              <div className="detail-section">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-primary">
                    Assets: {formatCurrency(balanceSheet.assets?.total || 0)} = Liabilities: {formatCurrency(balanceSheet.liabilities?.total || 0)} + Equity: {formatCurrency(balanceSheet.equity?.total || 0)}
                  </span>
                  <span className={`text-sm font-bold ${Math.abs((balanceSheet.assets?.total || 0) - (balanceSheet.liabilities?.total || 0) - (balanceSheet.equity?.total || 0)) < 0.01 ? "text-emerald-400" : "text-red-400"}`}>
                    {Math.abs((balanceSheet.assets?.total || 0) - (balanceSheet.liabilities?.total || 0) - (balanceSheet.equity?.total || 0)) < 0.01 ? "✓ Balanced" : "✗ Unbalanced"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {report === "cash_flow" && cashFlow && (
          <div className="detail-container">
            <div className="detail-section">
              <p className="detail-section-title">Cash Flow Statement</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Opening Balance</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(cashFlow.opening_balance || 0)}</p>
                </div>
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Operating Activities</p>
                  <p className="text-lg font-bold text-emerald-400">{formatCurrency(cashFlow.operating || 0)}</p>
                </div>
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Net Movement</p>
                  <p className="text-lg font-bold" style={{ color: Number(cashFlow.net_movement) >= 0 ? "#10b981" : "#ef4444" }}>{formatCurrency(cashFlow.net_movement || 0)}</p>
                </div>
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Closing Balance</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(cashFlow.closing_balance || 0)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {report === "day_book" && dayBook && (
          <div className="detail-container">
            <div className="detail-section">
              <p className="detail-section-title">Day Book</p>
              <p className="text-[10px] text-muted mb-3">All journal entries for {dayBook.date ? new Date(dayBook.date).toLocaleDateString() : "selected period"}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-2 text-muted">JE#</th>
                      <th className="text-left py-2 text-muted">Date</th>
                      <th className="text-left py-2 text-muted">Type</th>
                      <th className="text-left py-2 text-muted">Description</th>
                      <th className="text-left py-2 text-muted">Account</th>
                      <th className="text-right py-2 text-muted">Debit</th>
                      <th className="text-right py-2 text-muted">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayBook.entries?.map((e: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td className="py-1.5 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{e.journal_number || `JE-${String(e.journal_id).padStart(4, "0")}`}</td>
                        <td className="py-1.5 text-primary">{new Date(e.date).toLocaleDateString()}</td>
                        <td className="py-1.5"><StatusBadge status={e.reference_type} /></td>
                        <td className="py-1.5 text-xs max-w-[200px] truncate" style={{ color: "var(--text-secondary)" }}>{e.description || "—"}</td>
                        <td className="py-1.5 text-xs">{e.account_code} — {e.account_name}</td>
                        <td className="py-1.5 text-right" style={{ color: e.debit > 0 ? "#3b82f6" : "var(--text-muted)" }}>{e.debit > 0 ? formatCurrency(e.debit) : "—"}</td>
                        <td className="py-1.5 text-right" style={{ color: e.credit > 0 ? "#10b981" : "var(--text-muted)" }}>{e.credit > 0 ? formatCurrency(e.credit) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--border)" }}>
                      <td colSpan={5} className="py-2 font-semibold text-primary">Totals</td>
                      <td className="py-2 text-right font-semibold" style={{ color: "#3b82f6" }}>{formatCurrency(dayBook.total_debit)}</td>
                      <td className="py-2 text-right font-semibold" style={{ color: "#10b981" }}>{formatCurrency(dayBook.total_credit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {Number(dayBook.total_debit) !== Number(dayBook.total_credit) && (
                <div className="mt-3 p-2 rounded-lg text-[10px]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                  ⚠ Day Book does NOT balance! DR ({formatCurrency(dayBook.total_debit)}) ≠ CR ({formatCurrency(dayBook.total_credit)})
                </div>
              )}
            </div>
          </div>
        )}

        {report === "cash_book" && cashBook && (
          <div className="detail-container">
            <div className="detail-section">
              <p className="detail-section-title">Cash Book</p>
              <p className="text-[10px] text-muted mb-3">Cash account transactions with running balance</p>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Opening Balance</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(cashBook.opening_balance)}</p>
                </div>
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Total Receipts</p>
                  <p className="text-lg font-bold text-emerald-400">{formatCurrency(cashBook.total_receipts)}</p>
                </div>
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Total Payments</p>
                  <p className="text-lg font-bold text-red-400">{formatCurrency(cashBook.total_payments)}</p>
                </div>
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Closing Balance</p>
                  <p className="text-lg font-bold" style={{ color: Number(cashBook.closing_balance) >= 0 ? "#10b981" : "#ef4444" }}>{formatCurrency(cashBook.closing_balance)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-2 text-muted">Date</th>
                      <th className="text-left py-2 text-muted">Type</th>
                      <th className="text-left py-2 text-muted">Description</th>
                      <th className="text-right py-2 text-muted">Receipts (DR)</th>
                      <th className="text-right py-2 text-muted">Payments (CR)</th>
                      <th className="text-right py-2 text-muted">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashBook.entries?.map((e: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td className="py-1.5 text-primary">{new Date(e.date).toLocaleDateString()}</td>
                        <td className="py-1.5"><StatusBadge status={e.reference_type} /></td>
                        <td className="py-1.5 text-xs max-w-[200px] truncate" style={{ color: "var(--text-secondary)" }}>{e.description || "—"}</td>
                        <td className="py-1.5 text-right" style={{ color: e.debit > 0 ? "#10b981" : "var(--text-muted)" }}>{e.debit > 0 ? formatCurrency(e.debit) : "—"}</td>
                        <td className="py-1.5 text-right" style={{ color: e.credit > 0 ? "#ef4444" : "var(--text-muted)" }}>{e.credit > 0 ? formatCurrency(e.credit) : "—"}</td>
                        <td className="py-1.5 text-right font-medium" style={{ color: Number(e.balance) >= 0 ? "var(--text-primary)" : "#ef4444" }}>{formatCurrency(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {report === "bank_book" && bankBook && (
          <div className="detail-container">
            <div className="detail-section">
              <p className="detail-section-title">Bank Book</p>
              <p className="text-[10px] text-muted mb-3">Bank account transactions with running balance</p>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Opening Balance</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(bankBook.opening_balance)}</p>
                </div>
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Total Deposits</p>
                  <p className="text-lg font-bold text-emerald-400">{formatCurrency(bankBook.total_deposits)}</p>
                </div>
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Total Withdrawals</p>
                  <p className="text-lg font-bold text-red-400">{formatCurrency(bankBook.total_withdrawals)}</p>
                </div>
                <div className="stat-card p-3">
                  <p className="text-[10px] text-muted">Closing Balance</p>
                  <p className="text-lg font-bold" style={{ color: Number(bankBook.closing_balance) >= 0 ? "#10b981" : "#ef4444" }}>{formatCurrency(bankBook.closing_balance)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-2 text-muted">Date</th>
                      <th className="text-left py-2 text-muted">Type</th>
                      <th className="text-left py-2 text-muted">Description</th>
                      <th className="text-right py-2 text-muted">Deposits (DR)</th>
                      <th className="text-right py-2 text-muted">Withdrawals (CR)</th>
                      <th className="text-right py-2 text-muted">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankBook.entries?.map((e: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td className="py-1.5 text-primary">{new Date(e.date).toLocaleDateString()}</td>
                        <td className="py-1.5"><StatusBadge status={e.reference_type} /></td>
                        <td className="py-1.5 text-xs max-w-[200px] truncate" style={{ color: "var(--text-secondary)" }}>{e.description || "—"}</td>
                        <td className="py-1.5 text-right" style={{ color: e.debit > 0 ? "#10b981" : "var(--text-muted)" }}>{e.debit > 0 ? formatCurrency(e.debit) : "—"}</td>
                        <td className="py-1.5 text-right" style={{ color: e.credit > 0 ? "#ef4444" : "var(--text-muted)" }}>{e.credit > 0 ? formatCurrency(e.credit) : "—"}</td>
                        <td className="py-1.5 text-right font-medium" style={{ color: Number(e.balance) >= 0 ? "var(--text-primary)" : "#ef4444" }}>{formatCurrency(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {report === "receivables" && receivablesAging && (
          <div className="detail-container">
            <div className="detail-section">
              <p className="detail-section-title">Receivables Aging Report</p>
              <div className="space-y-3 mt-2">
                {receivablesAging.map((bucket: any) => (
                  <div key={bucket.label} className="p-3 rounded-lg" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.1)" }}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-primary">{bucket.label}</span>
                      <span className="text-xs font-bold" style={{ color: "#ef4444" }}>{formatCurrency(bucket.total)}</span>
                    </div>
                    {bucket.invoices?.map((inv: any) => (
                      <div key={inv.id} className="flex justify-between text-[10px] py-1" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <span style={{ color: "var(--text-secondary)" }}>{inv.client} · {inv.days_overdue}d overdue</span>
                        <span className="font-medium" style={{ color: "#ef4444" }}>{formatCurrency(inv.amount)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {report === "property_income" && propertyIncome && (
          <div className="detail-container">
            <div className="detail-section">
              <p className="detail-section-title">Property Income Report</p>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-2 text-muted">Property</th>
                      <th className="text-right py-2 text-muted">Income</th>
                      <th className="text-right py-2 text-muted">Expenses</th>
                      <th className="text-right py-2 text-muted">Net</th>
                      <th className="text-right py-2 text-muted">Occupancy</th>
                      <th className="text-right py-2 text-muted">Yield</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propertyIncome.map((p: any) => (
                      <tr key={p.property_id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td className="py-1.5 text-primary">{p.property_name}</td>
                        <td className="py-1.5 text-right text-emerald-400">{formatCurrency(p.income)}</td>
                        <td className="py-1.5 text-right text-red-400">{formatCurrency(p.expenses)}</td>
                        <td className="py-1.5 text-right font-semibold" style={{ color: p.net >= 0 ? "#10b981" : "#ef4444" }}>{formatCurrency(p.net)}</td>
                        <td className="py-1.5 text-right">{p.occupancy_rate}%</td>
                        <td className="py-1.5 text-right">{p.rental_yield}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {report === "dealer_commission" && dealerCommission && (
          <div className="detail-container">
            <div className="detail-section">
              <p className="detail-section-title">Dealer Commission Report</p>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-2 text-muted">Dealer</th>
                      <th className="text-right py-2 text-muted">Deals</th>
                      <th className="text-right py-2 text-muted">Sales Value</th>
                      <th className="text-right py-2 text-muted">Commission</th>
                      <th className="text-right py-2 text-muted">Paid</th>
                      <th className="text-right py-2 text-muted">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealerCommission.map((dc: any) => (
                      <tr key={dc.dealer_name} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td className="py-1.5 text-primary">{dc.dealer_name}</td>
                        <td className="py-1.5 text-right">{dc.deals}</td>
                        <td className="py-1.5 text-right">{formatCurrency(dc.sales_value)}</td>
                        <td className="py-1.5 text-right font-semibold">{formatCurrency(dc.commission)}</td>
                        <td className="py-1.5 text-right text-emerald-400">{formatCurrency(dc.paid)}</td>
                        <td className="py-1.5 text-right" style={{ color: dc.pending > 0 ? "#f59e0b" : "var(--text-muted)" }}>{formatCurrency(dc.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {report === "invoice_outstanding" && (
          <div className="detail-container">
            <div className="detail-section">
              <p className="detail-section-title">Outstanding Invoices</p>
              <p className="text-[10px] text-muted mb-3">All unpaid and partially paid invoices</p>
              {!invoiceOutstanding ? (
                <LoadingSpinner />
              ) : Array.isArray(invoiceOutstanding) && invoiceOutstanding.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted"><DollarSign size={24} className="mb-2 opacity-50" /><p className="text-xs">No outstanding invoices</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th className="text-left py-2 text-muted">Invoice</th>
                        <th className="text-left py-2 text-muted">Client</th>
                        <th className="text-left py-2 text-muted">Type</th>
                        <th className="text-right py-2 text-muted">Amount</th>
                        <th className="text-right py-2 text-muted">Paid</th>
                        <th className="text-right py-2 text-muted">Due</th>
                        <th className="text-right py-2 text-muted">Due Date</th>
                        <th className="text-center py-2 text-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(invoiceOutstanding) ? invoiceOutstanding : invoiceOutstanding?.invoices || []).map((inv: any) => (
                        <tr key={inv.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td className="py-1.5 font-mono text-[10px] text-blue-400">{inv.invoice_number || `#${inv.id}`}</td>
                          <td className="py-1.5 text-primary">{inv.client_name || "—"}</td>
                          <td className="py-1.5"><span className="text-[10px] uppercase text-muted">{inv.invoice_type || "—"}</span></td>
                          <td className="py-1.5 text-right font-medium">{formatCurrency(Number(inv.amount))}</td>
                          <td className="py-1.5 text-right text-emerald-400">{formatCurrency(Number(inv.paid_amount || 0))}</td>
                          <td className="py-1.5 text-right font-semibold" style={{ color: (inv.remaining_amount ?? inv.amount - (inv.paid_amount || 0)) > 0 ? "#ef4444" : "#10b981" }}>{formatCurrency(Number(inv.remaining_amount ?? inv.amount - (inv.paid_amount || 0)))}</td>
                          <td className="py-1.5 text-right text-muted">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                          <td className="py-1.5 text-center"><StatusBadge status={inv.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {report === "invoice_aging" && (
          <div className="detail-container">
            <div className="detail-section">
              <p className="detail-section-title">Invoice Aging Report</p>
              <p className="text-[10px] text-muted mb-3">Aging analysis of outstanding invoices</p>
              {!invoiceAging ? (
                <LoadingSpinner />
              ) : (
                <div className="space-y-3">
                  {(Array.isArray(invoiceAging) ? invoiceAging : invoiceAging?.buckets || []).map((bucket: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.1)" }}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-primary">{bucket.label || bucket.range || `Bucket ${i + 1}`}</span>
                        <span className="text-xs font-bold" style={{ color: "#ef4444" }}>{formatCurrency(Number(bucket.total || bucket.amount || 0))}</span>
                      </div>
                      {(bucket.invoices || bucket.items || []).map((inv: any) => (
                        <div key={inv.id} className="flex justify-between text-[10px] py-1" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <span style={{ color: "var(--text-secondary)" }}>
                            {inv.client_name || inv.client || "Unknown"} · {inv.days_overdue || 0}d overdue
                          </span>
                          <span className="font-medium" style={{ color: "#ef4444" }}>{formatCurrency(Number(inv.amount || inv.remaining_amount || 0))}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {(!invoiceAging || (Array.isArray(invoiceAging) && invoiceAging.length === 0)) && (
                    <div className="flex flex-col items-center py-8 text-muted"><AlertTriangle size={24} className="mb-2 opacity-50" /><p className="text-xs">No aging data</p></div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {report === "invoice_monthly" && (
          <div className="detail-container">
            <div className="detail-section">
              <p className="detail-section-title">Monthly Revenue Report</p>
              <p className="text-[10px] text-muted mb-3">Revenue breakdown by month</p>
              {!invoiceMonthly ? (
                <LoadingSpinner />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th className="text-left py-2 text-muted">Month</th>
                        <th className="text-right py-2 text-muted">Invoice Count</th>
                        <th className="text-right py-2 text-muted">Total Revenue</th>
                        <th className="text-right py-2 text-muted">Collected</th>
                        <th className="text-right py-2 text-muted">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(invoiceMonthly) ? invoiceMonthly : invoiceMonthly?.months || []).map((m: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td className="py-1.5 font-medium text-primary">{m.month || m.label || "—"}</td>
                          <td className="py-1.5 text-right text-muted">{m.count || m.invoice_count || 0}</td>
                          <td className="py-1.5 text-right font-medium text-emerald-400">{formatCurrency(Number(m.revenue || m.total || m.amount || 0))}</td>
                          <td className="py-1.5 text-right text-emerald-400">{formatCurrency(Number(m.collected || m.paid || 0))}</td>
                          <td className="py-1.5 text-right" style={{ color: "#ef4444" }}>{formatCurrency(Number(m.outstanding || m.due || 0))}</td>
                        </tr>
                      ))}
                      {Array.isArray(invoiceMonthly) && invoiceMonthly.length === 0 && (
                        <tr><td colSpan={5} className="py-4 text-center text-muted">No revenue data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIALOGS
// ═══════════════════════════════════════════════════════════════════════════════

function CreateAccountDialog({ isOpen, onClose, onSubmit, isLoading }: any) {
  const [form, setForm] = useState({ code: "", name: "", account_type: "Asset", parent_id: "", description: "", opening_balance: "", opening_balance_date: "", is_system_account: false, is_active: true });
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.code || !form.name) { setError("Code and Name are required"); return; }
    setError("");
    await onSubmit({
      code: form.code, name: form.name, account_type: form.account_type,
      parent_id: form.parent_id ? Number(form.parent_id) : null,
      description: form.description || null,
      opening_balance: form.opening_balance ? Number(form.opening_balance) : 0,
      opening_balance_date: form.opening_balance_date || null,
      is_system_account: form.is_system_account,
    });
    setForm({ code: "", name: "", account_type: "Asset", parent_id: "", description: "", opening_balance: "", opening_balance_date: "", is_system_account: false, is_active: true });
    onClose();
  };

  return (
    <AppDialog isOpen={isOpen} onClose={onClose} title="Create Account" subtitle="Add a new Chart of Accounts entry" size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Code" required><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. 6100" /></FormField>
          <FormField label="Name" required><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Interest Income" /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Type" required>
            <Select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
              <option>Asset</option><option>Liability</option><option>Income</option><option>Expense</option><option>Equity</option>
            </Select>
          </FormField>
          <FormField label="Parent Account">
            <Input value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))} placeholder="Parent ID (optional)" />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Opening Balance">
            <Input type="number" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} placeholder="0" />
          </FormField>
          <FormField label="Opening Date">
            <Input type="date" value={form.opening_balance_date} onChange={e => setForm(f => ({ ...f, opening_balance_date: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Description">
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
        </FormField>
        {error && <p className="text-[10px]" style={{ color: "#ef4444" }}>{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
          <button onClick={handleSubmit} disabled={isLoading} className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5">
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Create Account
          </button>
        </div>
      </div>
    </AppDialog>
  );
}



function BankCashDialog({ isOpen, type, onClose, onSubmit, accounts, isLoading }: any) {
  const isPayment = type?.includes("payment");
  const isBank = type?.includes("bank");
  const color = isPayment ? "#ef4444" : "#10b981";
  const title = `${isBank ? "Bank" : "Cash"} ${isPayment ? "Payment" : "Receipt"}`;
  const [form, setForm] = useState({ account_id: "", amount: "", description: "", date: new Date().toISOString().slice(0, 10), reference: "" });
  const [error, setError] = useState("");
  const [createdTxnId, setCreatedTxnId] = useState<number | null>(null);

  const defaultForm = () => ({ account_id: "", amount: "", description: "", date: new Date().toISOString().slice(0, 10), reference: "" });

  const handleSubmit = async () => {
    if (!form.account_id || !form.amount || !form.description) { setError("All fields required"); return; }
    setError("");
    try {
      const txnId = await onSubmit({ ...form, account_id: Number(form.account_id), amount: Number(form.amount) });
      setCreatedTxnId(txnId);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to record transaction");
    }
  };

  if (createdTxnId) {
    return (
      <AppDialog isOpen={isOpen} onClose={() => { setCreatedTxnId(null); onClose(); }} title={title} subtitle="Transaction recorded successfully" size="lg">
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Check size={16} className="text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">{title} recorded successfully</p>
          </div>
          <AttachmentPanel module="finance" recordId={createdTxnId} />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setCreatedTxnId(null); setForm(defaultForm()); }} className="btn-ghost px-4 py-2 text-xs">
              Add Another
            </button>
            <button onClick={() => { setCreatedTxnId(null); onClose(); }} className="btn-primary px-4 py-2 text-xs">
              Done
            </button>
          </div>
        </div>
      </AppDialog>
    );
  }

  return (
    <AppDialog isOpen={isOpen} onClose={onClose} title={title} subtitle={`Record ${isPayment ? "money out" : "money in"}`}>
      <div className="space-y-3">
        <FormField label="Account" required>
          <Select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
            <option value="">Select account</option>
            {accounts?.filter((a: Account) => !isBank || a.account_type === "Expense" || a.account_type === "Income").map((a: Account) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Amount" required><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></FormField>
        <FormField label="Description" required><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" /></FormField>
        <FormField label="Date"><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></FormField>
        <FormField label="Reference"><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Optional reference" /></FormField>
        {error && <p className="text-[10px]" style={{ color: "#ef4444" }}>{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
          <button onClick={handleSubmit} disabled={isLoading} className="btn-primary px-4 py-2 text-xs" style={{ background: color }}>
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : isPayment ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />} {title}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
