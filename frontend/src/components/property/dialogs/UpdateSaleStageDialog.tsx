import { useState, useEffect } from "react";
import ModuleDialog from "../../ui/ModuleDialog";
import { propApi } from "../../../lib/propertyApi";

interface UpdateSaleStageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  saleId: number;
  currentStage: string;
}

const STAGES = [
  "enquiry", "offer_made", "due_diligence", "spa_signed",
  "token_paid", "payment_processing", "transfer", "completed", "cancelled",
] as const;

const STAGE_LABELS: Record<string, string> = {
  enquiry: "Enquiry", offer_made: "Offer Made", due_diligence: "Due Diligence",
  spa_signed: "SPA Signed", token_paid: "Token Paid",
  payment_processing: "Payment Processing", transfer: "Transfer",
  completed: "Completed", cancelled: "Cancelled",
};

export default function UpdateSaleStageDialog({ isOpen, onClose, onSaved, saleId, currentStage }: UpdateSaleStageDialogProps) {
  const [stageValue, setStageValue] = useState(currentStage);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setStageValue(currentStage);
  }, [isOpen, currentStage]);

  const submit = async () => {
    if (!stageValue) return;
    setSubmitting(true);
    try {
      await propApi.updateSaleStage(saleId, { stage: stageValue });
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
      title="Update Sale Stage"
      size="sm"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1">New Stage</label>
          <select className="select-dark w-full px-3 py-2.5 text-sm" value={stageValue}
            onChange={(e) => setStageValue(e.target.value)}>
            {STAGES.filter(s => s !== "cancelled" && s !== "completed").map(s => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
            <option value="cancelled" style={{ color: "#ef4444" }}>Cancelled</option>
            <option value="completed" style={{ color: "#10b981" }}>Completed</option>
          </select>
        </div>
        <p className="text-xs text-muted">Stage change will be logged with timestamp for audit trail.</p>
        <button
          className="btn-property w-full py-3 text-sm flex items-center justify-center gap-2"
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Update Stage"
          )}
        </button>
      </div>
    </ModuleDialog>
  );
}
