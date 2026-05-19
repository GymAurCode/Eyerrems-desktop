import { useEffect, useState, FormEvent, useRef } from "react";
import { Plus, Printer } from "lucide-react";
import Modal from "../../Modal";
import { propApi, PropertySale, Property, Unit, Buyer, Seller } from "../../../lib/propertyApi";
import { formatCurrency } from "../../../lib/currency";
import { printRecord } from "../../actions";
import { SmartTable } from "../../data-table";
import { api } from "../../../lib/api";

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
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const paramsRef = useRef<any>(null);

  const [propId, setPropId]     = useState<number | "">("");
  const [unitId, setUnitId]     = useState<number | "">("");
  const [buyerId, setBuyerId]   = useState<number | "">("");
  const [sellerId, setSellerId] = useState<number | "">("");
  const [price, setPrice]       = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [status, setStatus]     = useState("pending");
  const [notes, setNotes]       = useState("");

  const fetchSales = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const res = await api.get<PropertySale[]>("/properties/sales/all", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          filter: params.dateFilter || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
        }
      });
      const data = res.data;
      setSales(Array.isArray(data) ? data : []);
      const totalCount = Number(res.headers["x-total-count"] || res.headers["X-Total-Count"] || (Array.isArray(data) ? data.length : 0));
      setTotal(totalCount);
    } catch (err) {
      console.error(err);
      setSales([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const refreshTable = () => {
    if (paramsRef.current) {
      fetchSales(paramsRef.current);
    }
  };

  useEffect(() => {
    refreshTable();
  }, [refresh]);

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

  const columns = [
    {
      key: "tid",
      label: "TID",
      className: "font-mono text-xs text-blue-400"
    },
    {
      key: "property_id",
      label: "Property",
      render: (val: any) => val || "—",
      className: "text-secondary font-mono text-xs"
    },
    {
      key: "unit_id",
      label: "Unit",
      render: (val: any) => val || "—",
      className: "text-secondary font-mono text-xs"
    },
    {
      key: "buyer_id",
      label: "Buyer",
      render: (val: number, row: PropertySale) => {
        const buyer = buyers.find((b) => b.id === val);
        return buyer?.name ?? val;
      },
      className: "text-primary font-medium"
    },
    {
      key: "seller_id",
      label: "Seller",
      render: (val: number, row: PropertySale) => {
        const seller = sellers.find((s) => s.id === val);
        return seller?.name ?? val;
      },
      className: "text-primary font-medium"
    },
    {
      key: "sale_price",
      label: "Price",
      render: (val: any) => formatCurrency(val),
      className: "text-emerald-400 font-semibold"
    },
    {
      key: "sale_date",
      label: "Date",
      className: "text-secondary"
    },
    {
      key: "status",
      label: "Status",
      render: (val: string) => {
        const sc = STATUS_COLOR[val] ?? "#94a3b8";
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: `${sc}18`, color: sc }}>{val}</span>
        );
      }
    }
  ];

  const rowActions = [
    {
      key: "print",
      label: "Print",
      icon: Printer,
      onClick: (row: PropertySale) => {
        const buyer = buyers.find((b) => b.id === row.buyer_id);
        const seller = sellers.find((s) => s.id === row.seller_id);
        printRecord(`Sale ${row.tid}`, [
          { label: "Buyer", value: buyer?.name ?? String(row.buyer_id) },
          { label: "Seller", value: seller?.name ?? String(row.seller_id) },
          { label: "Price", value: formatCurrency(row.sale_price) },
          { label: "Date", value: row.sale_date },
          { label: "Status", value: row.status },
        ]);
      }
    }
  ];

  return (
    <>
      <SmartTable
        storageKey="rems_property_sales"
        data={sales}
        columns={columns}
        rowActions={rowActions}
        loading={loading}
        total={total}
        onParamsChange={fetchSales}
        showStatusFilter={true}
        statusOptions={[
          { label: "Pending", value: "pending" },
          { label: "Completed", value: "completed" },
          { label: "Cancelled", value: "cancelled" }
        ]}
        showDateFilter={true}
        toolbarActions={
          <button type="button" onClick={() => { reset(); setOpen(true); }}
            className="btn-primary flex items-center gap-2 px-3 py-2 text-xs">
            <Plus size={13} /> New Sale
          </button>
        }
      />

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
