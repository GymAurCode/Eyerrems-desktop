import { useEffect, useState, FormEvent } from "react";
import { Plus, FileText } from "lucide-react";
import Modal from "../../Modal";
import { propApi, Lease, Property, Unit } from "../../../lib/propertyApi";

import { formatCurrency } from "../../../lib/currency";

type Props = { refresh: number; onRefresh: () => void };

const STATUS_COLOR: Record<string, string> = {
  active: "#10b981", expired: "#ef4444", terminated: "#94a3b8", pending: "#f59e0b",
};

export default function LeaseTab({ refresh, onRefresh }: Props) {
  const [leases, setLeases]         = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits]           = useState<Unit[]>([]);
  const [open, setOpen]             = useState(false);

  const [propId, setPropId]         = useState<number | "">("");
  const [unitId, setUnitId]         = useState<number | "">("");
  const [tenant, setTenant]         = useState("");
  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState("");
  const [rent, setRent]             = useState("");
  const [status, setStatus]         = useState("active");
  const [notes, setNotes]           = useState("");

  const load = () => propApi.getLeases().then(({ data }) => setLeases(data));
  useEffect(() => { void load(); }, [refresh]);
  useEffect(() => { propApi.getProperties().then(({ data }) => setProperties(data)); }, []);
  useEffect(() => {
    if (!propId) { setUnits([]); setUnitId(""); return; }
    propApi.getUnits(Number(propId)).then(({ data }) => setUnits(data));
  }, [propId]);

  const reset = () => {
    setPropId(""); setUnitId(""); setTenant(""); setStartDate("");
    setEndDate(""); setRent(""); setStatus("active"); setNotes("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!unitId) return;
    await propApi.createLease({
      unit_id: Number(unitId), tenant_name: tenant || null,
      start_date: startDate, end_date: endDate || null,
      monthly_rent: Number(rent), status, notes: notes || null,
    });
    reset(); setOpen(false); onRefresh();
  };

  return (
    <>
      <div className="flex justify-end mb-1">
        <button type="button" onClick={() => { reset(); setOpen(true); }}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
          <Plus size={15} /> New Lease
        </button>
      </div>

      <div className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {leases.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={32} className="text-muted mx-auto mb-3" />
            <p className="text-secondary text-sm">No leases yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["TID","Tenant","Unit ID","Start","End","Rent/mo","Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leases.map((l) => {
                const sc = STATUS_COLOR[l.status] ?? "#94a3b8";
                return (
                  <tr key={l.id} className="transition-colors row-hover"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="px-4 py-3 font-mono text-xs text-blue-400">{l.tid}</td>
                    <td className="px-4 py-3 text-primary">{l.tenant_name || "—"}</td>
                    <td className="px-4 py-3 text-secondary font-mono text-xs">{l.unit_id}</td>
                    <td className="px-4 py-3 text-secondary">{l.start_date}</td>
                    <td className="px-4 py-3 text-secondary">{l.end_date || "—"}</td>
                    <td className="px-4 py-3 text-secondary">{formatCurrency(l.monthly_rent)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${sc}18`, color: sc }}>{l.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Lease">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1">Property</label>
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={propId}
              onChange={(e) => setPropId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— Select property —</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.tid} — {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Unit *</label>
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={unitId}
              onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")} required>
              <option value="">— Select unit —</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.tid} — Unit {u.unit_number}</option>)}
            </select>
          </div>
          <input className="input-dark w-full px-4 py-2.5 text-sm" value={tenant}
            onChange={(e) => setTenant(e.target.value)} placeholder="Tenant name" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Start Date *</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">End Date</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={endDate}
                onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <input className="input-dark w-full px-4 py-2.5 text-sm" type="number" value={rent}
            onChange={(e) => setRent(e.target.value)} placeholder="Monthly rent (Rs) *" required />
          <select className="select-dark w-full px-3 py-2.5 text-sm" value={status}
            onChange={(e) => setStatus(e.target.value)}>
            {["active","pending","expired","terminated"].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <textarea className="input-dark w-full px-4 py-2.5 text-sm resize-none" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
          <button className="btn-primary w-full py-3 text-sm mt-1" type="submit">Create Lease</button>
        </form>
      </Modal>
    </>
  );
}
