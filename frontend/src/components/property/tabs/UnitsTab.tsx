import { useEffect, useState, useRef } from "react";
import { Printer, Plus, Edit2, Trash2, Eye, Users, Wrench, Calendar, Grid3X3, List, FileText } from "lucide-react";
import { propApi, Property, Unit, Floor } from "../../../lib/propertyApi";
import { printRecord } from "../../actions";
import ReportModal from "../../reports/ReportModal";
import { SmartTable } from "../../data-table";
import { api } from "../../../lib/api";
import { formatCurrency } from "../../../lib/currency";
import AddUnitDialog from "../dialogs/AddUnitDialog";
import ConfirmDialog from "../../actions/ConfirmDialog";
import { useNotifStore } from "../../../store/notifications";

type Props = { refresh: number };

const STATUS_COLOR: Record<string, string> = {
  available: "#10b981", sold: "#ef4444", rented: "#f59e0b",
  reserved: "#6366f1", maintenance: "#94a3b8", occupied: "#f59e0b",
};
function StatusBadge({ status }: { status: string }) {
  const sc = STATUS_COLOR[status] ?? "#94a3b8";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${sc}18`, color: sc }}>{status}</span>
  );
}

type ViewMode = "table" | "heatmap";

export default function UnitsTab({ refresh }: Props) {
  const [properties, setProperties]   = useState<Property[]>([]);

  // Report modal state
  const [reportModal, setReportModal] = useState<{
    open: boolean;
    reportType: string;
    filters: Record<string, unknown>;
    title?: string;
  }>({ open: false, reportType: "", filters: {} });

  const today = new Date().toISOString().split("T")[0];
  const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const [floors, setFloors]           = useState<Floor[]>([]);
  const [selectedProp, setSelectedProp] = useState<number | "">("");
  const [units, setUnits]             = useState<Unit[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const paramsRef = useRef<any>(null);
  const [viewMode, setViewMode]       = useState<ViewMode>("table");

  // Add/Edit dialog
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  useEffect(() => {
    propApi.getProperties().then((res) => {
      const data = res && 'data' in res ? (res as any).data : res;
      setProperties(Array.isArray(data) ? data : []);
    });
  }, [refresh]);

  // Fetch floors when property changes
  useEffect(() => {
    if (selectedProp !== "") {
      propApi.getFloors(Number(selectedProp)).then(res => {
        setFloors(Array.isArray(res) ? res : []);
      }).catch(() => setFloors([]));
    } else {
      setFloors([]);
    }
  }, [selectedProp]);

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
          status: params.status || undefined,
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

  const handleDelete = async (unit: Unit) => {
    await propApi.deleteUnit(unit.id);
    pushToast({ title: "Deleted", message: `Unit ${unit.unit_number} deleted`, type: "success" });
    if (paramsRef.current) fetchUnits(paramsRef.current);
  };

  // ── Table Columns ──
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
      key: "property_name",
      label: "Property",
      render: (val: any) => val || "—",
      className: "text-secondary"
    },
    {
      key: "floor_number",
      label: "Floor",
      render: (val: any) => val != null ? `Floor ${val}` : "—",
      className: "text-secondary"
    },
    {
      key: "status",
      label: "Status",
      render: (val: string) => <StatusBadge status={val} />
    },
    {
      key: "unit_type",
      label: "Type",
      render: (val: any) => val || "—",
      className: "text-secondary"
    },
    {
      key: "size",
      label: "Size",
      render: (val: any, row: Unit) => {
        if (row.area) return `${row.area}${row.area_unit ? ` ${row.area_unit}` : ""}`;
        return val || "—";
      },
      className: "text-secondary"
    },
    {
      key: "rent_amount",
      label: "Rent/mo",
      render: (val: any) => val ? formatCurrency(val) : "—",
      className: "text-secondary"
    },
    {
      key: "furnishing_status",
      label: "Furnishing",
      render: (val: any) => val ? val.replace("-", " ") : "—",
      className: "text-secondary"
    },
    {
      key: "current_tenant_name",
      label: "Tenant",
      render: (val: any) => val || "—",
      className: "text-secondary"
    },
  ];

  const rowActions = [
    {
      key: "edit",
      label: "Edit Unit",
      icon: Edit2,
      onClick: (row: Unit) => { setEditing(row); setOpen(true); },
    },
    {
      key: "print",
      label: "Print",
      icon: Printer,
      onClick: (row: Unit) => printRecord(`Unit ${row.tid}`, [
        { label: "Unit #", value: row.unit_number },
        { label: "Status", value: row.status },
        { label: "Type", value: row.unit_type || "—" },
        { label: "Size", value: row.area ? `${row.area}${row.area_unit ? ` ${row.area_unit}` : ""}` : (row.size || "—") },
        { label: "Rent Amount", value: row.rent_amount ? formatCurrency(row.rent_amount) : "—" },
        { label: "Sale Price", value: row.sale_price ? formatCurrency(row.sale_price) : "—" },
        { label: "Furnishing", value: row.furnishing_status || "—" },
        { label: "Tenant", value: row.current_tenant_name || "—" },
      ]),
    },
    {
      key: "assign_tenant",
      label: "Assign Tenant",
      icon: Users,
      onClick: (row: Unit) => {
        /* TODO: open tenant assignment dialog */
      },
    },
    {
      key: "maintenance",
      label: "Record Maintenance",
      icon: Wrench,
      onClick: (row: Unit) => {
        /* TODO: open maintenance recording dialog */
      },
    },
    {
      key: "view_lease",
      label: "View Lease",
      icon: Calendar,
      onClick: (row: Unit) => {
        /* TODO: navigate to lease view */
      },
    },
    {
      key: "unit_statement",
      label: "Unit Statement",
      icon: FileText,
      onClick: (row: Unit) => setReportModal({ open: true, reportType: "unit_statement", filters: { unit_id: row.id, date_from: firstDayOfYear, date_to: today }, title: "Unit Statement" }),
      variant: "secondary",
    },
    {
      key: "tenant_history",
      label: "Tenant History",
      icon: FileText,
      onClick: (row: Unit) => setReportModal({ open: true, reportType: "tenant_history", filters: { unit_id: row.id }, title: "Tenant History" }),
      variant: "secondary",
    },
    {
      key: "delete",
      label: "Delete Unit",
      icon: Trash2,
      onClick: (row: Unit) => setDeleteTarget(row),
    },
  ];

  // ── Heatmap / Floor View ──
  const unitsByFloor: Record<number, Unit[]> = {};
  const floorNumbers = [...new Set(units.filter(u => u.floor_number != null).map(u => u.floor_number!))].sort();
  for (const u of units) {
    const fn = u.floor_number ?? 0;
    if (!unitsByFloor[fn]) unitsByFloor[fn] = [];
    unitsByFloor[fn].push(u);
  }

  const renderHeatmap = () => (
    <div className="space-y-4">
      {floorNumbers.length === 0 ? (
        <div className="card-dark p-8 text-center text-secondary text-sm">
          No units with floor numbers to display.
        </div>
      ) : (
        floorNumbers.map(fn => {
          const floorUnits = unitsByFloor[fn] || [];
          const rented = floorUnits.filter(u => u.status === "rented" || u.status === "occupied").length;
          const totalRent = floorUnits.reduce((s, u) => s + (u.rent_amount || 0), 0);
          return (
            <div key={fn} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "var(--bg-surface2)" }}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-primary">Floor {fn}</span>
                  <span className="text-xs text-muted">{floorUnits.length} units</span>
                  <span className="text-xs text-muted">·</span>
                  <span className="text-xs text-muted">{rented} rented</span>
                  <span className="text-xs text-muted">·</span>
                  <span className="text-xs font-medium" style={{ color: "#10b981" }}>
                    {totalRent > 0 ? `${formatCurrency(totalRent)}/mo` : "—"}
                  </span>
                </div>
                {rented > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                      <div className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.round((rented / floorUnits.length) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-muted">{Math.round((rented / floorUnits.length) * 100)}%</span>
                  </div>
                )}
              </div>
              <div className="grid gap-1.5 p-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                {floorUnits.map(u => {
                  const color = STATUS_COLOR[u.status] ?? "#94a3b8";
                  return (
                    <div key={u.id}
                      className="rounded-lg px-3 py-2 text-xs transition-colors cursor-default"
                      style={{ background: `${color}12`, border: `1px solid ${color}30` }}
                      title={`${u.unit_number} — ${u.status}${u.current_tenant_name ? ` (${u.current_tenant_name})` : ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium" style={{ color }}>{u.unit_number}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>{u.status}</span>
                      </div>
                      {u.unit_type && <span className="text-muted block">{u.unit_type}</span>}
                      {u.rent_amount != null && <span className="text-emerald-400 font-medium block">{formatCurrency(u.rent_amount)}</span>}
                      {u.current_tenant_name && <span className="text-muted block truncate">{u.current_tenant_name}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── Top Bar: Property Selector + View Toggle + Add Button ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <select className="select-dark px-4 py-2.5 text-sm w-72"
            value={selectedProp} onChange={(e) => setSelectedProp(e.target.value ? Number(e.target.value) : "")}>
            <option value="">— Select a property —</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.tid} — {p.name}</option>)}
          </select>

          {selectedProp !== "" && (
            <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ border: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
              <button type="button" onClick={() => setViewMode("table")}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors"
                style={viewMode === "table" ? { background: "var(--bg-surface)", color: "var(--text-primary)" } : { color: "var(--text-muted)" }}>
                <List size={12} /> Table
              </button>
              <button type="button" onClick={() => setViewMode("heatmap")}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors"
                style={viewMode === "heatmap" ? { background: "var(--bg-surface)", color: "var(--text-primary)" } : { color: "var(--text-muted)" }}>
                <Grid3X3 size={12} /> Floor View
              </button>
            </div>
          )}
        </div>

        {selectedProp !== "" && viewMode === "table" && (
          <button type="button" onClick={() => { setEditing(null); setOpen(true); }}
            className="btn-property flex items-center gap-2 px-3 py-2 text-xs">
            <Plus size={13} /> Add Unit
          </button>
        )}
      </div>

      {selectedProp === "" ? (
        <div className="card-dark p-8 text-center text-secondary text-sm" style={{ border: "1px solid var(--border)" }}>
          Select a property to view its units.
        </div>
      ) : viewMode === "heatmap" ? (
        renderHeatmap()
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
          showStatusFilter={true}
          statusOptions={[
            { label: "Available", value: "available" },
            { label: "Rented", value: "rented" },
            { label: "Occupied", value: "occupied" },
            { label: "Reserved", value: "reserved" },
            { label: "Sold", value: "sold" },
            { label: "Maintenance", value: "maintenance" },
          ]}
        />
      )}

      {/* ── Add / Edit Unit Dialog ── */}
      <AddUnitDialog
        isOpen={open}
        onClose={() => { setEditing(null); setOpen(false); }}
        onSaved={() => { if (paramsRef.current) fetchUnits(paramsRef.current); }}
        floors={floors}
        editUnit={editing}
      />

      {/* Report Modal */}
      <ReportModal
        open={reportModal.open}
        onClose={() => setReportModal({ open: false, reportType: "", filters: {} })}
        reportType={reportModal.reportType}
        filters={reportModal.filters}
        title={reportModal.title}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete Unit ${deleteTarget?.unit_number ?? ""}`}
        message={`Are you sure you want to delete unit ${deleteTarget?.unit_number ?? ""}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await propApi.deleteUnit(deleteTarget.id);
          pushToast({ title: "Deleted", message: `Unit ${deleteTarget.unit_number} deleted`, type: "success" });
          setDeleteTarget(null);
          if (paramsRef.current) fetchUnits(paramsRef.current);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
