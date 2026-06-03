import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { propApi, Location } from "../../lib/propertyApi";
import Modal from "../Modal";

type Props = {
  /** The selected leaf location id (subsidiary or top-level leaf) */
  value: number | null;
  onChange: (id: number | null) => void;
};

export default function LocationPicker({ value, onChange }: Props) {
  const [locations, setLocations]   = useState<Location[]>([]);
  const [locOpen, setLocOpen]       = useState(false);
  const [subOpen, setSubOpen]       = useState(false);

  // Add-location form
  const [newLocName, setNewLocName] = useState("");

  // Add-subsidiary form
  const [newSubName, setNewSubName] = useState("");

  // Selected parent location (top-level)
  const [parentId, setParentId]     = useState<number | null>(null);

  const load = () => propApi.getLocations().then((res) => {
    const data = res && 'data' in res ? (res as any).data : res;
    setLocations(Array.isArray(data) ? data : []);
  });
  useEffect(() => { void load(); }, []);

  // Derive lists
  const topLevel     = Array.isArray(locations) ? locations.filter((l) => !l.parent_id) : [];
  const subsidiaries = parentId && Array.isArray(locations)
    ? locations.filter((l) => l.parent_id === parentId)
    : [];

  // When parent changes, clear subsidiary selection if it no longer belongs
  useEffect(() => {
    if (!parentId) { onChange(null); return; }
    // If current value is not a child of the new parent, clear it
    const current = Array.isArray(locations) ? locations.find((l) => l.id === value) : null;
    if (current && current.parent_id !== parentId) onChange(null);
  }, [parentId]);

  // Derive parentId from current value on load
  useEffect(() => {
    if (!value || !Array.isArray(locations) || locations.length === 0) return;
    const sel = locations.find((l) => l.id === value);
    if (sel?.parent_id) setParentId(sel.parent_id);
    else if (sel && !sel.parent_id) setParentId(sel.id); // top-level selected directly
  }, [value, locations]);

  const saveLocation = async () => {
    if (!newLocName.trim()) return;
    await propApi.createLocation({ name: newLocName.trim(), parent_id: null });
    setNewLocName("");
    setLocOpen(false);
    await load();
  };

  const saveSubsidiary = async () => {
    if (!newSubName.trim() || !parentId) return;
    const res = await propApi.createLocation({ name: newSubName.trim(), parent_id: parentId });
    const data = res && 'data' in res ? (res as any).data : res;
    setNewSubName("");
    setSubOpen(false);
    await load();
    if (data?.id) {
      onChange(data.id); // auto-select the new subsidiary
    }
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Location */}
      <div>
        <label className="block text-xs text-muted mb-1.5">Location</label>
        <div className="flex gap-2">
          <select
            className="select-dark flex-1 px-3 py-2.5 text-sm"
            value={parentId ?? ""}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null;
              setParentId(id);
              onChange(null); // clear subsidiary when location changes
            }}
          >
            <option value="">— Select location —</option>
            {topLevel.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setLocOpen(true)}
            title="Add new location"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-400 transition-colors shrink-0"
            style={{ border: "1px solid rgba(59,130,246,0.25)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Row 2: Subsidiary — only shown when a location is selected */}
      {parentId !== null && (
        <div>
          <label className="block text-xs text-muted mb-1.5">Subsidiary</label>
          <div className="flex gap-2">
            <select
              className="select-dark flex-1 px-3 py-2.5 text-sm"
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Select subsidiary —</option>
              {subsidiaries.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSubOpen(true)}
              title="Add new subsidiary"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-400 transition-colors shrink-0"
              style={{ border: "1px solid rgba(59,130,246,0.25)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Plus size={15} />
            </button>
          </div>
          {subsidiaries.length === 0 && (
            <p className="text-[10px] text-muted mt-1">
              No subsidiaries yet — click <span className="text-blue-400">+</span> to add one.
            </p>
          )}
        </div>
      )}

      {/* Add Location modal */}
      <Modal open={locOpen} onClose={() => setLocOpen(false)} title="Add Location">
        <div className="space-y-3">
          <p className="text-xs text-muted">Create a top-level location (e.g. DHA, Bahria Town).</p>
          <input
            className="input-dark w-full px-3 py-2.5 text-sm"
            value={newLocName}
            onChange={(e) => setNewLocName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void saveLocation()}
            placeholder="Location name *"
          />
          <button className="btn-property w-full py-2.5 text-sm" type="button" onClick={() => void saveLocation()}>
            Save Location
          </button>
        </div>
      </Modal>

      {/* Add Subsidiary modal */}
      <Modal open={subOpen} onClose={() => setSubOpen(false)} title="Add Subsidiary">
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Adding subsidiary under:{" "}
            <span className="font-semibold text-primary">
              {locations.find((l) => l.id === parentId)?.name ?? "—"}
            </span>
          </p>
          <input
            className="input-dark w-full px-3 py-2.5 text-sm"
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void saveSubsidiary()}
            placeholder="Subsidiary name (e.g. Phase 1) *"
          />
          <button className="btn-property w-full py-2.5 text-sm" type="button" onClick={() => void saveSubsidiary()}>
            Save Subsidiary
          </button>
        </div>
      </Modal>
    </div>
  );
}
