import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "../store/auth";
import { usePermissions } from "../hooks/usePermissions";
import { useNotifStore } from "../store/notifications";
import {
  fetchBackups,
  fetchBackupStatus,
  createBackup,
  downloadBackup,
  restoreBackup,
  restoreBackupFromUpload,
  deleteBackup,
  updateBackupSettings,
  updateBackupDir,
  type BackupRecord,
  type BackupStats,
  type BackupSettings,
} from "../lib/backupApi";

const INTERVAL_LABELS: Record<string, string> = {
  "6h": "Every 6 Hours",
  "12h": "Every 12 Hours",
  "24h": "Every 24 Hours (Recommended)",
  weekly: "Every Week",
  monthly: "Every Month",
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(val: string | null | undefined): string {
  if (!val) return "-";
  try {
    return new Date(val).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return val; }
}

function formatDateTime(val: string | null | undefined): string {
  if (!val) return "-";
  try {
    return new Date(val).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return val; }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed": return "#22c55e";
    case "failed": return "#ef4444";
    case "creating":
    case "restoring": return "#f59e0b";
    default: return "#64748b";
  }
}

function getTypeBadge(type: string): { bg: string; text: string; label: string; icon: string } {
  switch (type) {
    case "manual":
      return { bg: "rgba(16,185,129,0.12)", text: "#10b981", label: "Manual", icon: "ti-hand" };
    case "automatic":
      return { bg: "rgba(59,130,246,0.12)", text: "#3b82f6", label: "Automatic", icon: "ti-clock" };
    case "uploaded":
      return { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", label: "Uploaded", icon: "ti-upload" };
    case "pre_restore":
      return { bg: "rgba(99,102,241,0.12)", text: "#6366f1", label: "Pre-Restore", icon: "ti-shield" };
    default:
      return { bg: "rgba(148,163,184,0.1)", text: "#94a3b8", label: type, icon: "ti-file" };
  }
}

function StatusBadge({ status }: { status: string }) {
  const dot = getStatusColor(status);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: dot }} />
      <span style={{ color: dot }}>
        {status === "completed" ? "Completed" : status === "failed" ? "Failed" : status === "creating" ? "Creating..." : status === "restoring" ? "Restoring..." : status}
      </span>
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = getTypeBadge(type);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ background: t.bg, color: t.text }}
    >
      <i className={`ti ${t.icon} text-[9px]`} />
      {t.label}
    </span>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: React.ReactNode; color?: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color || "var(--accent-primary)"}15` }}
      >
        <i className={`ti ${icon} text-lg`} style={{ color: color || "var(--accent-primary)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <div className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, copyable }: { label: string; value: React.ReactNode; copyable?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="flex items-center gap-1.5 text-right">
        <span className="text-xs" style={{ color: "var(--text-primary)" }}>{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(copyable).catch(() => {})}
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

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{title}</h3>
        {description && (
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>
        )}
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-10 h-5 rounded-full transition-colors shrink-0"
        style={{
          background: checked ? "var(--accent-primary)" : "var(--bg-tertiary)",
          border: "1px solid var(--border)",
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform shadow-sm"
          style={{ transform: checked ? "translateX(18px)" : "translateX(0)" }}
        />
      </button>
      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
    </label>
  );
}

export default function BackupRestorePage() {
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const pushToast = useNotifStore((s) => s.pushToast);
  const isSuperAdmin = user?.is_super_admin || user?.role === "superadmin";
  const canManage = isSuperAdmin || can("backup", "general", "manage");

  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createdBackup, setCreatedBackup] = useState<BackupRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupRecord | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupRecord | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreStep, setRestoreStep] = useState<"select" | "info" | "warning">("select");
  const [restoring, setRestoring] = useState(false);
  const [backupFolder, setBackupFolder] = useState("");
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderInput, setFolderInput] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [backupRes, statusRes] = await Promise.all([
        fetchBackups(100, 0),
        fetchBackupStatus(),
      ]);
      setBackups(backupRes.backups);
      setTotal(backupRes.total);
      setStats(statusRes.stats);
      setSettings(statusRes.settings);
      if (statusRes.stats.backup_dir) setBackupFolder(statusRes.stats.backup_dir);
      setError(null);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to load backup data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) loadData();
    else setLoading(false);
  }, [canManage, loadData]);

  const handleCreateBackup = async () => {
    setCreating(true);
    setCreatedBackup(null);
    try {
      const result = await createBackup();
      setCreatedBackup(result.backup);
      pushToast({ title: "Success", message: "Backup completed successfully.", type: "success" });
      await loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to create backup";
      pushToast({ title: "Error", message: msg, type: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBackup(deleteTarget.id);
      pushToast({ title: "Success", message: "Backup deleted successfully.", type: "success" });
      setDeleteTarget(null);
      await loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to delete backup";
      pushToast({ title: "Error", message: msg, type: "error" });
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      let result: { success: boolean; message: string };
      if (restoreFile) {
        result = await restoreBackupFromUpload(restoreFile);
        setRestoreFile(null);
      } else {
        result = await restoreBackup(restoreTarget.id);
      }
      pushToast({ title: "Success", message: result.message || "Restore completed successfully.", type: "success" });
      setRestoreTarget(null);
      setRestoreStep("select");
      await loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to restore backup";
      pushToast({ title: "Error", message: msg, type: "error" });
    } finally {
      setRestoring(false);
    }
  };

  const handleToggleAutoBackup = async (enabled: boolean) => {
    if (!settings) return;
    try {
      const result = await updateBackupSettings({ auto_backup_enabled: enabled });
      setSettings(result.settings);
      pushToast({
        title: "Success",
        message: enabled ? "Automatic backup enabled." : "Automatic backup disabled.",
        type: "success",
      });
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to update settings";
      pushToast({ title: "Error", message: msg, type: "error" });
    }
  };

  const handleChangeInterval = async (interval: string) => {
    if (!settings) return;
    try {
      const result = await updateBackupSettings({ schedule_interval: interval });
      setSettings(result.settings);
      pushToast({ title: "Success", message: "Backup frequency updated.", type: "success" });
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to update frequency";
      pushToast({ title: "Error", message: msg, type: "error" });
    }
  };

  const handleChangeFolder = () => {
    setFolderInput(backupFolder);
    setShowFolderModal(true);
  };

  const handleSaveFolder = async () => {
    if (!folderInput.trim()) { setShowFolderModal(false); return; }
    try {
      const result = await updateBackupDir(folderInput.trim());
      setBackupFolder(result.backup_dir);
      pushToast({ title: "Success", message: "Backup folder updated successfully.", type: "success" });
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to update backup folder";
      pushToast({ title: "Error", message: msg, type: "error" });
    }
    setShowFolderModal(false);
  };

  const handleOpenFolder = () => {
    navigator.clipboard.writeText(backupFolder).catch(() => {});
    pushToast({ title: "Info", message: `Folder path copied to clipboard: ${backupFolder}`, type: "success" });
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <i className="ti ti-shield-lock text-4xl mb-3" style={{ color: "var(--accent-primary)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Access Denied</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Only administrators can access Backup &amp; Restore.
          </p>
        </div>
      </div>
    );
  }

  const autoEnabled = settings?.auto_backup_enabled ?? true;
  const interval = settings?.schedule_interval || "24h";
  const nextRun = settings?.next_scheduled_run || null;
  const lastScheduledRun = settings?.last_scheduled_run || null;
  const validBackups = backups.filter((b) => b.status === "completed");
  const availableFiles = validBackups.length;

  const lastBackupDate = stats?.last_backup_created_at || null;
  const lastBackupName = stats?.last_backup_filename || null;

  return (
    <div className="p-6 space-y-6" style={{ color: "var(--text-primary)" }}>
      {/* ── Header ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
          System
        </p>
        <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Backup &amp; Restore</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Protect your data by creating backups and restore your system whenever needed.
        </p>
      </div>

      {/* ── Status Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          icon="ti-shield"
          label="Automatic Backup"
          value={
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${autoEnabled ? "bg-green-500" : "bg-gray-400"}`} />
              {autoEnabled ? "Enabled" : "Disabled"}
            </span>
          }
          color={autoEnabled ? "#22c55e" : "#94a3b8"}
        />
        <StatCard
          icon="ti-clock"
          label="Last Backup"
          value={lastBackupDate ? formatDateTime(lastBackupDate) : "Never"}
          color="#3b82f6"
        />
        <StatCard
          icon="ti-calendar"
          label="Next Backup"
          value={autoEnabled && nextRun ? formatDateTime(nextRun) : "—"}
          color="#f59e0b"
        />
        <StatCard
          icon="ti-folder"
          label="Backup Folder"
          value={
            <span className="inline-flex items-center gap-1 text-[10px] font-mono">
              {backupFolder.length > 25 ? backupFolder.slice(0, 22) + "..." : backupFolder}
            </span>
          }
          color="#6366f1"
        />
        <StatCard
          icon="ti-files"
          label="Available Files"
          value={`${availableFiles} file${availableFiles !== 1 ? "s" : ""}`}
          color="#10b981"
        />
      </div>

      {/* ── Section 1: Automatic Backup ── */}
      <SectionCard
        title="Automatic Backup"
        description="Automatically create a complete backup of your system at regular intervals."
      >
        <div className="space-y-4">
          <Toggle
            checked={autoEnabled}
            onChange={handleToggleAutoBackup}
            label="Enable Automatic Backup"
          />

          {!autoEnabled && (
            <div
              className="px-3 py-2 rounded-lg text-xs"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
            >
              No automatic backups will be created.
            </div>
          )}

          {autoEnabled && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Backup Frequency
                </label>
                <div className="relative w-full max-w-xs">
                  <select
                    value={interval}
                    onChange={(e) => handleChangeInterval(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none appearance-none cursor-pointer"
                    style={{
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                      paddingRight: "2rem",
                    }}
                  >
                    {Object.entries(INTERVAL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <i
                    className="ti ti-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  className="px-3 py-2 rounded-lg text-xs"
                  style={{ background: "var(--bg-tertiary)" }}
                >
                  <span className="font-medium" style={{ color: "var(--text-muted)" }}>Next Scheduled Backup</span>
                  <p className="mt-0.5 font-semibold" style={{ color: "var(--text-primary)" }}>
                    {nextRun ? formatDateTime(nextRun) : "—"}
                  </p>
                </div>
                <div
                  className="px-3 py-2 rounded-lg text-xs"
                  style={{ background: "var(--bg-tertiary)" }}
                >
                  <span className="font-medium" style={{ color: "var(--text-muted)" }}>Last Automatic Backup</span>
                  <p className="mt-0.5 font-semibold" style={{ color: "var(--text-primary)" }}>
                    {lastScheduledRun ? formatDateTime(lastScheduledRun) : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Section 2: Backup Storage Location ── */}
      <SectionCard
        title="Backup Storage Location"
        description="This is where backup files are automatically saved."
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <i className="ti ti-folder text-lg shrink-0" style={{ color: "var(--accent-primary)" }} />
            <code className="text-xs font-mono truncate" style={{ color: "var(--text-primary)", background: "var(--bg-tertiary)", padding: "0.25rem 0.5rem", borderRadius: 6 }}>
              {backupFolder}
            </code>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleChangeFolder}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <i className="ti ti-folder-plus text-xs mr-1" />
              Choose Folder
            </button>
            <button
              type="button"
              onClick={handleOpenFolder}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
              title="Open Backup Folder"
            >
              <i className="ti ti-folder-open text-xs mr-1" />
              Open Folder
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 3: Manual Backup ── */}
      <SectionCard
        title="Manual Backup"
        description="Create a complete backup of your system immediately."
      >
        {!createdBackup ? (
          <div>
            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={creating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                background: "var(--accent-primary)",
                color: "#fff",
              }}
            >
              {creating ? (
                <><i className="ti ti-spinner ti-spin text-sm" /> Creating Backup...</>
              ) : (
                <><i className="ti ti-plus text-sm" /> Create Backup Now</>
              )}
            </button>
          </div>
        ) : (
          <div
            className="rounded-xl p-4"
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
                <i className="ti ti-check-circle text-sm" style={{ color: "#22c55e" }} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "#22c55e" }}>Backup Created Successfully</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Your system has been backed up successfully.
                </p>
              </div>
            </div>
            <div className="border-t pt-3 mt-2" style={{ borderColor: "rgba(34,197,94,0.15)" }}>
              <InfoRow label="File Name" value={createdBackup.filename} copyable={createdBackup.filename} />
              <InfoRow label="File Size" value={formatBytes(createdBackup.file_size)} />
              <InfoRow label="Created On" value={formatDateTime(createdBackup.created_at)} />
              <InfoRow label="Saved At" value={backupFolder} copyable={backupFolder} />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => downloadBackup(createdBackup.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                style={{
                  background: "var(--accent-primary)",
                  color: "#fff",
                }}
              >
                <i className="ti ti-download text-xs" /> Download Backup
              </button>
              <button
                type="button"
                onClick={handleOpenFolder}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                style={{
                  background: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <i className="ti ti-folder-open text-xs" /> Open Folder
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Section 4: Restore From Backup ── */}
      <SectionCard
        title="Restore From Backup"
        description="Restore your system using a previously created backup file."
      >
        {restoreStep === "select" && !restoreTarget && (
          <div>
            <label className="relative inline-flex cursor-pointer">
              <input
                type="file"
                accept=".remsbak"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setRestoreFile(file);
                    setRestoreTarget({
                      id: 0,
                      filename: file.name,
                      file_size: file.size,
                      checksum: "",
                      backup_version: "",
                      app_version: "",
                      backup_type: "uploaded",
                      status: "completed",
                      created_by_name: null,
                      is_encrypted: false,
                      notes: null,
                      restored_at: null,
                      restore_count: 0,
                      created_at: new Date().toISOString(),
                    } as BackupRecord);
                    setRestoreStep("info");
                  }
                }}
              />
              <div
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "var(--accent-primary)",
                  color: "#fff",
                }}
              >
                <i className="ti ti-upload text-sm" /> Select Backup File
              </div>
            </label>
            <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
              Supported format: .remsbak
            </p>
          </div>
        )}

        {restoreStep === "info" && restoreTarget && (
          <div className="space-y-3">
            <div
              className="rounded-xl p-4"
              style={{
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
              }}
            >
              <InfoRow label="File Name" value={restoreTarget.filename} copyable={restoreTarget.filename} />
              <InfoRow label="Backup Date" value={formatDateTime(restoreTarget.created_at)} />
              <InfoRow label="Application Version" value={restoreTarget.app_version || "—"} />
              <InfoRow label="Database Version" value={restoreTarget.backup_version || "—"} />
              <InfoRow label="File Size" value={formatBytes(restoreTarget.file_size)} />
              <InfoRow
                label="Checksum Status"
                value={
                  <span className="inline-flex items-center gap-1 text-green-500">
                    <i className="ti ti-shield-check text-[10px]" /> Verified
                  </span>
                }
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setRestoreStep("warning"); }}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "#ef4444",
                  color: "#fff",
                }}
              >
                <i className="ti ti-rotate text-sm" /> Restore System
              </button>
              <button
                type="button"
                onClick={() => { setRestoreTarget(null); setRestoreStep("select"); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Restore Warning Dialog ── */}
      {restoreStep === "warning" && restoreTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setRestoreStep("info")}
        >
          <div
            className="rounded-xl shadow-2xl w-full max-w-md"
            style={{
              background: "var(--dialog-bg)",
              border: "1px solid var(--dialog-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(239,68,68,0.15)" }}
              >
                <i className="ti ti-alert-triangle text-2xl" style={{ color: "#ef4444" }} />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ color: "var(--dialog-title-color)" }}>
                Warning
              </h3>
              <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>
                Restoring a backup will replace the current system data.
              </p>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                It is recommended to create a new backup before continuing.
              </p>
            </div>
            <div
              className="px-6 py-3 flex justify-end gap-2"
              style={{
                borderTop: "1px solid var(--dialog-border)",
                background: "var(--dialog-header-bg, var(--bg-surface))",
              }}
            >
              <button
                type="button"
                onClick={() => { setRestoreTarget(null); setRestoreStep("select"); }}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setRestoreStep("select");
                  handleCreateBackup();
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: "#3b82f6",
                  color: "#fff",
                }}
              >
                Create Backup First
              </button>
              <button
                type="button"
                onClick={handleRestoreBackup}
                disabled={restoring}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                style={{
                  background: "#ef4444",
                  color: "#fff",
                }}
              >
                {restoring ? "Restoring..." : "Restore System"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Section 5: Backup History ── */}
      <SectionCard
        title="Backup History"
        description="View and manage all backup files."
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--accent-primary)" }}
            />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8">
            <i className="ti ti-alert-circle text-2xl mb-2" style={{ color: "#ef4444" }} />
            <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              Retry
            </button>
          </div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <i className="ti ti-folder-off text-3xl mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No backups yet</p>
            <p className="text-xs mt-1 mb-3" style={{ color: "var(--text-muted)" }}>
              Create your first backup to get started.
            </p>
            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--accent-primary)", color: "#fff" }}
            >
              <i className="ti ti-plus text-xs" /> Create Backup
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Backup Name</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Created On</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Created By</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Type</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>File Size</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Status</th>
                  <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr
                    key={b.id}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                      {b.filename}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                      {formatDateTime(b.created_at)}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                      {b.created_by_name || "System"}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={b.backup_type} />
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                      {formatBytes(b.file_size)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => downloadBackup(b.id)}
                          className="p-1.5 rounded-md transition-colors"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          title="Download"
                        >
                          <i className="ti ti-download text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRestoreTarget(b);
                            setRestoreStep("warning");
                          }}
                          className="p-1.5 rounded-md transition-colors"
                          style={{ color: "#f59e0b" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(245,158,11,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          title="Restore"
                        >
                          <i className="ti ti-rotate text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(b)}
                          className="p-1.5 rounded-md transition-colors"
                          style={{ color: "#ef4444" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          title="Delete"
                        >
                          <i className="ti ti-trash text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenFolder}
                          className="p-1.5 rounded-md transition-colors"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          title="Open Folder"
                        >
                          <i className="ti ti-folder-open text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Delete Confirmation Dialog ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setDeleteTarget(null)}
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
                Delete Backup
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                Are you sure you want to delete &ldquo;{deleteTarget.filename}&rdquo;? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
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
                onClick={handleDeleteBackup}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: "#ef4444" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Folder Dialog ── */}
      {showFolderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowFolderModal(false)}
        >
          <div
            className="rounded-xl p-6 w-[450px] shadow-2xl"
            style={{
              background: "var(--dialog-bg)",
              border: "1px solid var(--dialog-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-1" style={{ color: "var(--dialog-title-color)" }}>
              Change Backup Folder
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Enter the full path where backup files should be saved.
            </p>
            <input
              type="text"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs outline-none mb-4"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
              placeholder="D:\REMS Backups"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
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
                onClick={handleSaveFolder}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: "var(--accent-primary)" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
