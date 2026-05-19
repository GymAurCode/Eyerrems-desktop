import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  BarChart3, BookOpen, DollarSign, TrendingUp, Zap, CreditCard,
  Banknote, Receipt, FileText, Plus, RefreshCw, ArrowUpRight,
  ArrowDownRight, Wallet, Activity, Layers, Eye, Printer, Edit2, Trash2
} from "lucide-react";
import { RowActions, QuickRowActions } from "../components/actions";
import type { ActionConfig } from "../components/actions";
import { formatCurrency } from "../lib/currency";
import { api } from "../lib/api";
import { AppTable, removeEmptyParams } from "../components/data-table";
import {
  accountsApi, journalsApi, invoicesApi, paymentsApi,
  commissionsApi, expensesApi, bankCashApi,
  type Account, type Invoice, type Payment, type Commission,
  type Expense, type Journal,
  type TrialBalance, type ProfitLoss,
} from "../lib/financeApi";
import {
  CreateAccountDialog, CreateInvoiceDialog, MakePaymentDialog,
  AddExpenseDialog, ManualJournalDialog, BankCashDialog,
} from "../components/finance/FinanceDialogs";
import CommissionWorkflow from "../components/finance/CommissionWorkflow";
import { crmApi } from "../lib/crmApi";
import ChartOfAccounts from "../components/finance/ChartOfAccountsSimple";
import { ErrorBoundary } from "../components/ErrorBoundary";
import UnifiedLedgersTab from "../components/finance/UnifiedLedgersTab";
import OperationsTab from "../components/finance/OperationsTab";

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

// ── Stat Card (matches Dashboard MetricCard exactly) ─────────────────────────
function StatCard({ label, value, icon: Icon, iconBg, iconColor, glowClass, sub, trend, trendUp }: {
  label: string; value: string; icon: React.ElementType;
  iconBg: string; iconColor: string; glowClass: string;
  sub?: string; trend?: string; trendUp?: boolean;
}) {
  return (
    <div className={`stat-card ${glowClass}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
          <Icon size={18} style={{ color: iconColor }} />
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trendUp ? "text-emerald-400" : "text-red-400"}`}>
            {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-primary mb-1">{value}</p>
      <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    paid:    ["rgba(16,185,129,0.15)", "#10b981"],
    partial: ["rgba(59,130,246,0.15)", "#3b82f6"],
    pending: ["rgba(245,158,11,0.15)", "#f59e0b"],
    earned:  ["rgba(59,130,246,0.15)", "#3b82f6"],
    paid2:   ["rgba(139,92,246,0.15)", "#8b5cf6"],
  };
  const key = status === "paid" && status ? "paid" : status;
  const [bg, color] = map[key] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: bg, color }}>{status}</span>
  );
}

export default function FinancePage() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [accounts,     setAccounts]     = useState<Account[]>([]);
  const [journals,     setJournals]     = useState<Journal[]>([]);
  const [invoices,     setInvoices]     = useState<Invoice[]>([]);
  const [payments,     setPayments]     = useState<Payment[]>([]);
  const [commissions,  setCommissions]  = useState<Commission[]>([]);
  const [expenses,     setExpenses]     = useState<Expense[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [profitLoss,   setProfitLoss]   = useState<ProfitLoss | null>(null);
  const [bankBalance,  setBankBalance]  = useState(0);
  const [cashBalance,  setCashBalance]  = useState(0);
  const [dlg, setDlg]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.electronAPI?.log("info", "FinancePage mounted", {
      pathname: location.pathname,
      state: location.state,
    });
    return () => {
      window.electronAPI?.log("info", "FinancePage unmounted");
    };
  }, [location.pathname, location.state]);

  useEffect(() => {
    const fromState = (location.state as { financeTab?: Tab } | null)?.financeTab;
    if (fromState) {
      window.electronAPI?.log("info", `FinancePage setting tab from state: ${fromState}`);
      setTab(fromState);
    }
  }, [location.state]);

  const load = useCallback(async () => {
    window.electronAPI?.log("info", "FinancePage load starting");
    try {
      const [accs, invs, pmts, comms, exps, tb, pl, bb, cb] = await Promise.allSettled([
        accountsApi.list(), invoicesApi.list(), paymentsApi.list(),
        commissionsApi.list(), expensesApi.list(),
        journalsApi.trialBalance(), journalsApi.profitLoss(),
        bankCashApi.bankBalance(), bankCashApi.cashBalance(),
      ]);
      
      window.electronAPI?.log("info", "FinancePage API calls settled", {
        accounts: accs.status,
        invoices: invs.status,
        payments: pmts.status,
        commissions: comms.status,
        expenses: exps.status,
        trialBalance: tb.status,
        profitLoss: pl.status,
        bankBalance: bb.status,
        cashBalance: cb.status,
      });

      if (accs.status  === "fulfilled") setAccounts(accs.value);
      if (invs.status  === "fulfilled") setInvoices(invs.value);
      if (pmts.status  === "fulfilled") setPayments(pmts.value);
      if (comms.status === "fulfilled") setCommissions(comms.value);
      if (exps.status  === "fulfilled") setExpenses(exps.value);
      if (tb.status    === "fulfilled") setTrialBalance(tb.value);
      if (pl.status    === "fulfilled") setProfitLoss(pl.value);
      if (bb.status    === "fulfilled") setBankBalance(bb.value.balance);
      if (cb.status    === "fulfilled") setCashBalance(cb.value.balance);
    } catch (e: any) {
      console.error(e);
      window.electronAPI?.log("error", "FinancePage load failed", {
        message: e?.message,
        stack: e?.stack,
      });
    }
  }, []);

  const loadJournals = useCallback(async () => {
    window.electronAPI?.log("info", "FinancePage loading journals");
    try {
      const d = await journalsApi.list({ limit: 200 });
      setJournals(d);
      window.electronAPI?.log("info", `FinancePage journals loaded: ${d.length} records`);
    } catch (e: any) {
      console.error(e);
      window.electronAPI?.log("error", "FinancePage loadJournals failed", {
        message: e?.message,
        stack: e?.stack,
      });
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === "journals") loadJournals();
  }, [tab, loadJournals]);

  const wrap = (fn: () => Promise<void>) => async () => {
    setLoading(true);
    try { await fn(); await load(); } finally { setLoading(false); }
  };

  const totalInvoiced   = invoices.reduce((s, i) => s + i.amount, 0);
  const totalCollected  = payments.reduce((s, p) => s + p.amount, 0);
  const netProfit       = profitLoss?.net_profit ?? 0;
  const pendingInvoices = invoices.filter(i => i.status !== "paid");
  const totalIncome     = profitLoss?.total_income ?? 0;
  const totalExpenses   = profitLoss?.total_expenses ?? 0;

  return (
    <ErrorBoundary>
      <div className="p-6 space-y-5 animate-slide-up">
        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-primary">Finance & Accounting</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Double-entry accounting · real-time ledger</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setDlg("account")}  className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><Plus size={13}/> Account</button>
            <button onClick={() => setDlg("invoice")}  className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><DollarSign size={13}/> Invoice</button>
            <button onClick={() => setDlg("payment")}  className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><TrendingUp size={13}/> Payment</button>
            <button onClick={() => setDlg("expense")}  className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><Receipt size={13}/> Expense</button>
            <button onClick={() => setDlg("journal")}  className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><FileText size={13}/> Journal</button>
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}>
              <RefreshCw size={13}/>
            </button>
          </div>
        </div>

        {/* ── Stat Cards (same as Dashboard MetricCard) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard label="Bank Balance"        value={formatCurrency(bankBalance)}
            icon={CreditCard}  iconBg="rgba(59,130,246,0.12)"  iconColor="#3b82f6"
            glowClass="glow-blue glow-blue-hover" />
          <StatCard label="Cash Balance"        value={formatCurrency(cashBalance)}
            icon={Banknote}    iconBg="rgba(16,185,129,0.12)"  iconColor="#10b981"
            glowClass="glow-green glow-green-hover" />
          <StatCard label="Total Income"        value={formatCurrency(totalIncome)}
            icon={TrendingUp}  iconBg="rgba(16,185,129,0.12)"  iconColor="#10b981"
            glowClass="glow-green glow-green-hover" trend={`${profitLoss?.income?.length ?? 0} accounts`} trendUp />
          <StatCard label="Total Expenses"      value={formatCurrency(totalExpenses)}
            icon={Receipt}     iconBg="rgba(239,68,68,0.12)"   iconColor="#ef4444"
            glowClass="glow-red glow-red-hover" sub={`${expenses.length} records`} />
          <StatCard label="Pending Receivables" value={formatCurrency(totalInvoiced - totalCollected)}
            icon={Wallet}      iconBg="rgba(245,158,11,0.12)"  iconColor="#f59e0b"
            glowClass="glow-yellow glow-yellow-hover" sub={`${pendingInvoices.length} invoices`} />
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ borderBottom: "1px solid var(--border)" }} className="overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === id
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent hover:text-primary"
                }`}
                style={{ color: tab === id ? "#60a5fa" : "var(--text-muted)" }}>
                <Icon size={13}/>{label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div>
          {tab === "dashboard"   && <DashboardTab trialBalance={trialBalance} profitLoss={profitLoss} invoices={invoices} payments={payments} bankBalance={bankBalance} cashBalance={cashBalance} expenses={expenses} />}
          {tab === "accounts"    && (
            <ErrorBoundary fallback={
              <div className="p-8 text-center">
                <h3 className="text-lg font-semibold text-red-400 mb-2">Chart of Accounts Error</h3>
                <p className="text-sm text-gray-400 mb-4">There was an error loading the Chart of Accounts.</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Refresh Page
                </button>
              </div>
            }>
              <ChartOfAccounts />
            </ErrorBoundary>
          )}
          {tab === "journals"    && <JournalsTab />}
          {tab === "invoices"    && <InvoicesTab onPay={(inv) => setDlg(`pay:${inv.id}`)} />}
          {tab === "payments"    && <PaymentsTab />}
          {tab === "bank"        && <BankCashTab instrument="bank"  balance={bankBalance} accounts={accounts} setDlg={setDlg} />}
          {tab === "cash"        && <BankCashTab instrument="cash"  balance={cashBalance} accounts={accounts} setDlg={setDlg} />}
          {tab === "commissions" && (
            <CommissionsTab
              onAdd={() => setDlg("commission")}
              onReload={load}
            />
          )}
          {tab === "expenses"    && <ExpensesTab onAdd={() => setDlg("expense")} />}
          {tab === "ledger"      && <UnifiedLedgersTab />}
          {tab === "reports"     && <ReportsTab trialBalance={trialBalance} profitLoss={profitLoss} />}
          {tab === "operations"  && <OperationsTab />}
        </div>

        {/* ── Dialogs ── */}
        <CreateAccountDialog isOpen={dlg === "account"} onClose={() => setDlg(null)} onSubmit={async (d) => { await accountsApi.create(d); await load(); }} isLoading={loading} />
        <CreateInvoiceDialog isOpen={dlg === "invoice"} onClose={() => setDlg(null)} onSubmit={async (d) => { await invoicesApi.create(d as any); await load(); }} isLoading={loading} />
        <MakePaymentDialog
          isOpen={dlg === "payment" || (typeof dlg === "string" && dlg.startsWith("pay:"))}
          onClose={() => setDlg(null)}
          onSubmit={async (d) => { await paymentsApi.create(d as any); await load(); }}
          invoices={invoices.filter(i => i.status !== "paid")}
          preselectedInvoiceId={dlg?.startsWith("pay:") ? Number(dlg.split(":")[1]) : undefined}
          isLoading={loading} />
        <AddExpenseDialog isOpen={dlg === "expense"} onClose={() => setDlg(null)} onSubmit={async (d) => { await expensesApi.create(d as any); await load(); }} accounts={accounts.filter(a => a.account_type === "Expense")} isLoading={loading} />
        <CommissionWorkflow
          isOpen={dlg === "commission"}
          onClose={() => setDlg(null)}
          onSuccess={load}
        />
        <ManualJournalDialog isOpen={dlg === "journal"} onClose={() => setDlg(null)} onSubmit={async (d) => { await journalsApi.create(d); await load(); if (tab === "journals") await loadJournals(); }} accounts={accounts} isLoading={loading} />
        <BankCashDialog
          isOpen={["bank_payment","bank_receipt","cash_payment","cash_receipt"].includes(dlg ?? "")}
          type={dlg as any} onClose={() => setDlg(null)}
          onSubmit={async (d) => {
            if (dlg === "bank_payment") await bankCashApi.bankPayment(d);
            if (dlg === "bank_receipt") await bankCashApi.bankReceipt(d);
            if (dlg === "cash_payment") await bankCashApi.cashPayment(d);
            if (dlg === "cash_receipt") await bankCashApi.cashReceipt(d);
            await load();
          }}
          accounts={accounts} isLoading={loading} />
      </div>
    </ErrorBoundary>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ trialBalance, profitLoss, invoices, payments, bankBalance, cashBalance, expenses }: any) {
  const paid    = invoices.filter((i: any) => i.status === "paid").length;
  const partial = invoices.filter((i: any) => i.status === "partial").length;
  const pending = invoices.filter((i: any) => i.status === "pending").length;

  // Recent transactions: merge payments + expenses, sort by date
  const recent = [
    ...payments.slice(0, 10).map((p: any) => ({
      id: `pmt-${p.id}`, label: `Payment — Invoice #${p.invoice_id}`,
      amount: p.amount, type: "in" as const, date: p.date, method: p.method,
    })),
    ...expenses.slice(0, 10).map((e: any) => ({
      id: `exp-${e.id}`, label: e.description,
      amount: e.amount, type: "out" as const, date: e.date, method: e.paid_from,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 12);

  return (
    <div className="space-y-5">
      {/* Row 1: P&L + Invoice Status + Cash/Bank */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* P&L */}
        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Profit & Loss</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Total Income</span>
                <span className="text-sm font-semibold text-emerald-400">{formatCurrency(profitLoss?.total_income ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Total Expenses</span>
                <span className="text-sm font-semibold text-red-400">{formatCurrency(profitLoss?.total_expenses ?? 0)}</span>
              </div>
              <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-primary">Net Profit</span>
                  <span className={`text-base font-bold ${Number(profitLoss?.net_profit ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatCurrency(profitLoss?.net_profit ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Status */}
        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Invoice Status</p>
            <div className="space-y-3">
              {[
                { label: "Paid",    count: paid,    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
                { label: "Partial", count: partial, color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
                { label: "Pending", count: pending, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
              ].map(({ label, count, color, bg }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: bg, color }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cash & Bank */}
        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Cash & Bank</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <div className="flex items-center gap-2">
                  <CreditCard size={15} style={{ color: "#3b82f6" }} />
                  <span className="text-xs font-medium text-primary">Bank</span>
                </div>
                <span className="text-sm font-bold" style={{ color: "#3b82f6" }}>{formatCurrency(bankBalance)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <div className="flex items-center gap-2">
                  <Banknote size={15} style={{ color: "#10b981" }} />
                  <span className="text-xs font-medium text-primary">Cash</span>
                </div>
                <span className="text-sm font-bold" style={{ color: "#10b981" }}>{formatCurrency(cashBalance)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Recent Transactions + Trial Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 detail-container">
          <div className="detail-section">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={14} style={{ color: "#3b82f6" }} />
              <p className="detail-section-title mb-0">Recent Transactions</p>
            </div>
            {recent.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>No transactions yet</p>
            ) : (
              <div className="space-y-0">
                {recent.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0`}
                      style={{ background: tx.type === "in" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
                      {tx.type === "in"
                        ? <ArrowUpRight size={13} style={{ color: "#10b981" }} />
                        : <ArrowDownRight size={13} style={{ color: "#ef4444" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary truncate">{tx.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {new Date(tx.date).toLocaleDateString()} · {tx.method}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold ${tx.type === "in" ? "text-emerald-400" : "text-red-400"}`}>
                      {tx.type === "in" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Trial Balance Preview */}
        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Trial Balance</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {trialBalance?.rows?.filter((r: any) => r.debit > 0 || r.credit > 0).slice(0, 10).map((row: any) => (
                <div key={row.account_id} className="flex justify-between items-center py-1">
                  <span className="text-[10px] truncate pr-2" style={{ color: "var(--text-secondary)" }}>{row.code} {row.name}</span>
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${row.debit > 0 ? "text-blue-400" : "text-emerald-400"}`}>
                    {row.debit > 0 ? `DR ${formatCurrency(row.debit)}` : `CR ${formatCurrency(row.credit)}`}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-3 mt-2 flex justify-between text-xs font-semibold" style={{ borderTop: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-muted)" }}>DR / CR</span>
              <span className="text-primary">{formatCurrency(trialBalance?.total_debit ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Journals Tab ──────────────────────────────────────────────────────────────
function JournalsTab() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewJournal, setViewJournal] = useState<Journal | null>(null);
  const [params, setParams] = useState({
    page: 1,
    pageSize: 10,
    search: "",
    filter: "",
    startDate: "",
    endDate: "",
    propertyType: "",
    status: "",
  });

  const fetchJournals = async (currentParams: typeof params) => {
    setLoading(true);
    setError(null);
    try {
      const sanitized = removeEmptyParams({
        limit: currentParams.pageSize,
        skip: (currentParams.page - 1) * currentParams.pageSize,
      });
      const res = await api.get<Journal[]>("/finance/journals", {
        params: sanitized
      });
      setJournals(res.data);
      setTotal(res.data.length < currentParams.pageSize ? (currentParams.page - 1) * currentParams.pageSize + res.data.length : 1000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load journals");
    } finally {
      setLoading(false);
    }
  };

  const refreshJournals = () => {
    void fetchJournals(params);
  };

  useEffect(() => {
    void fetchJournals(params);
  }, [params]);

  const journalColumns = [
    { key: "id", label: "Journal #", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
    {
      key: "reference_type",
      label: "Reference Type",
      render: (val: string) => <StatusBadge status={val} />
    },
    { key: "description", label: "Description", className: "text-xs" },
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (val: string) => new Date(val).toLocaleDateString()
    },
    {
      key: "lines",
      label: "Lines",
      render: (val: any, row: Journal) => `${row.entries?.length || 0} lines`
    }
  ];

  const journalActions = [
    {
      key: "view",
      label: "View Detail",
      icon: Eye,
      onClick: (row: Journal) => setViewJournal(row),
    }
  ];

  return (
    <div>
      <AppTable
        storageKey="rems_finance_journals"
        title="Journal Entries"
        subtitle="Double-entry ledger journal postings"
        data={journals}
        columns={journalColumns}
        rowActions={journalActions}
        loading={loading}
        error={error}
        onRetry={refreshJournals}
        pagination={{
          page: params.page,
          pageSize: params.pageSize,
          total: total,
        }}
        onPageChange={(config) => setParams((prev) => ({ ...prev, ...config }))}
        onFilterChange={(filters) => setParams((prev) => ({ ...prev, ...filters }))}
        showDateFilter={false}
        showStatusFilter={false}
        showTypeFilter={false}
      />

      {/* Journal entries detail view modal */}
      {viewJournal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
          onClick={() => setViewJournal(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 32px 64px rgba(0,0,0,0.45)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 className="text-sm font-semibold text-primary">Journal Entry Details</h3>
                <p className="text-[10px] text-muted mt-0.5">
                  Journal #{viewJournal.id} · {new Date(viewJournal.date).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setViewJournal(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--hover-bg)"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
                ✕
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-secondary mb-3">Description: {viewJournal.description || "—"}</p>
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)" }}>
                      <th className="px-4 py-2.5 text-xs font-medium text-muted">Account</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-muted text-right">Debit</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-muted text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewJournal.entries?.map((e: any) => (
                      <tr key={e.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td className="px-4 py-2 text-xs text-primary">{e.account_id}</td>
                        <td className="px-4 py-2 text-xs text-right text-emerald-400">{e.debit > 0 ? formatCurrency(e.debit) : "—"}</td>
                        <td className="px-4 py-2 text-xs text-right text-red-400">{e.credit > 0 ? formatCurrency(e.credit) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2"
              style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setViewJournal(null)} className="btn-ghost px-4 py-2 text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Invoices Tab ──────────────────────────────────────────────────────────────
function InvoicesTab({
  onPay,
}: {
  onPay: (inv: Invoice) => void;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewInv, setViewInv] = useState<Invoice | null>(null);
  const [params, setParams] = useState({
    page: 1,
    pageSize: 10,
    search: "",
    filter: "",
    startDate: "",
    endDate: "",
    propertyType: "",
    status: "",
  });

  const fetchInvoices = async (currentParams: typeof params) => {
    setLoading(true);
    setError(null);
    try {
      const sanitized = removeEmptyParams({
        limit: currentParams.pageSize,
        offset: (currentParams.page - 1) * currentParams.pageSize,
        search: currentParams.search,
        filter: currentParams.filter,
        startDate: currentParams.startDate,
        endDate: currentParams.endDate,
        status: currentParams.status,
      });
      const res = await api.get<Invoice[]>("/finance/invoices", {
        params: sanitized
      });
      setInvoices(res.data);
      setTotal(Number(res.headers["x-total-count"] || res.data.length));
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const refreshInvoices = () => {
    void fetchInvoices(params);
  };

  useEffect(() => {
    void fetchInvoices(params);
  }, [params]);

  const invoiceColumns = [
    { key: "id", label: "Invoice #", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
    { key: "tenant_id", label: "Tenant ID", sortable: true, className: "font-mono text-xs" },
    { key: "property_id", label: "Property ID", sortable: true, className: "font-mono text-xs" },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      className: "font-semibold text-primary text-right",
      render: (val: number) => formatCurrency(val)
    },
    {
      key: "status",
      label: "Status",
      render: (val: string) => <StatusBadge status={val} />
    },
    {
      key: "due_date",
      label: "Due Date",
      sortable: true,
      render: (val: string) => new Date(val).toLocaleDateString()
    }
  ];

  const invoiceActions = [
    {
      key: "view",
      label: "View",
      icon: Eye,
      onClick: (row: Invoice) => setViewInv(row),
    },
    {
      key: "pay",
      label: "Pay",
      icon: DollarSign,
      onClick: (row: Invoice) => onPay(row),
      hidden: (row: Invoice) => row.status === "paid",
      permission: "finance:manage"
    },
    {
      key: "print",
      label: "Print",
      icon: Printer,
      onClick: () => window.print(),
    }
  ];

  const statusOptions = [
    { label: "All Statuses", value: "" },
    { label: "Paid", value: "paid" },
    { label: "Partial", value: "partial" },
    { label: "Pending", value: "pending" }
  ];

  return (
    <div>
      <AppTable
        storageKey="rems_finance_invoices"
        title="Invoices"
        subtitle="Manage billing, rental invoices, and collection status"
        data={invoices}
        columns={invoiceColumns}
        rowActions={invoiceActions}
        loading={loading}
        error={error}
        onRetry={refreshInvoices}
        pagination={{
          page: params.page,
          pageSize: params.pageSize,
          total: total,
        }}
        onPageChange={(config) => setParams((prev) => ({ ...prev, ...config }))}
        onFilterChange={(filters) => setParams((prev) => ({ ...prev, ...filters }))}
        showStatusFilter={true}
        statusOptions={statusOptions}
        showTypeFilter={false}
      />

      {/* Invoice detail view modal */}
      {viewInv && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
          onClick={() => setViewInv(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 32px 64px rgba(0,0,0,0.45)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold text-primary">Invoice #{viewInv.id}</h3>
              <button onClick={() => setViewInv(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--hover-bg)"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
                ✕
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                { label: "Tenant ID",    value: viewInv.tenant_id ?? "—" },
                { label: "Property ID",  value: viewInv.property_id ?? "—" },
                { label: "Amount",       value: formatCurrency(viewInv.amount) },
                { label: "Status",       value: viewInv.status },
                { label: "Due Date",     value: new Date(viewInv.due_date).toLocaleDateString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span className="text-xs font-medium text-primary">{String(value)}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 flex justify-end gap-2"
              style={{ borderTop: "1px solid var(--border)" }}>
              {viewInv.status !== "paid" && (
                <button onClick={() => { onPay(viewInv); setViewInv(null); }}
                  className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5">
                  <DollarSign size={12} /> Pay Now
                </button>
              )}
              <button onClick={() => setViewInv(null)} className="btn-ghost px-4 py-2 text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payments Tab ──────────────────────────────────────────────────────────────
function PaymentsTab() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState({
    page: 1,
    pageSize: 10,
    search: "",
    filter: "",
    startDate: "",
    endDate: "",
    propertyType: "",
    status: "",
  });

  const fetchPayments = async (currentParams: typeof params) => {
    setLoading(true);
    setError(null);
    try {
      const sanitized = removeEmptyParams({
        limit: currentParams.pageSize,
        skip: (currentParams.page - 1) * currentParams.pageSize,
      });
      const res = await api.get<Payment[]>("/finance/payments", {
        params: sanitized
      });
      setPayments(res.data);
      setTotal(res.data.length < currentParams.pageSize ? (currentParams.page - 1) * currentParams.pageSize + res.data.length : 1000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const refreshPayments = () => {
    void fetchPayments(params);
  };

  useEffect(() => {
    void fetchPayments(params);
  }, [params]);

  const paymentColumns = [
    { key: "id", label: "#", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
    { key: "invoice_id", label: "Invoice ID", sortable: true, className: "font-mono text-xs" },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      className: "font-semibold text-emerald-400 text-right",
      render: (val: number) => formatCurrency(val)
    },
    {
      key: "method",
      label: "Method",
      render: (val: string) => <StatusBadge status={val} />
    },
    { key: "reference_number", label: "Reference", render: (val: any) => val || "—" },
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (val: string) => new Date(val).toLocaleDateString()
    }
  ];

  const paymentActions = [
    {
      key: "print",
      label: "Print",
      icon: Printer,
      onClick: (row: Payment) => {
        console.log("[Finance] Print payment receipt", row.id);
        window.print();
      }
    }
  ];

  return (
    <AppTable
      storageKey="rems_finance_payments"
      title="Payments"
      subtitle="Rental collections and miscellaneous transaction logs"
      data={payments}
      columns={paymentColumns}
      rowActions={paymentActions}
      loading={loading}
      error={error}
      onRetry={refreshPayments}
      pagination={{
        page: params.page,
        pageSize: params.pageSize,
        total: total,
      }}
      onPageChange={(config) => setParams((prev) => ({ ...prev, ...config }))}
      onFilterChange={(filters) => setParams((prev) => ({ ...prev, ...filters }))}
      showDateFilter={false}
      showStatusFilter={false}
      showTypeFilter={false}
    />
  );
}

// ── Bank/Cash Tab ─────────────────────────────────────────────────────────────
function BankCashTab({ instrument, balance, accounts, setDlg }: any) {
  const isBank  = instrument === "bank";
  const color   = isBank ? "#3b82f6" : "#10b981";
  const Icon    = isBank ? CreditCard : Banknote;
  const bgColor = isBank ? "rgba(59,130,246,0.08)" : "rgba(16,185,129,0.08)";
  const border  = isBank ? "rgba(59,130,246,0.2)" : "rgba(16,185,129,0.2)";

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
          <p className="text-3xl font-bold" style={{ color }}>{formatCurrency(balance)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: `${instrument}_payment`, label: "Record Payment", sub: "Money going out", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.15)" },
          { key: `${instrument}_receipt`, label: "Record Receipt",  sub: "Money coming in",  color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.15)" },
        ].map(({ key, label, sub, color: c, bg, border: b }) => (
          <button key={key} onClick={() => setDlg(key)}
            className="detail-container p-4 text-left transition-all hover:scale-[1.01]"
            style={{ border: `1px solid ${b}`, background: bg }}>
            <p className="text-xs font-semibold mb-1" style={{ color: c }}>{label}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Commissions Tab ───────────────────────────────────────────────────────────
function CommissionsTab({
  onAdd,
  onReload,
}: {
  onAdd: () => void;
  onReload: () => Promise<void>;
}) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealers, setDealers] = useState<{ id: number; name: string }[]>([]);
  const [params, setParams] = useState({
    page: 1,
    pageSize: 10,
    search: "",
    filter: "",
    startDate: "",
    endDate: "",
    propertyType: "",
    status: "",
  });

  useEffect(() => {
    crmApi.getDealers().then((d) => setDealers(d.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);

  const fetchCommissions = async (currentParams: typeof params) => {
    setLoading(true);
    setError(null);
    try {
      const sanitized = removeEmptyParams({
        limit: currentParams.pageSize,
        skip: (currentParams.page - 1) * currentParams.pageSize,
        type: currentParams.propertyType,
        payment_status: currentParams.status,
      });
      const res = await api.get<Commission[]>("/finance/commissions", {
        params: sanitized
      });
      setCommissions(res.data);
      setTotal(res.data.length < currentParams.pageSize ? (currentParams.page - 1) * currentParams.pageSize + res.data.length : 1000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load commissions");
    } finally {
      setLoading(false);
    }
  };

  const refreshCommissions = () => {
    void fetchCommissions(params);
  };

  useEffect(() => {
    void fetchCommissions(params);
  }, [params]);

  const handleMarkPaid = async (c: Commission) => {
    setLoading(true);
    try {
      await commissionsApi.markPaid(c.id);
      await onReload();
      refreshCommissions();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const unpaidTotal = commissions
    .filter((c) => c.type === "earned" && c.payment_status !== "paid")
    .reduce((s, c) => s + c.amount, 0);

  const commissionColumns = [
    { key: "id", label: "#", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
    {
      key: "dealer_name",
      label: "Dealer",
      render: (val: any, row: Commission) => (
        <div>
          <p className="text-xs font-medium text-primary">{row.dealer_name ?? (row.agent_id ? `Agent #${row.agent_id}` : "—")}</p>
          {row.dealer_code && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{row.dealer_code}</p>}
        </div>
      )
    },
    {
      key: "property_name",
      label: "Property",
      render: (val: any, row: Commission) => (
        <div>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{row.property_name ?? `Property #${row.property_id}`}</p>
          {row.property_code && <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{row.property_code}</p>}
        </div>
      )
    },
    {
      key: "sale_amount",
      label: "Sale",
      className: "text-right text-xs",
      render: (val: any) => val != null ? formatCurrency(val) : "—"
    },
    {
      key: "commission_rate",
      label: "Rate",
      className: "text-right text-xs",
      render: (val: any) => val != null ? `${val}%` : "—"
    },
    {
      key: "amount",
      label: "Amount",
      className: "text-right font-semibold",
      render: (val: number) => formatCurrency(val)
    },
    {
      key: "type",
      label: "Type",
      render: (val: string) => <StatusBadge status={val} />
    },
    {
      key: "payment_status",
      label: "Payout",
      render: (val: string, row: Commission) => <StatusBadge status={row.payment_status === "paid" ? "paid" : "pending"} />
    },
    {
      key: "date",
      label: "Date",
      render: (val: string) => new Date(val).toLocaleDateString()
    }
  ];

  const commissionActions = [
    {
      key: "mark_paid",
      label: "Mark paid",
      icon: DollarSign,
      onClick: (r: Commission) => void handleMarkPaid(r),
      hidden: (r: Commission) => !(r.type === "earned" && r.payment_status !== "paid")
    }
  ];

  const statusOptions = [
    { label: "All Payout Statuses", value: "" },
    { label: "Unpaid", value: "unpaid" },
    { label: "Paid", value: "paid" }
  ];

  const typeOptions = [
    { label: "All Commission Types", value: "" },
    { label: "Earned", value: "earned" },
    { label: "Paid (payout)", value: "paid" }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card glow-blue glow-blue-hover p-4">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total records</p>
          <p className="text-xl font-bold text-primary">{commissions.length}</p>
        </div>
        <div className="stat-card glow-yellow glow-yellow-hover p-4">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Unpaid earned</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(unpaidTotal)}</p>
        </div>
        <div className="stat-card glow-green glow-green-hover p-4 col-span-2">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Smart workflow</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            Dealer rate → property → auto-calc → ledger posting
          </p>
        </div>
      </div>

      <AppTable
        storageKey="rems_finance_commissions"
        title="Commissions"
        subtitle="Manage agent/dealer sales commissions and payout cycles"
        data={commissions}
        columns={commissionColumns}
        rowActions={commissionActions}
        loading={loading}
        error={error}
        onRetry={refreshCommissions}
        pagination={{
          page: params.page,
          pageSize: params.pageSize,
          total: total,
        }}
        onPageChange={(config) => setParams((prev) => ({ ...prev, ...config }))}
        onFilterChange={(filters) => setParams((prev) => ({ ...prev, ...filters }))}
        showStatusFilter={true}
        statusOptions={statusOptions}
        showTypeFilter={true}
        typeOptions={typeOptions}
        showDateFilter={false}
        toolbarActions={
          <button onClick={onAdd} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <Plus size={12} /> Record commission
          </button>
        }
      />
    </div>
  );
}

// ── Expenses Tab ──────────────────────────────────────────────────────────────
function ExpensesTab({ onAdd }: { onAdd: () => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState({
    page: 1,
    pageSize: 10,
    search: "",
    filter: "",
    startDate: "",
    endDate: "",
    propertyType: "",
    status: "",
  });

  const fetchExpenses = async (currentParams: typeof params) => {
    setLoading(true);
    setError(null);
    try {
      const sanitized = removeEmptyParams({
        limit: currentParams.pageSize,
        offset: (currentParams.page - 1) * currentParams.pageSize,
        search: currentParams.search,
        filter: currentParams.filter,
        startDate: currentParams.startDate,
        endDate: currentParams.endDate,
      });
      const res = await api.get<Expense[]>("/finance/expenses", {
        params: sanitized
      });
      setExpenses(res.data);
      setTotal(Number(res.headers["x-total-count"] || res.data.length));
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const refreshExpenses = () => {
    void fetchExpenses(params);
  };

  useEffect(() => {
    void fetchExpenses(params);
  }, [params]);

  const handleEditExpense = (expense: Expense) => {
    console.log("[Finance] Edit expense", expense.id);
  };

  const handleDeleteExpense = async (expense: Expense) => {
    try {
      await expensesApi.delete(expense.id);
      refreshExpenses();
    } catch (error) {
      console.error("[Finance] Failed to delete expense", error);
      throw error;
    }
  };

  const expenseColumns = [
    { key: "id", label: "#", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
    {
      key: "account_id",
      label: "Account",
      sortable: true,
      render: (val: any, row: any) => row.account_name ? `${row.account_code} - ${row.account_name}` : (val ? `Account ${val}` : "—")
    },
    { key: "description", label: "Description" },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      className: "font-semibold text-red-400 text-right",
      render: (val: number) => formatCurrency(val)
    },
    {
      key: "paid_from",
      label: "Paid From",
      render: (val: string) => <StatusBadge status={val} />
    },
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (val: string) => new Date(val).toLocaleDateString()
    }
  ];

  const expenseActions = [
    {
      key: "edit",
      label: "Edit",
      icon: Edit2,
      onClick: handleEditExpense,
      permission: "finance:manage"
    },
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      variant: "danger" as const,
      onClick: handleDeleteExpense,
      permission: "finance:manage",
    }
  ];

  return (
    <AppTable
      storageKey="rems_finance_expenses"
      title="Expenses"
      subtitle="Track corporate operating expenditures, bills, and payments"
      data={expenses}
      columns={expenseColumns}
      rowActions={expenseActions}
      loading={loading}
      error={error}
      onRetry={refreshExpenses}
      pagination={{
        page: params.page,
        pageSize: params.pageSize,
        total: total,
      }}
      onPageChange={(config) => setParams((prev) => ({ ...prev, ...config }))}
      onFilterChange={(filters) => setParams((prev) => ({ ...prev, ...filters }))}
      showStatusFilter={false}
      showTypeFilter={false}
      toolbarActions={
        <button onClick={onAdd} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
          <Plus size={12}/> Add Expense
        </button>
      }
    />
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab({ trialBalance, profitLoss }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Trial Balance */}
      <div className="detail-container">
        <div className="detail-section"><p className="detail-section-title mb-0">Trial Balance</p></div>
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead><tr><th>Code</th><th>Account</th><th>Type</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
            <tbody>
              {trialBalance?.rows?.map((r: any) => (
                <tr key={r.account_id}>
                  <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{r.code}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{r.name}</td>
                  <td><StatusBadge status={r.type} /></td>
                  <td className="text-right">{r.debit > 0 ? formatCurrency(r.debit) : "—"}</td>
                  <td className="text-right">{r.credit > 0 ? formatCurrency(r.credit) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="detail-section flex justify-between text-xs font-semibold">
          <span style={{ color: "var(--text-muted)" }}>Totals</span>
          <span className="text-primary">{formatCurrency(trialBalance?.total_debit ?? 0)} / {formatCurrency(trialBalance?.total_credit ?? 0)}</span>
        </div>
      </div>

      {/* P&L */}
      <div className="detail-container">
        <div className="detail-section"><p className="detail-section-title mb-0">Profit & Loss</p></div>
        <div className="detail-section">
          <p className="section-label mb-3">Income</p>
          {profitLoss?.income?.map((r: any) => (
            <div key={r.account_id} className="flex justify-between py-1.5 text-xs" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{r.code} — {r.name}</span>
              <span className="text-emerald-400 font-medium">{formatCurrency(r.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 text-xs font-semibold">
            <span style={{ color: "var(--text-muted)" }}>Total Income</span>
            <span className="text-emerald-400">{formatCurrency(profitLoss?.total_income ?? 0)}</span>
          </div>
        </div>
        <div className="detail-section">
          <p className="section-label mb-3">Expenses</p>
          {profitLoss?.expenses?.map((r: any) => (
            <div key={r.account_id} className="flex justify-between py-1.5 text-xs" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{r.code} — {r.name}</span>
              <span className="text-red-400 font-medium">{formatCurrency(r.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 text-xs font-semibold">
            <span style={{ color: "var(--text-muted)" }}>Total Expenses</span>
            <span className="text-red-400">{formatCurrency(profitLoss?.total_expenses ?? 0)}</span>
          </div>
        </div>
        <div className="detail-section flex justify-between">
          <span className="text-sm font-bold text-primary">Net Profit</span>
          <span className={`text-sm font-bold ${Number(profitLoss?.net_profit ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(profitLoss?.net_profit ?? 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
