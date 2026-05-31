import { FormEvent, useEffect, useId, useState } from "react";
import Modal from "../Modal";
import { FormField, ReadOnlyField } from "./FormField";
import { crmApi, Dealer } from "../../lib/crmApi";
import AttachmentsButton from "../attachments/AttachmentsButton";
import { useLookup } from "../../hooks/useLookup";

const CNIC_RE  = /^\d{5}-\d{7}-\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (d: Dealer) => void;
  initial?: Dealer | null;
};

function Divider({ label }: { label: string }) {
  return (
    <div className="col-span-full flex items-center gap-3 pt-1">
      <span className="text-[10px] font-bold uppercase tracking-widest shrink-0"
        style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

export default function DealerForm({ open, onClose, onSaved, initial }: Props) {
  const formId  = useId();
  const editing = !!initial;
  const { options: COMMISSION_TYPE_OPTS } = useLookup('commission_type');

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [company, setCompany]   = useState("");
  const [commType, setCommType] = useState("percentage");
  const [commRate, setCommRate] = useState("");
  const [cnic, setCnic]         = useState("");
  const [address, setAddress]   = useState("");
  const [notes, setNotes]       = useState("");
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const i = initial as any;
      setName(i.name); setEmail(i.email ?? ""); setPhone(i.phone ?? "");
      setCompany(i.company ?? ""); setCommType(i.commission_type);
      setCommRate(i.commission_rate ?? ""); setCnic(i.cnic ?? "");
      setAddress(i.address ?? ""); setNotes(i.notes ?? "");
    } else {
      setName(""); setEmail(""); setPhone(""); setCompany("");
      setCommType("percentage"); setCommRate(""); setCnic(""); setAddress(""); setNotes("");
    }
    setErrors({});
  }, [open, initial]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name  = "Required";
    if (!phone.trim()) e.phone = "Required";
    if (email && !EMAIL_RE.test(email)) e.email = "Invalid email";
    if (cnic  && !CNIC_RE.test(cnic))   e.cnic  = "Format: XXXXX-XXXXXXX-X";
    if (!commRate) e.commission_rate = "Required";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(), email: email || null, phone: phone.trim(),
        company: company || null, commission_type: commType,
        commission_rate: commRate ? Number(commRate) : null,
        cnic: cnic || null, address: address || null, notes: notes || null,
      };
      const res = editing
        ? await crmApi.updateDealer(initial!.id, payload as any)
        : await crmApi.createDealer(payload as any);
      onSaved(res);
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

  const footer = (
    <>
      <AttachmentsButton module="dealer" recordId={initial?.id} />
      <button type="button" onClick={onClose}
        className="px-5 py-2 text-sm rounded-lg transition-colors"
        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        Cancel
      </button>
      <button type="submit" form={formId} disabled={saving}
        className="btn-primary px-6 py-2 text-sm disabled:opacity-50">
        {saving ? "Saving…" : editing ? "Update Dealer" : "Create Dealer"}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Dealer" : "New Dealer"}
      size="xl" footer={footer}>
      <form id={formId} onSubmit={submit}>
        {errors.form && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {errors.form}
          </div>
        )}

        {/* Dealer ID banner */}
        {initial && (
          <div className="mb-4">
            <ReadOnlyField label="Dealer ID" value={initial.dealer_id} />
          </div>
        )}

        <div className="grid grid-cols-3 gap-x-4 gap-y-3">

          <Divider label="Basic Info" />

          <FormField label="Full Name" required error={errors.name} span="2">
            <input className="input-dark w-full px-3 py-2 text-sm" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="Dealer full name" />
          </FormField>

          <FormField label="Company">
            <input className="input-dark w-full px-3 py-2 text-sm" value={company}
              onChange={(e) => setCompany(e.target.value)} placeholder="Company name" />
          </FormField>

          <Divider label="Contact" />

          <FormField label="Phone" required error={errors.phone}>
            <input className="input-dark w-full px-3 py-2 text-sm" value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 0000000" />
          </FormField>

          <FormField label="Email" error={errors.email}>
            <input className="input-dark w-full px-3 py-2 text-sm" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </FormField>

          <FormField label="CNIC" error={errors.cnic}>
            <input className="input-dark w-full px-3 py-2 text-sm" value={cnic}
              onChange={(e) => setCnic(e.target.value)} placeholder="XXXXX-XXXXXXX-X" />
          </FormField>

          <FormField label="Address" span="full">
            <input className="input-dark w-full px-3 py-2 text-sm" value={address}
              onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
          </FormField>

          <Divider label="Commission" />

          <FormField label="Type">
            <select className="select-dark w-full px-3 py-2 text-sm" value={commType}
              onChange={(e) => setCommType(e.target.value)}>
              {COMMISSION_TYPE_OPTS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FormField>

          <FormField label={commType === "percentage" ? "Rate (%)" : "Fixed Amount"}
            required error={errors.commission_rate}>
            <input className="input-dark w-full px-3 py-2 text-sm" type="number"
              min="0" step="0.01" value={commRate}
              onChange={(e) => setCommRate(e.target.value)}
              placeholder={commType === "percentage" ? "e.g. 2.5" : "e.g. 50000"} />
          </FormField>

          {/* Live preview chip */}
          <div className="flex items-end">
            <div className="w-full px-3 py-2 rounded-lg text-sm font-semibold text-center"
              style={{
                background: commRate ? "rgba(16,185,129,0.08)" : "var(--bg-base)",
                border: `1px solid ${commRate ? "rgba(16,185,129,0.25)" : "var(--border)"}`,
                color: commRate ? "#10b981" : "var(--text-muted)",
                minHeight: "38px", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {commRate
                ? commType === "percentage"
                  ? `${commRate}% commission`
                  : `PKR ${Number(commRate).toLocaleString()} fixed`
                : "Preview"}
            </div>
          </div>

          <Divider label="Notes" />

          <FormField label="Internal Notes" span="full">
            <textarea className="input-dark w-full px-3 py-2 text-sm resize-none" rows={2}
              value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes…" />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
