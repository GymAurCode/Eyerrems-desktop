import { FormEvent, useEffect, useId, useState } from "react";
import Modal from "../Modal";
import { FormField, ReadOnlyField } from "./FormField";
import { crmApi, Client, Dealer } from "../../lib/crmApi";

const CNIC_RE  = /^\d{5}-\d{7}-\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (c: Client) => void;
  initial?: Client | null;
  leadPrefill?: { name: string; phone: string; email: string };
  previewIds?: { client_id: string; tracking_id: string };
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

export default function ClientForm({ open, onClose, onSaved, initial, leadPrefill, previewIds }: Props) {
  const formId  = useId();
  const editing = !!initial;

  const [name, setName]         = useState("");
  const [phone, setPhone]       = useState("");
  const [email, setEmail]       = useState("");
  const [cnic, setCnic]         = useState("");
  const [status, setStatus]     = useState("active");
  const [company, setCompany]   = useState("");
  const [address, setAddress]   = useState("");
  const [dealerId, setDealerId] = useState<number | "">("");
  const [notes, setNotes]       = useState("");
  const [dealers, setDealers]   = useState<Dealer[]>([]);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!open) return;
    crmApi.getDealers().then((r) => setDealers(r.data));
    if (initial) {
      setName(initial.name); setPhone(initial.phone ?? ""); setEmail(initial.email ?? "");
      setCnic(initial.cnic ?? ""); setStatus(initial.status);
      setCompany(initial.company_name ?? ""); setAddress(initial.address ?? "");
      setDealerId(initial.dealer_id ?? ""); setNotes(initial.notes ?? "");
    } else if (leadPrefill) {
      setName(leadPrefill.name); setPhone(leadPrefill.phone); setEmail(leadPrefill.email);
      setCnic(""); setStatus("active"); setCompany(""); setAddress(""); setDealerId(""); setNotes("");
    } else {
      setName(""); setPhone(""); setEmail(""); setCnic("");
      setStatus("active"); setCompany(""); setAddress(""); setDealerId(""); setNotes("");
    }
    setErrors({});
  }, [open, initial, leadPrefill]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name  = "Required";
    if (!phone.trim()) e.phone = "Required";
    if (email && !EMAIL_RE.test(email)) e.email = "Invalid email";
    if (cnic  && !CNIC_RE.test(cnic))   e.cnic  = "Format: XXXXX-XXXXXXX-X";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), phone: phone.trim(),
        email: email || null, cnic: cnic || null, status,
        company_name: company || null, address: address || null,
        dealer_id: dealerId || null, notes: notes || null,
      };
      const res = editing
        ? await crmApi.updateClient(initial!.id, payload)
        : await crmApi.createClient(payload);
      onSaved(res.data);
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
      <button type="button" onClick={onClose}
        className="px-5 py-2 text-sm rounded-lg transition-colors"
        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        Cancel
      </button>
      <button type="submit" form={formId} disabled={saving}
        className="btn-primary px-6 py-2 text-sm disabled:opacity-50">
        {saving ? "Saving…" : editing ? "Update Client" : "Create Client"}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Client" : "New Client"}
      size="xl" footer={footer}>
      <form id={formId} onSubmit={submit}>
        {errors.form && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {errors.form}
          </div>
        )}

        {/* IDs row — only shown when editing or preview */}
        {(previewIds || initial) && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <ReadOnlyField label="Tracking ID"
              value={initial?.tracking_id ?? previewIds?.tracking_id ?? "—"} />
            <ReadOnlyField label="Client ID"
              value={initial?.client_id ?? previewIds?.client_id ?? "—"} />
            <FormField label="Status">
              <select className="select-dark w-full px-3 py-2 text-sm" value={status}
                onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="potential">Potential</option>
              </select>
            </FormField>
          </div>
        )}

        {/* 3-column grid — all fields fit without scroll */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-3">

          <Divider label="Basic Info" />

          <FormField label="Full Name" required error={errors.name} span="2">
            <input className="input-dark w-full px-3 py-2 text-sm" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </FormField>

          {!(previewIds || initial) ? (
            <FormField label="Status">
              <select className="select-dark w-full px-3 py-2 text-sm" value={status}
                onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="potential">Potential</option>
              </select>
            </FormField>
          ) : <div />}

          <FormField label="Company">
            <input className="input-dark w-full px-3 py-2 text-sm" value={company}
              onChange={(e) => setCompany(e.target.value)} placeholder="Company (optional)" />
          </FormField>

          <FormField label="Assign Dealer" span="2">
            <select className="select-dark w-full px-3 py-2 text-sm" value={dealerId}
              onChange={(e) => setDealerId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— None —</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.dealer_id})</option>
              ))}
            </select>
          </FormField>

          <Divider label="Contact Info" />

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
              onChange={(e) => setAddress(e.target.value)} placeholder="Full address (optional)" />
          </FormField>

          <Divider label="Notes" />

          <FormField label="Internal Notes" span="full">
            <textarea className="input-dark w-full px-3 py-2 text-sm resize-none" rows={2}
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes…" />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
