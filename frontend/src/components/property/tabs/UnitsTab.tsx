import { useEffect, useState, useRef } from "react";
import { Printer } from "lucide-react";
import { propApi, Property, Unit } from "../../../lib/propertyApi";
import { printRecord } from "../../actions";
import { SmartTable } from "../../data-table";
import { api } from "../../../lib/api";
import { formatCurrency } from "../../../lib/currency";

type Props = { refresh: number };

const STATUS_COLOR: Record<string, string> = {
  available: "#10b981", sold: "#ef4444", rented: "#f59e0b",
  reserved: "#6366f1", maintenance: "#94a3b8",
};

export default function UnitsTab({ refresh }: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProp, setSelectedProp] = useState<number | "">("");
  const [units, setUnits]           = useState<Unit[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const paramsRef = useRef<any>(null);

  useEffect(() => {
    propApi.getProperties().then((res) => {
      const data = res && 'data' in res ? (res as any).data : res;
      setProperties(Array.isArray(data) ? data : []);
    });
  }, [refresh]);

  const fetchUnits = async (params: any) => {
    paramsRef.current = params;
    if (selectedProp === "") {
      setUnits([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<Unit[]>("/properties/units/all", {
        params: {
          property_id: Number(selectedProp),
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          filter: params.dateFilter || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
        }
      });
      const data = res.data;
      setUnits(Array.isArray(data) ? data : []);
      const totalCount = Number(res.headers["x-total-count"] || res.headers["X-Total-Count"] || (Array.isArray(data) ? data.length : 0));
      setTotal(totalCount);
    } catch (err) {
      console.error(err);
      setUnits([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paramsRef.current) {
      fetchUnits(paramsRef.current);
    }
  }, [selectedProp, refresh]);

  const columns = [
    {
      key: "tid",
      label: "TID",
      className: "font-mono text-xs text-blue-400"
    },
    {
      key: "unit_number",
      label: "Unit #",
      className: "text-primary font-medium"
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
    },
    {
      key: "size",
      label: "Size",
      render: (val: any) => val || "—",
      className: "text-secondary"
    },
    {
      key: "rent_amount",
      label: "Rent/mo",
      render: (val: any) => val ? formatCurrency(val) : "—",
      className: "text-secondary"
    },
    {
      key: "sale_price",
      label: "Sale Price",
      render: (val: any) => val ? formatCurrency(val) : "—",
      className: "text-secondary"
    }
  ];

  const rowActions = [
    {
      key: "print",
      label: "Print",
      icon: Printer,
      onClick: (row: Unit) => printRecord(`Unit ${row.tid}`, [
        { label: "Unit #", value: row.unit_number },
        { label: "Status", value: row.status },
        { label: "Size", value: row.size ? String(row.size) : "—" },
        { label: "Rent Amount", value: row.rent_amount ? formatCurrency(row.rent_amount) : "—" },
        { label: "Sale Price", value: row.sale_price ? formatCurrency(row.sale_price) : "—" },
      ])
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select className="select-dark px-4 py-2.5 text-sm w-72"
          value={selectedProp} onChange={(e) => setSelectedProp(e.target.value ? Number(e.target.value) : "")}>
          <option value="">— Select a property —</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.tid} — {p.name}</option>)}
        </select>
      </div>

      {selectedProp === "" ? (
        <div className="card-dark p-8 text-center text-secondary text-sm" style={{ border: "1px solid var(--border)" }}>
          Select a property to view its units.
        </div>
      ) : (
        <SmartTable
          storageKey="rems_property_units"
          data={units}
          columns={columns}
          rowActions={rowActions}
          loading={loading}
          total={total}
          onParamsChange={fetchUnits}
          showDateFilter={true}
        />
      )}
    </div>
  );
}
