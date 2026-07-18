import { useState } from "react";
import { CheckCircle, XCircle, Loader, Trash2, Plus, Mail } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { api } from "../../lib/api";
import { ConfirmDialog } from "../actions";
import { useNotifStore } from "../../store/notifications";
import type { EmailAccount } from "../../store/mail";

type Props = {
  accounts: EmailAccount[];
  onClose: () => void;
  onSaved: () => void;
};

type FormData = {
  display_name: string;
  email_address: string;
  smtp_host: string;
  smtp_port: number;
  smtp_use_tls: boolean;
  imap_host: string;
  imap_port: number;
  imap_use_ssl: boolean;
  username: string;
  password: string;
};

type TestResult = {
  smtp_ok: boolean;
  imap_ok: boolean;
  smtp_error: string | null;
  imap_error: string | null;
} | null;

const PRESETS: Record<string, Partial<FormData>> = {
  gmail: {
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    smtp_use_tls: true,
    imap_host: "imap.gmail.com",
    imap_port: 993,
    imap_use_ssl: true,
  },
  outlook: {
    smtp_host: "smtp.office365.com",
    smtp_port: 587,
    smtp_use_tls: true,
    imap_host: "outlook.office365.com",
    imap_port: 993,
    imap_use_ssl: true,
  },
  yahoo: {
    smtp_host: "smtp.mail.yahoo.com",
    smtp_port: 587,
    smtp_use_tls: true,
    imap_host: "imap.mail.yahoo.com",
    imap_port: 993,
    imap_use_ssl: true,
  },
};

const EMPTY_FORM: FormData = {
  display_name: "",
  email_address: "",
  smtp_host: "",
  smtp_port: 587,
  smtp_use_tls: true,
  imap_host: "",
  imap_port: 993,
  imap_use_ssl: true,
  username: "",
  password: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// Field — defined at MODULE SCOPE, not inside the parent component.
//
// ROOT CAUSE FIX: When a component is defined inside another component's render
// body, React creates a new function reference on every render. React uses the
// component's identity (reference equality) to decide whether to reuse or
// remount a node. A new reference = unmount old + mount new = input loses focus
// after every keystroke.
//
// Moving Field here makes it a stable reference that never changes between
// renders, so React always reuses the existing DOM node.
// ─────────────────────────────────────────────────────────────────────────────
type FieldProps = {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
};

function Field({ label, value, onChange, type = "text", placeholder, required }: FieldProps & { required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-secondary mb-1">{label}{required && <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="dialog-input"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AccountSetupModal
// ─────────────────────────────────────────────────────────────────────────────
export default function AccountSetupModal({ accounts, onClose, onSaved }: Props) {
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const [view, setView] = useState<"list" | "add">(safeAccounts.length === 0 ? "add" : "list");
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const applyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (preset) setForm((f) => ({ ...f, ...preset }));
  };

  const handleTest = async () => {
    if (!form.email_address || !form.password) {
      setError("Email address and password are required to test");
      return;
    }
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const { data: created } = await api.post("/mail/accounts", form);
      const { data: result } = await api.post(`/mail/accounts/${created.id}/test`);
      setTestResult(result);
      if (!result.smtp_ok || !result.imap_ok) {
        await api.delete(`/mail/accounts/${created.id}`);
      } else {
        onSaved();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e?.response?.data?.detail || "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.display_name || !form.email_address || !form.password) {
      setError("Display name, email address, and password are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/mail/accounts", form);
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e?.response?.data?.detail || "Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteTarget(id);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget);
    try {
      await api.delete(`/mail/accounts/${deleteTarget}`);
      onSaved();
      pushToast({ title: "Success", message: "Email account removed", type: "success" });
    } catch {
      pushToast({ title: "Error", message: "Failed to remove email account", type: "error" });
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  return (
    <>
    <AppDialog isOpen={true} title="Email Account Settings" subtitle="Manage your email accounts" size="lg" icon={<Mail size={16} />} onClose={onClose}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          {view === "add" ? (
            <>
              <button
                onClick={() => { setView("list"); setTestResult(null); setError(null); }}
                className="text-sm text-muted hover:text-primary transition-colors"
              >
                ← Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleTest}
                  disabled={testing || saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border border-theme text-secondary hover:bg-hover transition-colors disabled:opacity-50"
                >
                  {testing && <Loader size={13} className="animate-spin" />}
                  {testing ? "Testing…" : "Test & Save"}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || testing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
                >
                  {saving && <Loader size={13} className="animate-spin" />}
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto text-sm text-muted hover:text-primary transition-colors"
            >
              Close
            </button>
          )}
        </div>
      }
    >
          {view === "list" ? (
            <div className="p-5">
              {safeAccounts.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">No email accounts configured yet.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {safeAccounts.map((acc) => (
                    <div key={acc.id} className="flex items-center gap-3 p-3 rounded-lg border border-theme">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {acc.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary">{acc.display_name}</p>
                        <p className="text-xs text-muted">{acc.email_address}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {acc.is_verified ? (
                            <span className="text-[10px] text-green-500 flex items-center gap-0.5">
                              <CheckCircle size={10} /> Verified
                            </span>
                          ) : (
                            <span className="text-[10px] text-yellow-500">Not verified - cannot send</span>
                          )}
                        </div>
                      </div>
                      {!acc.is_verified && (
                        <button
                          onClick={async () => {
                            try {
                              await api.post(`/mail/accounts/${acc.id}/test`);
                              onSaved();
                            } catch (err) {
                              alert("Verification failed. Please check your settings.");
                            }
                          }}
                          className="px-2 py-1 rounded-md text-[10px] bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                        >
                          Verify
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(acc.id)}
                        disabled={deletingId === acc.id}
                        className="p-1.5 rounded-md hover:bg-hover text-muted hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {deletingId === acc.id
                          ? <Loader size={14} className="animate-spin" />
                          : <Trash2 size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setView("add")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-theme text-sm text-muted hover:text-primary hover:border-blue-500 transition-colors"
              >
                <Plus size={15} />
                Add Email Account
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-4">

              {/* Provider presets */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-2">Quick Setup</label>
                <div className="flex gap-2">
                  {Object.keys(PRESETS).map((key) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className="px-3 py-1.5 rounded-lg border border-theme text-xs text-secondary hover:bg-hover hover:text-primary transition-colors capitalize"
                    >
                      {key}
                    </button>
                  ))}
                  <button
                    onClick={() => setForm(EMPTY_FORM)}
                    className="px-3 py-1.5 rounded-lg border border-theme text-xs text-secondary hover:bg-hover hover:text-primary transition-colors"
                  >
                    Custom
                  </button>
                </div>
              </div>

              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Display Name"
                  value={form.display_name}
                  onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
                  placeholder="Company Mail"
                />
                <Field
                  label="Email Address"
                  value={form.email_address}
                  onChange={(v) => setForm((f) => ({ ...f, email_address: v, username: v }))}
                  placeholder="you@company.com"
                  required
                />
              </div>

              {/* Credentials */}
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Username"
                  value={form.username}
                  onChange={(v) => setForm((f) => ({ ...f, username: v }))}
                  placeholder="you@company.com"
                />
                <Field
                  label="Password / App Password"
                  value={form.password}
                  onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                  type="password"
                  placeholder="••••••••"
                  required
                />
              </div>

              {/* SMTP */}
              <div className="rounded-lg border border-theme p-3 space-y-3">
                <p className="text-xs font-semibold text-secondary">SMTP (Outgoing)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Field
                      label="Host"
                      value={form.smtp_host}
                      onChange={(v) => setForm((f) => ({ ...f, smtp_host: v }))}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <Field
                    label="Port"
                    value={form.smtp_port}
                    onChange={(v) => setForm((f) => ({ ...f, smtp_port: Number(v) }))}
                    placeholder="587"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="smtp_tls"
                    checked={form.smtp_use_tls}
                    onChange={(e) => setForm((f) => ({ ...f, smtp_use_tls: e.target.checked }))}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <label htmlFor="smtp_tls" className="text-xs text-secondary">Use STARTTLS</label>
                </div>
              </div>

              {/* IMAP */}
              <div className="rounded-lg border border-theme p-3 space-y-3">
                <p className="text-xs font-semibold text-secondary">IMAP (Incoming)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Field
                      label="Host"
                      value={form.imap_host}
                      onChange={(v) => setForm((f) => ({ ...f, imap_host: v }))}
                      placeholder="imap.gmail.com"
                    />
                  </div>
                  <Field
                    label="Port"
                    value={form.imap_port}
                    onChange={(v) => setForm((f) => ({ ...f, imap_port: Number(v) }))}
                    placeholder="993"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="imap_ssl"
                    checked={form.imap_use_ssl}
                    onChange={(e) => setForm((f) => ({ ...f, imap_use_ssl: e.target.checked }))}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <label htmlFor="imap_ssl" className="text-xs text-secondary">Use SSL</label>
                </div>
              </div>

              {/* Test result */}
              {testResult && (
                <div className="rounded-lg border border-theme p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-secondary mb-2">Connection Test</p>
                  <div className="flex items-center gap-2 text-xs">
                    {testResult.smtp_ok
                      ? <CheckCircle size={14} className="text-green-500" />
                      : <XCircle size={14} className="text-red-500" />}
                    <span className={testResult.smtp_ok ? "text-green-500" : "text-red-500"}>
                      SMTP: {testResult.smtp_ok ? "Connected" : testResult.smtp_error}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {testResult.imap_ok
                      ? <CheckCircle size={14} className="text-green-500" />
                      : <XCircle size={14} className="text-red-500" />}
                    <span className={testResult.imap_ok ? "text-green-500" : "text-red-500"}>
                      IMAP: {testResult.imap_ok ? "Connected" : testResult.imap_error}
                    </span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
                  {error}
                </div>
              )}
            </div>
          )}
    </AppDialog>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Email Account"
        message="Remove this email account? All synced emails will be deleted."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
