import { useEffect, useState } from "react";
import { propApi, Property, Unit } from "../../../lib/propertyApi";

type Props = { refresh: number };

const STATUS_COLOR: Record<string, string> = {
  available: "#10b981", sold: "#ef4444", rented: "#f59e0b",
  reserved: "#6366f1", maintenance: "#94a3b8",
};

export default function UnitsTab({ refresh }: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProp, setSelectedProp] = useState<number | "">("");
  const [units, setUnits]           = useState<Unit[]>([]);

  useEffect(() => {
    propApi.getProperties().then(({ data }) => setProperties(data));
  }, [refresh]);

  useEffect(() => {
    if (selectedProp === "") { setUnits([]); return; }
    propApi.getUnits(Number(selectedProp)).then(({ data }) => setUnits(data));
  }, [selectedProp, refresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select className="select-dark px-4 py-2.5 text-sm w-72"
          value={selectedProp} onChange={(e) => setSelectedProp(e.target.value ? Number(e.target.value) : "")}>
          <option value="">— Select a property —</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.tid} — {p.name}</option>)}
        </select>
      </div>

      <div className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {selectedProp === "" ? (
          <p className="p-8 text-center text-secondary text-sm">Select a property to view its units.</p>
        ) : units.length === 0 ? (
          <p className="p-8 text-center text-secondary text-sm">No units found for this property.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["TID","Unit #","Status","Size","Rent/mo","Sale Price"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const sc = STATUS_COLOR[u.status] ?? "#94a3b8";
                return (
                  <tr key={u.id} className="transition-colors row-hover"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="px-4 py-3 font-mono text-xs text-blue-400">{u.tid}</td>
                    <td className="px-4 py-3 text-primary font-medium">{u.unit_number}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${sc}18`, color: sc }}>{u.status}</span>
                    </td>
                    <td className="px-4 py-3 text-secondary">{u.size || "—"}</td>
                    <td className="px-4 py-3 text-secondary">
                      {u.rent_amount ? `AED ${Number(u.rent_amount).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {u.sale_price ? `AED ${Number(u.sale_price).toLocaleString()}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
