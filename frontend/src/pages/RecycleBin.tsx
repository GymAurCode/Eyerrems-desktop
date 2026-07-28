import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "../store/auth";
import { useNotifStore } from "../store/notifications";
import { usePermissions } from "../hooks/usePermissions";
import {
  fetchRecycleBin,
  fetchRecycleBinStats,
  fetchModules,
  fetchDetail,
  restoreRecord,
  permanentDelete,
  type RecycleBinRecord,
  type RecycleBinDetail,
  type RecycleBinStats,
  type ModuleOption,
  type AuditLogEntry,
  type UserInfo,
} from "../lib/recycleBinApi";

const MODULE_COLORS: Record<string, string> = {
  crm_leads: "#3b82f6",
  crm_clients: "#8b5cf6",
  crm_dealers: "#f59e0b",
  crm_deals: "#10b981",
  properties: "#06b6d4",
  units: "#14b8a6",
  leases: "#84cc16",
  tenants: "#ec4899",
  finance_invoices: "#ef4444",
  finance_payments: "#22c55e",
  finance_expenses: "#f97316",
  construction_projects: "#6366f1",
  hr_employees: "#a855f7",
  bookings: "#0ea5e9",
  towns: "#65a30d",
};

function getModuleColor(moduleKey: string): string {
  return MODULE_COLORS[moduleKey] || "#64748b";
}

function formatDateTime(val: string | null | undefined): string {
  if (!val) return "-";
  try {
    const d = new Date(val);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return val;
  }
}

function formatDate(val: string | null | undefined): string {
  if (!val) return "-";
  try {
    const d = new Date(val);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return val;
  }
}

function copyToClipboard(val: string) {
  navigator.clipboard.writeText(val).catch(() => {});
}

function Badge({ label, variant }: { label: string; variant: "deleted" | "restored" | "permanent" | "renumbered" }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    deleted: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", border: "rgba(239,68,68,0.3)" },
    restored: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", border: "rgba(34,197,94,0.3)" },
    permanent: { bg: "rgba(100,100,100,0.15)", text: "#94a3b8", border: "rgba(100,100,100,0.3)" },
    renumbered: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  };
  const c = colors[variant] || colors.deleted;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {label}
    </span>
  );
}

function UserDisplay({ user, size = "sm" }: { user: UserInfo | null; size?: "sm" | "md" }) {
  if (!user) return <span style={{ color: "var(--text-muted)" }}>-</span>;
  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const avatarSize = size === "md" ? 32 : 24;
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-full flex items-center justify-center font-semibold shrink-0"
        style={{
          width: avatarSize,
          height: avatarSize,
          fontSize: avatarSize * 0.4,
          background: "var(--accent-primary)20",
          color: "var(--accent-primary)",
        }}
      >
        {initials}
      </div>
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--text-primary)", lineHeight: 1.3 }}>
          {user.full_name}
        </p>
        {user.role_name && (
          <p className="text-[10px]" style={{ color: "var(--text-muted)", lineHeight: 1.3 }}>
            {user.role_name}
          </p>
        )}
      </div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-6 first:mt-0">
      <span
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

function InfoRow({ label, value, copyable }: { label: string; value: React.ReactNode; copyable?: string }) {
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-lg"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5 text-right">
        <span className="text-xs" style={{ color: "var(--text-primary)" }}>
          {value}
        </span>
        {copyable && (
          <button
            type="button"
            onClick={() => copyToClipboard(copyable)}
            className="p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-muted)" }}
            title="Copy"
          >
            <i className="ti ti-copy text-[10px]" />
          </button>
        )}
      </div>
    </div>
  );
}

function Timeline({ logs, record }: { logs: AuditLogEntry[]; record: RecycleBinRecord }) {
  const events: { label: string; time: string; icon: string; color: string }[] = [];

  if (record.created_at) {
    events.push({
      label: "Record Created",
      time: formatDateTime(record.created_at),
      icon: "ti-plus",
      color: "#22c55e",
    });
  }

  for (const log of logs) {
    if (log.action === "UPDATE" || log.action === "update") {
      events.push({
        label: "Record Updated",
        time: formatDateTime(log.created_at),
        icon: "ti-pencil",
        color: "#3b82f6",
      });
    }
    if (log.action === "DELETE" || log.action === "delete" || log.action === "SOFT_DELETE") {
      events.push({
        label: "Record Deleted",
        time: formatDateTime(log.created_at),
        icon: "ti-trash",
        color: "#ef4444",
      });
    }
    if (log.action === "RESTORE" || log.action === "restore") {
      events.push({
        label: "Record Restored",
        time: formatDateTime(log.created_at),
        icon: "ti-refresh",
        color: "#22c55e",
      });
    }
  }

  if (record.restored_at && !events.some((e) => e.label === "Record Restored")) {
    events.push({
      label: "Record Restored",
      time: formatDateTime(record.restored_at),
      icon: "ti-refresh",
      color: "#22c55e",
    });
  }

  if (events.length === 0) return null;

  return (
    <div className="space-y-0">
      {events.map((ev, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: `${ev.color}18` }}
            >
              <i className={`ti ${ev.icon} text-[10px]`} style={{ color: ev.color }} />
            </div>
            {i < events.length - 1 && (
              <div className="w-px flex-1 min-h-[24px]" style={{ background: "var(--border)" }} />
            )}
          </div>
          <div className="pb-4">
            <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              {ev.label}
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {ev.time}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailModal({
  record,
  open,
  onClose,
}: {
  record: RecycleBinRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<RecycleBinDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && record) {
      setLoading(true);
      fetchDetail(record.module, record.record_id)
        .then((d) => {
          setDetail(d);
        })
        .catch(() => {
          setDetail(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setDetail(null);
    }
  }, [open, record]);

  if (!open || !record) return null;

  const isRestored = !!record.restored_at;
  const modColor = getModuleColor(record.module);
  const d = detail || (record as any);
  const auditLogs: AuditLogEntry[] = d.audit_logs || [];
  const currentNumber = (d as any).current_business_number || record.original_id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--dialog-bg)",
          border: "1px solid var(--dialog-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{
            background: "var(--dialog-header-bg, var(--bg-surface))",
            borderBottom: "1px solid var(--dialog-border)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${modColor}18` }}
            >
              <i className="ti ti-trash text-lg" style={{ color: modColor }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: "var(--dialog-title-color)" }}>
                Record Details
              </h2>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {record.module_label} &middot; {record.original_id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRestored ? (
              <Badge label="Restored" variant="restored" />
            ) : (
              <Badge label="Deleted" variant="deleted" />
            )}
            {(record.restore_count || 0) > 0 && (
              <Badge label="Renumbered" variant="renumbered" />
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{
                color: "var(--text-muted)",
                background: "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <i className="ti ti-x text-sm" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div
                className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{
                  borderColor: "var(--border)",
                  borderTopColor: "var(--accent-primary)",
                }}
              />
            </div>
          ) : (
            <>
              {isRestored && (
                <div
                  className="rounded-xl p-4 mb-6"
                  style={{
                    background: "rgba(34,197,94,0.08)",
                    border: "1px solid rgba(34,197,94,0.25)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(34,197,94,0.15)" }}
                    >
                      <i className="ti ti-refresh text-sm" style={{ color: "#22c55e" }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: "#22c55e" }}>
                        Restored &amp; Renumbered
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        This record has been restored with a new business number
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Original Number
                      </span>
                      <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                        {record.original_business_number || record.original_id}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Current Number
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                          {currentNumber}
                        </span>
                        <Badge label="Renumbered" variant="renumbered" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Restored By
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-primary)" }}>
                        {record.restored_by_user?.full_name || "-"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Restore Date
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-primary)" }}>
                        {formatDateTime(record.restored_at)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Restore Count
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-primary)" }}>
                        {String(record.restore_count ?? 0)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Original Deleted By
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-primary)" }}>
                        {record.deleted_by_user?.full_name || "-"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Section 1: Record Information ── */}
              <SectionDivider label="Record Information" />
              <InfoRow
                label="Module"
                value={
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: modColor }} />
                    {record.module_label}
                  </div>
                }
              />
              <InfoRow
                label="Current Status"
                value={
                  isRestored ? (
                    <Badge label="Restored" variant="restored" />
                  ) : (
                    <Badge label="Deleted" variant="deleted" />
                  )
                }
              />
              <InfoRow
                label="Current Business Number"
                value={currentNumber}
                copyable={currentNumber}
              />
              <InfoRow
                label="Original Business Number"
                value={record.original_business_number || "-"}
                copyable={record.original_business_number || undefined}
              />
              <InfoRow label="Record Name" value={record.record_name} copyable={record.record_name} />
              <InfoRow
                label="Company"
                value={(d as any).company_id ? `Company #${(d as any).company_id}` : "—"}
              />
              <InfoRow label="Created Date" value={formatDateTime(record.created_at)} />
              <InfoRow label="Last Updated" value={formatDateTime((d as any).updated_at)} />

              {/* ── Section 2: Deletion Information ── */}
              <SectionDivider label="Deletion Information" />
              <InfoRow
                label="Deleted By"
                value={<UserDisplay user={record.deleted_by_user} size="md" />}
              />
              {record.deleted_by_user && (
                <>
                  <InfoRow label="Deleted User Email" value={record.deleted_by_user.email} copyable={record.deleted_by_user.email} />
                </>
              )}
              <InfoRow label="Deleted Date & Time" value={formatDateTime(record.deleted_at)} />
              {auditLogs
                .filter((l) => l.action === "DELETE" || l.action === "delete" || l.action === "SOFT_DELETE")
                .slice(0, 1)
                .map((log, i) => (
                  <div key={i}>
                    {log.ip_address && (
                      <InfoRow label="Delete IP Address" value={log.ip_address} />
                    )}
                    {log.user_agent && (
                      <InfoRow label="Browser" value={log.user_agent} />
                    )}
                  </div>
                ))}

              {/* ── Section 3: Restore Information ── */}
              {(isRestored || (record.restore_count || 0) > 0) && (
                <>
                  <SectionDivider label="Restore Information" />
                  <InfoRow
                    label="Restored By"
                    value={<UserDisplay user={record.restored_by_user} size="md" />}
                  />
                  {record.restored_by_user && (
                    <InfoRow label="Restored User Role" value={record.restored_by_user.role_name || "-"} />
                  )}
                  <InfoRow label="Restore Date" value={formatDateTime(record.restored_at)} />
                  <InfoRow label="Restore Count" value={String(record.restore_count ?? 0)} />
                  {(record.restore_count || 0) > 0 && (
                    <InfoRow
                      label="Current Number"
                      value={
                        <div className="flex items-center gap-1.5">
                          <span>{currentNumber}</span>
                          <Badge label="Renumbered after Restore" variant="renumbered" />
                        </div>
                      }
                      copyable={currentNumber}
                    />
                  )}
                  <InfoRow
                    label="Original Number"
                    value={record.original_business_number || "-"}
                    copyable={record.original_business_number || undefined}
                  />
                </>
              )}

              {/* ── Section 4: Timeline ── */}
              <SectionDivider label="Timeline" />
              <Timeline logs={auditLogs} record={record} />
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="sticky bottom-0 flex justify-end px-6 py-3"
          style={{
            background: "var(--dialog-footer-bg, var(--bg-surface))",
            borderTop: "1px solid var(--dialog-border)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecycleBinPage() {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const { can } = usePermissions();

  const [records, setRecords] = useState<RecycleBinRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<RecycleBinStats>({
    deleted_today: 0,
    deleted_this_week: 0,
    deleted_this_month: 0,
    total_deleted: 0,
    recently_restored: 0,
  });
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);

  const [filters, setFilters] = useState({
    module: "",
    search: "",
    restore_status: "",
    date_from: "",
    date_to: "",
    limit: 50,
    offset: 0,
  });

  const [confirmDelete, setConfirmDelete] = useState<{ module: string; id: number; name: string } | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<RecycleBinRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<RecycleBinRecord | null>(null);

  const pushToast = useNotifStore((s) => s.pushToast);
  const canAccess = isSuperAdmin || can("recycle_bin", "*", "view");
  const canRestore = isSuperAdmin || can("recycle_bin", "*", "edit");
  const canDeleteForever = isSuperAdmin || can("recycle_bin", "*", "delete");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recordsData, statsData, modulesData] = await Promise.all([
        fetchRecycleBin({
          module: filters.module || undefined,
          search: filters.search || undefined,
          restore_status: filters.restore_status || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          limit: filters.limit,
          offset: filters.offset,
        }),
        fetchRecycleBinStats(),
        fetchModules(),
      ]);
      setRecords(recordsData.records);
      setTotal(recordsData.total);
      setStats(statsData);
      setModules(modulesData);
    } catch (err) {
      console.error("Failed to load recycle bin data", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (canAccess) {
      loadData();
    }
  }, [loadData, canAccess]);

  const handleRestore = (rec: RecycleBinRecord) => {
    setRestoreConfirm(rec);
  };

  const handleRestoreConfirmed = async () => {
    if (!restoreConfirm) return;
    setRestoring(restoreConfirm.record_id);
    try {
      const result = await restoreRecord(restoreConfirm.module, restoreConfirm.record_id);
      let msg = "Record restored successfully.";
      if (result.renumber_reason) {
        msg = `Record restored. ${result.renumber_reason}`;
      }
      pushToast({ title: "Success", message: msg, type: "success" });
      setRestoreConfirm(null);
      loadData();
    } catch (err: any) {
      pushToast({ title: "Error", message: err?.response?.data?.detail || "Failed to restore record.", type: "error" });
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return;
    try {
      await permanentDelete(confirmDelete.module, confirmDelete.id);
      pushToast({ title: "Success", message: "Record permanently deleted.", type: "success" });
      setConfirmDelete(null);
      loadData();
    } catch (err: any) {
      pushToast({ title: "Error", message: err?.response?.data?.detail || "Failed to delete record.", type: "error" });
    }
  };

  const inputBase: React.CSSProperties = {
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <i className="ti ti-shield-lock text-4xl mb-3" style={{ color: "var(--accent-primary)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Access Denied
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            You do not have permission to access the Recycle Bin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ color: "var(--text-primary)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Recycle Bin</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Manage deleted records across all modules
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <i className="ti ti-refresh text-sm" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatsCard label="Deleted Today" value={stats.deleted_today} color="#ef4444" icon="ti-calendar" />
        <StatsCard label="This Week" value={stats.deleted_this_week} color="#f97316" icon="ti-calendar-week" />
        <StatsCard label="This Month" value={stats.deleted_this_month} color="#f59e0b" icon="ti-calendar-month" />
        <StatsCard label="Total Deleted" value={stats.total_deleted} color="#64748b" icon="ti-trash" />
        <StatsCard label="Recently Restored" value={stats.recently_restored} color="#22c55e" icon="ti-refresh" />
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Search by record name..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, offset: 0 }))}
              className="w-full px-3 py-1.5 rounded-lg text-xs outline-none transition-colors"
              style={inputBase}
            />
          </div>
          <div className="w-[180px]">
            <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>
              Module
            </label>
            <select
              value={filters.module}
              onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value, offset: 0 }))}
              className="w-full px-3 py-1.5 rounded-lg text-xs outline-none transition-colors"
              style={inputBase}
            >
              <option value="">All Modules</option>
              {modules.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="w-[160px]">
            <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>
              Restore Status
            </label>
            <select
              value={filters.restore_status}
              onChange={(e) => setFilters((f) => ({ ...f, restore_status: e.target.value, offset: 0 }))}
              className="w-full px-3 py-1.5 rounded-lg text-xs outline-none transition-colors"
              style={inputBase}
            >
              <option value="">All</option>
              <option value="deleted">Deleted</option>
              <option value="restored">Restored</option>
            </select>
          </div>
          <div className="w-[160px]">
            <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>
              Date From
            </label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value, offset: 0 }))}
              className="w-full px-3 py-1.5 rounded-lg text-xs outline-none transition-colors"
              style={inputBase}
            />
          </div>
          <div className="w-[160px]">
            <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>
              Date To
            </label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value, offset: 0 }))}
              className="w-full px-3 py-1.5 rounded-lg text-xs outline-none transition-colors"
              style={inputBase}
            />
          </div>
          {(filters.search || filters.module || filters.restore_status || filters.date_from || filters.date_to) && (
            <button
              type="button"
              onClick={() =>
                setFilters({
                  module: "",
                  search: "",
                  restore_status: "",
                  date_from: "",
                  date_to: "",
                  limit: 50,
                  offset: 0,
                })
              }
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: "rgba(239,68,68,0.1)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--accent-primary)" }}
            />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <i className="ti ti-trash-off text-3xl mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No deleted records found</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Deleted records will appear here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Original ID</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Status</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Module</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Record Name</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Deleted By</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Deleted Date</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Created Date</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Orig. Number</th>
                  <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const isRestored = !!rec.restored_at;
                  const modColor = getModuleColor(rec.module);
                  return (
                    <tr
                      key={`${rec.module}-${rec.record_id}`}
                      className="transition-colors"
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-primary)" }}>
                        {rec.original_id}
                      </td>
                      <td className="px-4 py-3">
                        {isRestored ? (
                          <Badge label="Restored" variant="restored" />
                        ) : (
                          <Badge label="Deleted" variant="deleted" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full inline-block shrink-0"
                            style={{ background: modColor }}
                          />
                          <span style={{ color: "var(--text-primary)" }}>{rec.module_label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                        {rec.record_name}
                      </td>
                      <td className="px-4 py-3">
                        <UserDisplay user={rec.deleted_by_user} />
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                        {formatDateTime(rec.deleted_at)}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                        {formatDateTime(rec.created_at)}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                        {rec.original_business_number || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailRecord(rec)}
                            className="px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
                            style={{
                              background: "rgba(99,102,241,0.1)",
                              color: "#818cf8",
                              border: "1px solid rgba(99,102,241,0.2)",
                            }}
                            title="View Details"
                          >
                            <i className="ti ti-eye text-xs" />
                          </button>
                          {canRestore && !isRestored && (
                            <button
                              type="button"
                              onClick={() => handleRestore(rec)}
                              disabled={restoring === rec.record_id}
                              className="px-2 py-1 rounded-md text-[10px] font-medium transition-colors disabled:opacity-50"
                              style={{
                                background: "rgba(34,197,94,0.1)",
                                color: "#22c55e",
                                border: "1px solid rgba(34,197,94,0.2)",
                              }}
                              title="Restore"
                            >
                              {restoring === rec.record_id ? (
                                <div className="w-3 h-3 border border-green-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <i className="ti ti-refresh text-xs" />
                              )}
                            </button>
                          )}
                          {canDeleteForever && !isRestored && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDelete({
                                  module: rec.module,
                                  id: rec.record_id,
                                  name: rec.record_name,
                                })
                              }
                              className="px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
                              style={{
                                background: "rgba(239,68,68,0.1)",
                                color: "#ef4444",
                                border: "1px solid rgba(239,68,68,0.2)",
                              }}
                              title="Delete Forever"
                            >
                              <i className="ti ti-trash text-xs" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > filters.limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Showing {filters.offset + 1}&ndash;{Math.min(filters.offset + filters.limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={filters.offset === 0}
                onClick={() => setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
                className="px-3 py-1 rounded-lg text-[10px] font-medium transition-colors disabled:opacity-30"
                style={{
                  background: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={filters.offset + filters.limit >= total}
                onClick={() => setFilters((f) => ({ ...f, offset: f.offset + f.limit }))}
                className="px-3 py-1 rounded-lg text-[10px] font-medium transition-colors disabled:opacity-30"
                style={{
                  background: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Permanent Delete */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="rounded-xl p-6 w-[400px] shadow-2xl"
            style={{
              background: "var(--dialog-bg)",
              border: "1px solid var(--dialog-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(239,68,68,0.15)" }}
              >
                <i className="ti ti-alert-triangle text-2xl" style={{ color: "#ef4444" }} />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ color: "var(--dialog-title-color)" }}>
                Permanently Delete Record?
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                This action cannot be undone. The record &ldquo;{confirmDelete.name}&rdquo; will be permanently removed from the database.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: "#ef4444" }}
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      {restoreConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setRestoreConfirm(null)}
        >
          <div
            className="rounded-xl p-6 w-[400px] shadow-2xl"
            style={{
              background: "var(--dialog-bg)",
              border: "1px solid var(--dialog-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(34,197,94,0.15)" }}
              >
                <i className="ti ti-refresh text-2xl" style={{ color: "#22c55e" }} />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ color: "var(--dialog-title-color)" }}>
                Restore Record?
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                Restore &ldquo;{restoreConfirm.record_name}&rdquo; from {restoreConfirm.module_label}?
                {(restoreConfirm.restore_count || 0) > 0
                  ? " The record will be renumbered to avoid business number conflicts."
                  : ""}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRestoreConfirm(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestoreConfirmed}
                disabled={restoring === restoreConfirm.record_id}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: "#22c55e" }}
              >
                {restoring === restoreConfirm.record_id ? "Restoring..." : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <DetailModal
        record={detailRecord}
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
      />
    </div>
  );
}

function StatsCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}15` }}
      >
        <i className={`ti ${icon} text-lg`} style={{ color }} />
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
