import { useState, useEffect, FormEvent } from "react";
import { AlertTriangle, X, Plus, Upload } from "lucide-react";
import ModuleDialog from "../../ui/ModuleDialog";
import FormSection from "../../ui/FormSection";
import { propApi, Property, Unit, Buyer, Seller } from "../../../lib/propertyApi";
import { formatCurrency } from "../../../lib/currency";

interface RecordSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  properties: Property[];
  buyers: Buyer[];
  sellers: Seller[];
}

const STAGES = [
  "enquiry", "offer_made", "due_diligence", "spa_signed",
  "token_paid", "payment_processing", "transfer", "completed", "cancelled",
] as const;

const STAGE_LABELS: Record<string, string> = {
  enquiry: "Enquiry", offer_made: "Offer Made", due_diligence: "Due Diligence",
  spa_signed: "SPA Signed", token_paid: "Token Paid",
  payment_processing: "Payment Processing", transfer: "Transfer",
  completed: "Completed", cancelled: "Cancelled",
};

const PAYMENT_TYPES = ["full_cash", "mortgage", "instalment", "mixed"];

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SectionLabel({ title, optional }: { title: string; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{title}</span>
      {optional && <span className="text-[9px] text-muted">(optional)</span>}
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

interface DraftInstalment {
  _key: string;
  milestone_name: string;
  due_date: string;
  amount: string;
  status: string;
}

const inputClass = "w-full px-3 py-2.5 rounded-lg text-sm border transition-colors duration-150 outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--surface-input, #1A1D24)",
  borderColor: "var(--border, #2E3340)",
  color: "var(--text-primary, #E8ECF0)",
};

export default function RecordSaleDialog({ isOpen, onClose, onSaved, properties, buyers, sellers }: RecordSaleDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [propId, setPropId] = useState<number | "">("");
  const [unitId, setUnitId] = useState<number | "">("");
  const [buyerId, setBuyerId] = useState<number | "">("");
  const [sellerId, setSellerId] = useState<number | "">("");

  const [price, setPrice] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenDate, setTokenDate] = useState("");
  const [paymentType, setPaymentType] = useState("full_cash");
  const [bankName, setBankName] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [approvalDate, setApprovalDate] = useState("");
  const [commPct, setCommPct] = useState("");
  const [commAmount, setCommAmount] = useState("");
  const [commPaidTo, setCommPaidTo] = useState("");
  const [stampDuty, setStampDuty] = useState("");
  const [regFee, setRegFee] = useState("");

  const [agreementDate, setAgreementDate] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [deedNumber, setDeedNumber] = useState("");
  const [saleStage, setSaleStage] = useState("enquiry");
  const [cancelReason, setCancelReason] = useState("");

  const [saleAgreementFile, setSaleAgreementFile] = useState<File | null>(null);
  const [transferDeedFile, setTransferDeedFile] = useState<File | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);

  const [notes, setNotes] = useState("");

  const [instalMode, setInstalMode] = useState<"auto" | "manual">("auto");
  const [instalTotal, setInstalTotal] = useState("");
  const [instalCount, setInstalCount] = useState("");
  const [instalFreq, setInstalFreq] = useState("monthly");
  const [draftInsts, setDraftInsts] = useState<DraftInstalment[]>([]);

  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    if (!propId) { setUnits([]); setUnitId(""); return; }
    propApi.getUnits(Number(propId)).then(r => {
      const d = r && 'data' in r ? (r as any).data : r;
      setUnits(Array.isArray(d) ? d : []);
    });
  }, [propId]);

  useEffect(() => {
    if (price && commPct) {
      const p = Number(price);
      const c = Number(commPct);
      if (p > 0 && c > 0) {
        setCommAmount(String((p * c / 100).toFixed(2)));
      }
    }
  }, [price, commPct]);

  const reset = () => {
    setPropId(""); setUnitId(""); setBuyerId(""); setSellerId("");
    setPrice(""); setTokenAmount(""); setTokenDate("");
    setPaymentType("full_cash"); setBankName(""); setLoanAmount(""); setApprovalDate("");
    setCommPct(""); setCommAmount(""); setCommPaidTo("");
    setStampDuty(""); setRegFee("");
    setAgreementDate(""); setTransferDate(""); setDeedNumber("");
    setSaleStage("enquiry"); setCancelReason("");
    setNotes("");
    setSaleAgreementFile(null); setTransferDeedFile(null); setAdditionalFiles([]);
    setInstalMode("auto"); setInstalTotal(""); setInstalCount(""); setInstalFreq("monthly");
    setDraftInsts([]);
    setError("");
  };

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen]);

  const generateAutoInstalments = () => {
    const totalAmt = Number(instalTotal || price);
    const count = Number(instalCount);
    if (!totalAmt || !count || count < 1) return;
    const perInst = Math.round(totalAmt / count);
    const remainder = totalAmt - perInst * (count - 1);
    const startDate = agreementDate ? new Date(agreementDate) : new Date();
    const list: DraftInstalment[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(startDate);
      if (instalFreq === "monthly") d.setMonth(d.getMonth() + i);
      else if (instalFreq === "quarterly") d.setMonth(d.getMonth() + i * 3);
      else if (instalFreq === "custom") d.setMonth(d.getMonth() + i * 2);
      list.push({
        _key: `inst-${Date.now()}-${i}`,
        milestone_name: i === 0 ? "Booking" : i === count - 1 ? "Final Payment" : `Instalment ${i + 1}`,
        due_date: d.toISOString().split("T")[0],
        amount: String(i === count - 1 ? remainder : perInst),
        status: "pending",
      });
    }
    setDraftInsts(list);
  };

  const addManualInstalment = () => {
    setDraftInsts(prev => [...prev, {
      _key: `inst-${Date.now()}`,
      milestone_name: "",
      due_date: "",
      amount: "",
      status: "pending",
    }]);
  };

  const updInst = (key: string, field: keyof DraftInstalment, val: string) => {
    setDraftInsts(prev => prev.map(i => i._key === key ? { ...i, [field]: val } : i));
  };

  const delInst = (key: string) => {
    setDraftInsts(prev => prev.filter(i => i._key !== key));
  };

  const instalTotalCalc = draftInsts.reduce((s, i) => s + Number(i.amount || 0), 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!buyerId || !sellerId || !price) {
      setError("Buyer, Seller, and Sale Price are required.");
      return;
    }
    if (Number(price) <= 0) {
      setError("Sale price must be positive.");
      return;
    }

    let instalmentsToSend: any[] = [];
    if (paymentType === "instalment") {
      if (draftInsts.length === 0) {
        setError("Please add at least one instalment.");
        return;
      }
      const totalInst = draftInsts.reduce((s, i) => s + Number(i.amount), 0);
      if (Math.abs(totalInst - Number(price)) > 0.01) {
        setError(`Instalment total (${formatCurrency(totalInst)}) must equal Agreed Sale Price (${formatCurrency(Number(price))}).`);
        return;
      }
      instalmentsToSend = draftInsts.map(i => ({
        milestone_name: i.milestone_name,
        due_date: i.due_date,
        amount: Number(i.amount),
        status: i.status,
      }));
    }

    setSubmitting(true);
    try {
      const payload: any = {
        property_id: propId ? Number(propId) : null,
        unit_id: unitId ? Number(unitId) : null,
        buyer_id: Number(buyerId),
        seller_id: Number(sellerId),
        sale_price: Number(price),
        agreement_date: agreementDate || undefined,
        sale_date: agreementDate || undefined,
        sale_stage: saleStage,
        token_amount: tokenAmount ? Number(tokenAmount) : null,
        token_date: tokenDate || null,
        payment_type: paymentType,
        bank_name: paymentType === "mortgage" ? bankName : null,
        loan_amount: paymentType === "mortgage" && loanAmount ? Number(loanAmount) : null,
        approval_date: paymentType === "mortgage" ? (approvalDate || null) : null,
        commission_pct: commPct ? Number(commPct) : null,
        commission_amount: commAmount ? Number(commAmount) : null,
        commission_paid_to: commPaidTo || null,
        stamp_duty: stampDuty ? Number(stampDuty) : null,
        registration_fee: regFee ? Number(regFee) : null,
        transfer_date: transferDate || null,
        transfer_deed_number: deedNumber || null,
        cancellation_reason: saleStage === "cancelled" ? (cancelReason || null) : null,
        notes: notes || null,
        instalments: instalmentsToSend,
      };

      const created = await propApi.createSale(payload);
      const newSaleId = created.id;

      if (saleAgreementFile) {
        await propApi.uploadSaleDocument(newSaleId, saleAgreementFile, "sale_agreement");
      }
      if (transferDeedFile) {
        await propApi.uploadSaleDocument(newSaleId, transferDeedFile, "transfer_deed");
      }
      for (const f of additionalFiles) {
        await propApi.uploadSaleDocument(newSaleId, f, "additional");
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to create sale.");
    } finally { setSubmitting(false); }
  };

  return (
    <ModuleDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Record Sale"
      size="xl"
    >
      <form onSubmit={submit} className="space-y-6">
        {error && (
          <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2"
            style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        <FormSection title="Property & Parties">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>Property</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={propId}
                onChange={(e) => setPropId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">— Optional —</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.tid} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>Unit</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={unitId}
                onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">— Optional —</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.tid} — {u.unit_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>Buyer *</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={buyerId}
                onChange={(e) => setBuyerId(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">— Select buyer —</option>
                {buyers.map((b) => <option key={b.id} value={b.id}>{b.tid} — {b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>Seller *</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={sellerId}
                onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">— Select seller —</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.tid} — {s.name}</option>)}
              </select>
            </div>
          </div>
        </FormSection>

        <FormSection title="Deal Financial Details">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 p-4 rounded-xl"
            style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <div>
              <label className="block text-xs text-muted mb-1">Agreed Sale Price (Rs) *</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={price}
                onChange={(e) => setPrice(e.target.value)} required min="1" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Token / Booking Amount (Rs)</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)} placeholder="Initial amount" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Token Date</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={tokenDate}
                onChange={(e) => setTokenDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Payment Type</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}>
                <option value="full_cash">Full Cash</option>
                <option value="mortgage">Mortgage</option>
                <option value="instalment">Instalment Plan</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            {paymentType === "mortgage" && (
              <>
                <div>
                  <label className="block text-xs text-muted mb-1">Bank Name</label>
                  <input className="input-dark w-full px-3 py-2.5 text-sm" value={bankName}
                    onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Loan Amount (Rs)</label>
                  <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Approval Date</label>
                  <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={approvalDate}
                    onChange={(e) => setApprovalDate(e.target.value)} />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs text-muted mb-1">Commission %</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" step="0.1" value={commPct}
                onChange={(e) => setCommPct(e.target.value)} placeholder="e.g. 2.5" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Commission Amount (Rs)</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={commAmount}
                onChange={(e) => setCommAmount(e.target.value)} placeholder="Auto-calculated" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Commission Paid To</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" value={commPaidTo}
                onChange={(e) => setCommPaidTo(e.target.value)} placeholder="Agent name" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Stamp Duty (Rs)</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={stampDuty}
                onChange={(e) => setStampDuty(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Registration Fee (Rs)</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={regFee}
                onChange={(e) => setRegFee(e.target.value)} />
            </div>
          </div>
        </FormSection>

        {paymentType === "instalment" && (
          <div className="p-4 rounded-xl" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <SectionLabel title="Instalment Plan" />
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer">
                <input type="radio" name="instalMode" checked={instalMode === "auto"}
                  onChange={() => setInstalMode("auto")} className="accent-blue-500" />
                Auto Generate
              </label>
              <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer">
                <input type="radio" name="instalMode" checked={instalMode === "manual"}
                  onChange={() => setInstalMode("manual")} className="accent-blue-500" />
                Manual Entry
              </label>
            </div>

            {instalMode === "auto" ? (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-muted mb-1">Total Amount (Rs)</label>
                  <input className="input-dark w-full px-3 py-2 text-sm" type="number" value={instalTotal}
                    onChange={(e) => setInstalTotal(e.target.value)} placeholder={price || "Sale price"} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Number of Instalments</label>
                  <input className="input-dark w-full px-3 py-2 text-sm" type="number" min="1" value={instalCount}
                    onChange={(e) => setInstalCount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Frequency</label>
                  <select className="select-dark w-full px-3 py-2 text-sm" value={instalFreq}
                    onChange={(e) => setInstalFreq(e.target.value)}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="custom">Custom (2 months)</option>
                  </select>
                </div>
                <div className="col-span-3">
                  <button type="button" onClick={generateAutoInstalments}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
                    Generate Schedule
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-3">
                <button type="button" onClick={addManualInstalment}
                  className="flex items-center gap-1 text-xs mb-3" style={{ color: "#60a5fa" }}>
                  <Plus size={11} /> Add Instalment
                </button>
              </div>
            )}

            {draftInsts.length > 0 && (
              <div className="space-y-2">
                <div className="grid gap-2 text-[10px] text-muted font-medium px-2"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr 80px auto" }}>
                  <span>Milestone</span><span>Due Date</span><span>Amount (Rs)</span><span>Status</span><span />
                </div>
                {draftInsts.map(inst => (
                  <div key={inst._key} className="grid gap-1.5 items-center"
                    style={{ gridTemplateColumns: "1fr 1fr 1fr 80px auto" }}>
                    <input className="input-dark px-2 py-1.5 text-xs" value={inst.milestone_name}
                      onChange={e => updInst(inst._key, "milestone_name", e.target.value)} placeholder="Milestone" />
                    <input className="input-dark px-2 py-1.5 text-xs" type="date" value={inst.due_date}
                      onChange={e => updInst(inst._key, "due_date", e.target.value)} />
                    <input className="input-dark px-2 py-1.5 text-xs" type="number" value={inst.amount}
                      onChange={e => updInst(inst._key, "amount", e.target.value)} placeholder="Amount" />
                    <select className="select-dark px-2 py-1.5 text-xs" value={inst.status}
                      onChange={e => updInst(inst._key, "status", e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                    <button type="button" onClick={() => delInst(inst._key)}
                      className="text-muted hover:text-red-400 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 text-xs"
                  style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-muted">Running Total:</span>
                  <span className="font-semibold" style={{ color: instalTotalCalc === Number(price) ? "#10b981" : "#f59e0b" }}>
                    {formatCurrency(instalTotalCalc)}
                    {instalTotalCalc !== Number(price) && price && ` / ${formatCurrency(Number(price))}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <FormSection title="Legal & Registration">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <label className="block text-xs text-muted mb-1">Agreement Date *</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={agreementDate}
                onChange={(e) => setAgreementDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Transfer / Registration Date</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Transfer Deed Number</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" value={deedNumber}
                onChange={(e) => setDeedNumber(e.target.value)} placeholder="Deed #" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Sale Stage</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={saleStage}
                onChange={(e) => setSaleStage(e.target.value)}>
                {STAGES.map(s => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            {saleStage === "cancelled" && (
              <div className="md:col-span-2">
                <label className="block text-xs text-muted mb-1">Cancellation Reason *</label>
                <input className="input-dark w-full px-3 py-2.5 text-sm" value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation" required />
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title="Documents">
          <div className="p-4 rounded-xl space-y-3"
            style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Sale Agreement / SPA</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => document.getElementById("sale-agreement-input")?.click()}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
                  style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
                  <Upload size={11} /> {saleAgreementFile ? "Change" : "Upload"}
                </button>
                {saleAgreementFile && <span className="text-[10px] text-muted">{saleAgreementFile.name}</span>}
                <input id="sale-agreement-input" type="file" accept=".pdf,.doc,.docx,.png,.jpg" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setSaleAgreementFile(f); e.target.value = ""; }} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Transfer Deed</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => document.getElementById("transfer-deed-input")?.click()}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
                  style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
                  <Upload size={11} /> {transferDeedFile ? "Change" : "Upload"}
                </button>
                {transferDeedFile && <span className="text-[10px] text-muted">{transferDeedFile.name}</span>}
                <input id="transfer-deed-input" type="file" accept=".pdf,.doc,.docx,.png,.jpg" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setTransferDeedFile(f); e.target.value = ""; }} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Additional Attachments</span>
              <button type="button" onClick={() => document.getElementById("additional-files-input")?.click()}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
                style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
                <Upload size={11} /> Add Files
              </button>
              <input id="additional-files-input" type="file" multiple className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) setAdditionalFiles(prev => [...prev, ...Array.from(files)]);
                  e.target.value = "";
                }} />
            </div>
            {additionalFiles.length > 0 && (
              <div className="space-y-1">
                {additionalFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-2 py-1 rounded"
                    style={{ background: "var(--bg-surface)" }}>
                    <span className="text-[10px] text-secondary">{f.name}</span>
                    <button type="button" onClick={() => setAdditionalFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-muted hover:text-red-400">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormSection>

        <div>
          <label className="block text-xs text-muted mb-1">Notes</label>
          <textarea className="input-dark w-full px-4 py-2.5 text-sm resize-none" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>

        <button type="submit" disabled={submitting}
          className="btn-property w-full py-3 text-sm flex items-center justify-center gap-2">
          {submitting
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
            : "Record Sale"}
        </button>
      </form>
    </ModuleDialog>
  );
}
