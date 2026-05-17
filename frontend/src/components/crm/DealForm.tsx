import { FormEvent, useEffect, useId, useState } from "react";
import Modal from "../Modal";
import { FormField, ReadOnlyField } from "./FormField";
import { crmApi, Deal, Client, Dealer } from "../../lib/crmApi";
import { propApi } from "../../lib/propertyApi";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (d: Deal) => void;
  initial?: Deal | null;
};

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest shrink-0"
        style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

export default function DealForm({ open, onClose, onSaved, initial }: Props) {
  const formId  = useId();
  const editing = !!initial;

  const [title, setTitle]                   = useState("");
  const [clientId, setClientId]             = useState<number | "">("");
  const [trackingId, setTrackingId]         = useState("");
  const [propId, setPropId]                 = useState<number | "">("");
  const [unitId, setUnitId]                 = useState<number | "">("");
  const [dealerId, setDealerId]             = useState<number | "">("");
  const [role, setRole]                     = useState("");
  const [value, setValue]                   = useState("");
  const [downPay, setDownPay]               = useState("");
  const [downPayStatus, setDownPayStatus]   = useState("pending");
  const [status, setStatus]                 = useState("pending");
  const [dealDate, setDealDate]             = useState("");
  const [dueDate, setDueDate]               = useState("");
  const [desc, setDesc]                     = useState("");

  const [clients, setClients]       = useState<Client[]>([]);
  const [dealers, setDealers]       = useState<Dealer[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits]           = useState<any[]>([]);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      crmApi.getClients(), crmApi.getDealers(),
      propApi.getProperties(), propApi.getUnits(),
    ]).then(([c, d, p, u]) => {
      setClients(c.data); setDealers(d.data);
      setProperties(p.data); setUnits(u.data);
    });
    if (initial) {
      setTitle(initial.deal_title ?? ""); setClientId(initial.client_id);
      setTrackingId(initial.tracking_id); setPropId(initial.property_id ?? "");
      setUnitId(initial.unit_id ?? ""); setDealerId(initial.dealer_id ?? "");
      setRole(initial.client_role ?? ""); setValue(initial.deal_value);
      setDownPay(initial.down_payment ?? ""); setDownPayStatus(initial.down_payment_status);
      setStatus(initial.status); setDealDate(initial.deal_date ?? "");
      setDueDate(initial.due_date ?? ""); setDesc(initial.description ?? "");
    } else {
      setTitle(""); setClientId(""); setTrackingId(""); setPropId(""); setUnitId("");
      setDealerId(""); setRole(""); setValue(""); setDownPay(""); setDownPayStatus("pending");
      setStatus("pending"); setDealDate(""); setDueDate(""); setDesc("");
    }
    setErrors({});
  }, [open, initial]);

  const onClientChange = (cid: number | "") => {
    setClientId(cid);
    setTrackingId(cid ? (clients.find((x) => x.id === cid)?.tracking_id ?? "") : "");
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title  = "Required";
    if (!clientId)     e.client = "Required";
    if (!value)        e.value  = "Required";
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
        property_id: propId || null, unit_id: unitId || null,
        dealer_id: dealerId || null, client_role: role || null,
        deal_value: Number(value), down_payment: downPay ? Number(downPay) : null,
        down_payment_status: downPayStatus, status,
        deal_date: dealDate || null, due_date: dueDate || null,
        description: desc || null,
      };
      const res = editing
        ? await crmApi.updateDeal(initial!.id, payload)
        : await crmApi.createDeal(payload);
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

  const remaining = value && downPay ? Number(value) - Number(downPay) : null;

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
    <Modal open={open} onClose={onClose} title={editing ? "Edit Deal" : "New Deal"}
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
          <div className="grid grid-cols-4 gap-3 mb-4">
            <ReadOnlyField label="Deal ID"     value={initial.deal_id} />
            <ReadOnlyField label="Tracking ID" value={initial.tracking_id} span="2" />
            <div />
          </div>
        )}

        {/* ── Two-panel side-by-side layout ── */}
        <div className="grid grid-cols-2 gap-x-8">

          {/* LEFT — Deal Info + Property */}
          <div className="space-y-3">
            <Divider label="Deal Info" />

            <FormField label="Deal Title" required error={errors.title}>
              <input className="input-dark w-full px-3 py-2 text-sm" value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Property Sale — DHA Phase 1" />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Client" required error={errors.client}>
                <select className="select-dark w-full px-3 py-2 text-sm" value={clientId}
                  onChange={(e) => onClientChange(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— Select Client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.client_id})</option>
                  ))}
                </select>
              </FormField>

              {/* Tracking ID auto-fill display */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Tracking ID
                </label>
                <div className="px-3 py-2 rounded-lg text-sm font-mono"
                  style={{
                    background: trackingId ? "rgba(59,130,246,0.06)" : "var(--bg-base)",
                    border: `1px solid ${trackingId ? "rgba(59,130,246,0.2)" : "var(--border)"}`,
                    color: trackingId ? "#60a5fa" : "var(--text-muted)",
                    minHeight: "36px", display: "flex", alignItems: "center",
                  }}>
                  {trackingId || "Auto-filled"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Client Role">
                <select className="select-dark w-full px-3 py-2 text-sm" value={role}
                  onChange={(e) => setRole(e.target.value)}>
                  <option value="">— None —</option>
                  <option value="Buyer">Buyer</option>
                  <option value="Seller">Seller</option>
                  <option value="Investor">Investor</option>
                </select>
              </FormField>
              <FormField label="Assign Dealer">
                <select className="select-dark w-full px-3 py-2 text-sm" value={dealerId}
                  onChange={(e) => setDealerId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— None —</option>
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <Divider label="Property" />

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Property">
                <select className="select-dark w-full px-3 py-2 text-sm" value={propId}
                  onChange={(e) => setPropId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— None —</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.tid})</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Unit">
                <select className="select-dark w-full px-3 py-2 text-sm" value={unitId}
                  onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— None —</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.unit_number} ({u.tid})</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Description">
              <textarea className="input-dark w-full px-3 py-2 text-sm resize-none" rows={3}
                value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="Deal description or notes…" />
            </FormField>
          </div>

          {/* RIGHT — Financial + Status/Dates */}
          <div className="space-y-3">
            <Divider label="Financial" />

            <FormField label="Deal Value" required error={errors.value}>
              <input className="input-dark w-full px-3 py-2 text-sm" type="number"
                min="0" step="0.01" value={value}
                onChange={(e) => setValue(e.target.value)} placeholder="Total deal value" />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Down Payment">
                <input className="input-dark w-full px-3 py-2 text-sm" type="number"
                  min="0" step="0.01" value={downPay}
                  onChange={(e) => setDownPay(e.target.value)} placeholder="Amount" />
              </FormField>
              <FormField label="DP Status">
                <select className="select-dark w-full px-3 py-2 text-sm" value={downPayStatus}
                  onChange={(e) => setDownPayStatus(e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </FormField>
            </div>

            {/* Remaining balance — only shown when both fields filled */}
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

            <Divider label="Status & Dates" />

            <FormField label="Deal Status">
              <select className="select-dark w-full px-3 py-2 text-sm" value={status}
                onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
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
          </div>
        </div>
      </form>
    </Modal>
  );
}
