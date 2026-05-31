import { useEffect, useState, FormEvent, useRef } from "react";
import { Plus, Printer } from "lucide-react";
import Modal from "../../Modal";
import AttachmentsButton from "../../attachments/AttachmentsButton";
import { propApi, Lease, Property, Unit } from "../../../lib/propertyApi";
import { formatCurrency } from "../../../lib/currency";
import { printRecord } from "../../actions";
import { SmartTable } from "../../data-table";
import { api } from "../../../lib/api";
import { useLookup } from "../../../hooks/useLookup";

type Props = { refresh: number; onRefresh: () => void };

const STATUS_COLOR: Record<string, string> = {
  active: "#10b981", expired: "#ef4444", terminated: "#94a3b8", pending: "#f59e0b",
};

export default function LeaseTab({ refresh, onRefresh }: Props) {
  const { options: LEASE_STATUS_OPTS } = useLookup('lease_status');
  const [leases, setLeases]         = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits]           = useState<Unit[]>([]);
  const [open, setOpen]             = useState(false);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const paramsRef = useRef<any>(null);

  const [propId, setPropId]         = useState<number | "">("");
  const [unitId, setUnitId]         = useState<number | "">("");
  const [tenant, setTenant]         = useState("");
  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState("");
  const [rent, setRent]             = useState("");
  const [status, setStatus]         = useState("active");
  const [notes, setNotes]           = useState("");

  const fetchLeases = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const res = await api.get<Lease[]>("/properties/leases/all", {
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
      setLeases(Array.isArray(data) ? data : []);
      const totalCount = Number(res.headers["x-total-count"] || res.headers["X-Total-Count"] || (Array.isArray(data) ? data.length : 0));
      setTotal(totalCount);
    } catch (err) {
      console.error(err);
      setLeases([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const refreshTable = () => {
    if (paramsRef.current) {
      fetchLeases(paramsRef.current);
    }
  };

  useEffect(() => {
    refreshTable();
  }, [refresh]);

  useEffect(() => {
    propApi.getProperties().then((res) => {
      const data = res && 'data' in res ? (res as any).data : res;
      setProperties(Array.isArray(data) ? data : []);
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

  const columns = [
    {
      key: "tid",
      label: "TID",
      className: "font-mono text-xs text-blue-400"
    },
    {
      key: "tenant_name",
      label: "Tenant",
      render: (val: any) => val || "—",
      className: "text-primary font-medium"
    },
    {
      key: "unit_id",
      label: "Unit ID",
      className: "text-secondary font-mono text-xs"
    },
    {
      key: "start_date",
      label: "Start",
      className: "text-secondary"
    },
    {
      key: "end_date",
      label: "End",
      render: (val: any) => val || "—",
      className: "text-secondary"
    },
    {
      key: "monthly_rent",
      label: "Rent/mo",
      render: (val: any) => formatCurrency(val),
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
      onClick: (row: Lease) => printRecord(`Lease ${row.tid}`, [
        { label: "Tenant", value: row.tenant_name || "—" },
        { label: "Rent", value: formatCurrency(row.monthly_rent) },
        { label: "Status", value: row.status },
        { label: "Start Date", value: row.start_date },
        { label: "End Date", value: row.end_date || "—" },
      ])
    }
  ];

  return (
    <>
      <SmartTable
        storageKey="rems_leases"
        data={leases}
        columns={columns}
        rowActions={rowActions}
        loading={loading}
        total={total}
        onParamsChange={fetchLeases}
        showStatusFilter={true}
        statusOptions={[
          { label: "Active", value: "active" },
          { label: "Pending", value: "pending" },
          { label: "Expired", value: "expired" },
          { label: "Terminated", value: "terminated" }
        ]}
        showDateFilter={true}
        toolbarActions={
          <button type="button" onClick={() => { reset(); setOpen(true); }}
            className="btn-primary flex items-center gap-2 px-3 py-2 text-xs">
            <Plus size={13} /> New Lease
          </button>
        }
      />

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
            {LEASE_STATUS_OPTS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <textarea className="input-dark w-full px-4 py-2.5 text-sm resize-none" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
          <AttachmentsButton module="lease" />
          <button className="btn-primary w-full py-3 text-sm mt-1" type="submit">Create Lease</button>
        </form>
      </Modal>
    </>
  );
}
