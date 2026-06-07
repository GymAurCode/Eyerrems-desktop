import { useState, useRef } from "react";
import { Upload, Paperclip, X, CheckCircle2, AlertCircle, DollarSign } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { FormSection, FormRow, FormField } from "../ui/DialogForm";
import { DialogCancelButton, DialogSubmitButton } from "../ui/DialogButtons";
import { bookingApi } from "../../lib/bookingApi";
import { attachmentApi } from "../../lib/attachmentApi";

interface InstallmentInfo {
  id: number;
  installment_number: number | null;
  due_date: string;
  amount: number;
  paid_amount: number;
  remaining: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  bookingRef: string;
  installment: InstallmentInfo;
  onPaid: () => void;
}

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank Draft" },
  { value: "cheque", label: "Cheque" },
  { value: "online", label: "Direct Transfer" },
];

export default function PaymentVerificationDialog({
  open, onClose, bookingId, bookingRef, installment, onPaid,
}: Props) {
  const [mode, setMode] = useState("bank");
  const [amount, setAmount] = useState(String(installment.remaining));
  const [refNumber, setRefNumber] = useState("");
  const [dateReceived, setDateReceived] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const remaining = installment.remaining;

  const reset = () => {
    setMode("bank");
    setAmount(String(remaining));
    setRefNumber("");
    setDateReceived(new Date().toISOString().split("T")[0]);
    setReceiptFile(null);
    setError("");
    setSuccess(false);
    setSaving(false);
  };

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (amt > remaining) { setError(`Cannot exceed remaining (${remaining.toLocaleString()})`); return; }
    if (!refNumber.trim()) { setError("Transaction reference is required"); return; }

    setSaving(true);
    setError("");

    try {
      let receiptId: number | null = null;
      if (receiptFile) {
        const attachment = await attachmentApi.upload(
          "booking", bookingId, receiptFile,
          `Payment Receipt — ${installment.installment_number != null ? `Installment #${installment.installment_number}` : `Inst #${installment.id}`}`,
          "COMPLETED",
        );
        receiptId = attachment.id;
      }

      await bookingApi.payInstallment(bookingId, installment.id, {
        installment_id: installment.id,
        method: mode,
        amount: amt,
        reference_number: refNumber.trim() || undefined,
        payment_date: dateReceived
          ? new Date(dateReceived).toISOString()
          : undefined,
        notes: receiptId ? `Receipt attachment ID: ${receiptId}` : undefined,
      });

      setSuccess(true);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const footer = success ? (
    <DialogSubmitButton
      onClick={() => { reset(); onPaid(); }}
      label="Done"
    />
  ) : (
    <>
      <DialogCancelButton onClick={() => { reset(); onClose(); }} label="Cancel" />
      <DialogSubmitButton onClick={handleSubmit} label="Confirm Payment" loading={saving} />
    </>
  );

  return (
    <AppDialog
      isOpen={open}
      onClose={success ? () => { reset(); onPaid(); } : onClose}
      title={`Payment — ${bookingRef}`}
      icon={<DollarSign size={18} />}
      subtitle="Record a payment against this installment"
      size="md"
      footer={footer}
    >
      {success ? (
        <div className="text-center py-6 space-y-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "rgba(52,211,153,0.15)" }}>
            <CheckCircle2 size={28} style={{ color: "#34d399" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-primary">Payment Recorded</p>
            <p className="text-xs text-muted mt-1">
              {Number(amount).toLocaleString()} received via {mode.replace("_", " ")}
            </p>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-4"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div className="px-3 py-2.5 rounded-lg text-xs space-y-1 mb-4"
            style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between">
              <span className="text-muted">Installment</span>
              <span className="font-semibold text-primary">
                #{installment.installment_number ?? installment.id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Due Date</span>
              <span className="text-secondary">
                {new Date(installment.due_date).toLocaleDateString("en-PK", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Installment Amount</span>
              <span className="text-secondary">{Number(installment.amount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Already Paid</span>
              <span className="text-green-400">{Number(installment.paid_amount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-1" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="font-semibold text-muted">Remaining Balance</span>
              <span className="font-bold" style={{ color: "#a78bfa" }}>{remaining.toLocaleString()}</span>
            </div>
          </div>

          <FormSection title="Payment Details">
            <FormField label="Payment Mode" fullWidth>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_MODES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className="py-2 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={
                      mode === value
                        ? { background: "rgba(59,130,246,0.2)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.4)" }
                        : { background: "var(--bg-surface2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FormField>

            <FormRow cols={2}>
              <FormField label="Amount Received" required>
                <input type="number" className="dialog-input w-full"
                  value={amount} onChange={(e) => setAmount(e.target.value)} />
              </FormField>
              <FormField label="Date Received" required>
                <input type="date" className="dialog-input w-full"
                  value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} />
              </FormField>
            </FormRow>

            <FormField label="Transaction Reference" required>
              <input className="dialog-input w-full"
                value={refNumber} onChange={(e) => setRefNumber(e.target.value)}
                placeholder="Cheque no. / TXN ID / DD no." />
            </FormField>
          </FormSection>

          <FormSection title="Bank Receipt">
            <FormField label="Upload Receipt (optional)" fullWidth>
              {receiptFile ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                  style={{ background: "var(--bg-surface2)" }}>
                  <span className="flex items-center gap-1.5 truncate">
                    <Paperclip size={12} style={{ color: "var(--text-muted)" }} />
                    {receiptFile.name}
                  </span>
                  <button type="button" onClick={() => setReceiptFile(null)}
                    style={{ color: "var(--text-muted)" }}
                    className="hover:text-red-400 shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs cursor-pointer border-2 border-dashed transition-colors hover:border-blue-500/50"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Upload size={14} style={{ color: "var(--text-muted)" }} />
                  <span style={{ color: "var(--text-muted)" }}>Upload bank receipt / proof</span>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setReceiptFile(e.target.files[0]);
                    }} />
                </label>
              )}
            </FormField>
          </FormSection>
        </>
      )}
    </AppDialog>
  );
}
