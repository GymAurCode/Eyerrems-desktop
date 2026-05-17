import { useEffect, useState } from "react";
import { X, Building2, MapPin, Tag, Layers, Paperclip, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { propApi, PropertyDetail as PD, Location, Amenity, Floor, Unit } from "../../lib/propertyApi";
import { uploadsUrl } from "../../lib/config";
import Modal from "../Modal";

type Props = { propertyId: number; onClose: () => void };

const STATUS_COLOR: Record<string, string> = {
  available: "#10b981", sold: "#ef4444", rented: "#f59e0b",
  reserved: "#6366f1", maintenance: "#94a3b8",
};

export default function PropertyDetailDrawer({ propertyId, onClose }: Props) {
  const [prop, setProp]           = useState<PD | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());

  // Add floor/unit modals
  const [floorOpen, setFloorOpen]   = useState(false);
  const [floorNum, setFloorNum]     = useState("");
  const [unitOpen, setUnitOpen]     = useState(false);
  const [unitFloor, setUnitFloor]   = useState<number | null>(null);
  const [unitNum, setUnitNum]       = useState("");
  const [unitStatus, setUnitStatus] = useState("available");
  const [unitSize, setUnitSize]     = useState("");
  const [unitRent, setUnitRent]     = useState("");

  const load = async () => {
    const [pd, locs, ams] = await Promise.all([
      propApi.getProperty(propertyId),
      propApi.getLocations(),
      propApi.getAmenities(),
    ]);
    setProp(pd.data);
    setLocations(locs.data);
    setAmenities(ams.data);
    // expand all floors by default
    setExpanded(new Set(pd.data.floors.map((f) => f.id)));
  };

  useEffect(() => { void load(); }, [propertyId]);

  const toggleFloor = (id: number) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const addFloor = async () => {
    if (!floorNum) return;
    await propApi.createFloor({ property_id: propertyId, floor_number: Number(floorNum) });
    setFloorNum(""); setFloorOpen(false); await load();
  };

  const addUnit = async () => {
    if (!unitFloor || !unitNum) return;
    await propApi.createUnit({
      floor_id: unitFloor, unit_number: unitNum, status: unitStatus,
      size: unitSize || null, rent_amount: unitRent ? Number(unitRent) : null,
    });
    setUnitNum(""); setUnitSize(""); setUnitRent(""); setUnitOpen(false); await load();
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

  if (!prop) {
    return (
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl z-40 flex items-center justify-center"
        style={{ background: "var(--bg-surface)", borderLeft: "1px solid var(--border)" }}>
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const location = locations.find((l) => l.id === prop.location_id);
  const parentLoc = location ? locations.find((l) => l.id === location.parent_id) : null;
  const propAmenities = amenities.filter((a) => prop.amenity_ids.includes(a.id));
  const statusColor = STATUS_COLOR[prop.status] ?? "#94a3b8";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} />

      {/* Add Floor Modal — outside drawer so z-50 is not clipped */}
      <Modal open={floorOpen} onClose={() => setFloorOpen(false)} title="Add Floor">
        <div className="space-y-3">
          <input className="input-dark w-full px-4 py-3 text-sm" type="number"
            value={floorNum} onChange={(e) => setFloorNum(e.target.value)} placeholder="Floor number (e.g. 1)" />
          <button className="btn-primary w-full py-3 text-sm" type="button" onClick={() => void addFloor()}>
            Add Floor
          </button>
        </div>
      </Modal>

      {/* Add Unit Modal — outside drawer */}
      <Modal open={unitOpen} onClose={() => setUnitOpen(false)} title="Add Unit">
        <div className="space-y-3">
          <input className="input-dark w-full px-4 py-3 text-sm" value={unitNum}
            onChange={(e) => setUnitNum(e.target.value)} placeholder="Unit number (e.g. 101)" />
          <input className="input-dark w-full px-4 py-3 text-sm" value={unitSize}
            onChange={(e) => setUnitSize(e.target.value)} placeholder="Size (e.g. 850 sqft)" />
          <input className="input-dark w-full px-4 py-3 text-sm" type="number" value={unitRent}
            onChange={(e) => setUnitRent(e.target.value)} placeholder="Monthly rent (AED)" />
          <select className="select-dark w-full px-4 py-3 text-sm" value={unitStatus}
            onChange={(e) => setUnitStatus(e.target.value)}>
            {["available","reserved","rented","sold","maintenance"].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <button className="btn-primary w-full py-3 text-sm" type="button" onClick={() => void addUnit()}>
            Add Unit
          </button>
        </div>
      </Modal>

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
              <button type="button" onClick={() => setFloorOpen(true)}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors">
                <Plus size={12} /> Add Floor
              </button>
            </div>
            {prop.floors.length === 0 && (
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

                {expanded.has(floor.id) && (
                  <div style={{ borderTop: "1px solid var(--border)" }}>
                    {floor.units.map((unit) => {
                      const uc = STATUS_COLOR[unit.status] ?? "#94a3b8";
                      return (
                        <div key={unit.id} className="flex items-center justify-between px-5 py-2.5 transition-colors"
                          style={{ borderBottom: "1px solid var(--border-subtle)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg-sm)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted">{unit.tid}</span>
                            <span className="text-sm text-primary">Unit {unit.unit_number}</span>
                            {unit.size && <span className="text-xs text-muted">{unit.size}</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            {unit.rent_amount && (
                              <span className="text-xs text-muted">AED {Number(unit.rent_amount).toLocaleString()}/mo</span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{ background: `${uc}18`, color: uc }}>
                              {unit.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <button type="button"
                      onClick={() => { setUnitFloor(floor.id); setUnitOpen(true); }}
                      className="w-full flex items-center gap-2 px-5 py-2.5 text-xs text-blue-400 transition-colors"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <Plus size={12} /> Add Unit
                    </button>
                  </div>
                )}
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
