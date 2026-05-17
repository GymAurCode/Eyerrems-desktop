/**
 * LedgerSummaryCards — Shows opening balance, total debit, total credit, closing balance.
 */
import { TrendingUp, TrendingDown, Scale, BookOpen } from "lucide-react";
import { formatCurrency } from "../../lib/currency";

interface Props {
  totalDebit:     number;
  totalCredit:    number;
  openingBalance: number;
  closingBalance: number;
  entryCount:     number;
}

export default function LedgerSummaryCards({
  totalDebit, totalCredit, openingBalance, closingBalance, entryCount,
}: Props) {
  const cards = [
    {
      label: "Opening Balance",
      value: formatCurrency(openingBalance),
      icon: Scale,
      iconBg: "rgba(99,102,241,0.12)",
      iconColor: "#6366f1",
      glowClass: "glow-blue",
    },
    {
      label: "Total Debit",
      value: formatCurrency(totalDebit),
      icon: TrendingDown,
      iconBg: "rgba(239,68,68,0.12)",
      iconColor: "#ef4444",
      glowClass: "glow-red",
      sub: "Charges & receivables",
    },
    {
      label: "Total Credit",
      value: formatCurrency(totalCredit),
      icon: TrendingUp,
      iconBg: "rgba(16,185,129,0.12)",
      iconColor: "#10b981",
      glowClass: "glow-green",
      sub: "Payments received",
    },
    {
      label: "Closing Balance",
      value: formatCurrency(Math.abs(closingBalance)),
      icon: BookOpen,
      iconBg: closingBalance >= 0 ? "rgba(59,130,246,0.12)" : "rgba(239,68,68,0.12)",
      iconColor: closingBalance >= 0 ? "#3b82f6" : "#ef4444",
      glowClass: closingBalance >= 0 ? "glow-blue" : "glow-red",
      sub: `${entryCount} entries · ${closingBalance < 0 ? "Credit" : "Debit"} balance`,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon, iconBg, iconColor, glowClass, sub }) => (
        <div key={label} className={`stat-card ${glowClass} ${glowClass}-hover`}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: iconBg }}>
              <Icon size={16} style={{ color: iconColor }} />
            </div>
          </div>
          <p className="text-xl font-bold text-primary mb-0.5">{value}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}>{label}</p>
          {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
        </div>
      ))}
    </div>
  );
}
