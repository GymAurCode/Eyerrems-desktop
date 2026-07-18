import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2, Tag, Layers, Paperclip, Clock,
  Plus, ChevronDown, ChevronRight, ImagePlus,
  DollarSign, Edit2, Trash2, Save,
  Archive, Landmark, TrendingUp, Wrench, Banknote, X, ChevronLeft,
} from "lucide-react";
import { propApi, PropertyDetail, PropertyAttachment, Location, Amenity } from "../lib/propertyApi";
import { uploadsUrl } from "../lib/config";
import { formatCurrency } from "../lib/currency";
import { auditApi, AuditLogEntry } from "../lib/auditApi";
import AppDialog from "../components/ui/AppDialog";
import RecordHistory from "../components/RecordHistory";
import { useNotifStore } from "../store/notifications";
import SearchableSelect from "../components/ui/SearchableSelect";
import StatCard from "../components/ui/StatCard";
import { accountsApi } from "../lib/financeApi";
import {
  DetailPage, DetailHeader, DetailBody, DetailSection,
  InfoGrid, DataTable, TagList, StatusBadge,
} from "../components/detail";
import AttachmentPanel from "../components/attachments/AttachmentPanel";
import { useLookup } from "../hooks/useLookup";
import type { SearchableOption } from "../components/ui/SearchableSelect";

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

const LISTING_COLORS: Record<string, string> = {
  available: "#10b981", under_offer: "#f59e0b", sold: "#ef4444",
  off_market: "#6b7280", coming_soon: "#6366f1",
};
const OPERATIONAL_COLORS: Record<string, string> = {
  active: "#10b981", under_renovation: "#f59e0b",
  vacant: "#6b7280", archived: "#94a3b8",
};

function TimelineIcon({ action }: { action: string }) {
  const icons: Record<string, any> = {
    CREATE: Plus, UPDATE: Edit2, DELETE: Trash2,
  };
  const Icon = icons[action] || Clock;
  const colors: Record<string, string> = {
    CREATE: "#10b981", UPDATE: "#f59e0b", DELETE: "#ef4444",
  };
  const color = colors[action] || "#6b7280";
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
      style={{ background: `${color}18`, border: `2px solid ${color}40` }}>
      <Icon size={12} style={{ color }} />
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function PropertyViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const propId = Number(id);
  const { options: UNIT_STATUS_OPTS } = useLookup('unit_status');
  const pushToast = useNotifStore((s) => s.pushToast);

  const [prop, setProp]           = useState<PropertyDetail | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());

  // COA Linkage edit modal
  const [coaEditOpen, setCoaEditOpen] = useState(false);
  const [coaOptions, setCoaOptions] = useState<SearchableOption[]>([]);
  const [editIncomeGl, setEditIncomeGl] = useState("");
  const [editExpenseGl, setEditExpenseGl] = useState("");
  const [editAssetGl, setEditAssetGl] = useState("");

  // Draft floors/units
  const [draftFloors, setDraftFloors] = useState<DraftFloor[]>([]);
  const [savingFloors, setSavingFloors] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving]     = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  // Image preview
  const [previewImgIndex, setPreviewImgIndex] = useState<number | null>(null);

  // Document delete
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [pdRes, locsRes, amsRes, audRes] = await Promise.all([
        propApi.getProperty(propId),
        propApi.getLocations(),
        propApi.getAmenities(),
        auditApi.getRecordHistory(String(propId)).catch(() => []),
      ]);
      const pd = pdRes && 'data' in pdRes ? (pdRes as any).data : pdRes;
      const locs = locsRes && 'data' in locsRes ? (locsRes as any).data : locsRes;
      const ams = amsRes && 'data' in amsRes ? (amsRes as any).data : amsRes;
      setProp(pd || null);
      setLocations(Array.isArray(locs) ? locs : []);
      setAmenities(Array.isArray(ams) ? ams : []);
      setAuditLogs(Array.isArray(audRes) ? audRes.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) : []);
      setExpanded(new Set());
    } catch {
      setProp(null);
      setLocations([]);
      setAmenities([]);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [propId]);

  const openCoaEdit = async () => {
    if (!prop) return;
    if (coaOptions.length === 0) {
      try {
        const accounts = await accountsApi.list();
        const opts: SearchableOption[] = accounts.map(a => ({
          value: String(a.id),
          label: `${a.code} - ${a.name}`,
          sublabel: a.account_type,
          meta: a.description || undefined,
        }));
        setCoaOptions(opts);
      } catch { return; }
    }
    setEditIncomeGl(prop.income_gl_account_id ? String(prop.income_gl_account_id) : "");
    setEditExpenseGl(prop.expense_gl_account_id ? String(prop.expense_gl_account_id) : "");
    setEditAssetGl(prop.asset_gl_account_id ? String(prop.asset_gl_account_id) : "");
    setCoaEditOpen(true);
  };

  const saveCoaLinks = async () => {
    if (!prop) return;
    await propApi.updateProperty(propId, {
      income_gl_account_id: editIncomeGl ? Number(editIncomeGl) : null,
      expense_gl_account_id: editExpenseGl ? Number(editExpenseGl) : null,
      asset_gl_account_id: editAssetGl ? Number(editAssetGl) : null,
    } as any);
    setCoaEditOpen(false);
    await load();
  };

  const toggleFloor = (id: number) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const addDraftFloor = () => {
    setDraftFloors((prev) => [...prev, { tempId: --draftIdCounter, floor_number: "", units: [] }]);
  };

  const updateDraftFloor = (tempId: number, floor_number: string) => {
    setDraftFloors((prev) => prev.map((f) => (f.tempId === tempId ? { ...f, floor_number } : f)));
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
    setSavingFloors(true);
    try {
      for (const df of draftFloors) {
        if (!df.floor_number) continue;
        const floorRes = await propApi.createFloor({ property_id: propId, floor_number: Number(df.floor_number) });
        for (const du of df.units) {
          if (!du.unit_number) continue;
          await propApi.createUnit({
            floor_id: floorRes.id, unit_number: du.unit_number, status: du.status,
            size: du.size || null, rent_amount: du.rent_amount ? Number(du.rent_amount) : null,
          });
        }
      }
      setDraftFloors([]);
      await load();
    } catch {
      alert("Failed to save floors and units");
    } finally {
      setSavingFloors(false);
    }
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if ((prop?.images.length ?? 0) >= 5) { alert("Maximum 5 images allowed"); e.target.value = ""; return; }
    await propApi.uploadImage(propId, file); e.target.value = ""; await load();
  };

  const handleDeleteDoc = async () => {
    if (!deleteDocId) return;
    await propApi.deleteAttachment(deleteDocId);
    setDeleteDocId(null);
    await load();
  };

  const isArchived = prop?.operational_status === "archived";

  const handleArchive = async () => {
    if (!prop) return;
    setArchiving(true);
    try {
      await propApi.updateProperty(propId, { operational_status: isArchived ? "active" : "archived" } as any);
      setArchiveOpen(false);
      await load();
    } catch {
      alert(`Failed to ${isArchived ? "unarchive" : "archive"} property`);
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await propApi.deleteProperty(propId);
      pushToast({ title: "Success", message: "Property deleted", type: "success" });
      navigate("/property");
    } finally { setDeleting(false); }
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

  const location      = Array.isArray(locations) ? locations.find((l) => l.id === prop.location_id) : null;
  const parentLoc     = location && Array.isArray(locations) ? locations.find((l) => l.id === location.parent_id) : null;
  const propAmenities = Array.isArray(amenities) && prop.amenity_ids
    ? amenities.filter((a) => prop.amenity_ids.includes(a.id))
    : [];
  const locationStr   = parentLoc ? `${parentLoc.name} › ${location?.name}` : location?.name || "—";
  const totalUnits    = prop.floors.reduce((s: number, f: any) => s + f.units.length, 0);
  const rentedUnits   = prop.floors.reduce((s: number, f: any) => s + f.units.filter((u: any) => u.status === "rented" || u.status === "occupied").length, 0);
  const monthlyIncome = prop.floors.reduce((s: number, f: any) =>
    s + f.units.reduce((us: number, u: any) => us + (u.rent_amount || 0), 0), 0);

  return (
    <DetailPage>
      {/* ── Header ── */}
      <DetailHeader
        backTo="/property"
        title={prop.name}
        subtitle={prop.address || undefined}
        badge={<StatusBadge status={prop.status} />}
        meta={[
          { label: "ID",       value: <span className="font-mono" style={{ color: "#60a5fa" }}>{prop.tid}</span> },
          { label: "Category", value: prop.category_name ?? "—" },
          { label: "Floors",   value: `${prop.floors.length}` },
          { label: "Units",    value: `${totalUnits}` },
        ]}
        actions={[
          { label: isArchived ? "Unarchive" : "Archive", icon: Archive, onClick: () => setArchiveOpen(true) },
          { label: "Delete", icon: Trash2, onClick: () => setDeleteOpen(true), variant: "danger" },
        ]}
      />

      <DetailBody>
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* A) FINANCIAL SUMMARY CARDS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mx-3 grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Banknote} label="Purchase Price" value={prop.purchase_price ? formatCurrency(prop.purchase_price) : "—"} iconBg="rgba(59,130,246,0.15)" iconColor="#3b82f6" />
          <StatCard icon={TrendingUp} label="Current Market Value" value={prop.current_market_value ? formatCurrency(prop.current_market_value) : "—"} iconBg="rgba(139,92,246,0.15)" iconColor="#8b5cf6" />
          <StatCard icon={DollarSign} label="Monthly Income" value={monthlyIncome > 0 ? formatCurrency(monthlyIncome) : "—"} iconBg="rgba(16,185,129,0.15)" iconColor="#10b981" />
          <StatCard icon={Wrench} label="Outstanding Maint." value="—" iconBg="rgba(245,158,11,0.15)" iconColor="#f59e0b" />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Section 1: Main Details (existing, extended with new fields) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <DetailSection title="Property Details" icon={Building2}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 lg:max-w-[200px]">
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {prop.images.length > 0 ? (
                  <div className="p-1 space-y-1">
                    {prop.images.map((img: any, i: number) => (
                      <img key={img.id} src={uploadsUrl(img.file_path)} alt=""
                        className="w-full object-contain rounded-lg cursor-pointer"
                        style={{ border: "1px solid var(--border)", maxHeight: 90, background: "var(--bg-surface2)" }}
                        onClick={() => setPreviewImgIndex(i)}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ))}
                  </div>
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center gap-2"
                    style={{ background: "var(--bg-surface2)" }}>
                    <Building2 size={24} style={{ color: "var(--text-muted)" }} />
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>No images</p>
                  </div>
                )}
                <div className="px-3 py-2.5 flex items-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{prop.images.length}/5</span>
                  {prop.images.length < 5 ? (
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer w-fit" style={{ color: "#60a5fa" }}>
                      <ImagePlus size={12} /> Add image
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadImage(e)} />
                    </label>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Max images reached</span>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <InfoGrid items={[
                { label: "Property ID",  value: <span className="font-mono text-xs" style={{ color: "#60a5fa" }}>{prop.tid}</span> },
                { label: "Listing Status", value: prop.listing_status ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${LISTING_COLORS[prop.listing_status] || "#6b7280"}18`,
                             color: LISTING_COLORS[prop.listing_status] || "#6b7280" }}>
                    {prop.listing_status.replace(/_/g, " ")}
                  </span>
                ) : "—" },
                { label: "Operational Status", value: prop.operational_status ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${OPERATIONAL_COLORS[prop.operational_status] || "#6b7280"}18`,
                             color: OPERATIONAL_COLORS[prop.operational_status] || "#6b7280" }}>
                    {prop.operational_status.replace(/_/g, " ")}
                  </span>
                ) : "—" },
                { label: "Category",     value: prop.category_name ?? "—" },
                { label: "Location",     value: locationStr },
                { label: "Size",         value: prop.size ? `${prop.size}${prop.size_unit ? ` ${prop.size_unit}` : ""}` : "—" },
                { label: "Year Built",   value: prop.year_built?.toString() || "—" },
                { label: "For Sale",     value: prop.for_sale ? formatCurrency(prop.sale_price) : "No" },
                { label: "Owner",        value: prop.owner_name || "—" },
                { label: "Owner Type",   value: prop.owner_type || "—" },
                { label: "CNIC/NTN",     value: prop.cnic_ntn || "—" },
                { label: "Ownership %",  value: prop.ownership_pct ? `${prop.ownership_pct}%` : "—" },
                { label: "Title Deed #", value: prop.title_deed_number || "—" },
                { label: "Reg. Date",    value: prop.registration_date || "—" },
                { label: "Mortgage",     value: prop.mortgage_lien ? `Yes (${prop.lender_name || "N/A"})` : "No" },
                { label: "Reg. Authority", value: prop.regulatory_authority || "—" },
                { label: "Description",  value: prop.description || "—" },
              ]} />
            </div>
          </div>
        </DetailSection>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* B) LINKED ACCOUNTS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <DetailSection
          title="Linked GL Accounts"
          icon={Landmark}
          action={
            <button type="button" onClick={() => void openCoaEdit()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.08)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
              <Edit2 size={12} /> Edit
            </button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "Income GL", account: prop.income_gl_account_name, code: prop.income_gl_account_code },
              { label: "Expense GL", account: prop.expense_gl_account_name, code: prop.expense_gl_account_code },
              { label: "Asset GL", account: prop.asset_gl_account_name, code: prop.asset_gl_account_code },
            ].map((item) => (
              <div key={item.label} className="rounded-lg px-4 py-3"
                style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                <p className="text-[10px] uppercase tracking-wider text-muted mb-1">{item.label}</p>
                {item.account ? (
                  <>
                    <p className="text-sm font-medium text-primary">{item.account}</p>
                    {item.code && <p className="text-[10px] font-mono text-muted">{item.code}</p>}
                  </>
                ) : (
                  <p className="text-xs text-muted italic">Not linked</p>
                )}
              </div>
            ))}
          </div>
        </DetailSection>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Section 2: Floors & Units */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <DetailSection
          title="Floors & Units"
          icon={Layers}
          action={
            <div className="flex items-center gap-2">
              {draftFloors.length > 0 && (
                <>
                  <button type="button" onClick={() => setDraftFloors([])}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    Cancel
                  </button>
                  <button type="button" onClick={saveDrafts} disabled={savingFloors}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "var(--accent-primary, #f6ce3a)", color: "#000" }}>
                    <Save size={13} /> {savingFloors ? "Saving..." : "Save"}
                  </button>
                </>
              )}
              <button type="button" onClick={addDraftFloor}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.08)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                <Plus size={12} /> Add Floor
              </button>
            </div>
          }
          noPad
        >
          {prop.floors.length === 0 && draftFloors.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 size={28} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>No floors yet.</p>
              <button type="button" onClick={addDraftFloor} className="btn-primary px-4 py-2 text-xs">
                Add First Floor
              </button>
            </div>
          ) : (
            <div>
              {/* Existing floors */}
              {prop.floors.map((floor: any, fi: number) => (
                <div key={floor.id} style={fi > 0 ? { borderTop: "1px solid var(--border-subtle)" } : undefined}>
                  <button type="button"
                    className="w-full flex items-center justify-between px-6 py-3.5 text-left transition-colors"
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--hover-bg-sm)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                    onClick={() => toggleFloor(floor.id)}>
                    <span className="flex items-center gap-3">
                      {expanded.has(floor.id)
                        ? <ChevronDown size={13} style={{ color: "var(--text-muted)" }} />
                        : <ChevronRight size={13} style={{ color: "var(--text-muted)" }} />}
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ color: "#60a5fa", background: "rgba(59,130,246,0.08)" }}>{floor.tid}</span>
                      <span className="text-sm font-medium text-primary">Floor {floor.floor_number}</span>
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {floor.units.length} unit{floor.units.length !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {expanded.has(floor.id) && (
                    <div className="px-6 pb-4" style={{ background: "var(--bg-surface2)" }}>
                      {floor.units.length === 0 ? (
                        <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>No units on this floor.</p>
                      ) : (
                        <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                                <th className="text-left py-2.5 px-3 font-medium text-muted">TID</th>
                                <th className="text-left py-2.5 px-3 font-medium text-muted">Unit #</th>
                                <th className="text-left py-2.5 px-3 font-medium text-muted">Size</th>
                                <th className="text-right py-2.5 px-3 font-medium text-muted">Rent/mo</th>
                                <th className="text-center py-2.5 px-3 font-medium text-muted">Status</th>
                                <th className="text-right py-2.5 px-3 font-medium text-muted">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {floor.units.map((u: any) => (
                                <tr key={u.id} style={{ borderTop: "1px solid var(--border-subtle)" }}
                                  className="hover:bg-white/[0.02] transition-colors">
                                  <td className="py-2.5 px-3">
                                    <span className="font-mono" style={{ color: "#60a5fa" }}>{u.tid}</span>
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-primary">{u.unit_number}</td>
                                  <td className="py-2.5 px-3" style={{ color: "var(--text-secondary)" }}>{u.size || "—"}</td>
                                  <td className="py-2.5 px-3 text-right" style={{ color: "var(--text-secondary)" }}>{u.rent_amount ? formatCurrency(u.rent_amount) : "—"}</td>
                                  <td className="py-2.5 px-3 text-center"><StatusBadge status={u.status} /></td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button type="button" title="Edit unit"
                                        className="p-1.5 rounded transition-colors"
                                        style={{ color: "var(--text-muted)" }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; (e.currentTarget as HTMLElement).style.color = "#60a5fa"; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}>
                                        <Edit2 size={12} />
                                      </button>
                                      <button type="button" title="Delete unit"
                                        className="p-1.5 rounded transition-colors"
                                        style={{ color: "var(--text-muted)" }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}>
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Draft floors */}
              {draftFloors.map((df, di) => (
                <div key={df.tempId} className="px-6 py-4" style={{ background: "rgba(246,206,58,0.03)", borderTop: (prop.floors.length > 0 || di > 0) ? "1px solid var(--border-subtle)" : "none" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>New Floor</span>
                      <input
                        className="input-dark w-28 px-3 py-1.5 text-sm"
                        value={df.floor_number}
                        onChange={(e) => updateDraftFloor(df.tempId, e.target.value)}
                        placeholder="Floor #"
                      />
                    </div>
                    <button type="button" onClick={() => removeDraftFloor(df.tempId)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors text-red-400 hover:text-red-300 hover:bg-red-500/10">
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>

                  {df.units.map((du) => (
                    <div key={du.tempId} className="flex items-end gap-2 mb-2 p-3 rounded-lg" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border-subtle)" }}>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] text-muted mb-1">Unit #</label>
                        <input className="input-dark w-full px-2.5 py-1.5 text-xs"
                          value={du.unit_number}
                          onChange={(e) => updateDraftUnit(df.tempId, du.tempId, "unit_number", e.target.value)}
                          placeholder="e.g. 101"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-[10px] text-muted mb-1">Size</label>
                        <input className="input-dark w-full px-2.5 py-1.5 text-xs"
                          value={du.size}
                          onChange={(e) => updateDraftUnit(df.tempId, du.tempId, "size", e.target.value)}
                          placeholder="sqft"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-[10px] text-muted mb-1">Rent</label>
                        <input className="input-dark w-full px-2.5 py-1.5 text-xs"
                          type="number" value={du.rent_amount}
                          onChange={(e) => updateDraftUnit(df.tempId, du.tempId, "rent_amount", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="w-28">
                        <label className="block text-[10px] text-muted mb-1">Status</label>
                        <select className="input-dark w-full px-2.5 py-1.5 text-xs"
                          value={du.status}
                          onChange={(e) => updateDraftUnit(df.tempId, du.tempId, "status", e.target.value)}>
                          {UNIT_STATUS_OPTS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <button type="button" onClick={() => removeDraftUnit(df.tempId, du.tempId)}
                        className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors mb-0.5">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  <button type="button" onClick={() => addDraftUnit(df.tempId)}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors w-full justify-center"
                    style={{ color: "#60a5fa", border: "1px dashed rgba(59,130,246,0.25)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.05)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.4)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.25)"; }}>
                    <Plus size={12} /> Add Unit
                  </button>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Section 3: Amenities (existing) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <DetailSection title="Amenities" icon={Tag}>
          <TagList tags={propAmenities.map((a) => a.name)} />
        </DetailSection>



        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* D) ACTIVITY TIMELINE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <DetailSection title="Activity Timeline" icon={Clock}>
          {auditLogs.length === 0 ? (
            <div className="text-center py-6">
              <Clock size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No activity recorded yet.</p>
            </div>
          ) : (
            <div className="relative max-h-96 overflow-y-auto pr-2">
              {/* Vertical line */}
              <div className="absolute left-3.5 top-2 bottom-2 w-px" style={{ background: "var(--border)" }} />
              <div className="space-y-0">
                {auditLogs.map((log, idx) => (
                  <div key={log.id || idx} className="relative flex items-start gap-4 pb-5 pl-0">
                    <TimelineIcon action={log.action} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-primary">
                          {log.action === "CREATE" ? "Property created" :
                           log.action === "DELETE" ? "Property deleted" :
                           `Field${log.diff ? "s" : ""} updated`}
                        </span>
                        <span className="text-[10px] text-muted">
                          by {log.changed_by || "System"}
                        </span>
                        <span className="text-[10px] text-muted">·</span>
                        <span className="text-[10px] text-muted">{formatDate(log.created_at)}</span>
                      </div>
                      {log.diff && Object.keys(log.diff).length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {Object.entries(log.diff).slice(0, 3).map(([key, val]) => (
                            <div key={key} className="text-[10px]">
                              <span className="text-muted">{key}:</span>{" "}
                              <span className="text-red-400 line-through">{String((val as any)?.from ?? "—")}</span>
                              {" → "}
                              <span className="text-emerald-400">{String((val as any)?.to ?? "—")}</span>
                            </div>
                          ))}
                          {Object.keys(log.diff).length > 3 && (
                            <span className="text-[10px] text-muted">
                              +{Object.keys(log.diff).length - 3} more change{Object.keys(log.diff).length - 3 !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DetailSection>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Section 5: Attachments (existing, kept for backward compat) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <DetailSection title="File Attachments" icon={Paperclip}>
          <AttachmentPanel module="property" recordId={prop.id} />
        </DetailSection>
      </DetailBody>

      {/* ── COA Linkage Edit Modal ── */}
      <AppDialog isOpen={coaEditOpen} onClose={() => setCoaEditOpen(false)} title="Edit Linked GL Accounts">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Income GL Account</label>
            <SearchableSelect
              options={coaOptions.filter(o => o.sublabel === "Income")}
              value={editIncomeGl}
              onChange={setEditIncomeGl}
              placeholder="Select income account…"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Expense GL Account</label>
            <SearchableSelect
              options={coaOptions.filter(o => o.sublabel === "Expense")}
              value={editExpenseGl}
              onChange={setEditExpenseGl}
              placeholder="Select expense account…"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Asset GL Account</label>
            <SearchableSelect
              options={coaOptions.filter(o => o.sublabel === "Asset")}
              value={editAssetGl}
              onChange={setEditAssetGl}
              placeholder="Select asset account…"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCoaEditOpen(false)}
              className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button type="button" onClick={() => void saveCoaLinks()}
              className="flex-1 py-2.5 text-sm rounded-xl font-medium text-white"
              style={{ background: "#3b82f6" }}>
              Save
            </button>
          </div>
        </div>
      </AppDialog>

      {/* ── Archive / Unarchive Confirmation ── */}
      <AppDialog isOpen={archiveOpen} onClose={() => !archiving && setArchiveOpen(false)} title={isArchived ? "Unarchive Property" : "Archive Property"}>
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {isArchived ? (
              <>Restore <span className="font-semibold text-primary">{prop?.tid}</span>? The property will be marked as active and visible in views.</>
            ) : (
              <>Archive <span className="font-semibold text-primary">{prop?.tid}</span>? The property will be marked as archived and hidden from active views.</>
            )}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setArchiveOpen(false)} disabled={archiving}
              className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button type="button" onClick={() => void handleArchive()} disabled={archiving}
              className="flex-1 py-2.5 text-sm rounded-xl font-medium text-white flex items-center justify-center gap-2"
              style={{ background: archiving ? "#6b7280" : "#94a3b8" }}>
              {archiving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {archiving ? (isArchived ? "Unarchiving…" : "Archiving…") : (isArchived ? "Unarchive" : "Archive")}
            </button>
          </div>
        </div>
      </AppDialog>

      {/* ── Delete Document Confirmation ── */}
      <AppDialog isOpen={!!deleteDocId} onClose={() => setDeleteDocId(null)} title="Delete Document">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Delete this document permanently?
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setDeleteDocId(null)}
              className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button type="button" onClick={() => void handleDeleteDoc()}
              className="flex-1 py-2.5 text-sm rounded-xl font-medium text-white"
              style={{ background: "#ef4444" }}>
              Delete
            </button>
          </div>
        </div>
      </AppDialog>

      {/* ── Delete Property Confirmation ── */}
      <AppDialog isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Property">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Delete <span className="font-semibold text-primary">{prop.tid}</span>? This removes all floors, units, images, and documents permanently.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setDeleteOpen(false)}
              className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
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
      </AppDialog>

      {/* ── Image Preview Lightbox ── */}
      {previewImgIndex !== null && prop && prop.images.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setPreviewImgIndex(null)}>
          {prop.images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setPreviewImgIndex(i => i !== null ? (i - 1 + prop.images.length) % prop.images.length : 0); }}
                className="absolute left-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>
                <ChevronLeft size={22} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setPreviewImgIndex(i => i !== null ? (i + 1) % prop.images.length : 0); }}
                className="absolute right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>
                <ChevronRight size={22} />
              </button>
            </>
          )}
          <button onClick={() => setPreviewImgIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>
            <X size={20} />
          </button>
          <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <img src={uploadsUrl(prop.images[previewImgIndex].file_path)} alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
              style={{ border: "1px solid rgba(255,255,255,0.15)" }} />
            <span className="text-sm text-white/60">{previewImgIndex + 1} / {prop.images.length}</span>
          </div>
        </div>
      )}
    </DetailPage>
  );
}
