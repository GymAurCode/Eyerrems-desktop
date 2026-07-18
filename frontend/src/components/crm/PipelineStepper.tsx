import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

export interface PipelineStage {
  key: string;
  label: string;
  color: string;
  completed?: boolean;
  active?: boolean;
  locked?: boolean;
}

const PIPELINE_STAGES: PipelineStage[] = [
  { key: "booking",     label: "Booking",     color: "#3b82f6" },
  { key: "fees",        label: "Fees",        color: "#8b5cf6" },
  { key: "contract",    label: "Contract",    color: "#f59e0b" },
  { key: "payment_plan",label: "Payment Plan",color: "#6366f1" },
  { key: "installments",label: "Installments", color: "#10b981" },
  { key: "transfer",    label: "Transfer",    color: "#ec4899" },
  { key: "possession",  label: "Possession",  color: "#06b6d4" },
  { key: "after_sales", label: "After Sales", color: "#f97316" },
];

export function getPipelineStages(booking: any, contract: any, plan: any,
                                  installments: any[], transfers: any[],
                                  handover: any, tickets: any[]): PipelineStage[] {
  const hasFees = booking && (
    Number(booking.processing_fee) > 0 ||
    Number(booking.possession_charges) > 0 ||
    Number(booking.development_charges) > 0 ||
    Number(booking.down_payment) > 0
  );
  const hasInstallments = installments && installments.length > 0;
  const allPaid = hasInstallments && installments.every((i: any) => i.status === "paid");
  const hasTransfer = transfers && transfers.length > 0;
  const hasHandover = handover && handover.status === "completed";
  const hasTickets = tickets && tickets.length > 0;
  const hasContract = contract && (contract.status === "signed" || contract.status === "sent");

  return PIPELINE_STAGES.map((stage) => {
    let completed = false;
    let active = false;

    switch (stage.key) {
      case "booking":
        completed = !!booking;
        active = !!booking && !hasFees;
        break;
      case "fees":
        completed = hasFees;
        active = hasFees && !hasContract;
        break;
      case "contract":
        completed = hasContract;
        active = hasContract && !hasInstallments;
        break;
      case "payment_plan":
        completed = !!plan;
        active = !!plan && !allPaid;
        break;
      case "installments":
        completed = allPaid;
        active = !allPaid && hasInstallments;
        break;
      case "transfer":
        completed = hasTransfer;
        active = hasTransfer && !hasHandover;
        break;
      case "possession":
        completed = hasHandover;
        active = hasHandover;
        break;
      case "after_sales":
        completed = hasTickets;
        active = hasHandover;
        break;
    }

    return { ...stage, completed, active, locked: !completed && !active };
  });
}

export function PipelineStepper({ stages, onStageClick, compact }: {
  stages: PipelineStage[];
  onStageClick?: (key: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center gap-0 ${compact ? "overflow-x-auto pb-1" : ""}`}>
      {stages.map((stage, idx) => {
        const showArrow = idx < stages.length - 1;
        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            <button
              type="button"
              onClick={() => !stage.locked && onStageClick?.(stage.key)}
              disabled={stage.locked}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap ${
                stage.locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
              }`}
              style={{
                background: stage.active ? `${stage.color}20` : "transparent",
                color: stage.completed || stage.active ? stage.color : "var(--text-muted)",
                border: stage.active ? `1px solid ${stage.color}40` : "1px solid transparent",
              }}
            >
              {stage.completed ? <CheckCircle2 size={compact ? 10 : 12} /> : <Circle size={compact ? 10 : 12} />}
              {compact ? (
                <span className="hidden sm:inline">{stage.label}</span>
              ) : (
                stage.label
              )}
            </button>
            {showArrow && (
              <ArrowRight size={compact ? 10 : 12} className="shrink-0 mx-0.5" style={{ color: "var(--text-muted)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
