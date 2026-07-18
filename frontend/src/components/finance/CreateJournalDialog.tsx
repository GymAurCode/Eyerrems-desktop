import { useState, useEffect } from "react";
import {
  FileText, Hash, Calendar, FolderOpen, Plus, Trash2, X, Check,
  Loader2, ArrowLeft, DollarSign, AlertTriangle, Search, Building2,
  User, Shield, Info, Layers, CreditCard, Settings, Eye
} from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import {
  journalsApi, accountsApi,
  type Journal, type JournalCreatePayload, type JournalEntryLine,
  type Account
} from "../../lib/financeApi";
import AppDialog from "../ui/AppDialog";
import AttachmentPanel from "../attachments/AttachmentPanel";
import { MODULE_COLORS } from "../../config/moduleColors";

const ACCENT = MODULE_COLORS.finance.primary;

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label} {required && <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Input(props: any) { return <input className="dialog-input w-full text-xs" {...props} />; }
function Select({ children, ...props }: any) { return <select className="dialog-select w-full text-xs" {...props}>{children}</select>; }

const REFERENCE_TYPES = [
  "manual", "adjustment", "transfer", "opening", "closing",
  "depreciation", "tax", "reversal", "correction", "write_off",
];

type Section = "info" | "source" | "lines" | "validation" | "attachments" | "approval" | "audit" | "reverse" | "summary";

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "info", label: "Journal Info", icon: FileText },
  { id: "source", label: "Source Document", icon: FolderOpen },
  { id: "lines", label: "Journal Lines", icon: Layers },
  { id: "validation", label: "Validation", icon: Check },
  { id: "attachments", label: "Attachments", icon: FileText },
  { id: "approval", label: "Approval", icon: Shield },
  { id: "audit", label: "Audit Trail", icon: Eye },
  { id: "reverse", label: "Reverse", icon: X },
  { id: "summary", label: "Summary", icon: Settings },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: JournalCreatePayload) => Promise<number>;
  accounts: Account[];
  editJournal?: Journal | null;
}

export default function CreateJournalDialog({ isOpen, onClose, onSubmit, accounts, editJournal }: Props) {
  const [section, setSection] = useState<Section>("info");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Section 1 - Info
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceType, setReferenceType] = useState("manual");
  const [referenceId, setReferenceId] = useState("");
  const [description, setDescription] = useState("");

  // Section 2 - Source Document
  const [sourceModule, setSourceModule] = useState("");
  const [sourceDocNumber, setSourceDocNumber] = useState("");
  const [sourceDocStatus, setSourceDocStatus] = useState("");
  const [sourceDocDate, setSourceDocDate] = useState("");

  // Section 3 - Lines
  const newLine = (): JournalEntryLine => ({
    account_id: 0, debit: 0, credit: 0, narration: "",
    cost_center: "", department: "", sort_order: 0,
  });
  const [lines, setLines] = useState<JournalEntryLine[]>([newLine(), newLine()]);
  const [accountSearch, setAccountSearch] = useState("");

  // Section 5 - Attachments
  const [internalNotes, setInternalNotes] = useState("");
  const [remarks, setRemarks] = useState("");

  // Load edit journal
  useEffect(() => {
    if (editJournal) {
      setDate(new Date(editJournal.date).toISOString().slice(0, 10));
      setReferenceType(editJournal.reference_type);
      setReferenceId(editJournal.reference_id || "");
      setDescription(editJournal.description || "");
      setSourceModule(editJournal.source_module || "");
      setSourceDocNumber(editJournal.source_document_number || "");
      setSourceDocStatus(editJournal.source_document_status || "");
      setSourceDocDate(editJournal.source_document_date ? new Date(editJournal.source_document_date).toISOString().slice(0, 10) : "");
      setInternalNotes(editJournal.internal_notes || "");
      setRemarks(editJournal.remarks || "");
      if (editJournal.entries?.length) {
        setLines(editJournal.entries.map(e => ({
          account_id: e.account_id, debit: Number(e.debit), credit: Number(e.credit),
          narration: e.narration || e.description || "",
          cost_center: e.cost_center || "", department: e.department || "",
          sort_order: e.sort_order || 0,
        })));
      }
    }
  }, [editJournal]);

  const filteredAccounts = accounts.filter(a =>
    a.account_type !== "Equity" || true
  ).filter(a =>
    !accountSearch || a.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
    a.code.toLowerCase().includes(accountSearch.toLowerCase())
  );

  const drTotal = lines.reduce((s, l) => s + Number(l.debit), 0);
  const crTotal = lines.reduce((s, l) => s + Number(l.credit), 0);
  const diff = Math.abs(drTotal - crTotal);
  const isBalanced = drTotal === crTotal && drTotal > 0;

  const addLine = () => setLines([...lines, { ...newLine(), sort_order: lines.length }]);
  const removeLine = (i: number) => { if (lines.length > 2) setLines(lines.filter((_, idx) => idx !== i)); };
  const updateLine = (i: number, field: keyof JournalEntryLine, value: any) => {
    const newLines = [...lines];
    (newLines[i] as any)[field] = value;
    setLines(newLines);
  };

  const resetForm = () => {
    setSection("info"); setCreatedId(null); setError("");
    setDate(new Date().toISOString().slice(0, 10));
    setReferenceType("manual"); setReferenceId(""); setDescription("");
    setSourceModule(""); setSourceDocNumber(""); setSourceDocStatus(""); setSourceDocDate("");
    setLines([newLine(), newLine()]); setAccountSearch("");
    setInternalNotes(""); setRemarks("");
  };

  const handleSubmit = async () => {
    if (!description) { setError("Description is required"); return; }
    if (!isBalanced) { setError("Journal must be balanced (Debits = Credits)"); return; }
    if (lines.some(l => !l.account_id)) { setError("All lines must have an account selected"); return; }
    setError(""); setLoading(true);
    try {
      const payload: JournalCreatePayload = {
        reference_type: referenceType, reference_id: referenceId || undefined,
        description, date, source: "MANUAL",
        source_module: sourceModule || undefined,
        source_document_number: sourceDocNumber || undefined,
        source_document_status: sourceDocStatus || undefined,
        source_document_date: sourceDocDate || undefined,
        internal_notes: internalNotes || undefined, remarks: remarks || undefined,
        lines: lines.map((l, i) => ({ ...l, sort_order: i })),
      };
      const id = await onSubmit(payload);
      setCreatedId(id);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to create journal");
    } finally { setLoading(false); }
  };

  if (createdId) {
    return (
      <AppDialog isOpen={isOpen} onClose={() => { setCreatedId(null); resetForm(); onClose(); }}
        title="Create Journal" subtitle="Journal created successfully" size="lg">
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <Check size={16} className="text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">Journal entry created successfully</p>
          </div>
          <AttachmentPanel module="finance" recordId={createdId} />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setCreatedId(null); resetForm(); }} className="btn-ghost px-4 py-2 text-xs">Add Another</button>
            <button onClick={() => { setCreatedId(null); resetForm(); onClose(); }} className="btn-primary px-4 py-2 text-xs">Done</button>
          </div>
        </div>
      </AppDialog>
    );
  }

  return (
    <AppDialog isOpen={isOpen} onClose={onClose}
      title={editJournal ? "Edit Journal" : "Create Journal Entry"}
      subtitle="Professional Double-Entry Accounting" size="2xl">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1 mb-3 p-1 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all ${section === s.id ? "text-white shadow-sm" : "text-muted hover:text-primary"}`}
              style={section === s.id ? { background: ACCENT } : {}}>
              <s.icon size={11} /> {s.label}
            </button>
          ))}
        </div>

        <div className="min-h-[350px] max-h-[65vh] overflow-y-auto pr-1 space-y-4">

          {/* Section 1: Journal Info */}
          {section === "info" && (
            <>
              <p className="text-xs font-semibold text-primary">Journal Information</p>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Journal Date" required>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </FormField>
                <FormField label="Reference Type" required>
                  <Select value={referenceType} onChange={e => setReferenceType(e.target.value)}>
                    {REFERENCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </Select>
                </FormField>
                <FormField label="Reference ID">
                  <Input value={referenceId} onChange={e => setReferenceId(e.target.value)} placeholder="e.g. INV-001" />
                </FormField>
              </div>
              <FormField label="Description" required>
                <textarea className="dialog-input w-full text-xs min-h-[60px] resize-y" value={description}
                  onChange={e => setDescription(e.target.value)} placeholder="Journal description / narration" />
              </FormField>
            </>
          )}

          {/* Section 2: Source Document */}
          {section === "source" && (
            <>
              <p className="text-xs font-semibold text-primary">Source Document</p>
              <p className="text-[10px] text-muted">If this journal is linked to another ERP module</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Source Module">
                  <Select value={sourceModule} onChange={e => setSourceModule(e.target.value)}>
                    <option value="">Not linked</option>
                    <option value="invoice">Invoice</option>
                    <option value="payment">Payment</option>
                    <option value="expense">Expense</option>
                    <option value="commission">Commission</option>
                    <option value="construction">Construction</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="payroll">Payroll</option>
                    <option value="bank">Bank</option>
                    <option value="asset">Asset</option>
                    <option value="inventory">Inventory</option>
                  </Select>
                </FormField>
                <FormField label="Document Number">
                  <Input value={sourceDocNumber} onChange={e => setSourceDocNumber(e.target.value)} placeholder="Auto-populated" />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Document Status">
                  <Input value={sourceDocStatus} onChange={e => setSourceDocStatus(e.target.value)} placeholder="Document status" />
                </FormField>
                <FormField label="Document Date">
                  <Input type="date" value={sourceDocDate} onChange={e => setSourceDocDate(e.target.value)} />
                </FormField>
              </div>
            </>
          )}

          {/* Section 3: Journal Lines */}
          {section === "lines" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-primary">Journal Lines</p>
                <button onClick={addLine} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-white" style={{ background: ACCENT }}>
                  <Plus size={11} /> Add Line
                </button>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {lines.map((line, i) => (
                  <div key={i} className="p-2.5 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-muted">Line #{i + 1}</span>
                      {lines.length > 2 && (
                        <button onClick={() => removeLine(i)} className="text-muted hover:text-red-400"><X size={11} /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-4">
                        <FormField label="Account">
                          <select className="dialog-select w-full text-[10px]" value={line.account_id || ""}
                            onChange={e => updateLine(i, "account_id", Number(e.target.value))}>
                            <option value="">Select account</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                            ))}
                          </select>
                        </FormField>
                      </div>
                      <div className="col-span-3">
                        <FormField label="Narration">
                          <input className="dialog-input w-full text-[10px]" value={line.narration || ""}
                            onChange={e => updateLine(i, "narration", e.target.value)} placeholder="Line narration" />
                        </FormField>
                      </div>
                      <div className="col-span-2">
                        <FormField label="Debit">
                          <input className="dialog-input w-full text-[10px]" type="number" step="0.01" value={line.debit || ""}
                            onChange={e => updateLine(i, "debit", Number(e.target.value))} />
                        </FormField>
                      </div>
                      <div className="col-span-2">
                        <FormField label="Credit">
                          <input className="dialog-input w-full text-[10px]" type="number" step="0.01" value={line.credit || ""}
                            onChange={e => updateLine(i, "credit", Number(e.target.value))} />
                        </FormField>
                      </div>
                      <div className="col-span-1 flex items-end pb-1">
                        <FormField label="Dim">
                          <button className="dialog-input w-full text-[10px] text-center" title="Set dimensions">+</button>
                        </FormField>
                      </div>
                    </div>
                    {/* Advanced dimensions - expandable */}
                    {(line.cost_center || line.department || line.project_id) && (
                      <div className="grid grid-cols-4 gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <FormField label="Cost Center">
                          <input className="dialog-input w-full text-[10px]" value={line.cost_center || ""}
                            onChange={e => updateLine(i, "cost_center", e.target.value)} placeholder="CC" />
                        </FormField>
                        <FormField label="Dept">
                          <input className="dialog-input w-full text-[10px]" value={line.department || ""}
                            onChange={e => updateLine(i, "department", e.target.value)} placeholder="Dept" />
                        </FormField>
                        <FormField label="Project ID">
                          <input className="dialog-input w-full text-[10px]" type="number" value={line.project_id || ""}
                            onChange={e => updateLine(i, "project_id", e.target.value ? Number(e.target.value) : null)} />
                        </FormField>
                        <FormField label="Tax Code">
                          <input className="dialog-input w-full text-[10px]" value={line.tax_code || ""}
                            onChange={e => updateLine(i, "tax_code", e.target.value)} placeholder="GST/SST" />
                        </FormField>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Section 4: Validation */}
          {section === "validation" && (
            <>
              <p className="text-xs font-semibold text-primary">Validation & Balance Check</p>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-xs">
                  <thead><tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
                    <th className="p-2 text-left text-muted">#</th>
                    <th className="p-2 text-left text-muted">Account</th>
                    <th className="p-2 text-left text-muted">Narration</th>
                    <th className="p-2 text-right text-muted">Debit</th>
                    <th className="p-2 text-right text-muted">Credit</th>
                  </tr></thead>
                  <tbody>
                    {lines.map((line, i) => {
                      const acc = accounts.find(a => a.id === line.account_id);
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td className="p-2 text-muted">{i + 1}</td>
                          <td className="p-2 text-primary text-[10px]">{acc ? `${acc.code} — ${acc.name}` : "—"}</td>
                          <td className="p-2 text-muted text-[10px]">{line.narration || "—"}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(line.debit)}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(line.credit)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--bg-card)" }}>
                      <td colSpan={3} className="p-2 text-xs font-semibold text-primary text-right">Totals</td>
                      <td className="p-2 text-right font-bold text-emerald-400">{formatCurrency(drTotal)}</td>
                      <td className="p-2 text-right font-bold text-emerald-400">{formatCurrency(crTotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="p-2 text-xs font-semibold text-primary text-right">Difference</td>
                      <td colSpan={2} className="p-2 text-right font-bold" style={{ color: isBalanced ? "#10b981" : "#ef4444" }}>
                        {isBalanced ? "✓ Balanced" : `${formatCurrency(diff)} (Unbalanced)`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {!isBalanced && (
                <div className="flex items-center gap-1.5 p-2 rounded text-[10px]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                  <AlertTriangle size={12} /> Journal is not balanced. Total Debits must equal Total Credits.
                </div>
              )}
            </>
          )}

          {/* Section 5: Attachments */}
          {section === "attachments" && (
            <>
              <p className="text-xs font-semibold text-primary">Attachments</p>
              {createdId ? (
                <AttachmentPanel module="finance" recordId={createdId} />
              ) : (
                <div className="p-8 rounded-lg text-center" style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}>
                  <FileText size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs text-muted">Save the journal first, then attach supporting documents</p>
                  <p className="text-[9px] text-muted mt-1">Invoices · Receipts · Bank Statements · Contracts · PDF · Images</p>
                </div>
              )}
            </>
          )}

          {/* Section 6: Approval */}
          {section === "approval" && (
            <>
              <p className="text-xs font-semibold text-primary">Approval Workflow</p>
              <div className="p-4 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 flex-wrap text-[10px]">
                  <span className="px-2 py-1 rounded" style={{ background: "rgba(148,163,184,0.15)", color: "#94a3b8" }}>Draft</span>
                  <span className="text-muted">→</span>
                  <span className="px-2 py-1 rounded" style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>Submitted</span>
                  <span className="text-muted">→</span>
                  <span className="px-2 py-1 rounded" style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>Approved</span>
                  <span className="text-muted">→</span>
                  <span className="px-2 py-1 rounded" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>Posted</span>
                </div>
                <p className="text-[10px] text-muted mt-3">Journal will be created as Draft. Use Submit → Approve → Post workflow.</p>
              </div>
              <FormField label="Internal Notes">
                <textarea className="dialog-input w-full text-xs min-h-[60px] resize-y" value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)} placeholder="Notes for approval workflow..." />
              </FormField>
            </>
          )}

          {/* Section 7: Audit Trail */}
          {section === "audit" && (
            <>
              <p className="text-xs font-semibold text-primary">Audit Trail</p>
              <div className="rounded-lg overflow-hidden text-xs" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full">
                  <tbody>
                    <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                      <td className="p-2.5 text-muted">Created By</td>
                      <td className="p-2.5 text-primary">Current User (auto-recorded)</td>
                    </tr>
                    <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                      <td className="p-2.5 text-muted">Created Date</td>
                      <td className="p-2.5 text-primary">{new Date().toLocaleString()}</td>
                    </tr>
                    <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                      <td className="p-2.5 text-muted">Status</td>
                      <td className="p-2.5"><span className="px-2 py-0.5 rounded text-[10px]" style={{ background: "rgba(148,163,184,0.15)", color: "#94a3b8" }}>Draft</span></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-muted">Permanence</td>
                      <td className="p-2.5 text-[10px] text-muted">Posted journals can NEVER be edited. Corrections use Reverse Journal.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <FormField label="Remarks">
                <textarea className="dialog-input w-full text-xs min-h-[60px] resize-y" value={remarks}
                  onChange={e => setRemarks(e.target.value)} placeholder="Additional remarks..." />
              </FormField>
            </>
          )}

          {/* Section 8: Reverse */}
          {section === "reverse" && (
            <>
              <p className="text-xs font-semibold text-primary">Reverse Journal</p>
              <div className="p-4 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "#ef4444" }} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: "#ef4444" }}>Never Edit Posted Journals</p>
                    <p className="text-[10px] text-muted mt-1">
                      Posted journals are permanent accounting records. To correct a posted journal, use the Reverse action on the journal detail view.
                      This automatically creates a new journal with opposite debit/credit values, linked to the original.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Section 9: Summary */}
          {section === "summary" && (
            <>
              <p className="text-xs font-semibold text-primary">Journal Summary</p>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                      <td className="p-2.5 text-muted">Date</td>
                      <td className="p-2.5 text-primary">{new Date(date).toLocaleDateString()}</td>
                    </tr>
                    <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                      <td className="p-2.5 text-muted">Reference Type</td>
                      <td className="p-2.5 text-primary capitalize">{referenceType.replace(/_/g, " ")}</td>
                    </tr>
                    <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                      <td className="p-2.5 text-muted">Description</td>
                      <td className="p-2.5 text-primary">{description || "—"}</td>
                    </tr>
                    <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                      <td className="p-2.5 text-muted">Lines</td>
                      <td className="p-2.5 text-primary">{lines.length}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-primary">Total Debit</td>
                      <td className="p-2.5 font-bold text-emerald-400">{formatCurrency(drTotal)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-primary">Total Credit</td>
                      <td className="p-2.5 font-bold text-emerald-400">{formatCurrency(crTotal)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-primary">Balanced</td>
                      <td className="p-2.5 font-bold">
                        {isBalanced
                          ? <span className="text-emerald-400">✓ Yes</span>
                          : <span className="text-red-400">✗ No — Diff: {formatCurrency(diff)}</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {error && <p className="text-[10px]" style={{ color: "#ef4444" }}>{error}</p>}

        <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => {
            const idx = SECTIONS.findIndex(s => s.id === section);
            if (idx > 0) setSection(SECTIONS[idx - 1].id);
          }} disabled={section === SECTIONS[0].id} className="btn-ghost px-3 py-1.5 text-[10px] flex items-center gap-1 disabled:opacity-30">
            <ArrowLeft size={12} /> Previous
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
            {section !== "summary" && (
              <button onClick={() => {
                const idx = SECTIONS.findIndex(s => s.id === section);
                if (idx < SECTIONS.length - 1) setSection(SECTIONS[idx + 1].id);
              }} className="btn-ghost px-4 py-2 text-xs">Next</button>
            )}
            {section === "summary" && (
              <button onClick={handleSubmit} disabled={loading || !isBalanced}
                className="btn-primary px-4 py-2 text-xs flex items-center gap-1">
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {editJournal ? "Update Journal" : "Create Journal"}
              </button>
            )}
          </div>
        </div>
      </div>
    </AppDialog>
  );
}
