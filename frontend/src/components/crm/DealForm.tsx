import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { Upload, Paperclip, X, FileText } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { FormField, FormSection } from "./FormField";
import AsyncDebouncedSelect, { AsyncSelectOption } from "../ui/AsyncDebouncedSelect";
import FileUpload from "../ui/FileUpload";
import { crmApi, Deal } from "../../lib/crmApi";
import { attachmentApi } from "../../lib/attachmentApi";
import { useLookup } from "../../hooks/useLookup";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (d: Deal) => void;
  initial?: Deal | null;
};

export default function DealForm({ open, onClose, onSaved, initial }: Props) {
  const formId = useId();
  const editing = !!initial;
  const { options: CLIENT_ROLE_OPTS } = useLookup("client_role");
  const { options: DOWN_PAYMENT_STATUS_OPTS } = useLookup("down_payment_status");
  const { options: DEAL_STATUS_OPTS } = useLookup("deal_status");

  const clientRoleOptions = CLIENT_ROLE_OPTS.length > 0 ? CLIENT_ROLE_OPTS
    : [{ value: "buyer", label: "Buyer" }, { value: "seller", label: "Seller" }, { value: "investor", label: "Investor" }];
  const downPaymentStatusOptions = DOWN_PAYMENT_STATUS_OPTS.length > 0 ? DOWN_PAYMENT_STATUS_OPTS
    : [{ value: "pending", label: "Pending" }, { value: "partial", label: "Partial" }, { value: "paid", label: "Paid" }];
  const dealStatusOptions = DEAL_STATUS_OPTS.length > 0 ? DEAL_STATUS_OPTS
    : [{ value: "pending", label: "Pending" }, { value: "active", label: "Active" }, { value: "closed", label: "Closed" }, { value: "cancelled", label: "Cancelled" }];

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<number | null>(null);
  const [trackingId, setTrackingId] = useState("");
  const [clientName, setClientName] = useState("");
  const [dealerId, setDealerId] = useState<number | null>(null);
  const [propId, setPropId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [role, setRole] = useState("");
  const [value, setValue] = useState("");
  const [downPay, setDownPay] = useState("");
  const [downPayStatus, setDownPayStatus] = useState("pending");
  const [status, setStatus] = useState("pending");
  const [dealDate, setDealDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [desc, setDesc] = useState("");
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const fileUploadRef = useRef<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.deal_title ?? "");
      setClientId(initial.client_id);
      setTrackingId(initial.tracking_id);
      setClientName(initial.client_name ?? "");
      setPropId(initial.property_id ?? null);
      setUnitId(initial.unit_id ?? null);
      setDealerId(initial.dealer_id ?? null);
      setRole(initial.client_role ?? "");
      setValue(String(initial.deal_value));
      setDownPay(initial.down_payment != null ? String(initial.down_payment) : "");
      setDownPayStatus(initial.down_payment_status);
      setStatus(initial.status);
      setDealDate(initial.deal_date ?? "");
      setDueDate(initial.due_date ?? "");
      setDesc(initial.description ?? "");
    } else {
      setTitle(""); setClientId(null); setTrackingId(""); setClientName("");
      setPropId(null); setUnitId(null); setDealerId(null); setRole("");
      setValue(""); setDownPay(""); setDownPayStatus("pending");
      setStatus("pending"); setDealDate(""); setDueDate(""); setDesc("");
    }
    setDocFiles([]);
    setErrors({});
  }, [open, initial]);

  const onClientSelect = (opt: AsyncSelectOption | null) => {
    if (opt) {
      setClientId(Number(opt.id));
      setTrackingId(opt.subtext ?? "");
      setClientName(opt.label);
    } else {
      setClientId(null);
      setTrackingId("");
      setClientName("");
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Required";
    if (!clientId) e.client = "Required";
    if (!value || Number(value) <= 0) e.value = "Required";
    if (!propId) e.property = "Required";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        deal_title: title.trim(), client_id: clientId,
        property_id: propId, unit_id: unitId,
        dealer_id: dealerId, client_role: role || null,
        deal_value: Number(value), down_payment: downPay ? Number(downPay) : null,
        down_payment_status: downPayStatus, status,
        deal_date: dealDate || null, due_date: dueDate || null,
        description: desc || null,
      };
      const deal = editing
        ? await crmApi.updateDeal(initial!.id, payload)
        : await crmApi.createDeal(payload);

      // Upload legal docs after deal is created
      const uploads: Promise<any>[] = [];
      docFiles.forEach((f) => {
        uploads.push(attachmentApi.upload("deal", deal.id, f, "Legal & Financial Document", "PENDING"));
      });

      const pendingFiles = fileUploadRef.current?.getPendingFiles() || [];
      pendingFiles.forEach((entry: { file: File; documentType: string | null }) => {
        uploads.push(attachmentApi.upload("deal", deal.id, entry.file, entry.documentType || "General", "PENDING"));
      });
      fileUploadRef.current?.clearPending();

      await Promise.allSettled(uploads);

      onSaved(deal);
      onClose();
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      if (Array.isArray(d)) {
        const m: Record<string, string> = {};
        d.forEach((x: any) => { m[x.loc?.at(-1) ?? "form"] = x.msg; });
        setErrors(m);
      } else { setErrors({ form: d ?? "Save failed" }); }
    } finally { setSaving(false); }
  };

  const remaining = value && downPay ? Number(value) - Number(downPay) : null;

  const addDocs = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setDocFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeDoc = (idx: number) => {
    setDocFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const footer = (
    <>
      <button type="button" onClick={onClose}
        className="px-5 py-2 text-sm rounded-lg transition-colors"
        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        Cancel
      </button>
      <button type="submit" form={formId} disabled={saving}
        className="btn-primary px-6 py-2 text-sm disabled:opacity-50">
        {saving ? "Saving…" : editing ? "Update Deal" : "Create Deal"}
      </button>
    </>
  );

  return (
    <AppDialog isOpen={open} onClose={onClose} title={editing ? "Edit Deal" : "New Deal"}
      size="2xl" footer={footer}>
      <form id={formId} onSubmit={submit}>
        {errors.form && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {errors.form}
          </div>
        )}

        {/* IDs row — edit mode only */}
        {initial && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <FormField label="Deal ID">
              <div className="px-3 py-2 text-sm font-mono select-all rounded-lg"
                style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa" }}>
                {initial.deal_id}
              </div>
            </FormField>
            <FormField label="Tracking ID">
              <div className="px-3 py-2 text-sm font-mono select-all rounded-lg"
                style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa" }}>
                {initial.tracking_id}
              </div>
            </FormField>
          </div>
        )}

        {/* ── Two-panel side-by-side layout ── */}
        <div className="grid grid-cols-2 gap-x-8">

          {/* LEFT — Deal Info + Property */}
          <div className="space-y-3">

            <FormSection title="Deal Info" />

            <FormField label="Deal Title" required error={errors.title}>
              <input className="input-dark w-full px-3 py-2 text-sm" value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Property Sale — DHA Phase 1" />
            </FormField>

            <FormField label="Client" required error={errors.client}>
              <AsyncDebouncedSelect
                endpoint="/crm/async-select/clients"
                placeholder="Search client by name or ID…"
                value={clientId}
                onChange={onClientSelect}
              />
            </FormField>

            <FormField label="Tracking ID (TRX)">
              <div
                className="px-3 py-2 rounded-lg text-sm font-mono flex items-center"
                style={{
                  background: trackingId ? "rgba(59,130,246,0.06)" : "var(--bg-base)",
                  border: `1px solid ${trackingId ? "rgba(59,130,246,0.2)" : "var(--border)"}`,
                  color: trackingId ? "#60a5fa" : "var(--text-muted)",
                  minHeight: "36px",
                }}>
                {trackingId || "Auto-filled from selected client"}
              </div>
            </FormField>

            <FormField label="Client Role">
              <select className="select-dark w-full px-3 py-2 text-sm" value={role}
                onChange={(e) => setRole(e.target.value)}>
                <option value="">— None —</option>
                {clientRoleOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Assigned Dealer">
              <AsyncDebouncedSelect
                endpoint="/crm/async-select/dealers"
                placeholder="Search dealer…"
                value={dealerId}
                onChange={(opt) => setDealerId(opt ? Number(opt.id) : null)}
              />
            </FormField>

            <FormSection title="Property" />

            <FormField label="Property" required error={errors.property}>
              <AsyncDebouncedSelect
                endpoint="/crm/async-select/properties"
                placeholder="Search property…"
                value={propId}
                onChange={(opt) => { setPropId(opt ? Number(opt.id) : null); setUnitId(null); }}
              />
            </FormField>

            <FormField label="Unit">
              <AsyncDebouncedSelect
                endpoint={`/crm/async-select/units${propId ? `?property_id=${propId}` : ""}`}
                placeholder={propId ? "Search unit…" : "Select a property first"}
                value={unitId}
                disabled={!propId}
                onChange={(opt) => setUnitId(opt ? Number(opt.id) : null)}
              />
            </FormField>

            <FormField label="Description">
              <textarea className="input-dark w-full px-3 py-2 text-sm resize-none" rows={3}
                value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="Deal description or notes…" />
            </FormField>
          </div>

          {/* RIGHT — Financial + Status/Dates + Attachments */}
          <div className="space-y-3">

            <FormSection title="Financial" />

            <FormField label="Deal Value" required error={errors.value}>
              <input className="input-dark w-full px-3 py-2 text-sm" type="number"
                min="0" step="0.01" value={value}
                onChange={(e) => setValue(e.target.value)} placeholder="Total deal value" />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Down Payment" required error={errors.down_payment}>
                <input className="input-dark w-full px-3 py-2 text-sm" type="number"
                  min="0" step="0.01" value={downPay}
                  onChange={(e) => setDownPay(e.target.value)} placeholder="Amount" />
              </FormField>
              <FormField label="DP Status">
                <select className="select-dark w-full px-3 py-2 text-sm" value={downPayStatus}
                  onChange={(e) => setDownPayStatus(e.target.value)}>
                  {downPaymentStatusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Remaining balance preview */}
            {remaining !== null && (
              <div className="px-4 py-3 rounded-xl"
                style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5"
                  style={{ color: "var(--text-muted)" }}>Remaining Balance</p>
                <p className="text-xl font-bold" style={{ color: "#818cf8" }}>
                  {remaining.toLocaleString()}
                </p>
              </div>
            )}

            <FormSection title="Status & Dates" />

            <FormField label="Deal Status">
              <select className="select-dark w-full px-3 py-2 text-sm" value={status}
                onChange={(e) => setStatus(e.target.value)}>
              {dealStatusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
              </select>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Deal Date">
                <input className="input-dark w-full px-3 py-2 text-sm" type="date"
                  value={dealDate} onChange={(e) => setDealDate(e.target.value)} />
              </FormField>
              <FormField label="Due Date">
                <input className="input-dark w-full px-3 py-2 text-sm" type="date"
                  value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </FormField>
            </div>

            {/* ── Legal & Financial Documents ── */}
            <FormSection title="Legal & Financial Documents" />

            <div
              className="relative border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer hover:border-blue-500/50"
              style={{ borderColor: "var(--border)" }}
              onClick={() => document.getElementById(`docs-${formId}`)?.click()}
            >
              <FileText size={20} className="mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Upload signed agreements, bank receipts, etc.
              </p>
              <input id={`docs-${formId}`} type="file" multiple className="hidden"
                accept=".pdf,.doc,.docx,image/*" onChange={addDocs} />
            </div>

            {docFiles.length > 0 && (
              <div className="space-y-1">
                {docFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "var(--bg-surface2)" }}>
                    <span className="flex items-center gap-1.5 truncate">
                      <Paperclip size={12} style={{ color: "var(--text-muted)" }} />
                      {f.name}
                    </span>
                    <button type="button" onClick={() => removeDoc(i)}
                      style={{ color: "var(--text-muted)" }}
                      className="hover:text-red-400 shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="pt-3 border-t border-theme">
          <FileUpload ref={fileUploadRef} module="crm" recordType="deal" recordId={initial?.id ? String(initial.id) : ""} documentTypes={["Sale Agreement", "SPA", "Token Receipt", "Cheque", "Other"]} />
        </div>
      </form>
    </AppDialog>
  );
}
