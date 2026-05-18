import { useEffect, useState, FormEvent } from "react";
import { Plus, TrendingUp } from "lucide-react";
import Modal from "../../Modal";
import { propApi, PropertySale, Property, Unit, Buyer, Seller } from "../../../lib/propertyApi";

import { formatCurrency } from "../../../lib/currency";
import { QuickRowActions, ActionsTh, ActionsCell, printRecord } from "../../actions";

type Props = { refresh: number; onRefresh: () => void };

const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b", completed: "#10b981", cancelled: "#ef4444",
};

export default function SalesTab({ refresh, onRefresh }: Props) {
  const [sales, setSales]           = useState<PropertySale[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits]           = useState<Unit[]>([]);
  const [buyers, setBuyers]         = useState<Buyer[]>([]);
  const [sellers, setSellers]       = useState<Seller[]>([]);
  const [open, setOpen]             = useState(false);

  const [propId, setPropId]     = useState<number | "">("");
  const [unitId, setUnitId]     = useState<number | "">("");
  const [buyerId, setBuyerId]   = useState<number | "">("");
  const [sellerId, setSellerId] = useState<number | "">("");
  const [price, setPrice]       = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [status, setStatus]     = useState("pending");
  const [notes, setNotes]       = useState("");

  const load = () => propApi.getSales().then((res) => {
    const data = res && 'data' in res ? (res as any).data : res;
    setSales(Array.isArray(data) ? data : []);
  });
  useEffect(() => { void load(); }, [refresh]);
  useEffect(() => {
    Promise.all([
      propApi.getProperties(), propApi.getBuyers(), propApi.getSellers(),
    ]).then(([p, b, s]) => {
      const pData = p && 'data' in p ? (p as any).data : p;
      const bData = b && 'data' in b ? (b as any).data : b;
      const sData = s && 'data' in s ? (s as any).data : s;
      setProperties(Array.isArray(pData) ? pData : []);
      setBuyers(Array.isArray(bData) ? bData : []);
      setSellers(Array.isArray(sData) ? sData : []);
    });
  }, []);
  useEffect(() => {
    if (!propId) { setUnits([]); setUnitId(""); return; }
    propApi.getUnits(Number(propId)).then((res) => {
      const data = res && 'data' in res ? (res as any).data : res;
      setUnits(Array.isArray(data) ? data : []);
    });
  }, [propId]);

  const reset = () => {
    setPropId(""); setUnitId(""); setBuyerId(""); setSellerId("");
    setPrice(""); setSaleDate(""); setStatus("pending"); setNotes("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!buyerId || !sellerId || !price || !saleDate) return;
    await propApi.createSale({
      property_id: propId ? Number(propId) : null,
      unit_id: unitId ? Number(unitId) : null,
      buyer_id: Number(buyerId), seller_id: Number(sellerId),
      sale_price: Number(price), sale_date: saleDate, status,
      notes: notes || null,
    });
    reset(); setOpen(false); onRefresh();
  };

  return (
    <>
      <div className="flex justify-end mb-1">
        <button type="button" onClick={() => { reset(); setOpen(true); }}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
          <Plus size={15} /> New Sale
        </button>
      </div>

      <div className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {sales.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp size={32} className="text-muted mx-auto mb-3" />
            <p className="text-secondary text-sm">No sales recorded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["TID","Property","Unit","Buyer","Seller","Price","Date","Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const sc = STATUS_COLOR[s.status] ?? "#94a3b8";
                const buyer  = buyers.find((b) => b.id === s.buyer_id);
                const seller = sellers.find((x) => x.id === s.seller_id);
                return (
                  <tr key={s.id} className="transition-colors row-hover"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="px-4 py-3 font-mono text-xs text-blue-400">{s.tid}</td>
                    <td className="px-4 py-3 text-secondary font-mono text-xs">{s.property_id ?? "—"}</td>
                    <td className="px-4 py-3 text-secondary font-mono text-xs">{s.unit_id ?? "—"}</td>
                    <td className="px-4 py-3 text-primary">{buyer?.name ?? s.buyer_id}</td>
                    <td className="px-4 py-3 text-primary">{seller?.name ?? s.seller_id}</td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold">{formatCurrency(s.sale_price)}</td>
                    <td className="px-4 py-3 text-secondary">{s.sale_date}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${sc}18`, color: sc }}>{s.status}</span>
                    </td>
                    <ActionsCell>
                      <QuickRowActions row={s} compact onPrint={(row) => printRecord(`Sale ${row.tid}`, [
                        { label: "Price", value: formatCurrency(row.sale_price) },
                        { label: "Date", value: row.sale_date },
                        { label: "Status", value: row.status },
                      ])} hiddenActions={["view", "edit", "delete"]} />
                    </ActionsCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Record Sale">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Property</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={propId}
                onChange={(e) => setPropId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">— Optional —</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.tid} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Unit</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={unitId}
                onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">— Optional —</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.tid} — {u.unit_number}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Buyer *</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={buyerId}
                onChange={(e) => setBuyerId(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">— Select buyer —</option>
                {buyers.map((b) => <option key={b.id} value={b.id}>{b.tid} — {b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Seller *</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={sellerId}
                onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">— Select seller —</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.tid} — {s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Sale Price (Rs) *</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={price}
                onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Sale Date *</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)} required />
            </div>
          </div>
          <select className="select-dark w-full px-3 py-2.5 text-sm" value={status}
            onChange={(e) => setStatus(e.target.value)}>
            {["pending","completed","cancelled"].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <textarea className="input-dark w-full px-4 py-2.5 text-sm resize-none" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
          <button className="btn-primary w-full py-3 text-sm mt-1" type="submit">Record Sale</button>
        </form>
      </Modal>
    </>
  );
}
