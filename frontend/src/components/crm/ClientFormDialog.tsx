import { FormEvent, useEffect, useId, useState } from "react";
import { Upload, Paperclip, X, Loader2 } from "lucide-react";
import Modal from "../Modal";
import { FormField, FormSection } from "./FormField";
import AsyncDebouncedSelect, { AsyncSelectOption } from "../ui/AsyncDebouncedSelect";
import { crmApi, Client } from "../../lib/crmApi";
import { attachmentApi } from "../../lib/attachmentApi";
import { useLookup } from "../../hooks/useLookup";

const CNIC_RE  = /^\d{5}-\d{7}-\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (client: Client) => void;
  initial?: Client | null;
  leadPrefill?: { name: string; phone: string; email: string };
  previewIds?: { client_id: string; tracking_id: string };
}

interface SecureFileSlot {
  label: string;
  key: "cnic_front" | "cnic_back" | "proof_of_income";
  accept: string;
  description: string;
}

const SECURE_SLOTS: SecureFileSlot[] = [
  { label: "CNIC (Front)", key: "cnic_front", accept: "image/*,.pdf", description: "CNIC Front Side" },
  { label: "CNIC (Back)", key: "cnic_back", accept: "image/*,.pdf", description: "CNIC Back Side" },
  { label: "Proof of Income", key: "proof_of_income", accept: "image/*,.pdf,.xls,.xlsx,.doc,.docx", description: "Proof of Income" },
];

export default function ClientFormDialog({ open, onClose, onSaved, initial, leadPrefill, previewIds }: Props) {
  const formId = useId();
  const editing = !!initial;
  const { options: CLIENT_STATUS_OPTS } = useLookup("client_status");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cnic, setCnic] = useState("");
  const [status, setStatus] = useState("active");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [mailingAddress, setMailingAddress] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [nextOfKinName, setNextOfKinName] = useState("");
  const [nextOfKinCnic, setNextOfKinCnic] = useState("");
  const [nextOfKinPhone, setNextOfKinPhone] = useState("");
  const [dealerId, setDealerId] = useState<number | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<Record<string, File>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setPhone(""); setEmail(""); setCnic("");
    setStatus("active"); setCompany(""); setAddress("");
    setMailingAddress(""); setPermanentAddress("");
    setNextOfKinName(""); setNextOfKinCnic(""); setNextOfKinPhone("");
    setDealerId(null); setPropertyId(null); setNotes("");
    setFiles({}); setErrors({}); setSaving(false);
  };

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name); setPhone(initial.phone ?? ""); setEmail(initial.email ?? "");
      setCnic(initial.cnic ?? ""); setStatus(initial.status);
      setCompany(initial.company_name ?? ""); setAddress(initial.address ?? "");
      setMailingAddress(initial.mailing_address ?? "");
      setPermanentAddress(initial.permanent_address ?? "");
      setNextOfKinName(initial.next_of_kin_name ?? "");
      setNextOfKinCnic(initial.next_of_kin_cnic ?? "");
      setNextOfKinPhone(initial.next_of_kin_phone ?? "");
      setDealerId(initial.dealer_id ?? null);
      setPropertyId((initial as any).interested_property_id ?? null);
      setNotes(initial.notes ?? "");
    } else if (leadPrefill) {
      setName(leadPrefill.name); setPhone(leadPrefill.phone); setEmail(leadPrefill.email);
      setCnic(""); setStatus("active"); setCompany(""); setAddress("");
      setMailingAddress(""); setPermanentAddress("");
      setNextOfKinName(""); setNextOfKinCnic(""); setNextOfKinPhone("");
      setDealerId(null); setPropertyId(null); setNotes("");
    } else {
      reset();
    }
    setErrors({});
  }, [open, initial, leadPrefill]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name  = "Required";
    if (!phone.trim()) e.phone = "Required";
    if (email && !EMAIL_RE.test(email)) e.email = "Invalid email";
    if (cnic  && !CNIC_RE.test(cnic))   e.cnic  = "Format: XXXXX-XXXXXXX-X";
    if (nextOfKinCnic && !CNIC_RE.test(nextOfKinCnic)) e.next_of_kin_cnic = "Format: XXXXX-XXXXXXX-X";
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
        mailing_address: mailingAddress || null, permanent_address: permanentAddress || null,
        next_of_kin_name: nextOfKinName || null, next_of_kin_cnic: nextOfKinCnic || null,
        next_of_kin_phone: nextOfKinPhone || null,
        dealer_id: dealerId, interested_property_id: propertyId,
        notes: notes || null,
      };
      const client = editing
        ? await crmApi.updateClient(initial!.id, payload)
        : await crmApi.createClient(payload);

      // Upload secure attachments after client is created/updated
      const recordId = client.id;
      const uploads = Object.entries(files).map(([key, file]) =>
        attachmentApi.upload("client", recordId, file, key, "PENDING"),
      );
      await Promise.allSettled(uploads);

      onSaved(client);
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

  const handleFileSelect = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFiles((prev) => ({ ...prev, [key]: e.target.files![0] }));
    }
  };

  const removeFile = (key: string) => {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
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
      size="2xl" footer={footer}>
      <form id={formId} onSubmit={submit}>
        {errors.form && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {errors.form}
          </div>
        )}

        <div className="grid grid-cols-3 gap-x-4 gap-y-3">

          {/* ── IDs row — only shown when editing or preview ── */}
          {(previewIds || initial) && (
            <>
              <FormField label="Tracking ID">
                <div className="px-3 py-2 text-sm font-mono select-all rounded-lg"
                  style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa" }}>
                  {initial?.tracking_id ?? previewIds?.tracking_id ?? "—"}
                </div>
              </FormField>
              <FormField label="Client ID">
                <div className="px-3 py-2 text-sm font-mono select-all rounded-lg"
                  style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa" }}>
                  {initial?.client_id ?? previewIds?.client_id ?? "—"}
                </div>
              </FormField>
              <FormField label="Status">
                <select className="select-dark w-full px-3 py-2 text-sm" value={status}
                  onChange={(e) => setStatus(e.target.value)}>
                  {CLIENT_STATUS_OPTS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FormField>
            </>
          )}

          {/* ── Basic Info ── */}
          <FormSection title="Basic Info" />

          <FormField label="Full Name" required error={errors.name} span="2">
            <input className="input-dark w-full px-3 py-2 text-sm" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </FormField>

          {!(previewIds || initial) ? (
            <FormField label="Status">
              <select className="select-dark w-full px-3 py-2 text-sm" value={status}
                onChange={(e) => setStatus(e.target.value)}>
                {CLIENT_STATUS_OPTS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>
          ) : <div />}

          <FormField label="Company">
            <input className="input-dark w-full px-3 py-2 text-sm" value={company}
              onChange={(e) => setCompany(e.target.value)} placeholder="Company (optional)" />
          </FormField>

          <FormField label="Assign Dealer" span="2">
            <AsyncDebouncedSelect
              endpoint="/crm/async-select/dealers"
              placeholder="Search dealer…"
              value={dealerId}
              onChange={(opt: AsyncSelectOption | null) => setDealerId(opt ? Number(opt.id) : null)}
            />
          </FormField>

          <FormField label="Interested Property">
            <AsyncDebouncedSelect
              endpoint="/crm/async-select/properties"
              placeholder="Search property…"
              value={propertyId}
              onChange={(opt: AsyncSelectOption | null) => setPropertyId(opt ? Number(opt.id) : null)}
            />
          </FormField>

          {/* ── Contact Info ── */}
          <FormSection title="Contact Info" />

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

          {/* ── Addresses ── */}
          <FormSection title="Addresses" />

          <FormField label="Residential Address" span="full">
            <input className="input-dark w-full px-3 py-2 text-sm" value={address}
              onChange={(e) => setAddress(e.target.value)} placeholder="Current residential address" />
          </FormField>

          <FormField label="Mailing Address" span="full">
            <input className="input-dark w-full px-3 py-2 text-sm" value={mailingAddress}
              onChange={(e) => setMailingAddress(e.target.value)} placeholder="Mailing address (if different)" />
          </FormField>

          <FormField label="Permanent Address" span="full">
            <input className="input-dark w-full px-3 py-2 text-sm" value={permanentAddress}
              onChange={(e) => setPermanentAddress(e.target.value)} placeholder="Permanent address" />
          </FormField>

          {/* ── Next of Kin ── */}
          <FormSection title="Next of Kin" />

          <FormField label="Name">
            <input className="input-dark w-full px-3 py-2 text-sm" value={nextOfKinName}
              onChange={(e) => setNextOfKinName(e.target.value)} placeholder="Next of kin name" />
          </FormField>

          <FormField label="CNIC" error={errors.next_of_kin_cnic}>
            <input className="input-dark w-full px-3 py-2 text-sm" value={nextOfKinCnic}
              onChange={(e) => setNextOfKinCnic(e.target.value)} placeholder="XXXXX-XXXXXXX-X" />
          </FormField>

          <FormField label="Phone">
            <input className="input-dark w-full px-3 py-2 text-sm" value={nextOfKinPhone}
              onChange={(e) => setNextOfKinPhone(e.target.value)} placeholder="+92 300 0000000" />
          </FormField>

          {/* ── Notes ── */}
          <FormSection title="Notes" />

          <FormField label="Internal Notes" span="full">
            <textarea className="input-dark w-full px-3 py-2 text-sm resize-none" rows={2}
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes…" />
          </FormField>

          {/* ── Secure Attachments ── */}
          <FormSection title="Secure Attachments" />

          {SECURE_SLOTS.map((slot) => (
            <FormField key={slot.key} label={slot.label}>
              {files[slot.key] ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                  style={{ background: "var(--bg-surface2)" }}>
                  <span className="flex items-center gap-1.5 truncate">
                    <Paperclip size={12} style={{ color: "var(--text-muted)" }} />
                    {files[slot.key].name}
                  </span>
                  <button type="button" onClick={() => removeFile(slot.key)}
                    style={{ color: "var(--text-muted)" }}
                    className="hover:text-red-400 shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer border-2 border-dashed transition-colors hover:border-blue-500/50"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Upload size={14} style={{ color: "var(--text-muted)" }} />
                  <span style={{ color: "var(--text-muted)" }}>Upload</span>
                  <input type="file" accept={slot.accept} className="hidden"
                    onChange={handleFileSelect(slot.key)} />
                </label>
              )}
            </FormField>
          ))}

        </div>
      </form>
    </Modal>
  );
}
