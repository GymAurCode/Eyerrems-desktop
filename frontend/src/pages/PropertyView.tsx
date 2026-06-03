import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2, Tag, Layers, Paperclip, Clock,
  Plus, ChevronDown, ChevronRight, ImagePlus,
  DollarSign, Edit2, Trash2,
  Download, Archive, FileText, Landmark, TrendingUp, Wrench, Banknote,
} from "lucide-react";
import { propApi, PropertyDetail, PropertyAttachment, Location, Amenity } from "../lib/propertyApi";
import { uploadsUrl } from "../lib/config";
import { formatCurrency } from "../lib/currency";
import { auditApi, AuditLogEntry } from "../lib/auditApi";
import Modal from "../components/Modal";
import RecordHistory from "../components/RecordHistory";
import SearchableSelect from "../components/ui/SearchableSelect";
import { accountsApi } from "../lib/financeApi";
import {
  DetailPage, DetailHeader, DetailBody, DetailSection,
  InfoGrid, DataTable, TagList, StatusBadge,
} from "../components/detail";
import AttachmentPanel from "../components/attachments/AttachmentPanel";
import { DataTable as VaultTable } from "../components/data-table";
import { useLookup } from "../hooks/useLookup";
import type { SearchableOption } from "../components/ui/SearchableSelect";

const LISTING_COLORS: Record<string, string> = {
  available: "#10b981", under_offer: "#f59e0b", sold: "#ef4444",
  off_market: "#6b7280", coming_soon: "#6366f1",
};
const OPERATIONAL_COLORS: Record<string, string> = {
  active: "#10b981", under_renovation: "#f59e0b",
  vacant: "#6b7280", archived: "#94a3b8",
};

const DOC_STATUS = {
  VALID: { label: "Valid", color: "#10b981" },
  EXPIRING_SOON: { label: "Expiring Soon", color: "#f59e0b" },
  EXPIRED: { label: "Expired", color: "#ef4444" },
};

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl p-4 flex items-start gap-3"
      style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color || "#3b82f6"}18` }}>
        <Icon size={16} style={{ color: color || "#3b82f6" }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
        <p className="text-sm font-semibold text-primary truncate">{value}</p>
      </div>
    </div>
  );
}

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

function getDocStatus(expiryDate: string | null): typeof DOC_STATUS[keyof typeof DOC_STATUS] {
  if (!expiryDate) return DOC_STATUS.VALID;
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return DOC_STATUS.EXPIRED;
  if (diffDays < 30) return DOC_STATUS.EXPIRING_SOON;
  return DOC_STATUS.VALID;
}

export default function PropertyViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const propId = Number(id);
  const { options: UNIT_STATUS_OPTS } = useLookup('unit_status');

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

  // Floor / Unit modals
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
      if (pd?.floors) {
        setExpanded(new Set(pd.floors.map((f: any) => f.id)));
      }
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

  const handleDeleteDoc = async () => {
    if (!deleteDocId) return;
    await propApi.deleteAttachment(deleteDocId);
    setDeleteDocId(null);
    await load();
  };

  const handleArchive = async () => {
    if (!prop) return;
    await propApi.updateProperty(propId, { operational_status: "archived" } as any);
    await load();
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

  const location      = Array.isArray(locations) ? locations.find((l) => l.id === prop.location_id) : null;
  const parentLoc     = location && Array.isArray(locations) ? locations.find((l) => l.id === location.parent_id) : null;
  const propAmenities = Array.isArray(amenities) && prop.amenity_ids
    ? amenities.filter((a) => prop.amenity_ids.includes(a.id))
    : [];
  const locationStr   = parentLoc ? `${parentLoc.name} › ${location?.name}` : location?.name || "—";
  const totalUnits    = prop.floors.reduce((s, f) => s + f.units.length, 0);
  const rentedUnits   = prop.floors.reduce((s, f) => s + f.units.filter(u => u.status === "rented" || u.status === "occupied").length, 0);
  const monthlyIncome = prop.floors.reduce((s, f) =>
    s + f.units.reduce((us, u) => us + (u.rent_amount || 0), 0), 0);

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
          { label: "Archive", icon: Archive, onClick: () => void handleArchive() },
          { label: "Delete", icon: Trash2, onClick: () => setDeleteOpen(true), variant: "danger" },
        ]}
      />

      <DetailBody>
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* A) FINANCIAL SUMMARY CARDS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Banknote} label="Purchase Price"
            value={prop.purchase_price ? formatCurrency(prop.purchase_price) : "—"} color="#3b82f6" />
          <StatCard icon={TrendingUp} label="Current Market Value"
            value={prop.current_market_value ? formatCurrency(prop.current_market_value) : "—"} color="#8b5cf6" />
          <StatCard icon={DollarSign} label="Monthly Income"
            value={monthlyIncome > 0 ? formatCurrency(monthlyIncome) : "—"} color="#10b981" />
          <StatCard icon={Wrench} label="Outstanding Maint."
            value="—" color="#f59e0b" />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Section 1: Main Details (existing, extended with new fields) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <DetailSection title="Property Details" icon={Building2}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        {/* Section 2: Floors & Units (existing) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
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

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Section 3: Amenities (existing) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <DetailSection title="Amenities" icon={Tag}>
          <TagList tags={propAmenities.map((a) => a.name)} />
        </DetailSection>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* C) DOCUMENT VAULT */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <DetailSection title="Document Vault" icon={FileText}>
          <VaultTable
            data={prop.attachments}
            columns={[
              { key: "document_type", label: "Type", render: (val) => <span className="text-secondary">{val || "—"}</span> },
              { key: "document_name", label: "Name", render: (val, row) => (
                <span className="flex items-center gap-1.5">
                  <Paperclip size={11} className="text-muted" />
                  <span className="text-primary">{val || row.filename}</span>
                </span>
              )},
              { key: "uploaded_by", label: "Uploaded By", render: (val) => <span className="text-secondary">{val || "—"}</span> },
              { key: "created_at", label: "Upload Date", render: (val) => <span className="text-secondary">{val ? new Date(val).toLocaleDateString() : "—"}</span> },
              { key: "expiry_date", label: "Expiry", render: (val) => <span className="text-secondary">{val ? new Date(val).toLocaleDateString() : "—"}</span> },
              { key: "expiry_date", label: "Status", render: (val) => {
                const docStatus = getDocStatus(val);
                return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${docStatus.color}18`, color: docStatus.color }}>{docStatus.label}</span>;
              }},
              { key: "id", label: "Actions", align: "right", render: (val, row) => (
                <div className="flex items-center justify-end gap-1">
                  <a href={uploadsUrl(row.file_path)} target="_blank" rel="noreferrer"
                    className="p-1.5 rounded text-muted hover:text-blue-400 hover:bg-white/5 transition-colors">
                    <Download size={12} />
                  </a>
                  <button type="button" onClick={() => setDeleteDocId(val)}
                    className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-white/5 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              )},
            ]}
            variant="compact"
            searchable={false}
            emptyTitle="No documents uploaded yet"
            emptyIcon={FileText}
          />
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
                              <span className="text-red-400 line-through">{String(val?.from ?? "—")}</span>
                              {" → "}
                              <span className="text-emerald-400">{String(val?.to ?? "—")}</span>
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
      <Modal open={coaEditOpen} onClose={() => setCoaEditOpen(false)} title="Edit Linked GL Accounts">
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
      </Modal>

      {/* ── Add Floor Modal ── */}
      <Modal open={floorOpen} onClose={() => setFloorOpen(false)} title="Add Floor">
        <div className="space-y-3">
          <input className="input-dark w-full px-4 py-3 text-sm" type="number"
            value={floorNum} onChange={(e) => setFloorNum(e.target.value)} placeholder="Floor number (e.g. 1)" />
          <button className="btn-primary w-full py-3 text-sm" type="button" onClick={() => void addFloor()}>
            Add Floor
          </button>
        </div>
      </Modal>

      {/* ── Add Unit Modal ── */}
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
            {UNIT_STATUS_OPTS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button className="btn-primary w-full py-3 text-sm" type="button" onClick={() => void addUnit()}>
            Add Unit
          </button>
        </div>
      </Modal>

      {/* ── Delete Document Confirmation ── */}
      <Modal open={!!deleteDocId} onClose={() => setDeleteDocId(null)} title="Delete Document">
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
      </Modal>

      {/* ── Delete Property Confirmation ── */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Property">
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
      </Modal>
    </DetailPage>
  );
}
