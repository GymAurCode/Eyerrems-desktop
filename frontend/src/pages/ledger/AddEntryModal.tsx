/**
 * AddEntryModal — Manual ledger entry creation modal.
 * Works for client, dealer, and property ledger types.
 */
import { useState } from "react";
import { BookOpen } from "lucide-react";
import AppDialog from "../../components/ui/AppDialog";
import type {
  ClientLedgerEntryCreate,
  DealerLedgerEntryCreate,
  PropertyLedgerEntryCreate,
} from "../../lib/ledgerApi";

type LedgerType = "client" | "dealer" | "property";

interface Props {
  type:       LedgerType;
  entityId:   number;
  entityName: string;
  entryTypes: string[];
  onClose:    () => void;
  onSubmit:   (data: any) => Promise<void>;
}

export default function AddEntryModal({ type, entityId, entityName, entryTypes, onClose, onSubmit }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const today = new Date().toISOString().slice(0, 16);

  const [form, setForm] = useState({
    entry_date:      today,
    description:     "",
    reference_no:    "",
    entry_type:      entryTypes[0] ?? "",
    debit:           "",
    credit:          "",
    payment_method:  "",
    status:          "posted",
    notes:           "",
    commission_rate: "",
    gross_commission: "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.description.trim()) { setError("Description is required"); return; }
    if (!form.entry_type)         { setError("Entry type is required");   return; }
    if (!form.debit && !form.credit) { setError("Enter either a debit or credit amount"); return; }

    const debit  = parseFloat(form.debit)  || 0;
    const credit = parseFloat(form.credit) || 0;

    if (debit < 0 || credit < 0) { setError("Amounts must be positive"); return; }

    setLoading(true);
    try {
      const base = {
        entry_date:   form.entry_date,
        description:  form.description.trim(),
        reference_no: form.reference_no.trim() || undefined,
        entry_type:   form.entry_type,
        debit,
        credit,
        status:       form.status,
        notes:        form.notes.trim() || undefined,
      };

      if (type === "client") {
        await onSubmit({
          ...base,
          client_id:      entityId,
          payment_method: form.payment_method || undefined,
        } as ClientLedgerEntryCreate);
      } else if (type === "dealer") {
        await onSubmit({
          ...base,
          dealer_id:        entityId,
          commission_rate:  form.commission_rate ? parseFloat(form.commission_rate) / 100 : undefined,
          gross_commission: form.gross_commission ? parseFloat(form.gross_commission) : undefined,
        } as DealerLedgerEntryCreate);
      } else {
        await onSubmit({
          ...base,
          property_id: entityId,
        } as PropertyLedgerEntryCreate);
      }

      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to create entry");
    } finally {
      setLoading(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.65rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "var(--text-muted)",
    marginBottom: "0.375rem",
  };

  return (
    <AppDialog isOpen onClose={onClose} title="Add Ledger Entry" subtitle={entityName} size="lg" icon={<BookOpen size={16} />}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", width: "100%" }}>
          <button type="button" onClick={onClose} className="btn-ghost text-xs px-4 py-2">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary text-xs px-5 py-2" form="add-entry-form">
            {loading ? "Saving…" : "Save Entry"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} id="add-entry-form">
        <div className="space-y-4">
              {error && (
                <div className="px-3 py-2 rounded-xl text-xs"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                  {error}
                </div>
              )}

              {/* Date + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Entry Date *</label>
                  <input type="datetime-local" value={form.entry_date}
                    onChange={e => set("entry_date", e.target.value)} className="dialog-input" required />
                </div>
                <div>
                  <label style={labelStyle}>Entry Type *</label>
                  <select value={form.entry_type} onChange={e => set("entry_type", e.target.value)} className="dialog-select">
                    {entryTypes.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description *</label>
                <input type="text" value={form.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="Enter transaction description…"
                  className="dialog-input" required />
              </div>

              {/* Reference No */}
              <div>
                <label style={labelStyle}>Reference No</label>
                <input type="text" value={form.reference_no}
                  onChange={e => set("reference_no", e.target.value)}
                  placeholder="e.g. INV-001, CHQ-123…"
                  className="dialog-input" />
              </div>

              {/* Debit + Credit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ ...labelStyle, color: "#f87171" }}>Debit Amount</label>
                  <input type="number" min="0" step="0.01" value={form.debit}
                    onChange={e => set("debit", e.target.value)}
                    placeholder="0.00"
                    className="dialog-input" style={{ color: form.debit ? "#f87171" : "var(--text-primary)" }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, color: "#34d399" }}>Credit Amount</label>
                  <input type="number" min="0" step="0.01" value={form.credit}
                    onChange={e => set("credit", e.target.value)}
                    placeholder="0.00"
                    className="dialog-input" style={{ color: form.credit ? "#34d399" : "var(--text-primary)" }} />
                </div>
              </div>

              {/* Payment Method (client only) */}
              {type === "client" && (
                <div>
                  <label style={labelStyle}>Payment Method</label>
                  <select value={form.payment_method} onChange={e => set("payment_method", e.target.value)} className="dialog-select">
                    <option value="">— Select —</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              )}

              {/* Commission fields (dealer only) */}
              {type === "dealer" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Commission Rate (%)</label>
                    <input type="number" min="0" max="100" step="0.01" value={form.commission_rate}
                      onChange={e => set("commission_rate", e.target.value)}
                      placeholder="e.g. 2.5"
                      className="dialog-input" />
                  </div>
                  <div>
                    <label style={labelStyle}>Gross Commission</label>
                    <input type="number" min="0" step="0.01" value={form.gross_commission}
                      onChange={e => set("gross_commission", e.target.value)}
                      placeholder="0.00"
                      className="dialog-input" />
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={e => set("status", e.target.value)} className="dialog-select">
                  <option value="posted">Posted</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                  placeholder="Optional notes or remarks…"
                  rows={3}
                  className="dialog-textarea" />
              </div>
            </div>
      </form>
    </AppDialog>
  );
}
