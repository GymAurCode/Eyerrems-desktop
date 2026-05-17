import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2, MapPin, Tag, Layers, Paperclip,
  Plus, ChevronDown, ChevronRight, ImagePlus,
  Calendar, Ruler, DollarSign, Edit2, Trash2,
} from "lucide-react";
import { propApi, PropertyDetail, Location, Amenity } from "../lib/propertyApi";
import { uploadsUrl } from "../lib/config";
import { formatCurrency } from "../lib/currency";
import Modal from "../components/Modal";
import {
  DetailPage, DetailHeader, DetailBody, DetailSection,
  InfoGrid, DataTable, TagList, AttachmentList, StatusBadge,
} from "../components/detail";

const STATUS_COLOR: Record<string, string> = {
  available: "#10b981", sold: "#ef4444", rented: "#f59e0b",
  reserved: "#6366f1", maintenance: "#94a3b8",
};

export default function PropertyViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const propId = Number(id);

  const [prop, setProp]           = useState<PropertyDetail | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());

  const [floorOpen, setFloorOpen] = useState(false);
  const [floorNum, setFloorNum]   = useState("");
  const [unitOpen, setUnitOpen]     = useState(false);
  const [unitFloor, setUnitFloor]   = useState<number | null>(null);
  const [unitNum, setUnitNum]       = useState("");
  const [unitSize, setUnitSize]     = useState("");
  const [unitRent, setUnitRent]     = useState("");
  const [unitStatus, setUnitStatus] = useState("available");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pd, locs, ams] = await Promise.all([
        propApi.getProperty(propId), propApi.getLocations(), propApi.getAmenities(),
      ]);
      setProp(pd.data); setLocations(locs.data); setAmenities(ams.data);
      setExpanded(new Set(pd.data.floors.map((f) => f.id)));
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [propId]);

  const toggleFloor = (id: number) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const addFloor = async () => {
    if (!floorNum) return;
    await propApi.createFloor({ property_id: propId, floor_number: Number(floorNum) });
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
    await propApi.uploadImage(propId, file); e.target.value = ""; await load();
  };

  const uploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    await propApi.uploadAttachment(propId, file); e.target.value = ""; await load();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await propApi.deleteProperty(propId); navigate("/property"); }
    finally { setDeleting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  if (!prop) return (
    <div className="p-6 text-center">
      <Building2 size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
      <p style={{ color: "var(--text-secondary)" }}>Property not found.</p>
      <button type="button" onClick={() => navigate("/property")} className="btn-primary px-4 py-2 text-sm mt-4">
        Back to Properties
      </button>
    </div>
  );

  const location      = locations.find((l) => l.id === prop.location_id);
  const parentLoc     = location ? locations.find((l) => l.id === location.parent_id) : null;
  const propAmenities = amenities.filter((a) => prop.amenity_ids.includes(a.id));
  const locationStr   = parentLoc ? `${parentLoc.name} › ${location?.name}` : location?.name || "—";
  const totalUnits    = prop.floors.reduce((s, f) => s + f.units.length, 0);

  return (
    <DetailPage>
      {/* ── Header ── */}
      <DetailHeader
        backTo="/property"
        title={prop.name}
        subtitle={prop.address}
        badge={<StatusBadge status={prop.status} />}
        meta={[
          { label: "ID",       value: <span className="font-mono" style={{ color: "#60a5fa" }}>{prop.tid}</span> },
          { label: "Category", value: prop.category_name ?? "—" },
          { label: "Floors",   value: `${prop.floors.length}` },
          { label: "Units",    value: `${totalUnits}` },
        ]}
        actions={[
          { label: "Edit",   icon: Edit2,  onClick: () => navigate(`/property/${propId}/edit`) },
          { label: "Delete", icon: Trash2, onClick: () => setDeleteOpen(true), variant: "danger" },
        ]}
      />

      <DetailBody>
        {/* ── Section 1: Main Details ── */}
        <DetailSection title="Property Details" icon={Building2}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Images */}
            <div className="lg:col-span-1">
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {prop.images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-1 p-1">
                    {prop.images.map((img) => (
                      <img key={img.id} src={uploadsUrl(img.file_path)} alt=""
                        className="w-full h-28 object-cover rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="h-36 flex flex-col items-center justify-center gap-2"
                    style={{ background: "var(--bg-surface2)" }}>
                    <Building2 size={28} style={{ color: "var(--text-muted)" }} />
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>No images</p>
                  </div>
                )}
                <div className="px-3 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer w-fit" style={{ color: "#60a5fa" }}>
                    <ImagePlus size={12} /> Add image
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadImage(e)} />
                  </label>
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div className="lg:col-span-2">
              <InfoGrid items={[
                { label: "Property ID",  value: <span className="font-mono text-xs" style={{ color: "#60a5fa" }}>{prop.tid}</span> },
                { label: "Status",       value: <StatusBadge status={prop.status} /> },
                { label: "Category",     value: prop.category_name ?? "—" },
                { label: "Location",     value: locationStr },
                { label: "Size",         value: prop.size || "—" },
                { label: "Year Built",   value: prop.year_built?.toString() || "—" },
                { label: "For Sale",     value: prop.for_sale ? formatCurrency(prop.sale_price) : "No" },
                { label: "Description",  value: prop.description || "—" },
              ]} />
            </div>
          </div>
        </DetailSection>

        {/* ── Section 2: Floors & Units ── */}
        <DetailSection
          title="Floors & Units"
          icon={Layers}
          action={
            <button type="button" onClick={() => setFloorOpen(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.08)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
              <Plus size={12} /> Add Floor
            </button>
          }
          noPad
        >
          {prop.floors.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 size={28} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>No floors yet.</p>
              <button type="button" onClick={() => setFloorOpen(true)} className="btn-primary px-4 py-2 text-xs">
                Add First Floor
              </button>
            </div>
          ) : (
            <div>
              {prop.floors.map((floor) => (
                <div key={floor.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <button type="button"
                    className="w-full flex items-center justify-between px-6 py-3.5 text-left transition-colors"
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--hover-bg-sm)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                    onClick={() => toggleFloor(floor.id)}>
                    <span className="flex items-center gap-3">
                      {expanded.has(floor.id)
                        ? <ChevronDown size={13} style={{ color: "var(--text-muted)" }} />
                        : <ChevronRight size={13} style={{ color: "var(--text-muted)" }} />}
                      <span className="font-mono text-xs" style={{ color: "#60a5fa" }}>{floor.tid}</span>
                      <span className="text-sm font-medium text-primary">Floor {floor.floor_number}</span>
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {floor.units.length} unit{floor.units.length !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {expanded.has(floor.id) && (
                    <div style={{ background: "var(--bg-surface2)" }}>
                      <DataTable
                        columns={[
                          { key: "tid",    label: "TID" },
                          { key: "unit",   label: "Unit #" },
                          { key: "size",   label: "Size" },
                          { key: "rent",   label: "Rent/mo", align: "right" },
                          { key: "status", label: "Status" },
                        ]}
                        emptyText="No units on this floor."
                        rows={floor.units.map((u) => ({
                          tid:    <span className="font-mono text-xs" style={{ color: "#60a5fa" }}>{u.tid}</span>,
                          unit:   <span className="font-medium">{u.unit_number}</span>,
                          size:   <span style={{ color: "var(--text-secondary)" }}>{u.size || "—"}</span>,
                          rent:   <span style={{ color: "var(--text-secondary)" }}>{u.rent_amount ? formatCurrency(u.rent_amount) : "—"}</span>,
                          status: <StatusBadge status={u.status} />,
                        }))}
                      />
                      <button type="button"
                        onClick={() => { setUnitFloor(floor.id); setUnitOpen(true); }}
                        className="w-full flex items-center gap-2 px-6 py-2.5 text-xs transition-colors"
                        style={{ color: "#60a5fa" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--hover-bg)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                        <Plus size={11} /> Add Unit to Floor {floor.floor_number}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        {/* ── Section 3: Amenities ── */}
        <DetailSection title="Amenities" icon={Tag}>
          <TagList tags={propAmenities.map((a) => a.name)} />
        </DetailSection>

        {/* ── Section 4: Attachments ── */}
        <DetailSection title="Attachments" icon={Paperclip}>
          <AttachmentList
            attachments={prop.attachments}
            urlFn={uploadsUrl}
            onUpload={async (file) => {
              const input = document.createElement("input");
              input.type = "file";
              const e = { target: { files: [file], value: "" } } as any;
              await uploadAttachment(e);
            }}
          />
          <label className="flex items-center gap-1.5 text-xs cursor-pointer mt-3" style={{ color: "#60a5fa" }}>
            <Plus size={12} /> Upload attachment
            <input type="file" className="hidden" onChange={(e) => void uploadAttachment(e)} />
          </label>
        </DetailSection>
      </DetailBody>

      {/* ── Modals ── */}
      <Modal open={floorOpen} onClose={() => setFloorOpen(false)} title="Add Floor">
        <div className="space-y-3">
          <input className="input-dark w-full px-4 py-3 text-sm" type="number"
            value={floorNum} onChange={(e) => setFloorNum(e.target.value)} placeholder="Floor number (e.g. 1)" />
          <button className="btn-primary w-full py-3 text-sm" type="button" onClick={() => void addFloor()}>
            Add Floor
          </button>
        </div>
      </Modal>

      <Modal open={unitOpen} onClose={() => setUnitOpen(false)} title="Add Unit">
        <div className="space-y-3">
          <input className="input-dark w-full px-4 py-3 text-sm" value={unitNum}
            onChange={(e) => setUnitNum(e.target.value)} placeholder="Unit number (e.g. 101) *" />
          <input className="input-dark w-full px-4 py-3 text-sm" value={unitSize}
            onChange={(e) => setUnitSize(e.target.value)} placeholder="Size (e.g. 850 sqft)" />
          <input className="input-dark w-full px-4 py-3 text-sm" type="number" value={unitRent}
            onChange={(e) => setUnitRent(e.target.value)} placeholder="Monthly rent" />
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

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Property">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Delete <span className="font-semibold text-primary">{prop.tid}</span>? This removes all floors, units, images, and attachments permanently.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setDeleteOpen(false)}
              className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--hover-bg)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
              Cancel
            </button>
            <button type="button" onClick={() => void handleDelete()} disabled={deleting}
              className="flex-1 py-2.5 text-sm rounded-xl font-medium text-white flex items-center justify-center gap-2"
              style={{ background: deleting ? "#6b7280" : "#ef4444" }}>
              {deleting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Delete Property
            </button>
          </div>
        </div>
      </Modal>
    </DetailPage>
  );
}
