/**
 * LedgerSummaryCards — Shows opening balance, total debit, total credit, closing balance.
 */
import { TrendingUp, TrendingDown, Scale, BookOpen } from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import StatCard from "../../components/ui/StatCard";

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
    },
    {
      label: "Total Debit",
      value: formatCurrency(totalDebit),
      icon: TrendingDown,
      iconBg: "rgba(239,68,68,0.12)",
      iconColor: "#ef4444",
      sub: "Charges & receivables",
    },
    {
      label: "Total Credit",
      value: formatCurrency(totalCredit),
      icon: TrendingUp,
      iconBg: "rgba(16,185,129,0.12)",
      iconColor: "#10b981",
      sub: "Payments received",
    },
    {
      label: "Closing Balance",
      value: formatCurrency(Math.abs(closingBalance)),
      icon: BookOpen,
      iconBg: closingBalance >= 0 ? "rgba(59,130,246,0.12)" : "rgba(239,68,68,0.12)",
      iconColor: closingBalance >= 0 ? "#3b82f6" : "#ef4444",
      sub: `${entryCount} entries · ${closingBalance < 0 ? "Credit" : "Debit"} balance`,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon, iconBg, iconColor, sub }) => (
        <StatCard key={label} label={label} value={value} icon={icon} iconBg={iconBg} iconColor={iconColor} sub={sub} />
      ))}
    </div>
  );
}
