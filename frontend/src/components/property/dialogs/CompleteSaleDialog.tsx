import { useState } from "react";
import { CheckCircle } from "lucide-react";
import ModuleDialog from "../../ui/ModuleDialog";
import { propApi } from "../../../lib/propertyApi";

interface CompleteSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  saleId: number;
}

export default function CompleteSaleDialog({ isOpen, onClose, onSaved, saleId }: CompleteSaleDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await propApi.completeSale(saleId);
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
      onClose={onClose}
      title="Mark Sale As Completed"
      size="sm"
      footer={
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)", background: "transparent" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="flex-1 py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
            style={{ background: submitting ? "#10b98180" : "#10b981", color: "#fff" }}
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><CheckCircle size={14} /> Confirm Complete</>
            )}
          </button>
        </div>
      }
    >
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        This will mark the sale as completed and update the property/unit listing status to "Sold".
      </p>
    </ModuleDialog>
  );
}
