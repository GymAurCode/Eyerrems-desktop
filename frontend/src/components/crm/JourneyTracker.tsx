import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

const LEAD_JOURNEY = [
  { key: "new", label: "New", color: "#3b82f6" },
  { key: "contacted", label: "Contacted", color: "#8b5cf6" },
  { key: "interested", label: "Interested", color: "#f59e0b" },
  { key: "site_visit_scheduled", label: "Site Visit", color: "#6366f1" },
  { key: "negotiation", label: "Negotiation", color: "#ec4899" },
  { key: "converted", label: "Converted", color: "#10b981" },
];

const CLIENT_JOURNEY = [
  { key: "lead_created", label: "Lead Created", color: "#3b82f6" },
  { key: "converted", label: "Converted", color: "#8b5cf6" },
  { key: "deal_created", label: "Deal Created", color: "#f59e0b" },
  { key: "booking_created", label: "Booking Created", color: "#6366f1" },
  { key: "payment_received", label: "Payment", color: "#10b981" },
  { key: "possession", label: "Possession", color: "#06b6d4" },
];

export function LeadJourneyTracker({ currentStatus, onStageClick }: { currentStatus: string; onStageClick?: (stage: string) => void }) {
  return (
    <div className="flex items-center gap-0">
      {LEAD_JOURNEY.map((stage, idx) => {
        const stageIdx = LEAD_JOURNEY.findIndex(s => s.key === currentStatus);
        const isActive = stageIdx >= idx;
        const isCurrent = stage.key === currentStatus;
        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            <button
              onClick={() => onStageClick?.(stage.key)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap"
              style={{
                background: isCurrent ? `${stage.color}20` : "transparent",
                color: isActive ? stage.color : "var(--text-muted)",
                border: isCurrent ? `1px solid ${stage.color}40` : "1px solid transparent",
              }}
            >
              {isActive ? <CheckCircle2 size={12} /> : <Circle size={12} />}
              {stage.label}
            </button>
            {idx < LEAD_JOURNEY.length - 1 && (
              <ArrowRight size={12} className="shrink-0 mx-1" style={{ color: "var(--text-muted)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ClientJourneyTracker({ completedStages }: { completedStages: string[] }) {
  return (
    <div className="flex items-center gap-0">
      {CLIENT_JOURNEY.map((stage, idx) => {
        const isCompleted = completedStages.includes(stage.key);
        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            <span
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap"
              style={{
                background: isCompleted ? `${stage.color}15` : "transparent",
                color: isCompleted ? stage.color : "var(--text-muted)",
              }}
            >
              {isCompleted ? <CheckCircle2 size={12} /> : <Circle size={12} />}
              {stage.label}
            </span>
            {idx < CLIENT_JOURNEY.length - 1 && (
              <ArrowRight size={12} className="shrink-0 mx-1" style={{ color: "var(--text-muted)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
