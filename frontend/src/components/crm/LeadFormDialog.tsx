import { FormEvent, useState, useRef } from "react";
import { Paperclip, X, Upload, UserPlus } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { FormSection, FormRow, FormField } from "../ui/DialogForm";
import { DialogCancelButton, DialogSubmitButton } from "../ui/DialogButtons";
import AsyncDebouncedSelect, { AsyncSelectOption } from "../ui/AsyncDebouncedSelect";
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
  const [preferredProject, setPreferredProject] = useState("");
  const [investorType, setInvestorType] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("new");
  const [dealerId, setDealerId] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName(""); setPhone(""); setEmail(""); setSource("");
    setBudgetMin(""); setBudgetMax(""); setPreferredTown("");
    setInvestorType(""); setNotes(""); setStatus("new"); setPreferredProject("");
    setDealerId(null); setFiles([]); setErr(""); setSaving(false);
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
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
        preferred_project: preferredProject.trim() || null,
        investor_type: investorType || null,
        notes: notes.trim() || null,
        status,
        assigned_dealer_id: dealerId,
      });

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
    <AppDialog isOpen={open} onClose={onClose} title="New Lead"
      icon={<UserPlus size={18} />}
      subtitle="Enter lead information and property requirements"
      size="lg"
      footer={
        <>
          <DialogCancelButton onClick={onClose} />
          <DialogSubmitButton onClick={handleSubmit} label="Save Lead" loading={saving} />
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)" }}>
            {err}
          </div>
        )}

        <FormSection title="Contact Information">
          <FormRow cols={2}>
            <FormField label="Name" required>
              <input className="dialog-input w-full" value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </FormField>
            <FormField label="Phone">
              <input className="dialog-input w-full" value={phone}
                onChange={(e) => setPhone(e.target.value)} placeholder="03XX-XXXXXXX" />
            </FormField>
          </FormRow>
          <FormRow cols={2}>
            <FormField label="Email">
              <input className="dialog-input w-full" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
            </FormField>
            <FormField label="Lead Source">
              <select className="dialog-select w-full" value={source}
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
            </FormField>
          </FormRow>
        </FormSection>

        <FormSection title="Budget & Property">
          <FormRow cols={2}>
            <FormField label="Budget (Min)">
              <input className="dialog-input w-full" type="number" min="0" value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)} placeholder="PKR 0" />
            </FormField>
            <FormField label="Budget (Max)">
              <input className="dialog-input w-full" type="number" min="0" value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)} placeholder="PKR 0" />
            </FormField>
          </FormRow>
          <FormRow cols={2}>
            <FormField label="Preferred Location / Town">
              <input className="dialog-input w-full" value={preferredTown}
                onChange={(e) => setPreferredTown(e.target.value)} placeholder="e.g. DHA, Bahria Town" />
            </FormField>
            <FormField label="Project">
              <input className="dialog-input w-full" value={preferredProject}
                onChange={(e) => setPreferredProject(e.target.value)} placeholder="Project name (if any)" />
            </FormField>
          </FormRow>
          <FormRow cols={2}>
            <FormField label="Investor / End-User">
              <select className="dialog-select w-full" value={investorType}
                onChange={(e) => setInvestorType(e.target.value)}>
                <option value="">Select type…</option>
                <option value="investor">Investor</option>
                <option value="end_user">End-User</option>
              </select>
            </FormField>
            <FormField label="&nbsp;" />
          </FormRow>
        </FormSection>

        <FormSection title="Status & Notes">
          <FormRow cols={2}>
            <FormField label="Status">
              <select className="dialog-select w-full" value={status}
                onChange={(e) => setStatus(e.target.value)}>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="interested">Interested</option>
                <option value="site_visit_scheduled">Site Visit Scheduled</option>
                <option value="negotiation">Negotiation</option>
              </select>
            </FormField>
            <FormField label="Notes">
              <textarea className="dialog-textarea w-full" rows={2}
                value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes…" />
            </FormField>
          </FormRow>
          <FormRow cols={1}>
            <FormField label="Assign to Dealer" fullWidth>
              <AsyncDebouncedSelect
                endpoint="/crm/async-select/dealers"
                placeholder="Search dealer…"
                value={dealerId}
                onChange={(opt: AsyncSelectOption | null) => setDealerId(opt ? Number(opt.id) : null)}
              />
            </FormField>
          </FormRow>
        </FormSection>

        <FormSection title="Attachments">
          <FormField label="Attachments (business cards, briefs, etc.)" fullWidth>
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
          </FormField>
        </FormSection>
      </form>
    </AppDialog>
  );
}
