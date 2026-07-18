import type { ElementType } from "react";

interface StatCardProps {
  icon: string | ElementType;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  trend?: string;
  trendUp?: boolean;
  trendColor?: string;
  sub?: string;
}

export default function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  trend,
  trendUp,
  trendColor,
  sub,
}: StatCardProps) {
  const IconComponent = typeof icon === "string" ? null : icon;
  const iconClass = typeof icon === "string" ? icon : "";

  return (
    <div
      className="flex flex-col p-[18px] transition-all duration-200"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border)",
        borderRadius: "10px",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: iconBg }}
        >
          {IconComponent ? (
            <IconComponent size={16} style={{ color: iconColor }} />
          ) : (
            <i className={`${iconClass} text-base`} style={{ color: iconColor, fontSize: "16px" }} />
          )}
        </div>
        {trend && (
          <span
            className="flex items-center gap-1 text-[10px] font-medium"
            style={{ color: trendColor || "#4ADE80" }}
          >
            <i className={`${trendUp ? "ti ti-trending-up" : "ti ti-trending-down"} text-xs`} />
            {trend}
          </span>
        )}
      </div>
      <p
        className="text-[19px] font-medium leading-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
      <p
        className="text-[10px] font-medium mt-1"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </p>
      {sub && (
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
