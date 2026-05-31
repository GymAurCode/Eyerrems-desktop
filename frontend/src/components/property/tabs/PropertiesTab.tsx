
import { useEffect, useState, FormEvent, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Building2, ChevronDown, ChevronRight,
  ImagePlus, Paperclip, X, Trash2, Hash, Edit2, AlertTriangle,
  Eye, Printer
} from "lucide-react";
import { QuickRowActions, ActionsTh, ActionsCell, printRecord } from "../../actions";
import Modal from "../../Modal";
import LocationPicker from "../LocationPicker";
import AmenityPicker from "../AmenityPicker";
import AttachmentsButton from "../../attachments/AttachmentsButton";
import { propApi, Property, PropertyCategory } from "../../../lib/propertyApi";
import { formatCurrency } from "../../../lib/currency";
import { SmartTable } from "../../data-table";
import { api } from "../../../lib/api";
import { useLookup } from "../../../hooks/useLookup";

type Props = { onView: (id: number) => void; refresh: number; onRefresh: () => void };

type DraftUnit  = { _key: string; unit_number: string; size: string; rent_amount: string; status: string };
type DraftFloor = { _key: string; floor_number: string; units: DraftUnit[] };

const STATUS_COLOR: Record<string, string> = {
  available: "#10b981", sold: "#ef4444", rented: "#f59e0b",
  reserved: "#6366f1", maintenance: "#94a3b8",
};

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{title}</span>
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(!value)}
        className="relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0"
        style={{ background: value ? "#3b82f6" : "var(--border)" }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
          style={{ left: value ? "22px" : "2px" }} />
      </button>
      <span className="text-sm text-primary">{label}</span>
    </div>
  );
}

export default function PropertiesTab({ onView, refresh, onRefresh }: Props) {
  const navigate = useNavigate();
  const { options: PROP_STATUS_OPTS } = useLookup('property_status');
  const [properties, setProperties]   = useState<Property[]>([]);
  const [categories, setCategories]   = useState<PropertyCategory[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const paramsRef = useRef<any>(null);
  const [open, setOpen]               = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  // TID
  const [tid, setTid]                 = useState("");
  const [tidError, setTidError]       = useState("");
  const [tidChecking, setTidChecking] = useState(false);

  // Basic Info
  const [address, setAddress]         = useState("");
  const [description, setDesc]        = useState("");
  const [status, setStatus]           = useState("available");
  const [categoryId, setCategoryId]   = useState<number | "">("");
  const [size, setSize]               = useState("");
  const [yearBuilt, setYearBuilt]     = useState("");

  // Pricing
  const [forSale, setForSale]         = useState(false);
  const [salePrice, setSalePrice]     = useState("");

  // Location
  const [locationId, setLocationId]   = useState<number | null>(null);

  // Amenities
  const [amenityIds, setAmenityIds]   = useState<number[]>([]);

  // Media
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [attachFiles, setAttachFiles] = useState<File[]>([]);
  const imageInputRef                 = useRef<HTMLInputElement>(null);
  const attachInputRef                = useRef<HTMLInputElement>(null);

  // Floors (optional)
  const [floors, setFloors]                 = useState<DraftFloor[]>([]);
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const [floorsExpanded, setFloorsExpanded] = useState(false);
  const [mediaExpanded, setMediaExpanded]   = useState(true);

  const loadCategories = () => propApi.getCategories().then((res) => {
    const data = res && 'data' in res ? (res as any).data : res;
    setCategories(Array.isArray(data) ? data : []);
  });

  const fetchProperties = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const res = await api.get<Property[]>("/properties", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          property_status: params.status || undefined,
          property_type: params.propertyType || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
          filter: params.dateFilter || undefined,
        }
      });
      const data = res.data;
      setProperties(Array.isArray(data) ? data : []);
      const totalCount = Number(res.headers["x-total-count"] || res.headers["X-Total-Count"] || (Array.isArray(data) ? data.length : 0));
      setTotal(totalCount);
    } catch (err) {
      console.error(err);
      setProperties([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const refreshTable = () => {
    if (paramsRef.current) {
      fetchProperties(paramsRef.current);
    }
  };

  useEffect(() => {
    refreshTable();
  }, [refresh]);

  useEffect(() => { void loadCategories(); }, []);

  const openDialog = async () => {
    reset();
    try {
      const res = await propApi.previewTid();
      const data = res && 'data' in res ? (res as any).data : res;
      setTid(data?.tid ?? "PRO-0001");
    }
    catch { setTid("PRO-0001"); }
    setOpen(true);
  };

  const reset = () => {
    setTid(""); setTidError(""); setAddress(""); setDesc(""); setStatus("available");
    setCategoryId(""); setSize(""); setYearBuilt(""); setForSale(false); setSalePrice("");
    setLocationId(null); setAmenityIds([]);
    setImageFile(null); setImagePreview(null); setAttachFiles([]);
    setFloors([]); setExpandedFloors(new Set());
    setFloorsExpanded(false); setMediaExpanded(true);
    setError("");
  };

  // Debounced TID uniqueness check
  const checkTid = useCallback(async (value: string) => {
    if (!value.trim()) { setTidError("TID is required"); return; }
    setTidChecking(true);
    try {
      const res = await propApi.checkTid(value.trim());
      const data = res && 'data' in res ? (res as any).data : res;
      setTidError(data?.available ? "" : `TID "${value}" is already in use`);
    } catch {
      setTidError("");
    } finally {
      setTidChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!tid) return;
    const t = setTimeout(() => void checkTid(tid), 400);
    return () => clearTimeout(t);
  }, [tid, checkTid]);

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImageFile(file); setImagePreview(URL.createObjectURL(file)); e.target.value = "";
  };
  const onAttachChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
    e.target.value = "";
  };

  const addFloor = () => {
    const key = `f-${Date.now()}`;
    setFloors((prev) => [...prev, { _key: key, floor_number: String(prev.length + 1), units: [] }]);
    setExpandedFloors((prev) => new Set([...prev, key]));
  };
  const removeFloor = (key: string) => setFloors((prev) => prev.filter((f) => f._key !== key));
  const updateFloor = (key: string, val: string) =>
    setFloors((prev) => prev.map((f) => f._key === key ? { ...f, floor_number: val } : f));
  const toggleFloor = (key: string) =>
    setExpandedFloors((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const addUnit = (fk: string) => {
    const uk = `u-${Date.now()}`;
    setFloors((prev) => prev.map((f) =>
      f._key === fk ? { ...f, units: [...f.units, { _key: uk, unit_number: "", size: "", rent_amount: "", status: "available" }] } : f
    ));
  };
  const removeUnit = (fk: string, uk: string) =>
    setFloors((prev) => prev.map((f) => f._key === fk ? { ...f, units: f.units.filter((u) => u._key !== uk) } : f));
  const updateUnit = (fk: string, uk: string, field: keyof DraftUnit, val: string) =>
    setFloors((prev) => prev.map((f) =>
      f._key === fk ? { ...f, units: f.units.map((u) => u._key === uk ? { ...u, [field]: val } : u) } : f
    ));

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError("");
    if (!tid.trim())  { setError("TID is required."); return; }
    if (tidError)     { setError(tidError); return; }
    if (forSale && !salePrice) { setError("Sale price is required when For Sale is enabled."); return; }
    for (const f of floors) {
      if (!f.floor_number) { setError("All floors must have a floor number."); return; }
      for (const u of f.units) {
        if (!u.unit_number) { setError("All units must have a unit number."); return; }
      }
    }
    setSubmitting(true);
    try {
      const propRes = await propApi.createProperty({
        tid: tid.trim(),
        address: address || null, description: description || null,
        status, category_id: categoryId === "" ? null : categoryId, size: size || null,
        for_sale: forSale, sale_price: forSale && salePrice ? Number(salePrice) : null,
        year_built: yearBuilt ? Number(yearBuilt) : null,
        location_id: locationId, amenity_ids: amenityIds,
      });
      const prop = propRes && 'data' in propRes ? (propRes as any).data : propRes;

      if (imageFile) await propApi.uploadImage(prop.id, imageFile);
      for (const file of attachFiles) await propApi.uploadAttachment(prop.id, file);
      for (const f of floors) {
        const floorRes = await propApi.createFloor({ property_id: prop.id, floor_number: Number(f.floor_number) });
        const floor = floorRes && 'data' in floorRes ? (floorRes as any).data : floorRes;
        for (const u of f.units) {
          await propApi.createUnit({
            floor_id: floor.id, unit_number: u.unit_number,
            size: u.size || null, rent_amount: u.rent_amount ? Number(u.rent_amount) : null, status: u.status,
          });
        }
      }
      reset(); setOpen(false); onRefresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to create property.");
    } finally { setSubmitting(false); }
  };

  const handleDeleteProperty = async (p: Property) => {
    await propApi.deleteProperty(p.id);
    onRefresh();
  };

  const columns = [
    {
      key: "tid",
      label: "TID",
      className: "font-mono text-xs text-blue-400"
    },
    {
      key: "address",
      label: "Address",
      render: (val: any) => val || "—",
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
      key: "category_name",
      label: "Category",
      render: (val: any) => val || "—",
      className: "text-secondary"
    },
    {
      key: "size",
      label: "Size",
      render: (val: any) => val || "—",
      className: "text-secondary"
    },
    {
      key: "for_sale",
      label: "For Sale",
      render: (val: any, row: Property) => row.for_sale ? formatCurrency(row.sale_price) : "No",
      className: "text-secondary"
    }
  ];

  const rowActions = [
    {
      key: "view",
      label: "View",
      icon: Eye,
      onClick: (row: Property) => navigate(`/property/${row.id}`),
    },
    {
      key: "edit",
      label: "Edit",
      icon: Edit2,
      onClick: (row: Property) => navigate(`/property/${row.id}`),
    },
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      variant: "danger" as const,
      onClick: (row: Property) => void handleDeleteProperty(row),
    },
    {
      key: "print",
      label: "Print",
      icon: Printer,
      onClick: (row: Property) => printRecord(`Property ${row.tid}`, [
        { label: "TID", value: row.tid },
        { label: "Address", value: row.address || "—" },
        { label: "Status", value: row.status },
        { label: "Category", value: row.category_name || "—" },
        { label: "Size", value: row.size || "—" },
        { label: "For Sale", value: row.for_sale ? formatCurrency(row.sale_price) : "No" },
      ])
    }
  ];

  return (
    <>
      <SmartTable
        storageKey="rems_properties"
        data={properties}
        columns={columns}
        rowActions={rowActions}
        loading={loading}
        total={total}
        onParamsChange={fetchProperties}
        showTypeFilter={true}
        typeOptions={categories.map((c) => ({ label: c.name, value: c.name }))}
        showStatusFilter={true}
        statusOptions={[
          { label: "Available", value: "available" },
          { label: "Reserved", value: "reserved" },
          { label: "Rented", value: "rented" },
          { label: "Sold", value: "sold" },
          { label: "Maintenance", value: "maintenance" }
        ]}
        showDateFilter={true}
        toolbarActions={
          <button type="button" onClick={() => void openDialog()}
            className="btn-primary flex items-center gap-2 px-3 py-2 text-xs">
            <Plus size={13} /> New Property
          </button>
        }
      />

      {/* ── Create Property Dialog ── */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Property" size="xl">
        <form onSubmit={submit}>
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-xs border flex items-center gap-2"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          {/* TID — editable with validation */}
          <div className="mb-5 p-4 rounded-xl" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Hash size={11} /> Tracking ID
            </label>
            <div className="flex items-center gap-2">
              <input
                className="input-dark flex-1 px-3 py-2 text-sm font-mono"
                value={tid}
                onChange={(e) => { setTid(e.target.value.toUpperCase()); setTidError(""); }}
                placeholder="PRO-0001"
                required
              />
              {tidChecking && <span className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin shrink-0" />}
            </div>
            {tidError && <p className="text-[11px] text-red-400 mt-1">{tidError}</p>}
            {!tidError && tid && !tidChecking && <p className="text-[11px] text-emerald-400 mt-1">TID is available</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">

            {/* LEFT */}
            <div className="space-y-5">
              <div>
                <SectionLabel title="Basic Info" />
                <div className="space-y-3">
                  <input className="input-dark w-full px-4 py-2.5 text-sm" value={address}
                    onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted mb-1">Status</label>
                      <select className="select-dark w-full px-3 py-2.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                        {PROP_STATUS_OPTS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">Category</label>
                      <select className="select-dark w-full px-3 py-2.5 text-sm" value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}>
                        <option value="">— Select category —</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted mb-1">Size</label>
                      <input className="input-dark w-full px-3 py-2.5 text-sm" value={size}
                        onChange={(e) => setSize(e.target.value)} placeholder="e.g. 2500 sqft" />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">Year Built</label>
                      <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={yearBuilt}
                        onChange={(e) => setYearBuilt(e.target.value)} placeholder="e.g. 2018" />
                    </div>
                  </div>
                  <textarea className="input-dark w-full px-4 py-2.5 text-sm resize-none" rows={2} value={description}
                    onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" />
                </div>
              </div>

              <div>
                <SectionLabel title="Pricing" />
                <div className="space-y-3">
                  <Toggle value={forSale} onChange={setForSale} label="For Sale" />
                  {forSale && (
                    <input className="input-dark w-full px-4 py-2.5 text-sm" type="number" value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)} placeholder="Sale price (Rs) *" required />
                  )}
                </div>
              </div>

              <div>
                <SectionLabel title="Location" />
                <LocationPicker value={locationId} onChange={setLocationId} />
              </div>

              <div>
                <SectionLabel title="Amenities" />
                <AmenityPicker selected={amenityIds} onChange={setAmenityIds} />
              </div>
            </div>

            {/* RIGHT */}
            <div className="space-y-5">
              {/* Media */}
              <div>
                <button type="button" onClick={() => setMediaExpanded((v) => !v)}
                  className="w-full flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Media</span>
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  {mediaExpanded ? <ChevronDown size={12} className="text-muted shrink-0" /> : <ChevronRight size={12} className="text-muted shrink-0" />}
                </button>
                {mediaExpanded && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-muted mb-2">Main Image</label>
                      {imagePreview ? (
                        <div className="relative w-full h-32 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                          <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(0,0,0,0.6)" }}>
                            <X size={12} className="text-white" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => imageInputRef.current?.click()}
                          className="w-full h-20 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors"
                          style={{ border: "2px dashed var(--border)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.4)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
                          <ImagePlus size={18} className="text-muted" />
                          <span className="text-xs text-muted">Click to upload</span>
                        </button>
                      )}
                      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={onImageChange} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-2">Attachments</label>
                      <button type="button" onClick={() => attachInputRef.current?.click()}
                        className="flex items-center gap-2 text-xs text-blue-400 px-3 py-2 rounded-lg transition-colors"
                        style={{ border: "1px solid rgba(59,130,246,0.2)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.08)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                        <Paperclip size={13} /> Add files
                      </button>
                      <input ref={attachInputRef} type="file" multiple className="hidden" onChange={onAttachChange} />
                      {attachFiles.length > 0 && (
                        <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                          {attachFiles.map((f, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                              style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                              <span className="text-xs text-secondary truncate flex-1">{f.name}</span>
                              <button type="button" onClick={() => setAttachFiles((prev) => prev.filter((_, j) => j !== i))}
                                className="ml-2 text-muted hover:text-red-400 transition-colors shrink-0">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Floors & Units — optional */}
              <div>
                <button type="button" onClick={() => setFloorsExpanded((v) => !v)}
                  className="w-full flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Floors &amp; Units</span>
                  <span className="text-[10px] text-muted">(optional)</span>
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  {floorsExpanded ? <ChevronDown size={12} className="text-muted shrink-0" /> : <ChevronRight size={12} className="text-muted shrink-0" />}
                </button>
                {floorsExpanded && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted">
                        {floors.length === 0 ? "Can be added later from the property page" :
                          `${floors.length} floor${floors.length !== 1 ? "s" : ""} · ${floors.reduce((s, f) => s + f.units.length, 0)} units`}
                      </p>
                      <button type="button" onClick={addFloor}
                        className="flex items-center gap-1.5 text-xs text-blue-400 px-3 py-1.5 rounded-lg transition-colors"
                        style={{ border: "1px solid rgba(59,130,246,0.2)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.08)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                        <Plus size={12} /> Add Floor
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                      {floors.map((floor) => (
                        <div key={floor._key} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                          <div className="flex items-center gap-2 px-3 py-2" style={{ background: "var(--bg-surface2)" }}>
                            <button type="button" onClick={() => toggleFloor(floor._key)} className="text-muted hover:text-primary transition-colors">
                              {expandedFloors.has(floor._key) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </button>
                            <span className="text-xs text-muted">Floor</span>
                            <input className="input-dark w-14 px-2 py-1 text-xs text-center" type="number"
                              value={floor.floor_number} onChange={(e) => updateFloor(floor._key, e.target.value)} placeholder="#" />
                            <span className="text-xs text-muted flex-1">{floor.units.length} unit{floor.units.length !== 1 ? "s" : ""}</span>
                            <button type="button" onClick={() => removeFloor(floor._key)} className="text-muted hover:text-red-400 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                          {expandedFloors.has(floor._key) && (
                            <div style={{ borderTop: "1px solid var(--border)" }}>
                              {floor.units.map((unit) => (
                                <div key={unit._key} className="grid gap-1.5 px-2.5 py-2 items-center"
                                  style={{ gridTemplateColumns: "1fr 1fr 1fr auto auto", borderBottom: "1px solid var(--border-subtle)" }}>
                                  <input className="input-dark px-2 py-1.5 text-xs" value={unit.unit_number}
                                    onChange={(e) => updateUnit(floor._key, unit._key, "unit_number", e.target.value)} placeholder="Unit # *" />
                                  <input className="input-dark px-2 py-1.5 text-xs" value={unit.size}
                                    onChange={(e) => updateUnit(floor._key, unit._key, "size", e.target.value)} placeholder="Size" />
                                  <input className="input-dark px-2 py-1.5 text-xs" type="number" value={unit.rent_amount}
                                    onChange={(e) => updateUnit(floor._key, unit._key, "rent_amount", e.target.value)} placeholder="Rent (Rs)" />
                                  <select className="select-dark px-1.5 py-1.5 text-xs" value={unit.status}
                                    onChange={(e) => updateUnit(floor._key, unit._key, "status", e.target.value)}>
                                    {PROP_STATUS_OPTS.map(opt => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                  <button type="button" onClick={() => removeUnit(floor._key, unit._key)} className="text-muted hover:text-red-400 transition-colors">
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                              <button type="button" onClick={() => addUnit(floor._key)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-blue-400 transition-colors"
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                                <Plus size={11} /> Add Unit
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <AttachmentsButton module="property" />
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="submit" disabled={submitting || !!tidError}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
              {submitting
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
                : "Create Property"}
            </button>
          </div>
        </form>
      </Modal>

    </>
  );
}
