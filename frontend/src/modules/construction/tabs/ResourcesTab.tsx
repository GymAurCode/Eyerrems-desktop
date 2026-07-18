import { useEffect, useState } from "react";
import {
  Users, Truck, Package, Plus, Edit3, Trash2, Search, AlertTriangle,
  CheckCircle, XCircle, User,
} from "lucide-react";
import { constructionApi, ResourceItem, ResourceAllocation } from "../../../lib/constructionApi";
import DataTable from "../../../components/data-table/DataTable";
import type { TableColumn } from "../../../components/data-table/types";
import ConfirmDialog from "../../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../../store/notifications";

const AVAILABILITY_COLOR: Record<string, string> = {
  available: "#10b981", allocated: "#3b82f6", under_maintenance: "#f59e0b",
  reserved: "#8b5cf6", unavailable: "#ef4444",
};

const RESOURCE_TYPES = [
  { value: "human", label: "Human Resources", icon: "👷", categories: ["Engineer","Supervisor","Architect","Civil Engineer","Electrician","Plumber","Painter","Laborer","Security"] },
  { value: "equipment", label: "Equipment", icon: "🔧", categories: ["Excavator","Concrete Mixer","Tower Crane","Generator","Scaffolding","Truck","Forklift","Vehicle"] },
  { value: "material", label: "Materials", icon: "📦", categories: ["Cement","Steel","Sand","Bricks","Blocks","Paint","Tiles","Pipes","Electrical Items"] },
];

function Badge({ label, color }: { label: string; color?: string }) {
  const c = color ?? AVAILABILITY_COLOR[label] ?? "#94a3b8";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${c}20`, color: c }}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold text-primary">{title}</p>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function ResourcesTab({ projectId }: { projectId: number }) {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("human");
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  const [editing, setEditing] = useState<ResourceItem | null>(null);
  const [form, setForm] = useState({ name: "", type: "human", category: "", unit_cost: "", unit: "", description: "", code: "" });
  const [allocateForm, setAllocateForm] = useState({ resource_id: 0, quantity: "1", notes: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{type: 'release' | 'delete', id: number} | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const load = async () => {
    setLoading(true);
    try {
      const [r, a] = await Promise.all([
        constructionApi.listResources(),
        constructionApi.listProjectResources(projectId),
      ]);
      setResources(r);
      setAllocations(a);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const filteredResources = resources.filter(r =>
    r.type === activeTab &&
    (r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (r.code ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
     (r.category ?? "").toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
      };
      if (editing) {
        await constructionApi.updateResource(editing.id, payload);
      } else {
        await constructionApi.createResource(payload);
      }
      pushToast({ title: editing ? "Resource updated" : "Resource created", message: `Resource "${form.name}" has been ${editing ? "updated" : "created"}.`, type: "success" });
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", type: activeTab, category: "", unit_cost: "", unit: "", description: "", code: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleAllocate = async () => {
    if (!allocateForm.resource_id) return;
    setSaving(true);
    try {
      await constructionApi.allocateResource({
        project_id: projectId,
        resource_id: allocateForm.resource_id,
        quantity: Number(allocateForm.quantity),
        notes: allocateForm.notes,
      });
      setShowAllocate(false);
      setAllocateForm({ resource_id: 0, quantity: "1", notes: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed to allocate"); }
    finally { setSaving(false); }
  };

  const handleRelease = async (id: number) => {
    setDeleteTarget({ type: 'release', id });
  };

  const activeType = RESOURCE_TYPES.find(t => t.value === activeTab);

  const resourceColumns: TableColumn<ResourceItem>[] = [
    { key: 'name', label: 'Name', render: (v, r) => (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-primary">{v}</span>
        {r.code && <span className="text-[10px] text-muted font-mono">#{r.code}</span>}
      </div>
    )},
    { key: 'category', label: 'Category', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'availability', label: 'Status', render: (v, r) => (
      <select value={v} onChange={e => constructionApi.updateResourceAvailability(r.id, e.target.value).then(load)}
        className="text-[10px] px-1 py-0.5 rounded bg-transparent border border-white/10 text-primary">
        {["available","allocated","under_maintenance","reserved","unavailable"].map(s => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
    )},
    { key: 'unit_cost', label: 'Unit Cost', render: (v) => <span className="text-xs font-mono text-primary">{v ? `$${Number(v)}` : "—"}</span> },
    { key: 'current_stock', label: 'Stock', render: (v, r) => activeTab === "material" ? (
      <span className="text-xs font-mono text-primary">{v ?? 0} {r.unit ?? ""}</span>
    ) : null },
  ];

  const allocationColumns: TableColumn<ResourceAllocation>[] = [
    { key: 'resource', label: 'Resource', render: (_, r) => (
      <span className="text-xs text-primary">{r.resource?.name ?? "—"}</span>
    )},
    { key: 'quantity', label: 'Qty', render: (v) => <span className="text-xs font-mono text-primary">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <Badge label={v} /> },
    { key: 'notes', label: 'Notes', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'actions', label: '', render: (_, r) => (
      <button onClick={() => handleRelease(r.id)}
        className="p-1 text-muted hover:text-red-400 transition-colors"><XCircle size={11} /></button>
    )},
  ];

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Resource Tabs */}
      <div className="flex gap-2">
        {RESOURCE_TYPES.map(t => (
          <button key={t.value} onClick={() => setActiveTab(t.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === t.value
                ? "text-white bg-blue-600"
                : "text-muted hover:text-primary bg-white/5 hover:bg-white/10"
            }`}>
            <span className="text-xs">{t.icon}</span>
            {t.label}
            <span className="text-[10px] opacity-60">({resources.filter(r => r.type === t.value).length})</span>
          </button>
        ))}
      </div>

      {/* Resource List */}
      <SectionCard title={`${activeType?.label ?? "Resources"} Inventory`}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search…" className="input-dark text-[10px] pl-6 pr-2 py-1 rounded-lg w-32" />
            </div>
            <button onClick={() => { setEditing(null); setForm({ name: "", type: activeTab, category: "", unit_cost: "", unit: "", description: "", code: "" }); setShowForm(true); }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              <Plus size={10} /> Add
            </button>
          </div>
        }>
        <DataTable data={filteredResources} columns={resourceColumns} searchable={false}
          emptyTitle="No resources found"
          onEdit={(row) => { setEditing(row); setForm({
            name: row.name, type: row.type, category: row.category ?? "",
            unit_cost: String(row.unit_cost ?? ""), unit: row.unit ?? "",
            description: row.description ?? "", code: row.code ?? "",
          }); setShowForm(true); }}
          onDelete={(row) => setDeleteTarget({ type: 'delete', id: row.id })}
        />
      </SectionCard>

      {/* Allocations */}
      <SectionCard title="Current Allocations"
        action={
          <button onClick={() => setShowAllocate(true)}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white bg-emerald-600 hover:bg-emerald-500">
            <Plus size={10} /> Allocate
          </button>
        }>
        {allocations.length === 0 ? (
          <p className="text-xs text-muted text-center py-6">No resources allocated yet</p>
        ) : (
          <DataTable data={allocations} columns={allocationColumns} searchable={false} />
        )}
      </SectionCard>

      {/* Resource Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-md" style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">{editing ? "Edit Resource" : "New Resource"}</h3>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="dialog-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Code</label>
                  <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Category</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="dialog-select">
                    <option value="">Select</option>
                    {activeType?.categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Unit Cost</label>
                  <input type="number" value={form.unit_cost} onChange={e => setForm(p => ({ ...p, unit_cost: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Unit</label>
                  <input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} className="dialog-input" placeholder="kg, ton, piece" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="dialog-textarea" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                  {saving ? "Saving…" : editing ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Allocate Dialog */}
      {showAllocate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAllocate(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-sm" style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">Allocate Resource</h3>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Resource *</label>
                <select value={allocateForm.resource_id} onChange={e => setAllocateForm(p => ({ ...p, resource_id: Number(e.target.value) }))} className="dialog-select">
                  <option value={0}>Select resource</option>
                  {resources.filter(r => r.availability === "available" || r.availability === "allocated").map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Quantity</label>
                <input type="number" min="1" value={allocateForm.quantity}
                  onChange={e => setAllocateForm(p => ({ ...p, quantity: e.target.value }))} className="dialog-input" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Notes</label>
                <textarea value={allocateForm.notes}
                  onChange={e => setAllocateForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} className="dialog-textarea" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAllocate(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleAllocate} disabled={saving || !allocateForm.resource_id}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                  {saving ? "Allocating…" : "Allocate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.type === 'release' ? "Release Resource" : "Delete Resource"}
        message={deleteTarget?.type === 'release' ? "Are you sure you want to release this resource allocation?" : "Are you sure you want to delete this resource? This action cannot be undone."}
        confirmLabel={deleteTarget?.type === 'release' ? "Release" : "Delete"}
        variant="danger"
        onConfirm={async () => {
          if (deleteTarget !== null) {
            if (deleteTarget.type === 'release') {
              await constructionApi.releaseResource(deleteTarget.id);
              pushToast({ title: "Resource released", message: "The resource allocation has been released.", type: "success" });
            } else {
              await constructionApi.deleteResource(deleteTarget.id);
              pushToast({ title: "Resource deleted", message: "The resource has been deleted.", type: "success" });
            }
            setDeleteTarget(null);
            load();
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
