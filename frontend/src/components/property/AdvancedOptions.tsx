import { useEffect, useState } from "react";
import { Plus, Trash2, MapPin, Tag, ChevronRight, LayoutGrid } from "lucide-react";
import Modal from "../Modal";
import { propApi, Location, Amenity, PropertyCategory } from "../../lib/propertyApi";

type Tab = "categories" | "locations" | "amenities";

type Props = { open: boolean; onClose: () => void };

export default function AdvancedOptions({ open, onClose }: Props) {
  const [tab, setTab]               = useState<Tab>("categories");
  const [locations, setLocations]   = useState<Location[]>([]);
  const [amenities, setAmenities]   = useState<Amenity[]>([]);
  const [categories, setCategories] = useState<PropertyCategory[]>([]);

  const [locName, setLocName]       = useState("");
  const [locParent, setLocParent]   = useState<number | null>(null);
  const [amName, setAmName]         = useState("");
  const [catName, setCatName]       = useState("");
  const [catError, setCatError]     = useState("");

  const loadAll = () => Promise.all([
    propApi.getLocations().then((res) => {
      const data = res && 'data' in res ? (res as any).data : res;
      setLocations(Array.isArray(data) ? data : []);
    }),
    propApi.getAmenities().then((res) => {
      const data = res && 'data' in res ? (res as any).data : res;
      setAmenities(Array.isArray(data) ? data : []);
    }),
    propApi.getCategories().then((res) => {
      const data = res && 'data' in res ? (res as any).data : res;
      setCategories(Array.isArray(data) ? data : []);
    }),
  ]);

  useEffect(() => { if (open) void loadAll(); }, [open]);

  const addLocation = async () => {
    if (!locName.trim()) return;
    await propApi.createLocation({ name: locName.trim(), parent_id: locParent });
    setLocName(""); setLocParent(null);
    propApi.getLocations().then((res) => {
      const data = res && 'data' in res ? (res as any).data : res;
      setLocations(Array.isArray(data) ? data : []);
    });
  };

  const addAmenity = async () => {
    if (!amName.trim()) return;
    await propApi.createAmenity(amName.trim());
    setAmName("");
    propApi.getAmenities().then((res) => {
      const data = res && 'data' in res ? (res as any).data : res;
      setAmenities(Array.isArray(data) ? data : []);
    });
  };

  const addCategory = async () => {
    if (!catName.trim()) return;
    setCatError("");
    try {
      await propApi.createCategory(catName.trim());
      setCatName("");
      propApi.getCategories().then((res) => {
        const data = res && 'data' in res ? (res as any).data : res;
        setCategories(Array.isArray(data) ? data : []);
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCatError(typeof msg === "string" ? msg : "Failed to add category");
    }
  };

  const deleteCategory = async (id: number) => {
    await propApi.deleteCategory(id);
    propApi.getCategories().then((res) => {
      const data = res && 'data' in res ? (res as any).data : res;
      setCategories(Array.isArray(data) ? data : []);
    });
  };

  const parents   = locations.filter((l) => !l.parent_id || l.has_children);
  const roots     = locations.filter((l) => !l.parent_id);
  const children  = (pid: number) => locations.filter((l) => l.parent_id === pid);

  const TABS = [
    { key: "categories" as Tab, label: "Categories", icon: LayoutGrid },
    { key: "locations"  as Tab, label: "Locations",  icon: MapPin },
    { key: "amenities"  as Tab, label: "Amenities",  icon: Tag },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Advanced Options">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            style={tab === key
              ? { background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }
              : { color: "var(--text-secondary)" }}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* Categories */}
      {tab === "categories" && (
        <div className="space-y-4">
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-primary">Add Category</p>
            <div className="flex gap-2">
              <input className="input-dark flex-1 px-3 py-2.5 text-sm" value={catName}
                onChange={(e) => { setCatName(e.target.value); setCatError(""); }}
                onKeyDown={(e) => e.key === "Enter" && void addCategory()}
                placeholder="e.g. Residential" />
              <button type="button" onClick={() => void addCategory()}
                className="btn-primary px-4 py-2.5 text-sm flex items-center gap-1.5">
                <Plus size={13} /> Add
              </button>
            </div>
            {catError && <p className="text-xs text-red-400">{catError}</p>}
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {categories.length === 0 && <p className="text-xs text-muted text-center py-4">No categories yet.</p>}
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <LayoutGrid size={12} className="text-blue-400 shrink-0" />
                  <span className="text-sm text-primary">{c.name}</span>
                </div>
                <button type="button" onClick={() => void deleteCategory(c.id)}
                  className="text-muted hover:text-red-400 transition-colors p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locations */}
      {tab === "locations" && (
        <div className="space-y-4">
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-primary">Add Location</p>
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={locParent ?? ""}
              onChange={(e) => setLocParent(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Top-level (no parent) —</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input className="input-dark flex-1 px-3 py-2.5 text-sm" value={locName}
                onChange={(e) => setLocName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addLocation()}
                placeholder="Location name" />
              <button type="button" onClick={() => void addLocation()}
                className="btn-primary px-4 py-2.5 text-sm flex items-center gap-1.5">
                <Plus size={13} /> Add
              </button>
            </div>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {roots.length === 0 && <p className="text-xs text-muted text-center py-4">No locations yet.</p>}
            {roots.map((root) => (
              <div key={root.id}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                  <MapPin size={12} className="text-blue-400 shrink-0" />
                  <span className="text-sm font-medium text-primary flex-1">{root.name}</span>
                  <span className="text-[10px] font-mono text-muted">{root.tid}</span>
                </div>
                {children(root.id).map((child) => (
                  <div key={child.id} className="flex items-center gap-2 px-3 py-2 ml-5 rounded-lg mt-0.5"
                    style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                    <ChevronRight size={10} className="text-muted shrink-0" />
                    <span className="text-sm text-secondary flex-1">{child.name}</span>
                    <span className="text-[10px] font-mono text-muted">{child.tid}</span>
                    {!child.has_children && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>leaf</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Amenities */}
      {tab === "amenities" && (
        <div className="space-y-4">
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-primary">Add Amenity</p>
            <div className="flex gap-2">
              <input className="input-dark flex-1 px-3 py-2.5 text-sm" value={amName}
                onChange={(e) => setAmName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addAmenity()}
                placeholder="e.g. Swimming Pool" />
              <button type="button" onClick={() => void addAmenity()}
                className="btn-primary px-4 py-2.5 text-sm flex items-center gap-1.5">
                <Plus size={13} /> Add
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
            {amenities.length === 0 && <p className="text-xs text-muted w-full text-center py-4">No amenities yet.</p>}
            {amenities.map((a) => (
              <span key={a.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}>
                <Tag size={10} /> {a.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
