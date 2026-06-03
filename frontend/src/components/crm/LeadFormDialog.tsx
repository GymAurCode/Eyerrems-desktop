import { FormEvent, useState, useRef } from "react";
import { Paperclip, X, Loader2, Upload } from "lucide-react";
import Modal from "../Modal";
import { crmApi, Lead } from "../../lib/crmApi";
import { attachmentApi } from "../../lib/attachmentApi";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
}

export default function LeadFormDialog({ open, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [preferredTown, setPreferredTown] = useState("");
  const [investorType, setInvestorType] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("new");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName(""); setPhone(""); setEmail(""); setSource("");
    setBudgetMin(""); setBudgetMax(""); setPreferredTown("");
    setInvestorType(""); setNotes(""); setStatus("new");
    setFiles([]); setErr(""); setSaving(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr("Name is required"); return; }
    setErr(""); setSaving(true);
    try {
      const lead = await crmApi.createLead({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        source: source.trim() || null,
        budget_min: budgetMin ? Number(budgetMin) : null,
        budget_max: budgetMax ? Number(budgetMax) : null,
        preferred_town: preferredTown.trim() || null,
        investor_type: investorType || null,
        notes: notes.trim() || null,
        status,
      });

      // Upload attached files after lead is created
      if (files.length > 0) {
        await Promise.allSettled(
          files.map((f) =>
            attachmentApi.upload("lead", lead.id, f, "", "PENDING"),
          ),
        );
      }

      reset();
      onSaved(lead);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to create lead");
    } finally {
      setSaving(false);
    }
  };

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Modal open={open} onClose={onClose} title="New Lead" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {err && (
          <p className="text-xs text-red-400 px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)" }}>
            {err}
          </p>
        )}

        {/* Row 1: Name + Phone */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" required>
            <input className="input-dark w-full px-3 py-2.5 text-sm" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Phone" required>
            <input className="input-dark w-full px-3 py-2.5 text-sm" value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder="03XX-XXXXXXX" />
          </Field>
        </div>

        {/* Row 2: Email + Source */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <input className="input-dark w-full px-3 py-2.5 text-sm" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </Field>
          <Field label="Lead Source">
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={source}
              onChange={(e) => setSource(e.target.value)}>
              <option value="">Select source…</option>
              <option value="Website">Website</option>
              <option value="Referral">Referral</option>
              <option value="Social Media">Social Media</option>
              <option value="Phone Inquiry">Phone Inquiry</option>
              <option value="Walk-in">Walk-in</option>
              <option value="Campaign">Campaign</option>
              <option value="Other">Other</option>
            </select>
          </Field>
        </div>

        {/* Row 3: Budget Min + Budget Max */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Budget (Min)" required>
            <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" min="0" value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)} placeholder="PKR 0" />
          </Field>
          <Field label="Budget (Max)" required>
            <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" min="0" value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)} placeholder="PKR 0" />
          </Field>
        </div>

        {/* Row 4: Preferred Location + Investor/End-User Tag */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Preferred Location / Town">
            <input className="input-dark w-full px-3 py-2.5 text-sm" value={preferredTown}
              onChange={(e) => setPreferredTown(e.target.value)} placeholder="e.g. DHA, Bahria Town" />
          </Field>
          <Field label="Investor / End-User">
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={investorType}
              onChange={(e) => setInvestorType(e.target.value)}>
              <option value="">Select type…</option>
              <option value="investor">Investor</option>
              <option value="end_user">End-User</option>
            </select>
          </Field>
        </div>

        {/* Row 5: Status + Notes */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={status}
              onChange={(e) => setStatus(e.target.value)}>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="site_visit_scheduled">Site Visit Scheduled</option>
              <option value="negotiation">Negotiation</option>
            </select>
          </Field>
          <Field label="Notes">
            <textarea className="input-dark w-full px-3 py-2.5 text-sm resize-none" rows={2}
              value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes…" />
          </Field>
        </div>

        {/* File drop zone */}
        <Field label="Attachments (business cards, briefs, etc.)">
          <div
            className="relative border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer hover:border-blue-500/50"
            style={{ borderColor: "var(--border)" }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={20} className="mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Drop files here or click to browse
            </p>
            <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,.pdf" onChange={addFiles} />
          </div>

          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "var(--bg-surface2)" }}>
                  <span className="flex items-center gap-1.5 truncate">
                    <Paperclip size={12} style={{ color: "var(--text-muted)" }} />
                    {f.name}
                  </span>
                  <button type="button" onClick={() => removeFile(i)} style={{ color: "var(--text-muted)" }}
                    className="hover:text-red-400 shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Field>

        {/* Submit */}
        <button type="submit" disabled={saving}
          className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Creating Lead…" : "Save Lead"}
        </button>
      </form>
    </Modal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
