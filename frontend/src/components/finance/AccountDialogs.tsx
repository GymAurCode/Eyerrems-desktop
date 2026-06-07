import { useState, useEffect } from "react";
import { AlertCircle, FileText } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { FormSection, FormRow, FormField } from "../ui/DialogForm";
import { DialogCancelButton, DialogSubmitButton } from "../ui/DialogButtons";
import AttachmentsButton from "../attachments/AttachmentsButton";
import { accountsApi, type AccountTreeNode, type Account } from "../../lib/financeApi";
import { useLookup } from "../../hooks/useLookup";

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
  const { options: ACCOUNT_TYPE_OPTS } = useLookup('account_type');
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
    accountsApi.list().then(setAccounts).catch(() => {});
  }, []);

  const handleSubmit = async () => {
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
    : `Edit \u2014 ${initial?.name}`;

  const subtitle = mode === "create"
    ? (parentAccount ? `Create a sub-account under ${parentAccount.name}` : "Add a new account to the chart of accounts")
    : "Edit account details";

  return (
    <AppDialog
      isOpen={true}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="md"
      icon={<FileText size={18} />}
      footer={
        <>
          <DialogCancelButton onClick={onClose} />
          <DialogSubmitButton onClick={handleSubmit} label={mode === "create" ? "Create Account" : "Save Changes"} loading={saving} />
        </>
      }
    >
      {parentAccount && mode === "create" && (
        <div className="px-3 py-2 rounded-lg text-xs"
          style={{ background: "rgba(59,130,246,0.08)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
          Parent: {parentAccount.code} — {parentAccount.name}
        </div>
      )}

      <FormRow cols={2}>
        <FormField label="Account Code" required>
          <input className="dialog-input" value={code} onChange={e => setCode(e.target.value)}
            placeholder="e.g. 1110" disabled={mode === "edit"} />
        </FormField>
        <FormField label="Account Type" required>
          <select className="dialog-select" value={type} onChange={e => setType(e.target.value)}>
            {ACCOUNT_TYPE_OPTS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </FormField>
      </FormRow>

      <FormField label="Account Name" required>
        <input className="dialog-input" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Petty Cash" />
      </FormField>

      <FormField label="Description" hint="Optional">
        <input className="dialog-input" value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Brief description..." />
      </FormField>

      {mode === "edit" && (
        <FormField label="Parent Account">
          <select className="dialog-select" value={parentId} onChange={e => setParentId(e.target.value)}>
            <option value="">None (Root)</option>
            {accounts
              .filter(a => a.id !== initial?.id)
              .map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </FormField>
      )}

      {err && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={12} /> {err}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <AttachmentsButton module="account" recordId={initial?.id} />
      </div>
    </AppDialog>
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
    <AppDialog
      isOpen={true}
      onClose={onClose}
      title="Delete Account"
      subtitle="Are you sure you want to delete this account?"
      size="sm"
      icon={<AlertCircle size={18} />}
      footer={
        <>
          <DialogCancelButton onClick={onClose} />
          <DialogSubmitButton onClick={handleConfirm} label="Delete Account" loading={loading} variant="danger" />
        </>
      }
    >
      <div className="flex items-start gap-3 px-3 py-3 rounded-lg"
        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <AlertCircle size={16} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#f87171" }}>This cannot be undone</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Account <span className="font-mono text-primary">{account.code}</span> — {account.name} will be permanently deleted.
            This will fail if the account has journal entries or sub-accounts.
          </p>
        </div>
      </div>
    </AppDialog>
  );
}
