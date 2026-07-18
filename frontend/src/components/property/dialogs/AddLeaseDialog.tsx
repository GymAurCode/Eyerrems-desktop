import { useState, useEffect, FormEvent } from "react";
import {
  Plus, X, ChevronDown, ChevronRight, UserPlus, AlertTriangle, Upload, FileText
} from "lucide-react";
import AppDialog from "../../ui/AppDialog";
import FormSection from "../../ui/FormSection";
import FileUpload from "../../ui/FileUpload";
import { propApi, Property, Unit, Lease } from "../../../lib/propertyApi";
import { tenantApi, Tenant } from "../../../lib/tenantApi";
import { syncApi } from "../../../lib/financeApi";
import { useNotifStore } from "../../../store/notifications";

interface AddLeaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const PAY_FREQ = ["monthly", "quarterly", "every_4_months", "bi_annual", "annual"];
const PAY_METHODS = ["cash", "bank_transfer", "cheque", "online"];

interface DraftPdc { _key: string; cheque_no: string; amount: string; due_date: string; }

export default function AddLeaseDialog({ isOpen, onClose, onSaved }: AddLeaseDialogProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pushToast = useNotifStore((s) => s.pushToast);

  const [propId, setPropId] = useState<number | "">("");
  const [unitId, setUnitId] = useState<number | "">("");
  const [tenantId, setTenantId] = useState<number | "">("");
  const [tenantName, setTenantName] = useState("");
  const [showNewTenant, setShowNewTenant] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantPhone, setNewTenantPhone] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [annualRent, setAnnualRent] = useState("");
  const [payFreq, setPayFreq] = useState("monthly");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [depositStatus, setDepositStatus] = useState("pending");
  const [noticePeriod, setNoticePeriod] = useState("30");

  const [gracePeriod, setGracePeriod] = useState("5");
  const [lateFeeType, setLateFeeType] = useState("");
  const [lateFeeValue, setLateFeeValue] = useState("");

  const [payMethod, setPayMethod] = useState("cash");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [pdcs, setPdcs] = useState<DraftPdc[]>([]);

  const [renewalExpanded, setRenewalExpanded] = useState(false);
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [renewalDuration, setRenewalDuration] = useState("");
  const [rentIncreasePct, setRentIncreasePct] = useState("");

  const [leaseFile, setLeaseFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    reset();
    propApi.getProperties().then(r => setProperties(Array.isArray(r) ? r : []));
    tenantApi.list().then(r => setTenants(Array.isArray(r) ? r : [])).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!propId) { setUnits([]); setUnitId(""); return; }
    propApi.getUnits(Number(propId)).then(r => setUnits(Array.isArray(r) ? r : []));
  }, [propId]);

  useEffect(() => {
    if (monthlyRent) setAnnualRent((Number(monthlyRent) * 12).toFixed(2));
    else setAnnualRent("");
  }, [monthlyRent]);

  useEffect(() => {
    if (startDate && !firstDueDate) setFirstDueDate(startDate);
  }, [startDate]);

  const reset = () => {
    setPropId(""); setUnitId(""); setTenantId(""); setTenantName("");
    setShowNewTenant(false); setNewTenantName(""); setNewTenantPhone("");
    setStartDate(""); setEndDate(""); setMonthlyRent(""); setAnnualRent("");
    setPayFreq("monthly"); setFirstDueDate(""); setSecurityDeposit("");
    setDepositStatus("pending"); setNoticePeriod("30");
    setGracePeriod("5"); setLateFeeType(""); setLateFeeValue("");
    setPayMethod("cash"); setBankName(""); setBankAccount(""); setPdcs([]);
    setRenewalExpanded(false); setAutoRenewal(false); setRenewalDuration(""); setRentIncreasePct("");
    setLeaseFile(null);
    setError("");
  };

  const quickAddTenant = async () => {
    if (!newTenantName.trim() || !newTenantPhone.trim()) return;
    try {
      const t = await tenantApi.create({ tenant: { name: newTenantName.trim(), phone: newTenantPhone.trim() }, lease: null as any });
      const data = t && 'data' in t ? (t as any).data : t;
      if (data?.id) {
        setTenants(prev => [...prev, data]);
        setTenantId(data.id);
        setTenantName(data.name);
      }
      pushToast({ title: "Created", message: `Tenant ${data.name} created`, type: "success" });
      setShowNewTenant(false); setNewTenantName(""); setNewTenantPhone("");
    } catch {}
  };

  const monthsBetween = (start: string, end: string): number => {
    const s = new Date(start), e = new Date(end);
    return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!unitId) { setError("Unit is required."); return; }
    if (!startDate || !endDate) { setError("Start and end dates are required."); return; }
    if (new Date(endDate) <= new Date(startDate)) { setError("End date must be after start date."); return; }
    if (!monthlyRent || Number(monthlyRent) <= 0) { setError("Monthly rent must be positive."); return; }

    setSubmitting(true);
    try {
      const payload = {
        property_id: propId ? Number(propId) : null,
        unit_id: Number(unitId),
        tenant_name: tenantName || null,
        tenant_id: tenantId ? Number(tenantId) : null,
        start_date: startDate,
        end_date: endDate,
        monthly_rent: Number(monthlyRent),
        annual_rent: annualRent ? Number(annualRent) : null,
        payment_frequency: payFreq,
        first_payment_due_date: firstDueDate || startDate,
        security_deposit: securityDeposit ? Number(securityDeposit) : null,
        deposit_status: depositStatus,
        notice_period: Number(noticePeriod),
        grace_period: Number(gracePeriod),
        late_fee_type: lateFeeType || null,
        late_fee_value: lateFeeValue ? Number(lateFeeValue) : null,
        payment_method: payMethod,
        bank_name: payMethod === "cheque" ? bankName : null,
        bank_account_details: payMethod === "bank_transfer" ? bankAccount : null,
        auto_renewal: autoRenewal,
        renewal_duration_months: autoRenewal && renewalDuration ? Number(renewalDuration) : null,
        rent_increase_pct: autoRenewal && rentIncreasePct ? Number(rentIncreasePct) : null,
        pdcs: pdcs.map(p => ({ cheque_no: p.cheque_no, amount: Number(p.amount), due_date: p.due_date })),
      };

      const createdLease = await propApi.createLease(payload);
      pushToast({ title: "Created", message: "Lease created successfully", type: "success" });

      // Sync security deposit to finance
      if (securityDeposit && Number(securityDeposit) > 0) {
        syncApi.securityDeposit({
          lease_id: createdLease.id,
          amount: Number(securityDeposit),
          tenant_name: tenantName || "",
          unit_name: "",
        }).catch(() => {});
      }

      if (leaseFile) {
        const createdLeases = await propApi.getLeases();
        const latest = createdLeases[0];
        if (latest?.id) await propApi.uploadLeaseDocument(latest.id, leaseFile, "lease_agreement");
      }

      reset();
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to create lease.");
    } finally { setSubmitting(false); }
  };

  const addPdc = () => setPdcs(prev => [...prev, { _key: `pdc-${Date.now()}`, cheque_no: "", amount: "", due_date: "" }]);
  const updPdc = (key: string, field: keyof DraftPdc, val: string) =>
    setPdcs(prev => prev.map(p => p._key === key ? { ...p, [field]: val } : p));
  const delPdc = (key: string) => setPdcs(prev => prev.filter(p => p._key !== key));

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title="New Lease"
      subtitle="Create a new lease agreement"
      icon={<FileText size={18} style={{ color: "var(--property-accent, #34D399)" }} />}
      size="xl"
      footer={
        <>
          <button type="button" onClick={() => { reset(); onClose(); }}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              border: "1px solid var(--border, #2E3340)",
              color: "var(--text-secondary, #9BA3AF)",
              background: "transparent",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover, #2C3140)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            Cancel
          </button>
          <button type="button" onClick={(e) => submit(e as any)}
            disabled={submitting}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={{
              background: "var(--property-accent, #34D399)",
              color: "#fff",
              opacity: submitting ? 0.6 : 1,
            }}>
            {submitting && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {submitting ? "Creating..." : "Create Lease"}
          </button>
        </>
      }>
      <form onSubmit={submit}>
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-xs border flex items-center gap-2"
            style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {/* ── Section 1: Lease Parties ── */}
        <FormSection title="Lease Parties">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Property
              </label>
              <select className="dialog-select" value={propId}
                onChange={(e) => setPropId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select property</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.tid} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Unit <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>
              </label>
              <select className="dialog-select" value={unitId}
                onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select unit</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.tid} — Unit {u.unit_number}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Tenant <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>
              </label>
              {showNewTenant ? (
                <div className="flex items-center gap-2">
                  <input className="dialog-input" value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)} placeholder="Tenant name" />
                  <input className="dialog-input w-36" value={newTenantPhone}
                    onChange={(e) => setNewTenantPhone(e.target.value)} placeholder="Phone" />
                  <button type="button" onClick={() => void quickAddTenant()}
                    className="px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0"
                    style={{ background: "var(--property-accent, #34D399)", color: "#fff" }}>
                    Add
                  </button>
                  <button type="button" onClick={() => setShowNewTenant(false)}
                    className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select className="dialog-select" value={tenantId}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : "";
                      setTenantId(id);
                      const t = tenants.find(t2 => t2.id === id);
                      setTenantName(t?.name || "");
                    }}>
                    <option value="">Select tenant</option>
                    {tenants.map((t) => <option key={t.id} value={t.id}>{t.tenant_id} — {t.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewTenant(true)}
                    className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg whitespace-nowrap"
                    style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
                    <UserPlus size={12} /> + New Tenant
                  </button>
                </div>
              )}
            </div>
          </div>
        </FormSection>

        {/* ── Section 2: Lease Terms ── */}
        <FormSection title="Lease Terms">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Start Date <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>
              </label>
              <input type="date" className="dialog-input" value={startDate}
                onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                End Date <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>
              </label>
              <input type="date" className="dialog-input" value={endDate}
                onChange={(e) => setEndDate(e.target.value)} />
            </div>
            {startDate && endDate && new Date(endDate) > new Date(startDate) && (
              <div className="flex items-end pb-2.5">
                <span className="text-xs font-medium" style={{ color: "#60a5fa" }}>
                  Duration: {monthsBetween(startDate, endDate)} months
                </span>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Rent Amount (Rs/month) <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>
              </label>
              <input type="number" className="dialog-input" value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Payment Frequency
              </label>
              <select className="dialog-select" value={payFreq}
                onChange={(e) => setPayFreq(e.target.value)}>
                {PAY_FREQ.map(f => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Security Deposit (Rs)
              </label>
              <input type="number" className="dialog-input" value={securityDeposit}
                onChange={(e) => setSecurityDeposit(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                First Due Date
              </label>
              <input type="date" className="dialog-input" value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Notice Period (days)
              </label>
              <input type="number" className="dialog-input" value={noticePeriod}
                onChange={(e) => setNoticePeriod(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Annual Rent (auto)
              </label>
              <input type="number" className="dialog-input" value={annualRent} readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Deposit Status
              </label>
              <select className="dialog-select" value={depositStatus}
                onChange={(e) => setDepositStatus(e.target.value)}>
                <option value="pending">Pending</option>
                <option value="received">Received</option>
                <option value="waived">Waived</option>
              </select>
            </div>
          </div>

          {/* ── Optional: Renewal ── */}
          <div className="mt-4">
            <button type="button" onClick={() => setRenewalExpanded(v => !v)}
              className="w-full flex items-center gap-2 py-2">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted, #6B7280)" }}>
                Renewal Terms
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted, #6B7280)" }}>(optional)</span>
              <div className="flex-1 h-px" style={{ background: "var(--border-subtle, #252932)" }} />
              {renewalExpanded
                ? <ChevronDown size={12} style={{ color: "var(--text-muted, #6B7280)" }} />
                : <ChevronRight size={12} style={{ color: "var(--text-muted, #6B7280)" }} />}
            </button>
            {renewalExpanded && (
              <div className="mt-3 flex flex-col gap-3">
                <label className="relative inline-flex items-center cursor-pointer gap-3">
                  <input type="checkbox" className="sr-only peer" checked={autoRenewal}
                    onChange={() => setAutoRenewal(!autoRenewal)} />
                  <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                    style={{ background: autoRenewal ? "var(--property-accent, #34D399)" : "var(--bg-active, #313849)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary, #9BA3AF)" }}>Auto-Renewal</span>
                </label>
                {autoRenewal && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                        Renewal Duration (months)
                      </label>
                      <input type="number" className="dialog-input" value={renewalDuration}
                        onChange={(e) => setRenewalDuration(e.target.value)} placeholder="e.g. 12" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                        Rent Increase (%)
                      </label>
                      <input type="number" className="dialog-input" value={rentIncreasePct}
                        onChange={(e) => setRentIncreasePct(e.target.value)} placeholder="e.g. 10" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </FormSection>

        {/* ── Section 3: Payment Details ── */}
        <FormSection title="Payment Details">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Payment Method
              </label>
              <select className="dialog-select" value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}>
                {PAY_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Grace Period (days)
              </label>
              <input type="number" className="dialog-input" value={gracePeriod}
                onChange={(e) => setGracePeriod(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Late Fee
              </label>
              <div className="flex gap-2">
                <select className="dialog-select w-24 shrink-0" value={lateFeeType}
                  onChange={(e) => setLateFeeType(e.target.value)}>
                  <option value="">None</option>
                  <option value="fixed">Fixed</option>
                  <option value="percentage">%</option>
                </select>
                <input type="number" className="dialog-input" value={lateFeeValue}
                  onChange={(e) => setLateFeeValue(e.target.value)}
                  placeholder={lateFeeType === "percentage" ? "%" : "Rs"} />
              </div>
            </div>
          </div>

          {payMethod === "cheque" && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-xs font-medium" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                  Bank Name
                </label>
                <input className="dialog-input max-w-xs" value={bankName}
                  onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" />
                <button type="button" onClick={addPdc}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded ml-auto"
                  style={{ color: "var(--property-accent, #34D399)", background: "var(--property-accent-soft, rgba(52,211,153,0.12))" }}>
                  <Plus size={11} /> Add PDC
                </button>
              </div>
              {pdcs.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {pdcs.map(pdc => (
                    <div key={pdc._key} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: "1fr 1fr 1fr auto" }}>
                      <input className="dialog-input" value={pdc.cheque_no}
                        onChange={e => updPdc(pdc._key, "cheque_no", e.target.value)} placeholder="Cheque No." />
                      <input type="number" className="dialog-input" value={pdc.amount}
                        onChange={e => updPdc(pdc._key, "amount", e.target.value)} placeholder="Amount" />
                      <input type="date" className="dialog-input" value={pdc.due_date}
                        onChange={e => updPdc(pdc._key, "due_date", e.target.value)} />
                      <button type="button" onClick={() => delPdc(pdc._key)}
                        className="p-1 rounded transition-colors" style={{ color: "var(--text-muted, #6B7280)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted, #6B7280)")}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {payMethod === "bank_transfer" && (
            <div className="mt-3">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Bank Account Details
              </label>
              <input className="dialog-input" value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)} placeholder="Account name, IBAN, bank name" />
            </div>
          )}
        </FormSection>

        {/* ── Section 4: Documents ── */}
        <FormSection title="Documents">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
              Signed Lease Agreement (PDF)
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => document.getElementById("lease-file-input")?.click()}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors"
                style={{ border: "1px solid var(--border, #2E3340)", color: "var(--text-secondary, #9BA3AF)" }}>
                <Upload size={12} /> {leaseFile ? "Change" : "Upload"}
              </button>
              {leaseFile && <span className="text-xs" style={{ color: "var(--text-muted, #6B7280)" }}>{leaseFile.name}</span>}
              <input id="lease-file-input" type="file" accept=".pdf,.doc,.docx,.png,.jpg" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLeaseFile(f); } e.target.value = ""; }} />
            </div>
          </div>
        </FormSection>
        <div className="pt-2">
          <FileUpload module="properties" recordType="lease" recordId="" compact documentTypes={["Lease Agreement", "Security Deposit Receipt", "Condition Report", "Other"]} />
        </div>
      </form>
    </AppDialog>
  );
}
