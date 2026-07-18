/**
 * Shared ERP Detail Page Component System
 * Used by: PropertyView, TenantDetail, ClientDetail, DealDetail, LeadDetail
 */
import { ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DataTable as DataTableImpl } from "../data-table";

// ─────────────────────────────────────────────────────────────────────────────
// DetailPage — outermost wrapper
// ─────────────────────────────────────────────────────────────────────────────
export function DetailPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 space-y-0 animate-slide-up max-w-7xl mx-auto">
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailHeader
// ─────────────────────────────────────────────────────────────────────────────
type Action = {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: "default" | "danger" | "primary";
};

export function DetailHeader({
  backTo,
  title,
  subtitle,
  badge,
  actions = [],
  meta = [],
}: {
  backTo: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: Action[];
  meta?: { label: string; value: React.ReactNode }[];
}) {
  const navigate = useNavigate();

  const variantStyle = (v: Action["variant"] = "default") => {
    if (v === "primary") return "btn-primary flex items-center gap-1.5 px-3 py-2 text-xs";
    if (v === "danger")
      return "flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors";
    return "flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors";
  };

  return (
    <div
      className="flex items-start justify-between gap-4 px-6 py-5"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "14px 14px 0 0",
        borderBottom: "none",
      }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--hover-bg)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-primary leading-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
          )}
          {meta.length > 0 && (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {meta.map((m, i) => (
                <span key={i} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{m.label}:</span>
                  <span style={{ color: "var(--text-secondary)" }}>{m.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {actions.map((a, i) => {
            const Icon = a.icon;
            if (a.variant === "danger") {
              return (
                <button key={i} type="button" onClick={a.onClick}
                  className={variantStyle("danger")}
                  style={{ border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                  {Icon && <Icon size={13} />} {a.label}
                </button>
              );
            }
            if (a.variant === "primary") {
              return (
                <button key={i} type="button" onClick={a.onClick} className={variantStyle("primary")}>
                  {Icon && <Icon size={13} />} {a.label}
                </button>
              );
            }
            return (
              <button key={i} type="button" onClick={a.onClick}
                className={variantStyle("default")}
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}>
                {Icon && <Icon size={13} />} {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailBody — wraps all sections in one card
// ─────────────────────────────────────────────────────────────────────────────
export function DetailBody({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderTop: "none",
        borderRadius: "0 0 14px 14px",
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailSection — a titled section inside DetailBody
// ─────────────────────────────────────────────────────────────────────────────
export function DetailSection({
  title,
  icon: Icon,
  action,
  children,
  noPad = false,
}: {
  title?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      {title && (
        <div
          className="flex items-center justify-between px-6 py-3"
          style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface2)" }}
        >
          <div className="flex items-center gap-2">
            {Icon && <Icon size={13} style={{ color: "var(--text-muted)" }} />}
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              {title}
            </span>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPad ? "" : "px-6 py-5"}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InfoGrid — 2-column key/value grid
// ─────────────────────────────────────────────────────────────────────────────
export function InfoGrid({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
      {items.map((item, i) => (
        <div
          key={i}
          className="grid grid-cols-[auto_1fr] gap-3 py-2.5 items-start"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
            {item.label}
          </span>
          <span className="text-xs font-medium text-right text-primary break-words min-w-0">{item.value ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DataTable — consistent ERP table
// ─────────────────────────────────────────────────────────────────────────────
export function DataTable({
  columns,
  rows,
  emptyText = "No records",
  onRowClick,
}: {
  columns: { key: string; label: string; align?: "left" | "right" | "center" }[];
  rows: Record<string, React.ReactNode>[];
  emptyText?: string;
  onRowClick?: (row: Record<string, React.ReactNode>, idx: number) => void;
}) {
  const dtColumns = columns.map((c) => ({
    key: c.key,
    label: c.label,
    align: c.align || ("left" as const),
    render: (_: any, row: any) => row[c.key],
  }));
  return (
    <DataTableImpl
      data={rows}
      columns={dtColumns}
      searchable={false}
      sortable={false}
      emptyTitle={emptyText}
      onRowClick={onRowClick ? (row, idx) => onRowClick(row as Record<string, React.ReactNode>, idx) : undefined}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SummaryCards — row of KPI cards
// ─────────────────────────────────────────────────────────────────────────────
export function SummaryCards({
  cards,
}: {
  cards: { label: string; value: string | number; color: string; bg: string }[];
}) {
  return (
    <div className={`grid gap-4 grid-cols-2 sm:grid-cols-${Math.min(cards.length, 4)}`}>
      {cards.map((c, i) => (
        <div
          key={i}
          className="rounded-xl px-4 py-4 transition-all hover:scale-[1.01]"
          style={{ background: c.bg, border: `1px solid ${c.color}25` }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.color }}>
            {c.label}
          </p>
          <p className="text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TagList — chips/tags
// ─────────────────────────────────────────────────────────────────────────────
export function TagList({ tags, color = "#3b82f6" }: { tags: string[]; color?: string }) {
  if (tags.length === 0)
    return <p className="text-xs" style={{ color: "var(--text-muted)" }}>None</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t, i) => (
        <span
          key={i}
          className="text-xs px-2.5 py-1 rounded-full"
          style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AttachmentList
// ─────────────────────────────────────────────────────────────────────────────
export function AttachmentList({
  attachments,
  onUpload,
  urlFn,
}: {
  attachments: { id: number; filename: string; file_path: string }[];
  onUpload?: (file: File) => void;
  urlFn: (path: string) => string;
}) {
  return (
    <div className="space-y-1">
      {attachments.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>No attachments.</p>
      ) : (
        attachments.map((a) => (
          <a
            key={a.id}
            href={urlFn(a.file_path)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 py-1.5 text-xs transition-colors"
            style={{ color: "#60a5fa" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#93c5fd")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#60a5fa")}
          >
            📎 {a.filename}
          </a>
        ))
      )}
      {onUpload && (
        <label
          className="flex items-center gap-1.5 text-xs cursor-pointer mt-2"
          style={{ color: "#60a5fa" }}
        >
          + Upload file
          <input
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
          />
        </label>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge — universal
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, [string, string]> = {
  active:      ["rgba(16,185,129,0.12)",  "#10b981"],
  available:   ["rgba(16,185,129,0.12)",  "#10b981"],
  paid:        ["rgba(16,185,129,0.12)",  "#10b981"],
  closed:      ["rgba(99,102,241,0.12)",  "#6366f1"],
  qualified:   ["rgba(16,185,129,0.12)",  "#10b981"],
  rented:      ["rgba(245,158,11,0.12)",  "#f59e0b"],
  pending:     ["rgba(245,158,11,0.12)",  "#f59e0b"],
  contacted:   ["rgba(245,158,11,0.12)",  "#f59e0b"],
  partial:     ["rgba(59,130,246,0.12)",  "#3b82f6"],
  new:         ["rgba(59,130,246,0.12)",  "#3b82f6"],
  reserved:    ["rgba(99,102,241,0.12)",  "#6366f1"],
  sold:        ["rgba(239,68,68,0.12)",   "#ef4444"],
  cancelled:   ["rgba(239,68,68,0.12)",   "#ef4444"],
  overdue:     ["rgba(239,68,68,0.12)",   "#ef4444"],
  lost:        ["rgba(239,68,68,0.12)",   "#ef4444"],
  inactive:    ["rgba(148,163,184,0.1)",  "#94a3b8"],
  ended:       ["rgba(148,163,184,0.1)",  "#94a3b8"],
  maintenance: ["rgba(148,163,184,0.1)",  "#94a3b8"],
};

export function StatusBadge({ status }: { status: string }) {
  const [bg, color] = STATUS_MAP[status?.toLowerCase()] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: bg, color }}
    >
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MonoId — styled monospace ID chip
// ─────────────────────────────────────────────────────────────────────────────
export function MonoId({ value }: { value: string }) {
  return (
    <span
      className="font-mono text-xs px-2 py-0.5 rounded-lg"
      style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}
    >
      {value}
    </span>
  );
}
