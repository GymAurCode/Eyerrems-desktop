import { useEffect, useState } from "react";
import { X, Paperclip, Plus, ChevronDown, ChevronRight, Trash2, Save } from "lucide-react";
import { propApi, PropertyDetail as PD, Location, Amenity } from "../../lib/propertyApi";
import { uploadsUrl } from "../../lib/config";

type Props = { propertyId: number; onClose: () => void };

const STATUS_COLOR: Record<string, string> = {
  available: "#10b981", sold: "#ef4444", rented: "#f59e0b",
  reserved: "#6366f1", maintenance: "#94a3b8",
};

interface DraftUnit {
  tempId: number;
  unit_number: string;
  status: string;
  size: string;
  rent_amount: string;
}

interface DraftFloor {
  tempId: number;
  floor_number: string;
  units: DraftUnit[];
}

let draftIdCounter = 0;

export default function PropertyDetailDrawer({ propertyId, onClose }: Props) {
  const [prop, setProp]           = useState<PD | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());
  const [saving, setSaving]       = useState(false);

  const [draftFloors, setDraftFloors] = useState<DraftFloor[]>([]);

  const load = async () => {
    try {
      const [pdRes, locsRes, amsRes] = await Promise.all([
        propApi.getProperty(propertyId),
        propApi.getLocations(),
        propApi.getAmenities(),
      ]);
      const pd = pdRes && 'data' in pdRes ? (pdRes as any).data : pdRes;
      const locs = locsRes && 'data' in locsRes ? (locsRes as any).data : locsRes;
      const ams = amsRes && 'data' in amsRes ? (amsRes as any).data : amsRes;
      setProp(pd || null);
      setLocations(Array.isArray(locs) ? locs : []);
      setAmenities(Array.isArray(ams) ? ams : []);
      if (pd?.floors) {
        setExpanded(new Set(pd.floors.map((f: any) => f.id)));
      }
    } catch {
      setProp(null);
      setLocations([]);
      setAmenities([]);
    }
  };

  useEffect(() => { void load(); }, [propertyId]);

  const toggleFloor = (id: number) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const addDraftFloor = () => {
    setDraftFloors((prev) => [
      ...prev,
      { tempId: --draftIdCounter, floor_number: "", units: [] },
    ]);
  };

  const updateDraftFloor = (tempId: number, floor_number: string) => {
    setDraftFloors((prev) =>
      prev.map((f) => (f.tempId === tempId ? { ...f, floor_number } : f))
    );
  };

  const removeDraftFloor = (tempId: number) => {
    setDraftFloors((prev) => prev.filter((f) => f.tempId !== tempId));
  };

  const addDraftUnit = (floorTempId: number) => {
    setDraftFloors((prev) =>
      prev.map((f) =>
        f.tempId === floorTempId
          ? { ...f, units: [...f.units, { tempId: --draftIdCounter, unit_number: "", status: "available", size: "", rent_amount: "" }] }
          : f
      )
    );
  };

  const updateDraftUnit = (floorTempId: number, unitTempId: number, field: keyof DraftUnit, value: string) => {
    setDraftFloors((prev) =>
      prev.map((f) =>
        f.tempId === floorTempId
          ? { ...f, units: f.units.map((u) => (u.tempId === unitTempId ? { ...u, [field]: value } : u)) }
          : f
      )
    );
  };

  const removeDraftUnit = (floorTempId: number, unitTempId: number) => {
    setDraftFloors((prev) =>
      prev.map((f) =>
        f.tempId === floorTempId
          ? { ...f, units: f.units.filter((u) => u.tempId !== unitTempId) }
          : f
      )
    );
  };

  const saveDrafts = async () => {
    setSaving(true);
    try {
      for (const df of draftFloors) {
        if (!df.floor_number) continue;
        const floorRes = await propApi.createFloor({ property_id: propertyId, floor_number: Number(df.floor_number) });
        const floorId = floorRes.id;
        for (const du of df.units) {
          if (!du.unit_number) continue;
          await propApi.createUnit({
            floor_id: floorId, unit_number: du.unit_number, status: du.status,
            size: du.size || null, rent_amount: du.rent_amount ? Number(du.rent_amount) : null,
          });
        }
      }
      setDraftFloors([]);
      await load();
    } catch {
      alert("Failed to save floors and units");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    await propApi.uploadImage(propertyId, file);
    e.target.value = ""; await load();
  };

  const uploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    await propApi.uploadAttachment(propertyId, file);
    e.target.value = ""; await load();
  };

  const hasDrafts = draftFloors.length > 0;

  if (!prop) {
    return (
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl z-40 flex items-center justify-center"
        style={{ background: "var(--bg-surface)", borderLeft: "1px solid var(--border)" }}>
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const location = Array.isArray(locations) ? locations.find((l) => l.id === prop.location_id) : null;
  const parentLoc = location && Array.isArray(locations) ? locations.find((l) => l.id === location.parent_id) : null;
  const propAmenities = Array.isArray(amenities) && prop.amenity_ids
    ? amenities.filter((a) => prop.amenity_ids.includes(a.id))
    : [];
  const statusColor = STATUS_COLOR[prop.status] ?? "#94a3b8";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/40" />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl z-40 flex flex-col overflow-hidden animate-slide-up"
        style={{ background: "var(--bg-surface)", borderLeft: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-blue-400">{prop.tid}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${statusColor}18`, color: statusColor }}>
                {prop.status}
              </span>
            </div>
            <h2 className="text-base font-bold text-primary mt-0.5">{prop.name}</h2>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Images */}
          {prop.images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {prop.images.map((img) => (
                <img key={img.id} src={uploadsUrl(img.file_path)} alt=""
                  className="h-28 w-40 object-cover rounded-xl" style={{ border: "1px solid var(--border)" }} />
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-blue-400 cursor-pointer hover:text-blue-300 w-fit">
            <Plus size={13} /> Add image
            <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadImage(e)} />
          </label>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Address",    prop.address || "—"],
              ["Category",   prop.category_name || "—"],
              ["Size",       prop.size || "—"],
              ["Year Built", prop.year_built?.toString() || "—"],
              ["For Sale",   prop.for_sale ? `Yes — AED ${Number(prop.sale_price).toLocaleString()}` : "No"],
              ["Location",   parentLoc ? `${parentLoc.name} › ${location?.name}` : location?.name || "—"],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl px-4 py-3" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                <p className="text-[10px] text-muted uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-sm text-primary font-medium">{val}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          {prop.description && (
            <div>
              <p className="text-xs text-muted mb-1.5">Description</p>
              <p className="text-sm text-secondary leading-relaxed">{prop.description}</p>
            </div>
          )}

          {/* Amenities */}
          {propAmenities.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-2">Amenities</p>
              <div className="flex flex-wrap gap-1.5">
                {propAmenities.map((a) => (
                  <span key={a.id} className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}>
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Floors & Units */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-primary">Floors &amp; Units</p>
              <div className="flex items-center gap-2">
                {hasDrafts && (
                  <button type="button" onClick={saveDrafts} disabled={saving}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "var(--accent-primary, #f6ce3a)", color: "#000" }}>
                    <Save size={13} /> {saving ? "Saving..." : "Save"}
                  </button>
                )}
                <button type="button" onClick={addDraftFloor}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors">
                  <Plus size={12} /> Add Floor
                </button>
              </div>
            </div>

            {/* Existing floors */}
            {prop.floors.length === 0 && !hasDrafts && (
              <p className="text-xs text-muted py-4 text-center">No floors yet.</p>
            )}
            {prop.floors.map((floor) => (
              <div key={floor.id} className="mb-2 rounded-xl overflow-hidden"
                style={{ border: "1px solid var(--border)" }}>
                <button type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-primary transition-colors"
                  style={{ color: "var(--text-primary)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  onClick={() => toggleFloor(floor.id)}>
                  <span className="flex items-center gap-2">
                    {expanded.has(floor.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="text-xs font-mono text-blue-400">{floor.tid}</span>
                    Floor {floor.floor_number}
                  </span>
                  <span className="text-xs text-muted">{floor.units.length} units</span>
                </button>
              </div>
            ))}

            {/* Draft floors */}
            {draftFloors.map((df) => (
              <div key={df.tempId} className="mb-3 rounded-xl overflow-hidden"
                style={{ border: "2px dashed var(--accent-primary, #f6ce3a)" }}>
                <div className="flex items-center gap-2 px-4 py-3"
                  style={{ background: "rgba(246,206,58,0.05)", borderBottom: "1px solid var(--border)" }}>
                  <input className="flex-1 bg-transparent text-sm font-medium outline-none"
                    style={{ color: "var(--text-primary)" }}
                    value={df.floor_number}
                    onChange={(e) => updateDraftFloor(df.tempId, e.target.value)}
                    placeholder="Floor number (e.g. 1)"
                  />
                  <button type="button" onClick={() => removeDraftFloor(df.tempId)}
                    className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Draft units */}
                {df.units.map((du) => (
                  <div key={du.tempId} className="flex items-center gap-2 px-5 py-2.5 flex-wrap"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <input className="bg-transparent text-xs outline-none w-20"
                      style={{ color: "var(--text-primary)" }}
                      value={du.unit_number} onChange={(e) => updateDraftUnit(df.tempId, du.tempId, "unit_number", e.target.value)}
                      placeholder="Unit #"
                    />
                    <input className="bg-transparent text-xs outline-none w-24"
                      style={{ color: "var(--text-secondary)" }}
                      value={du.size} onChange={(e) => updateDraftUnit(df.tempId, du.tempId, "size", e.target.value)}
                      placeholder="Size"
                    />
                    <input className="bg-transparent text-xs outline-none w-28"
                      style={{ color: "var(--text-secondary)" }}
                      type="number" value={du.rent_amount}
                      onChange={(e) => updateDraftUnit(df.tempId, du.tempId, "rent_amount", e.target.value)}
                      placeholder="Rent (AED)"
                    />
                    <select className="bg-transparent text-xs outline-none"
                      style={{ color: "var(--text-secondary)" }}
                      value={du.status}
                      onChange={(e) => updateDraftUnit(df.tempId, du.tempId, "status", e.target.value)}>
                      {["available","reserved","rented","sold","maintenance"].map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeDraftUnit(df.tempId, du.tempId)}
                      className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                <button type="button" onClick={() => addDraftUnit(df.tempId)}
                  className="w-full flex items-center gap-2 px-5 py-2.5 text-xs text-blue-400 hover:bg-blue-500/5 transition-colors">
                  <Plus size={12} /> Add Unit
                </button>
              </div>
            ))}
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-primary">Attachments</p>
              <label className="flex items-center gap-1.5 text-xs text-blue-400 cursor-pointer hover:text-blue-300 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors">
                <Plus size={12} /> Upload
                <input type="file" className="hidden" onChange={(e) => void uploadAttachment(e)} />
              </label>
            </div>
            {prop.attachments.length === 0 && <p className="text-xs text-muted">No attachments.</p>}
            {prop.attachments.map((att) => (
              <a key={att.id} href={uploadsUrl(att.file_path)} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 py-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                <Paperclip size={12} /> {att.filename}
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
