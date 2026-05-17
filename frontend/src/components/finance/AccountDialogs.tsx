import { useState, useEffect, FormEvent } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X } from "lucide-react";
import { accountsApi, type AccountTreeNode, type Account } from "../../lib/financeApi";

function getPortalRoot(): HTMLElement {
  let el = document.getElementById("modal-portal-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "modal-portal-root";
    el.className = "app-shell";
    document.body.appendChild(el);
  }
  return el;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}>
      {children}
    </div>,
    getPortalRoot()
  );
}

function DialogBox({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl w-full max-w-md overflow-hidden"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
        <p className="text-sm font-semibold text-primary">{title}</p>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <X size={14} />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
        style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

// ── Account Create / Edit Dialog ──────────────────────────────────────────────
export function AccountDialog({
  mode, initial, parentAccount, onClose, onSave,
}: {
  mode: "create" | "edit";
  initial: AccountTreeNode | null;
  parentAccount: AccountTreeNode | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [code, setCode]         = useState(initial?.code ?? "");
  const [name, setName]         = useState(initial?.name ?? "");
  const [type, setType]         = useState(initial?.account_type ?? "Asset");
  const [desc, setDesc]         = useState(initial?.description ?? "");
  const [parentId, setParentId] = useState<string>(
    mode === "create" ? String(parentAccount?.id ?? "") : String(initial?.parent_id ?? "")
  );
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");

  useEffect(() => {
    accountsApi.list(false).then(setAccounts).catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr("Name is required"); return; }
    if (mode === "create" && !code.trim()) { setErr("Code is required"); return; }
    setSaving(true); setErr("");
    try {
      await onSave({
        code: code.trim(),
        name: name.trim(),
        account_type: type,
        description: desc.trim() || null,
        parent_id: parentId ? Number(parentId) : null,
        is_active: true,
      });
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "create"
    ? (parentAccount ? `Add Sub-account under ${parentAccount.name}` : "Create Account")
    : `Edit — ${initial?.name}`;

  return (
    <Overlay>
      <DialogBox title={title} onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-3">
          {parentAccount && mode === "create" && (
            <div className="px-3 py-2 rounded-lg text-xs"
              style={{ background: "rgba(59,130,246,0.08)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
              Parent: {parentAccount.code} — {parentAccount.name}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Account Code">
              <input className="input-dark w-full px-3 py-2 text-sm"
                value={code} onChange={e => setCode(e.target.value)}
                placeholder="e.g. 1110" disabled={mode === "edit"} />
            </Field>
            <Field label="Account Type">
              <select className="select-dark w-full px-3 py-2 text-sm"
                value={type} onChange={e => setType(e.target.value)}>
                {["Asset", "Liability", "Income", "Expense", "Equity"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Account Name">
            <input className="input-dark w-full px-3 py-2 text-sm"
              value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Petty Cash" />
          </Field>

          <Field label="Description (optional)">
            <input className="input-dark w-full px-3 py-2 text-sm"
              value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Brief description..." />
          </Field>

          {mode === "edit" && (
            <Field label="Parent Account">
              <select className="select-dark w-full px-3 py-2 text-sm"
                value={parentId} onChange={e => setParentId(e.target.value)}>
                <option value="">None (Root)</option>
                {accounts
                  .filter(a => a.id !== initial?.id)
                  .map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </Field>
          )}

          {err && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={12} /> {err}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-50">
              {saving ? "Saving..." : mode === "create" ? "Create Account" : "Save Changes"}
            </button>
          </div>
        </form>
      </DialogBox>
    </Overlay>
  );
}

// ── Confirm Delete Dialog ─────────────────────────────────────────────────────
export function ConfirmDeleteDialog({
  account, onClose, onConfirm,
}: {
  account: AccountTreeNode;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); }
    finally { setLoading(false); }
  };

  return (
    <Overlay>
      <DialogBox title="Delete Account" onClose={onClose}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 px-3 py-3 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertCircle size={16} style={{ color: "#f87171", shrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#f87171" }}>This cannot be undone</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Account <span className="font-mono text-primary">{account.code}</span> — {account.name} will be permanently deleted.
                This will fail if the account has journal entries or sub-accounts.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={loading}
              className="flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50 transition-colors"
              style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = "rgba(239,68,68,0.25)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}>
              {loading ? "Deleting..." : "Delete Account"}
            </button>
          </div>
        </div>
      </DialogBox>
    </Overlay>
  );
}
