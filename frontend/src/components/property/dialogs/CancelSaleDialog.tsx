import { useState } from "react";
import { Ban } from "lucide-react";
import ModuleDialog from "../../ui/ModuleDialog";
import { propApi } from "../../../lib/propertyApi";

interface CancelSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  saleId: number;
}

export default function CancelSaleDialog({ isOpen, onClose, onSaved, saleId }: CancelSaleDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await propApi.cancelSale(saleId, { reason: reason.trim() });
      setReason("");
      onSaved();
      onClose();
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModuleDialog
      isOpen={isOpen}
      onClose={() => { setReason(""); onClose(); }}
      title="Cancel Sale"
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          This will mark the sale as cancelled and restore the property/unit status to Available.
        </p>
        <div>
          <label className="block text-xs text-muted mb-1">Reason for Cancellation *</label>
          <textarea
            className="input-dark w-full px-3 py-2.5 text-sm resize-none"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this sale is being cancelled"
            required
          />
        </div>
        <button
          className="w-full py-3 text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
          style={{ background: submitting ? "#ef444480" : "#ef4444", color: "#fff" }}
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <><Ban size={14} /> Cancel Sale</>
          )}
        </button>
      </div>
    </ModuleDialog>
  );
}
