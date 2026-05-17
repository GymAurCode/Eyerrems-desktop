/**
 * ReportSummaryCards — KPI summary cards for reports.
 * Styled to match the dark theme of the existing app.
 */
import React from "react";
import { ReportSummary } from "./types";

interface Props {
  summary: ReportSummary[];
}

const ACCENT: Record<string, { accent: string; bg: string; text: string }> = {
  blue:   { accent: "#3b82f6", bg: "rgba(59,130,246,0.12)",  text: "#60a5fa" },
  green:  { accent: "#10b981", bg: "rgba(16,185,129,0.12)",  text: "#34d399" },
  red:    { accent: "#ef4444", bg: "rgba(239,68,68,0.12)",   text: "#f87171" },
  yellow: { accent: "#f59e0b", bg: "rgba(245,158,11,0.12)",  text: "#fbbf24" },
  purple: { accent: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  text: "#a78bfa" },
  gray:   { accent: "#6b7280", bg: "rgba(107,114,128,0.12)", text: "#9ca3af" },
};

export default function ReportSummaryCards({ summary }: Props) {
  if (!summary || summary.length === 0) return null;

  const formatValue = (card: ReportSummary): string => {
    const val = card.value;
    if (card.format === "currency") {
      const num = typeof val === "number" ? val : parseFloat(String(val));
      if (isNaN(num)) return String(val);
      // Compact large numbers
      if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
      if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
      return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (card.format === "percentage") {
      const num = typeof val === "number" ? val : parseFloat(String(val));
      return isNaN(num) ? String(val) : `${num.toFixed(1)}%`;
    }
    if (card.format === "number") {
      const num = typeof val === "number" ? val : parseFloat(String(val));
      if (isNaN(num)) return String(val);
      if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
      if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
      return num.toLocaleString("en-US");
    }
    return String(val);
  };

  return (
    <div className={`grid gap-3 mb-4 ${
      summary.length === 1 ? "grid-cols-1" :
      summary.length === 2 ? "grid-cols-2" :
      summary.length === 3 ? "grid-cols-3" :
      "grid-cols-2 sm:grid-cols-4"
    }`}>
      {summary.map((card, idx) => {
        const colors = ACCENT[card.color] ?? ACCENT.gray;
        return (
          <div
            key={idx}
            className="rounded-xl border p-4 transition-all duration-200"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
              style={{ background: colors.bg }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: colors.accent }} />
            </div>
            <p className="text-xl font-bold mb-0.5" style={{ color: colors.text }}>
              {formatValue(card)}
            </p>
            <p className="text-xs text-muted">{card.label}</p>
            {card.sub_label && (
              <p className="text-[10px] text-muted mt-0.5 italic">{card.sub_label}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
