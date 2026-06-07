import { useState, useEffect } from "react";
import AppDialog from "../../ui/AppDialog";
import { propApi, SaleInstalment } from "../../../lib/propertyApi";
import { formatCurrency } from "../../../lib/currency";

interface RecordPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  saleId: number;
  salePrice: number;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function RecordPaymentDialog({ isOpen, onClose, onSaved, saleId, salePrice }: RecordPaymentDialogProps) {
  const [instalments, setInstalments] = useState<SaleInstalment[]>([]);
  const [instalId, setInstalId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [refNo, setRefNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(String(salePrice));
      setDate(new Date().toISOString().split("T")[0]);
      setRefNo("");
      setInstalId("");
      propApi.getSaleInstalments(saleId).then(r => {
        setInstalments(r || []);
      }).catch(() => setInstalments([]));
    }
  }, [isOpen, saleId, salePrice]);

  const submit = async () => {
    if (!amount || !date) return;
    setSubmitting(true);
    try {
      await propApi.recordSalePayment(saleId, {
        instalment_id: instalId ? Number(instalId) : null,
        amount: Number(amount),
        payment_date: date,
        reference_no: refNo || null,
      });
      onSaved();
      onClose();
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      size="sm"
    >
      <div className="space-y-4">
        {instalments.length > 0 && (
          <div>
            <label className="block text-xs text-muted mb-1">Select Instalment</label>
            <select className="dialog-select" value={instalId}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : "";
                setInstalId(id);
                if (id) {
                  const inst = instalments.find(i => i.id === id);
                  if (inst) setAmount(String(inst.amount));
                }
              }}>
              <option value="">— Direct payment —</option>
              {instalments.filter(i => i.status !== "paid").map(inst => (
                <option key={inst.id} value={inst.id}>
                  {inst.milestone_name} — {formatCurrency(inst.amount)} (due {formatDate(inst.due_date)})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">Amount (Rs) *</label>
            <input className="dialog-input" type="number" value={amount}
              onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Payment Date *</label>
            <input className="dialog-input" type="date" value={date}
              onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Reference No.</label>
          <input className="dialog-input" value={refNo}
            onChange={(e) => setRefNo(e.target.value)} placeholder="Optional" />
        </div>
        <button
          className="btn-property w-full py-3 text-sm flex items-center justify-center gap-2"
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Record Payment"
          )}
        </button>
      </div>
    </AppDialog>
  );
}
