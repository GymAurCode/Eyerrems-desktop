import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, BookOpen, DollarSign, TrendingUp, Zap, CreditCard,
  Banknote, Receipt, FileText, Plus, RefreshCw, ArrowUpRight,
  ArrowDownRight, Wallet, Activity, Layers,
} from "lucide-react";
import { RowActions, QuickRowActions } from "../components/actions";
import type { ActionConfig } from "../components/actions";
import { formatCurrency } from "../lib/currency";
import {
  accountsApi, journalsApi, invoicesApi, paymentsApi,
  commissionsApi, expensesApi, bankCashApi,
  type Account, type Invoice, type Payment, type Commission,
  type Expense, type Journal,
  type TrialBalance, type ProfitLoss,
} from "../lib/financeApi";
import {
  CreateAccountDialog, CreateInvoiceDialog, MakePaymentDialog,
  CreateCommissionDialog, AddExpenseDialog, ManualJournalDialog, BankCashDialog,
} from "../components/finance/FinanceDialogs";
import ChartOfAccounts from "../components/finance/ChartOfAccounts";
import GeneralLedger from "../components/finance/GeneralLedger";
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
  const navigate = useNavigate();
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

  const load = useCallback(async () => {
    try {
      const [accs, invs, pmts, comms, exps, tb, pl, bb, cb] = await Promise.allSettled([
        accountsApi.list(), invoicesApi.list(), paymentsApi.list(),
        commissionsApi.list(), expensesApi.list(),
        journalsApi.trialBalance(), journalsApi.profitLoss(),
        bankCashApi.bankBalance(), bankCashApi.cashBalance(),
      ]);
      if (accs.status  === "fulfilled") setAccounts(accs.value);
      if (invs.status  === "fulfilled") setInvoices(invs.value);
      if (pmts.status  === "fulfilled") setPayments(pmts.value);
      if (comms.status === "fulfilled") setCommissions(comms.value);
      if (exps.status  === "fulfilled") setExpenses(exps.value);
      if (tb.status    === "fulfilled") setTrialBalance(tb.value);
      if (pl.status    === "fulfilled") setProfitLoss(pl.value);
      if (bb.status    === "fulfilled") setBankBalance(bb.value.balance);
      if (cb.status    === "fulfilled") setCashBalance(cb.value.balance);
    } catch (e) { console.error(e); }
  }, []);

  const loadJournals = useCallback(async () => {
    try { const d = await journalsApi.list({ limit: 200 }); setJournals(d); } catch (e) { console.error(e); }
  }, []);


  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "journals") loadJournals(); }, [tab, loadJournals]);

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
        {tab === "accounts"    && <ChartOfAccounts onSelectAccount={(id) => { navigate("/ledger"); }} />}
        {tab === "journals"    && <JournalsTab journals={journals} onRefresh={loadJournals} />}
        {tab === "invoices"    && <InvoicesTab invoices={invoices} onPay={(inv) => setDlg(`pay:${inv.id}`)} />}
        {tab === "payments"    && <PaymentsTab payments={payments} />}
        {tab === "bank"        && <BankCashTab instrument="bank"  balance={bankBalance} accounts={accounts} setDlg={setDlg} />}
        {tab === "cash"        && <BankCashTab instrument="cash"  balance={cashBalance} accounts={accounts} setDlg={setDlg} />}
        {tab === "commissions" && <CommissionsTab commissions={commissions} onAdd={() => setDlg("commission")} />}
        {tab === "expenses"    && <ExpensesTab expenses={expenses} onAdd={() => setDlg("expense")} />}
        {tab === "ledger"      && (
          <LedgerRedirectPanel onNavigate={() => navigate("/ledger")} />
        )}
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
      <CreateCommissionDialog isOpen={dlg === "commission"} onClose={() => setDlg(null)} onSubmit={async (d) => { await commissionsApi.create(d as any); await load(); }} isLoading={loading} />
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
function JournalsTab({ journals, onRefresh }: { journals: Journal[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div className="detail-container">
      <div className="detail-section flex items-center justify-between">
        <p className="detail-section-title mb-0">Journal Entries</p>
        <button onClick={onRefresh} className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}>
          <RefreshCw size={13}/>
        </button>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        {journals.length === 0 && <p className="text-xs text-center py-10" style={{ color: "var(--text-muted)" }}>No journal entries yet</p>}
        {journals.map(j => (
          <div key={j.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <button onClick={() => setExpanded(expanded === j.id ? null : j.id)}
              className="w-full flex items-center justify-between px-5 py-3 text-left transition-colors"
              style={{ background: expanded === j.id ? "var(--hover-bg-sm)" : "transparent" }}
              onMouseEnter={e => { if (expanded !== j.id) (e.currentTarget as HTMLElement).style.background = "var(--hover-bg-sm)"; }}
              onMouseLeave={e => { if (expanded !== j.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <div className="flex items-center gap-3">
                <StatusBadge status={j.reference_type} />
                <span className="text-xs text-primary">{j.description || `Ref: ${j.reference_id || j.id}`}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(j.date).toLocaleDateString()}</span>
              </div>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{j.entries?.length} lines</span>
            </button>
            {expanded === j.id && (
              <div className="px-5 pb-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <table className="erp-table mt-3">
                  <thead><tr><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
                  <tbody>
                    {j.entries?.map((e: any) => (
                      <tr key={e.id}>
                        <td style={{ color: "var(--text-secondary)" }}>{e.account_id}</td>
                        <td className="text-right">{e.debit > 0 ? formatCurrency(e.debit) : "—"}</td>
                        <td className="text-right">{e.credit > 0 ? formatCurrency(e.credit) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Invoices Tab ──────────────────────────────────────────────────────────────
// ── Invoices Tab ──────────────────────────────────────────────────────────────
function InvoicesTab({
  invoices,
  onPay,
}: {
  invoices: Invoice[];
  onPay: (inv: Invoice) => void;
}) {
  const [viewInv, setViewInv] = useState<Invoice | null>(null);

  // Build per-row actions using the reusable ActionConfig pattern.
  // Each action is typed to Invoice so handlers receive the correct row data.
  const getActions = (inv: Invoice): ActionConfig<Invoice>[] => [
    {
      type: "view",
      handler: (r) => setViewInv(r),
      tooltip: "View invoice details",
    },
    {
      // "Pay" is a custom action — uses the "custom" type with overrides
      type: "custom",
      label: "Pay",
      color: "#60a5fa",
      icon: DollarSign,
      tooltip: "Record payment for this invoice",
      handler: (r) => onPay(r),
      // Only show Pay button for unpaid invoices
      visible: (r) => r.status !== "paid",
      permission: "finance:manage",
    },
    {
      type: "print",
      handler: (r) => window.print(),
      tooltip: "Print invoice",
    },
    {
      type: "delete",
      handler: async (r) => {
        // Placeholder — wire to invoicesApi.delete(r.id) when endpoint exists
        console.log("[Finance] Delete invoice", r.id);
      },
      permission: "finance:manage",
      confirmMessage: `Are you sure you want to delete Invoice #${viewInv?.id ?? ""}? This cannot be undone.`,
    },
  ];

  return (
    <div className="detail-container">
      <div className="detail-section">
        <p className="detail-section-title mb-0">Invoices</p>
      </div>
      <div className="overflow-x-auto">
        <table className="erp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tenant</th>
              <th>Property</th>
              <th className="text-right">Amount</th>
              <th>Status</th>
              <th>Due Date</th>
              {/* Actions column — no header text, right-aligned */}
              <th className="text-right" style={{ width: "1%" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10" style={{ color: "var(--text-muted)" }}>
                  No invoices
                </td>
              </tr>
            )}
            {invoices.map(inv => (
              <tr key={inv.id}>
                <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>#{inv.id}</td>
                <td style={{ color: "var(--text-secondary)" }}>{inv.tenant_id ?? "—"}</td>
                <td style={{ color: "var(--text-secondary)" }}>{inv.property_id ?? "—"}</td>
                <td className="text-right font-semibold">{formatCurrency(inv.amount)}</td>
                <td><StatusBadge status={inv.status} /></td>
                <td style={{ color: "var(--text-secondary)" }}>
                  {new Date(inv.due_date).toLocaleDateString()}
                </td>
                <td className="text-right">
                  {/* ── RowActions example implementation ── */}
                  <RowActions
                    row={inv}
                    actions={getActions(inv)}
                    variant="icon-buttons"
                    compact
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
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
                { label: "Created",      value: new Date(viewInv.created_at).toLocaleDateString() },
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
function PaymentsTab({ payments }: { payments: Payment[] }) {
  return (
    <div className="detail-container">
      <div className="detail-section"><p className="detail-section-title mb-0">Payment History</p></div>
      <div className="overflow-x-auto">
        <table className="erp-table">
          <thead><tr><th>#</th><th>Invoice</th><th className="text-right">Amount</th><th>Method</th><th>Reference</th><th>Date</th></tr></thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={6} className="text-center py-10" style={{ color: "var(--text-muted)" }}>No payments</td></tr>}
            {payments.map(p => (
              <tr key={p.id}>
                <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>#{p.id}</td>
                <td style={{ color: "var(--text-secondary)" }}>#{p.invoice_id}</td>
                <td className="text-right font-semibold text-emerald-400">{formatCurrency(p.amount)}</td>
                <td><StatusBadge status={p.method} /></td>
                <td style={{ color: "var(--text-muted)" }}>{p.reference_number || "—"}</td>
                <td style={{ color: "var(--text-secondary)" }}>{new Date(p.date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
function CommissionsTab({ commissions, onAdd }: { commissions: Commission[]; onAdd: () => void }) {
  return (
    <div className="detail-container">
      <div className="detail-section flex items-center justify-between">
        <p className="detail-section-title mb-0">Commissions</p>
        <button onClick={onAdd} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={12}/> Add</button>
      </div>
      <div className="overflow-x-auto">
        <table className="erp-table">
          <thead><tr><th>#</th><th>Agent</th><th>Property</th><th className="text-right">Amount</th><th>Type</th><th>Date</th></tr></thead>
          <tbody>
            {commissions.length === 0 && <tr><td colSpan={6} className="text-center py-10" style={{ color: "var(--text-muted)" }}>No commissions</td></tr>}
            {commissions.map(c => (
              <tr key={c.id}>
                <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>#{c.id}</td>
                <td style={{ color: "var(--text-secondary)" }}>{c.agent_id}</td>
                <td style={{ color: "var(--text-secondary)" }}>{c.property_id}</td>
                <td className="text-right font-semibold">{formatCurrency(c.amount)}</td>
                <td><StatusBadge status={c.type} /></td>
                <td style={{ color: "var(--text-secondary)" }}>{new Date(c.date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Expenses Tab ──────────────────────────────────────────────────────────────
function ExpensesTab({ expenses, onAdd }: { expenses: Expense[]; onAdd: () => void }) {
  return (
    <div className="detail-container">
      <div className="detail-section flex items-center justify-between">
        <p className="detail-section-title mb-0">Expenses</p>
        <button onClick={onAdd} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={12}/> Add</button>
      </div>
      <div className="overflow-x-auto">
        <table className="erp-table">
          <thead><tr><th>#</th><th>Account</th><th>Description</th><th className="text-right">Amount</th><th>Paid From</th><th>Date</th></tr></thead>
          <tbody>
            {expenses.length === 0 && <tr><td colSpan={6} className="text-center py-10" style={{ color: "var(--text-muted)" }}>No expenses</td></tr>}
            {expenses.map(e => (
              <tr key={e.id}>
                <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>#{e.id}</td>
                <td style={{ color: "var(--text-secondary)" }}>{e.account_code} — {e.account_name}</td>
                <td style={{ color: "var(--text-muted)" }}>{e.description}</td>
                <td className="text-right font-semibold text-red-400">{formatCurrency(e.amount)}</td>
                <td><StatusBadge status={e.paid_from} /></td>
                <td style={{ color: "var(--text-secondary)" }}>{new Date(e.date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Ledger Redirect Panel ─────────────────────────────────────────────────────
function LedgerRedirectPanel({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.2)" }}>
        <BookOpen size={28} style={{ color: "#3b82f6" }} />
      </div>
      <div className="text-center space-y-1">
        <p className="text-base font-bold text-primary">Ledger Management</p>
        <p className="text-xs max-w-sm" style={{ color: "var(--text-muted)" }}>
          All ledger types — Accounts, Clients, Dealers, and Properties — are now unified
          in the dedicated Ledger module.
        </p>
      </div>
      <button
        onClick={onNavigate}
        className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
      >
        <BookOpen size={14} />
        Open Ledger Management
      </button>
    </div>
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
