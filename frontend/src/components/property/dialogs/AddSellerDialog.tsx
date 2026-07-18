import { useEffect, useState, FormEvent } from "react";
import { AlertTriangle, Plus, Upload, X } from "lucide-react";
import AppDialog from "../../ui/AppDialog";
import { propApi, Contact } from "../../../lib/propertyApi";
import { formatCNIC } from "../../../lib/cnic";

interface AddSellerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editContact?: Contact | null;
}

const ROLE_LABELS: Record<string, string> = {
  buyer: "Buyer", seller: "Seller", agent: "Agent", other: "Other",
};
const SOURCE_FUNDS = ["Salary", "Business", "Investment", "Inheritance", "Overseas Remittance", "Other"];
const INCOME_RANGES = ["Under 1M", "1M–5M", "5M–20M", "20M+", "Prefer not to say"];
const DOC_TYPES = [
  "CNIC (Front)", "CNIC (Back)", "Passport", "Proof of Address (Utility Bill)",
  "Proof of Income / Bank Statement", "Company Registration", "Other",
];

function SectionLabel({ title, optional }: { title: string; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{title}</span>
      {optional && <span className="text-[9px] text-muted">(optional)</span>}
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

function validateCNIC(cnic: string): boolean {
  return /^\d{5}-\d{7}-\d{1}$/.test(cnic);
}

interface DraftDoc {
  _key: string;
  document_type: string;
  file: File | null;
}

export default function AddSellerDialog({ isOpen, onClose, onSaved, editContact }: AddSellerDialogProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<string[]>(["seller"]);
  const [contactType, setContactType] = useState("individual");
  const [cnic, setCnic] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("");
  const [profession, setProfession] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ntn, setNtn] = useState("");
  const [companyReg, setCompanyReg] = useState("");
  const [authPerson, setAuthPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappSame, setWhatsappSame] = useState(false);
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [taxNtn, setTaxNtn] = useState("");
  const [sourceFunds, setSourceFunds] = useState("");
  const [incomeRange, setIncomeRange] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAcct, setBankAcct] = useState("");
  const [kycStatus, setKycStatus] = useState("pending");
  const [draftDocs, setDraftDocs] = useState<DraftDoc[]>([]);
  const [internalNotes, setInternalNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarn, setDuplicateWarn] = useState<{ id: number; name: string; type: string } | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const resetForm = () => {
    setName(""); setRole(["seller"]); setContactType("individual");
    setCnic(""); setDob(""); setNationality(""); setProfession("");
    setCompanyName(""); setNtn(""); setCompanyReg(""); setAuthPerson("");
    setEmail(""); setPhone(""); setWhatsapp(""); setWhatsappSame(false);
    setSecondaryPhone(""); setAddress(""); setCity("");
    setTaxNtn(""); setSourceFunds(""); setIncomeRange("");
    setBankName(""); setBankAcct(""); setKycStatus("pending");
    setDraftDocs([]); setInternalNotes("");
    setEditId(null); setDuplicateWarn(null); setError("");
  };

  const loadContact = (contact: Contact) => {
    setName(contact.name);
    setRole(contact.role.split(",").map(r => r.trim()).filter(Boolean));
    setContactType(contact.contact_type);
    setCnic(contact.cnic || "");
    setDob(contact.date_of_birth || "");
    setNationality(contact.nationality || "");
    setProfession(contact.profession || "");
    setCompanyName(contact.company_name || "");
    setNtn(contact.ntn || "");
    setCompanyReg(contact.company_reg_no || "");
    setAuthPerson(contact.authorized_person || "");
    setEmail(contact.email || "");
    setPhone(contact.phone || "");
    setWhatsapp(contact.whatsapp || "");
    setWhatsappSame(contact.whatsapp === contact.phone && !!contact.whatsapp);
    setSecondaryPhone(contact.secondary_phone || "");
    setAddress(contact.address || "");
    setCity(contact.city || "");
    setTaxNtn(contact.tax_ntn || "");
    setSourceFunds(contact.source_of_funds || "");
    setIncomeRange(contact.annual_income_range || "");
    setBankName(contact.bank_name || "");
    setBankAcct(contact.bank_account_no || "");
    setKycStatus(contact.kyc_status);
    setInternalNotes(contact.internal_notes || "");
    setEditId(contact.id);
    setError("");
    setDuplicateWarn(null);
  };

  useEffect(() => {
    if (isOpen) {
      if (editContact) loadContact(editContact);
      else resetForm();
    }
  }, [isOpen, editContact]);

  useEffect(() => {
    if (whatsappSame) setWhatsapp(phone);
  }, [phone, whatsappSame]);

  const addDraftDoc = () => setDraftDocs(prev => [...prev, { _key: `doc-${Date.now()}`, document_type: "Other", file: null }]);
  const updDraftDoc = (key: string, field: keyof DraftDoc, val: any) =>
    setDraftDocs(prev => prev.map(d => d._key === key ? { ...d, [field]: val } : d));
  const delDraftDoc = (key: string) => setDraftDocs(prev => prev.filter(d => d._key !== key));

  const handleMergeDuplicate = async () => {
    if (!duplicateWarn) return;
    const addR = role.includes("buyer") ? "buyer" : "seller";
    try {
      await propApi.addContactRole(duplicateWarn.id, addR);
      await propApi.updateContact(duplicateWarn.id, { role: [...new Set([...duplicateWarn.name.split(","), addR])].join(",") });
      setDuplicateWarn(null);
      resetForm(); onClose(); onSaved();
    } catch {}
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Full name is required."); return; }

    if (contactType === "individual" && cnic && !validateCNIC(cnic)) {
      setError("CNIC format must be 00000-0000000-0 (e.g., 12345-6789012-3).");
      return;
    }

    const payload: any = {
      name: name.trim(),
      role: role.join(","),
      contact_type: contactType,
      cnic: cnic || null,
      date_of_birth: dob || null,
      nationality: nationality || null,
      profession: profession || null,
      company_name: contactType === "company" ? companyName : null,
      ntn: contactType === "company" ? ntn : null,
      company_reg_no: contactType === "company" ? companyReg : null,
      authorized_person: contactType === "company" ? authPerson : null,
      email: email || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      secondary_phone: secondaryPhone || null,
      address: address || null,
      city: city || null,
      tax_ntn: taxNtn || null,
      source_of_funds: sourceFunds || null,
      annual_income_range: incomeRange || null,
      bank_name: bankName || null,
      bank_account_no: bankAcct || null,
      kyc_status: kycStatus,
      internal_notes: internalNotes || null,
    };

    setSubmitting(true);
    try {
      let createdId: number;
      if (editId) {
        await propApi.updateContact(editId, payload);
        createdId = editId;
      } else {
        try {
          const created = await propApi.createContact(payload);
          createdId = created.id;
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "";
          const dupMatch = msg.match(/DUPLICATE_(CNIC|EMAIL)\|(\d+)\|(.+)/);
          if (dupMatch) {
            setDuplicateWarn({ id: Number(dupMatch[2]), name: dupMatch[3], type: dupMatch[1] });
            setSubmitting(false);
            return;
          }
          throw err;
        }
      }

      for (const doc of draftDocs) {
        if (doc.file) {
          await propApi.uploadContactDocument(createdId, doc.file, doc.document_type);
        }
      }

      resetForm(); onClose(); onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to save contact.");
    } finally { setSubmitting(false); }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={editId ? "Edit Contact" : "Add Contact"}
      size="xl">
      <form onSubmit={submit} className="space-y-6">
        {error && (
          <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2"
            style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {duplicateWarn && (
          <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-3"
            style={{ color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <AlertTriangle size={13} />
            <span>Duplicate found: <strong>{duplicateWarn.name}</strong> (same {duplicateWarn.type}). Merge roles?</span>
            <button type="button" onClick={handleMergeDuplicate}
              className="px-2 py-1 text-xs rounded" style={{ background: "#f59e0b", color: "var(--surface-input)" }}>
              Add Role & Merge
            </button>
            <button type="button" onClick={() => setDuplicateWarn(null)}
              className="text-muted">Ignore</button>
          </div>
        )}

        <SectionLabel title="Personal Information" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div className="md:col-span-2">
            <label className="block text-xs text-muted mb-1">Full Name <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <input className="dialog-input w-full px-3 py-2.5 text-sm" value={name}
              onChange={(e) => setName(e.target.value)} required placeholder="Contact name" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Role</label>
            <div className="flex flex-wrap gap-3">
              {["buyer", "seller", "agent"].map(r => (
                <label key={r} className="flex items-center gap-1.5 text-xs text-primary cursor-pointer">
                  <input type="checkbox" checked={role.includes(r)} className="accent-blue-500"
                    onChange={() => {
                      if (role.includes(r)) setRole(role.filter(x => x !== r));
                      else setRole([...role, r]);
                    }} />
                  {ROLE_LABELS[r]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Contact Type</label>
            <select className="dialog-select w-full px-3 py-2.5 text-sm" value={contactType}
              onChange={(e) => setContactType(e.target.value)}>
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </div>

          {contactType === "individual" ? (
            <>
              <div>
                <label className="block text-xs text-muted mb-1">CNIC Number (00000-0000000-0)</label>
                <input className="dialog-input w-full px-3 py-2.5 text-sm" value={cnic}
                  onChange={(e) => setCnic(formatCNIC(e.target.value))} placeholder="e.g. 12345-6789012-3" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Date of Birth</label>
                <input className="dialog-input w-full px-3 py-2.5 text-sm" type="date" value={dob}
                  onChange={(e) => setDob(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Nationality</label>
                <input className="dialog-input w-full px-3 py-2.5 text-sm" value={nationality}
                  onChange={(e) => setNationality(e.target.value)} placeholder="e.g. Pakistani" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Profession / Occupation</label>
                <input className="dialog-input w-full px-3 py-2.5 text-sm" value={profession}
                  onChange={(e) => setProfession(e.target.value)} placeholder="e.g. Business" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-muted mb-1">Company Name</label>
                <input className="dialog-input w-full px-3 py-2.5 text-sm" value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">NTN Number</label>
                <input className="dialog-input w-full px-3 py-2.5 text-sm" value={ntn}
                  onChange={(e) => setNtn(e.target.value)} placeholder="NTN" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Company Registration No.</label>
                <input className="dialog-input w-full px-3 py-2.5 text-sm" value={companyReg}
                  onChange={(e) => setCompanyReg(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Authorized Person Name</label>
                <input className="dialog-input w-full px-3 py-2.5 text-sm" value={authPerson}
                  onChange={(e) => setAuthPerson(e.target.value)} placeholder="Authorized person" />
              </div>
            </>
          )}
        </div>

        <SectionLabel title="Contact Details" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4 rounded-xl"
          style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
          <div>
            <label className="block text-xs text-muted mb-1">Email</label>
            <input className="dialog-input w-full px-3 py-2.5 text-sm" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Phone <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <input className="dialog-input w-full px-3 py-2.5 text-sm" value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 1234567" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">WhatsApp Number</label>
            <div className="flex items-center gap-2">
              <input className="dialog-input flex-1 px-3 py-2.5 text-sm" value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp" disabled={whatsappSame} />
              <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={whatsappSame} className="accent-blue-500"
                  onChange={(e) => setWhatsappSame(e.target.checked)} />
                Same as phone
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Secondary Phone</label>
            <input className="dialog-input w-full px-3 py-2.5 text-sm" value={secondaryPhone}
              onChange={(e) => setSecondaryPhone(e.target.value)} placeholder="Alternate number" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-muted mb-1">Address</label>
            <textarea className="dialog-textarea" rows={2} value={address}
              onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">City</label>
            <input className="dialog-input w-full px-3 py-2.5 text-sm" value={city}
              onChange={(e) => setCity(e.target.value)} placeholder="City" />
          </div>
        </div>

        <SectionLabel title="Financial Information (KYC)" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Tax NTN</label>
            <input className="dialog-input w-full px-3 py-2.5 text-sm" value={taxNtn}
              onChange={(e) => setTaxNtn(e.target.value)} placeholder="Tax number" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Source of Funds</label>
            <select className="dialog-select w-full px-3 py-2.5 text-sm" value={sourceFunds}
              onChange={(e) => setSourceFunds(e.target.value)}>
              <option value="">— Select —</option>
              {SOURCE_FUNDS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Annual Income Range</label>
            <select className="dialog-select w-full px-3 py-2.5 text-sm" value={incomeRange}
              onChange={(e) => setIncomeRange(e.target.value)}>
              <option value="">— Select —</option>
              {INCOME_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Bank Name</label>
            <input className="dialog-input w-full px-3 py-2.5 text-sm" value={bankName}
              onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Bank Account No.</label>
            <input className="dialog-input w-full px-3 py-2.5 text-sm" value={bankAcct}
              onChange={(e) => setBankAcct(e.target.value)} placeholder="Account number" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">KYC Status</label>
            <select className="dialog-select w-full px-3 py-2.5 text-sm" value={kycStatus}
              onChange={(e) => setKycStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="in_review">In Review</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <SectionLabel title="KYC Documents" />
        <div className="p-4 rounded-xl space-y-2"
          style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
          {draftDocs.length === 0 && <p className="text-[10px] text-muted">No documents added yet.</p>}
          {draftDocs.map(doc => (
            <div key={doc._key} className="grid gap-2 items-center"
              style={{ gridTemplateColumns: "1fr 1fr auto" }}>
              <select className="dialog-select px-2 py-1.5 text-xs" value={doc.document_type}
                onChange={e => updDraftDoc(doc._key, "document_type", e.target.value)}>
                {DOC_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf,.doc,.docx,.png,.jpg,.jpeg";
                  input.onchange = () => {
                    const f = input.files?.[0];
                    if (f) updDraftDoc(doc._key, "file", f);
                  };
                  input.click();
                }}
                  className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg whitespace-nowrap"
                  style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
                  <Upload size={10} /> {doc.file ? doc.file.name.slice(0, 20) : "Choose file"}
                </button>
              </div>
              <button type="button" onClick={() => delDraftDoc(doc._key)}
                className="text-muted hover:text-red-400"><X size={12} /></button>
            </div>
          ))}
          <button type="button" onClick={addDraftDoc}
            className="flex items-center gap-1 text-[10px] mt-2" style={{ color: "#60a5fa" }}>
            <Plus size={10} /> Add Document
          </button>
        </div>

        <SectionLabel title="Notes" />
        <div>
          <label className="block text-xs text-muted mb-1">Internal Notes (staff only)</label>
          <textarea className="dialog-textarea" rows={2} value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)} placeholder="Internal notes not visible to contact" />
        </div>

        <button type="submit" disabled={submitting}
          className="btn-property w-full py-3 text-sm flex items-center justify-center gap-2">
          {submitting
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
            : editId ? "Update Contact" : "Save Contact"}
        </button>
      </form>
    </AppDialog>
  );
}
