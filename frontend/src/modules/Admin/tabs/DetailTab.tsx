import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useAuthStore } from "../../../store/auth";
import { useCurrencyStore, CURRENCY_OPTIONS, type CurrencyCode } from "../../../store/currency";
import {
  Building2, DollarSign, Save, CheckCircle, AlertCircle, Key, Eye, EyeOff, RefreshCw,
  Trash2, Download,
} from "lucide-react";
import Modal from "../../../components/Modal";
import {
  verifyClearDataPassword,
  prepareClearData,
  executeClearData,
  downloadBackupByPath,
  type PreClearBackupInfo,
  type ClearDataResult,
} from "../../../lib/backupApi";

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function DetailTab() {
  const user = useAuthStore((s) => s.user);
  const { currencyCode, saveCurrency } = useCurrencyStore();

  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");

  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currencyCode);
  const [currencySaving, setCurrencySaving] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);
  const [currencyErr, setCurrencyErr] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwErr, setPwErr] = useState("");

  const [clearDataDialog, setClearDataDialog] = useState<"closed" | "confirm" | "success">("closed");
  const [clearDataPassword, setClearDataPassword] = useState("");
  const [clearDataPasswordError, setClearDataPasswordError] = useState("");
  const [clearDataLoading, setClearDataLoading] = useState(false);
  const [clearDataBackup, setClearDataBackup] = useState<PreClearBackupInfo | null>(null);
  const [clearDataResult, setClearDataResult] = useState<ClearDataResult | null>(null);

  const closeClearData = useCallback(() => {
    setClearDataDialog("closed");
    setClearDataPassword("");
    setClearDataPasswordError("");
    setClearDataLoading(false);
    setClearDataBackup(null);
    setClearDataResult(null);
  }, []);

  const handleClearData = useCallback(async (pwd: string) => {
    setClearDataLoading(true);
    setClearDataPasswordError("");
    try {
      await verifyClearDataPassword(pwd);
      const backupRes = await prepareClearData(pwd);
      if (!backupRes.success || !backupRes.backup) {
        setClearDataPasswordError("Backup creation failed. No recovery backup was created.");
        setClearDataLoading(false);
        return;
      }
      setClearDataBackup(backupRes.backup);
      downloadBackupByPath(backupRes.backup.id, backupRes.backup.filename).catch(() => {});
      const result = await executeClearData(pwd);
      setClearDataResult(result);
      setClearDataPassword("");
      setClearDataDialog("success");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "An error occurred";
      setClearDataPasswordError(msg);
    } finally {
      setClearDataLoading(false);
    }
  }, []);

  const canClearData = user?.role_name === "Admin" || user?.is_super_admin === true;

  useEffect(() => { setSelectedCurrency(currencyCode); }, [currencyCode]);

  useEffect(() => {
    if (user?.company_id) {
      api.get(`/company`).then(({ data }) => {
        setCompanyName(data?.name || "");
        setCompanySlug(data?.slug || "");
      }).catch(() => {});
    }
  }, [user?.company_id]);

  const handleSaveCurrency = async () => {
    setCurrencySaving(true); setCurrencyErr(""); setCurrencySaved(false);
    try {
      await saveCurrency(selectedCurrency);
      setCurrencySaved(true);
      setTimeout(() => setCurrencySaved(false), 3000);
    } catch (e: any) {
      setCurrencyErr(e?.response?.data?.detail ?? "Failed to save currency");
    } finally { setCurrencySaving(false); }
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw) { setPwErr("Old and new password are required"); return; }
    if (newPw !== confirmPw) { setPwErr("Passwords do not match"); return; }
    if (newPw.length < 6) { setPwErr("Password must be at least 6 characters"); return; }
    setPwSaving(true); setPwErr(""); setPwSaved(false);
    try {
      await api.post("/auth/change-password", { old_password: oldPw, new_password: newPw });
      setPwSaved(true); setOldPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setPwSaved(false), 3000);
    } catch (e: any) {
      setPwErr(e?.response?.data?.detail ?? "Failed to change password");
    } finally { setPwSaving(false); }
  };

  const previewAmount = 1250000;
  const previewCfg = CURRENCY_OPTIONS.find((c) => c.code === selectedCurrency)!;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Company Information ────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Building2 size={15} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-primary">Company Information</h2>
            <p className="text-[11px] text-muted mt-0.5">Your organization details</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Company Name</label>
              <p className="text-sm font-semibold text-primary">{companyName || user?.full_name || "—"}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Company Slug</label>
              <p className="text-sm font-mono text-secondary">{companySlug || "—"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Your Name</label>
              <p className="text-sm font-semibold text-primary">{user?.full_name || "—"}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Email</label>
              <p className="text-sm text-secondary">{user?.email || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Currency Settings ──────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
            <DollarSign size={15} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-primary">Currency Settings</h2>
            <p className="text-[11px] text-muted mt-0.5">Choose the currency shown across the application</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {CURRENCY_OPTIONS.map((opt) => {
            const isActive = selectedCurrency === opt.code;
            return (
              <label key={opt.code} onClick={() => setSelectedCurrency(opt.code)}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                style={{
                  border: isActive ? "1px solid rgba(16,185,129,0.4)" : "1px solid var(--border)",
                  background: isActive ? "rgba(16,185,129,0.06)" : "transparent",
                }}
              >
                <input type="radio" name="currency" value={opt.code} checked={isActive}
                  onChange={() => setSelectedCurrency(opt.code)} className="sr-only" />
                <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: isActive ? "#10b981" : "var(--border)" }}>
                  {isActive && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                </div>
                <span className="text-sm font-bold w-8 text-center">{opt.symbol}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary">{opt.code}</p>
                  <p className="text-[11px] text-muted">Example: {opt.symbol}{new Intl.NumberFormat(previewCfg.locale, { minimumFractionDigits: 0 }).format(previewAmount)}</p>
                </div>
                {isActive && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-emerald-600" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)" }}>Active</span>}
              </label>
            );
          })}
          {currencyErr && <Status msg={currencyErr} type="error" />}
          {currencySaved && <Status msg="Currency settings saved" type="success" />}
          <div className="flex justify-end pt-1">
            <button onClick={handleSaveCurrency} disabled={currencySaving || selectedCurrency === currencyCode}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg disabled:opacity-50"
              style={{ background: "var(--color-primary, #3b82f6)", color: "#fff" }}>
              {currencySaving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
              {currencySaving ? "Saving..." : "Save Currency"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Change Password ────────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
            <Key size={15} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-primary">Change Password</h2>
            <p className="text-[11px] text-muted mt-0.5">Update your account password</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Current Password</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={oldPw} onChange={(e) => setOldPw(e.target.value)}
                className="w-full px-3 py-2 pr-9 text-sm border rounded-lg" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }} />
              <button onClick={() => setShowPass((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">New Password</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Confirm New Password</label>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }} />
          </div>
          {pwErr && <Status msg={pwErr} type="error" />}
          {pwSaved && <Status msg="Password changed successfully" type="success" />}
          <div className="flex justify-end pt-1">
            <button onClick={handleChangePassword} disabled={pwSaving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg disabled:opacity-50"
              style={{ background: "var(--color-primary, #3b82f6)", color: "#fff" }}>
              {pwSaving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <RefreshCw size={12} />}
              {pwSaving ? "Changing..." : "Change Password"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Clear System Data (Admin only) ─────────────────────────────────── */}
      {canClearData && <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
            <Trash2 size={15} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-primary">Clear System Data</h2>
            <p className="text-[11px] text-muted mt-0.5">Permanently clear all business data</p>
          </div>
        </div>
        <div className="p-5">
          <div className="rounded-xl p-4" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(239,68,68,0.12)" }}>
                <AlertCircle size={16} style={{ color: "#ef4444" }} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold" style={{ color: "#ef4444" }}>Danger Zone</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  This will permanently delete all CRM, Properties, Tenants, Finance, Reports,
                  Construction, Maintenance, and all other business data. A complete recovery backup
                  will be created and downloaded before any data is cleared.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setClearDataDialog("confirm");
                    setClearDataPassword("");
                    setClearDataPasswordError("");
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                  style={{ background: "#ef4444", color: "#fff" }}
                >
                  <Trash2 size={12} /> Clear System Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>}

      {/* ── Clear Data: Confirm Dialog ── */}
      <Modal
        open={clearDataDialog === "confirm"}
        title={clearDataLoading ? "Processing..." : "Clear System Data"}
        subtitle={clearDataLoading ? "Creating backup and clearing data..." : "This action cannot be undone"}
        onClose={clearDataLoading ? () => {} : closeClearData}
        icon={<Trash2 size={18} />}
        size="sm"
        footer={
          !clearDataLoading ? (
            <>
              <button
                type="button"
                onClick={closeClearData}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleClearData(clearDataPassword)}
                disabled={!clearDataPassword}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                style={{ background: "#ef4444", color: "#fff" }}
              >
                Permanently Clear All Data
              </button>
            </>
          ) : undefined
        }
      >
        {clearDataLoading ? (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <div className="w-10 h-10 rounded-full animate-spin" style={{ border: "3px solid var(--border)", borderTopColor: "#ef4444" }} />
            <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
              Verifying password, creating recovery backup, and clearing data...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {clearDataPasswordError && (
              <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle size={12} /> {clearDataPasswordError}
              </div>
            )}
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Enter your password to confirm
              </label>
              <input
                type="password"
                value={clearDataPassword}
                onChange={(e) => { setClearDataPassword(e.target.value); setClearDataPasswordError(""); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && clearDataPassword) {
                    handleClearData(clearDataPassword);
                  }
                }}
                className="w-full px-3 py-2.5 rounded-lg text-xs outline-none"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                placeholder="Enter your password" autoFocus
              />
            </div>
            <div className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                This will permanently delete all business data including CRM, Properties, Tenants, Finance, Reports, Construction, and Maintenance records.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Clear Data: Success Dialog ── */}
      <Modal
        open={clearDataDialog === "success"}
        title="System Data Cleared"
        subtitle="All business data has been permanently removed"
        onClose={closeClearData}
        icon={<CheckCircle size={18} />}
        size="sm"
        footer={
          <button
            type="button"
            onClick={closeClearData}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: "var(--accent-primary)", color: "#fff" }}
          >
            Done
          </button>
        }
      >
        <div className="space-y-4">
          {clearDataBackup && clearDataResult && (
            <>
              <div className="rounded-xl p-4" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Backup File</span>
                  <span className="text-[10px] font-mono font-medium" style={{ color: "var(--text-primary)" }}>{clearDataBackup.filename}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Tables Cleared</span>
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>{clearDataResult.details.tables_cleared}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Rows Removed</span>
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>{clearDataResult.details.total_rows_removed.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Cleared By</span>
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>{clearDataResult.audit.cleared_by}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Cleared At</span>
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>{new Date(clearDataResult.cleared_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => clearDataBackup && downloadBackupByPath(clearDataBackup.id, clearDataBackup.filename).catch(() => {})}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  <Download size={12} /> Download Backup
                </button>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                To restore this data later, use <strong>System → Backup &amp; Restore → Restore From Backup</strong> and select the downloaded <code className="font-mono">.remsbak</code> file.
              </p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Status({ msg, type }: { msg: string; type: "success" | "error" }) {
  const bg = type === "error" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)";
  const border = type === "error" ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)";
  const color = type === "error" ? "#ef4444" : "#10b981";
  return (
    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: bg, border: `1px solid ${border}`, color }}>
      {type === "error" ? <AlertCircle size={12} /> : <CheckCircle size={12} />}
      {msg}
    </div>
  );
}
