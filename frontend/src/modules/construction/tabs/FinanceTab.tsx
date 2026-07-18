import { useEffect, useState } from "react";
import {
  Wallet, Plus, DollarSign, Edit3, Trash2, Search,
  TrendingUp, TrendingDown, Receipt,
} from "lucide-react";
import { constructionApi, ConstructionExpense, VendorPayment } from "../../../lib/constructionApi";
import { formatCurrency } from "../../../lib/currency";
import DataTable from "../../../components/data-table/DataTable";
import type { TableColumn } from "../../../components/data-table/types";
import ConfirmDialog from "../../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../../store/notifications";

const EXPENSE_TYPES = [
  "material", "labor", "equipment", "machinery", "contractor",
  "utility", "transport", "permit", "govt", "misc",
];

const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b", paid: "#10b981", cancelled: "#ef4444",
};

function Badge({ label, color }: { label: string; color?: string }) {
  const c = color ?? STATUS_COLOR[label] ?? "#94a3b8";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${c}20`, color: c }}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold text-primary">{title}</p>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function FinanceTab({ projectId }: { projectId: number }) {
  const [expenses, setExpenses] = useState<ConstructionExpense[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [budget, setBudget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"expenses" | "payments">("expenses");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    amount: "", expense_type: "material", description: "", date: new Date().toISOString().split("T")[0], reference_id: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    vendor_name: "", amount: "", payment_date: new Date().toISOString().split("T")[0],
    payment_method: "cash", reference: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const load = async () => {
    setLoading(true);
    try {
      const [e, p, b] = await Promise.all([
        constructionApi.listExpenses(projectId),
        constructionApi.listVendorPayments(projectId),
        constructionApi.getBudget(projectId).catch(() => null),
      ]);
      setExpenses(e);
      setPayments(p);
      setBudget(b);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleSaveExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description) return;
    setSaving(true);
    try {
      await constructionApi.addExpense({
        project_id: projectId,
        ...expenseForm,
        amount: Number(expenseForm.amount),
      });
      pushToast({ title: "Expense added", message: "The expense has been recorded.", type: "success" });
      setShowExpenseForm(false);
      setExpenseForm({ amount: "", expense_type: "material", description: "", date: new Date().toISOString().split("T")[0], reference_id: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed"); }
    finally { setSaving(false); }
  };

  const handleSavePayment = async () => {
    if (!paymentForm.amount || !paymentForm.vendor_name) return;
    setSaving(true);
    try {
      await constructionApi.createVendorPayment({
        project_id: projectId,
        ...paymentForm,
        amount: Number(paymentForm.amount),
      });
      pushToast({ title: "Payment recorded", message: "The vendor payment has been recorded.", type: "success" });
      setShowPaymentForm(false);
      setPaymentForm({ vendor_name: "", amount: "", payment_date: new Date().toISOString().split("T")[0], payment_method: "cash", reference: "", notes: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed"); }
    finally { setSaving(false); }
  };

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalPayments = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalBudget = budget ? Number(budget.total_cost) : 0;

  const expenseColumns: TableColumn<ConstructionExpense>[] = [
    { key: 'date', label: 'Date', render: (v) => <span className="text-xs font-mono text-muted">{v}</span> },
    { key: 'expense_type', label: 'Type', render: (v) => <Badge label={v} /> },
    { key: 'description', label: 'Description', render: (v) => <span className="text-xs text-primary max-w-[200px] truncate block">{v}</span> },
    { key: 'amount', label: 'Amount', render: (v) => <span className="text-xs font-mono text-primary font-semibold">{formatCurrency(Number(v))}</span> },
    { key: 'reference_id', label: 'Ref', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
  ];

  const paymentColumns: TableColumn<VendorPayment>[] = [
    { key: 'payment_date', label: 'Date', render: (v) => <span className="text-xs font-mono text-muted">{v}</span> },
    { key: 'vendor_name', label: 'Vendor', render: (v) => <span className="text-xs text-primary">{v ?? "—"}</span> },
    { key: 'amount', label: 'Amount', render: (v) => <span className="text-xs font-mono text-primary font-semibold">{formatCurrency(Number(v))}</span> },
    { key: 'payment_method', label: 'Method', render: (v) => <span className="text-xs capitalize text-muted">{v ?? "—"}</span> },
    { key: 'status', label: 'Status', render: (v, r) => (
      <div className="flex items-center gap-1">
        <Badge label={v} />
        {v === "pending" && (
          <button onClick={() => constructionApi.updateVendorPaymentStatus(r.id, "paid").then(load)}
            className="p-0.5 text-muted hover:text-emerald-400"><DollarSign size={10} /></button>
        )}
      </div>
    )},
    { key: 'reference', label: 'Ref', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
  ];

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
          <span className="text-[10px] text-muted uppercase tracking-wider">Total Budget</span>
          <p className="text-lg font-bold text-blue-400">{formatCurrency(totalBudget)}</p>
        </div>
        <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
          <span className="text-[10px] text-muted uppercase tracking-wider">Total Expenses</span>
          <p className="text-lg font-bold text-orange-400">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
          <span className="text-[10px] text-muted uppercase tracking-wider">Vendor Payments</span>
          <p className="text-lg font-bold text-purple-400">{formatCurrency(totalPayments)}</p>
        </div>
        <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
          <span className="text-[10px] text-muted uppercase tracking-wider">Remaining</span>
          <p className={`text-lg font-bold ${(totalBudget - totalExpenses) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(Math.max(0, totalBudget - totalExpenses))}
          </p>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2">
        {(["expenses","payments"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
              activeTab === tab ? "text-white bg-blue-600" : "text-muted hover:text-primary bg-white/5 hover:bg-white/10"
            }`}>
            {tab === "expenses" ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {tab}
          </button>
        ))}
      </div>

      {/* Expenses */}
      {activeTab === "expenses" && (
        <SectionCard title="Project Expenses"
          action={
            <button onClick={() => setShowExpenseForm(true)}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              <Plus size={10} /> Add Expense
            </button>
          }>
          <DataTable data={expenses} columns={expenseColumns} searchable
            emptyTitle="No expenses recorded"
            onDelete={(row) => setDeleteTarget(row.id)} />
        </SectionCard>
      )}

      {/* Payments */}
      {activeTab === "payments" && (
        <SectionCard title="Vendor Payments"
          action={
            <button onClick={() => setShowPaymentForm(true)}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white bg-emerald-600 hover:bg-emerald-500">
              <Plus size={10} /> Record Payment
            </button>
          }>
          <DataTable data={payments} columns={paymentColumns} searchable
            emptyTitle="No payments recorded" />
        </SectionCard>
      )}

      {/* Expense Form */}
      {showExpenseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowExpenseForm(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-md" style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">Add Expense</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Amount *</label>
                  <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Type</label>
                  <select value={expenseForm.expense_type} onChange={e => setExpenseForm(p => ({ ...p, expense_type: e.target.value }))} className="dialog-select">
                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Date</label>
                  <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Reference</label>
                  <input value={expenseForm.reference_id} onChange={e => setExpenseForm(p => ({ ...p, reference_id: e.target.value }))} className="dialog-input" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Description *</label>
                <textarea value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} rows={2} className="dialog-textarea" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowExpenseForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleSaveExpense} disabled={saving || !expenseForm.amount || !expenseForm.description}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                  {saving ? "Saving…" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Form */}
      {showPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPaymentForm(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-md" style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">Record Vendor Payment</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Vendor *</label>
                  <input value={paymentForm.vendor_name} onChange={e => setPaymentForm(p => ({ ...p, vendor_name: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Amount *</label>
                  <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Date</label>
                  <input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Method</label>
                  <select value={paymentForm.payment_method} onChange={e => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))} className="dialog-select">
                    {["cash","bank_transfer","check","credit_card","other"].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Reference</label>
                <input value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} className="dialog-input" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Notes</label>
                <textarea value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="dialog-textarea" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowPaymentForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleSavePayment} disabled={saving || !paymentForm.amount || !paymentForm.vendor_name}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                  {saving ? "Saving…" : "Record"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (deleteTarget !== null) {
            await constructionApi.deleteExpense(deleteTarget);
            pushToast({ title: "Expense deleted", message: "The expense has been deleted.", type: "success" });
            setDeleteTarget(null);
            load();
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
