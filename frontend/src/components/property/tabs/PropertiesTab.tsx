import { useEffect, useState, FormEvent, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Building2, ChevronDown, ChevronRight,
  ImagePlus, X, Trash2, Hash, AlertTriangle,
  Eye, Edit2, FileText, Upload, DollarSign, Archive,
  Printer
} from "lucide-react";
import AppDialog from "../../ui/AppDialog";
import ConfirmDialog from "../../actions/ConfirmDialog";
import LocationPicker from "../LocationPicker";
import AmenityPicker from "../AmenityPicker";
import { propApi, Property, PropertyCategory, PropertyAttachment } from "../../../lib/propertyApi";
import { formatCurrency } from "../../../lib/currency";
import { SmartTable } from "../../data-table";
import { api } from "../../../lib/api";
import { accountsApi } from "../../../lib/financeApi";
import SearchableSelect, { SearchableOption } from "../../ui/SearchableSelect";
import { useNotifStore } from "../../../store/notifications";

type Props = { onView: (id: number) => void; refresh: number; onRefresh: () => void };

type DraftUnit  = { _key: string; unit_number: string; size: string; rent_amount: string; status: string };
type DraftFloor = { _key: string; floor_number: string; units: DraftUnit[] };

type DraftDocument = {
  _key: string;
  document_type: string;
  document_name: string;
  file: File | null;
  file_name: string;
  file_size: string;
  expiry_date: string;
  notes: string;
  upload_status: "pending" | "uploaded" | "error";
  server_id?: number;
};

const LISTING_STATUSES = ["available", "under_offer", "sold", "off_market", "coming_soon"];
const OPERATIONAL_STATUSES = ["active", "under_renovation", "vacant", "archived"];
const CATEGORIES = ["Residential", "Commercial", "Industrial", "Land", "Mixed Use", "Retail"];
const SIZE_UNITS = ["sqft", "sqm", "marla", "kanal"];
const OWNER_TYPES = ["Individual", "Company"];
const REGULATORY_AUTHORITIES = ["RERA", "DHA", "LDA", "CDA", "Private", "Other"];
const DOC_TYPES = [
  "Title Deed", "NOC", "Insurance Policy", "Valuation Report",
  "Survey Map", "Lease Agreement", "Utility Bill", "Tax Certificate", "Other"
];

const LISTING_COLORS: Record<string, string> = {
  available: "#10b981", under_offer: "#f59e0b", sold: "#ef4444",
  off_market: "#6b7280", coming_soon: "#6366f1",
};
const OPERATIONAL_COLORS: Record<string, string> = {
  active: "#10b981", under_renovation: "#f59e0b",
  vacant: "#6b7280", archived: "#94a3b8",
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

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: `${color}18`, color }}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PropertiesTab({ onView, refresh, onRefresh }: Props) {
  const navigate = useNavigate();
  const [properties, setProperties]   = useState<Property[]>([]);
  const [categories, setCategories]   = useState<PropertyCategory[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const paramsRef = useRef<any>(null);
  const [open, setOpen]               = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  const pushToast = useNotifStore((s) => s.pushToast);

  // TID
  const [tid, setTid]                 = useState("");
  const [tidError, setTidError]       = useState("");
  const [tidChecking, setTidChecking] = useState(false);

  // ── 1. Basic Info ──
  const [address, setAddress]         = useState("");
  const [description, setDesc]        = useState("");
  const [listingStatus, setListingStatus] = useState("available");
  const [operationalStatus, setOperationalStatus] = useState("active");
  const [categoryName, setCategoryName] = useState("");
  const [size, setSize]               = useState("");
  const [sizeUnit, setSizeUnit]       = useState("sqft");
  const [yearBuilt, setYearBuilt]     = useState("");

  // ── 2. Ownership & Legal ──
  const [ownerName, setOwnerName]         = useState("");
  const [ownerType, setOwnerType]         = useState("Individual");
  const [cnicNtn, setCnicNtn]             = useState("");
  const [ownershipPct, setOwnershipPct]   = useState("100");
  const [titleDeedNum, setTitleDeedNum]   = useState("");
  const [regDate, setRegDate]             = useState("");
  const [mortgageLien, setMortgageLien]   = useState(false);
  const [lenderName, setLenderName]       = useState("");
  const [outstandingAmt, setOutstandingAmt] = useState("");
  const [regAuthority, setRegAuthority]   = useState("");

  // ── 3. Pricing ──
  const [purchasePrice, setPurchasePrice]       = useState("");
  const [currentMarketValue, setCurrentMarketValue] = useState("");
  const [forSale, setForSale]         = useState(false);
  const [askingPrice, setAskingPrice] = useState("");
  const [commissionPct, setCommissionPct] = useState("");

  // ── 4. COA Linkage ──
  const [coaOptions, setCoaOptions] = useState<SearchableOption[]>([]);
  const [incomeGlId, setIncomeGlId]     = useState("");
  const [expenseGlId, setExpenseGlId]   = useState("");
  const [assetGlId, setAssetGlId]       = useState("");
  const [costCentre, setCostCentre]     = useState("");

  // ── 5. Location ──
  const [locationId, setLocationId]   = useState<number | null>(null);

  // ── 6. Amenities ──
  const [amenityIds, setAmenityIds]   = useState<number[]>([]);

  // ── 7. Document Vault ──
  const [documents, setDocuments] = useState<DraftDocument[]>([]);

  // ── 8. Media ──
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef                 = useRef<HTMLInputElement>(null);

  // ── 9. Floors & Units ──
  const [floors, setFloors]                 = useState<DraftFloor[]>([]);
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const [floorsExpanded, setFloorsExpanded] = useState(false);
  const [mediaExpanded, setMediaExpanded]   = useState(true);

  // ── Derived: for sale pricing visible ──
  const showForSaleFields = forSale;

  // COA options loading
  useEffect(() => {
    if (open && coaOptions.length === 0) {
      accountsApi.list().then(accounts => {
        const opts: SearchableOption[] = accounts.map(a => ({
          value: String(a.id),
          label: `${a.code} - ${a.name}`,
          sublabel: a.account_type,
          meta: a.description || undefined,
        }));
        setCoaOptions(opts);
      }).catch(() => {});
    }
  }, [open, coaOptions.length]);

  const loadCategories = () => propApi.getCategories().then((res) => {
    const data = res && 'data' in res ? (res as any).data : res;
    setCategories(Array.isArray(data) ? data : []);
  }).catch(() => setCategories([]));

  const fetchProperties = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const res = await api.get<Property[]>("/properties/", {
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
    setEditingProperty(null);
    reset();
    try {
      const res = await propApi.previewTid();
      const data = res && 'data' in res ? (res as any).data : res;
      setTid(data?.tid ?? "PRO-0001");
    }
    catch { setTid("PRO-0001"); }
    setOpen(true);
  };

  const openEditDialog = (property: Property) => {
    setEditingProperty(property);
    setTid(property.tid || "");
    setTidError("");
    setAddress(property.address || "");
    setDesc(property.description || "");
    setListingStatus(property.listing_status || "available");
    setOperationalStatus(property.operational_status || "active");
    setCategoryName(property.category_name || "");
    setSize(property.size ? String(property.size) : "");
    setSizeUnit(property.size_unit || "sqft");
    setYearBuilt(property.year_built ? String(property.year_built) : "");
    setOwnerName(property.owner_name || "");
    setOwnerType(property.owner_type || "Individual");
    setCnicNtn(property.cnic_ntn || "");
    setOwnershipPct(property.ownership_pct ? String(property.ownership_pct) : "100");
    setTitleDeedNum(property.title_deed_number || "");
    setRegDate(property.registration_date || "");
    setMortgageLien(property.mortgage_lien || false);
    setLenderName(property.lender_name || "");
    setOutstandingAmt(property.outstanding_amount ? String(property.outstanding_amount) : "");
    setRegAuthority(property.regulatory_authority || "");
    setPurchasePrice(property.purchase_price ? String(property.purchase_price) : "");
    setCurrentMarketValue(property.current_market_value ? String(property.current_market_value) : "");
    setForSale(property.for_sale || false);
    setAskingPrice(property.sale_price ? String(property.sale_price) : "");
    setCommissionPct(property.commission_pct ? String(property.commission_pct) : "");
    setCostCentre(property.cost_centre || "");
    setError("");
    setOpen(true);
  };

  const reset = () => {
    setEditingProperty(null);
    setTid(""); setTidError(""); setAddress(""); setDesc("");
    setListingStatus("available"); setOperationalStatus("active");
    setCategoryName(""); setSize(""); setSizeUnit("sqft"); setYearBuilt("");
    setOwnerName(""); setOwnerType("Individual"); setCnicNtn(""); setOwnershipPct("100");
    setTitleDeedNum(""); setRegDate(""); setMortgageLien(false); setLenderName("");
    setOutstandingAmt(""); setRegAuthority("");
    setPurchasePrice(""); setCurrentMarketValue("");
    setForSale(false); setAskingPrice(""); setCommissionPct("");
    setIncomeGlId(""); setExpenseGlId(""); setAssetGlId(""); setCostCentre("");
    setLocationId(null); setAmenityIds([]);
    setDocuments([]);
    setImageFile(null); setImagePreview(null);
    setFloors([]); setExpandedFloors(new Set());
    setFloorsExpanded(false); setMediaExpanded(true);
    setError("");
  };

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
    if (editingProperty && tid === editingProperty.tid) { setTidError(""); return; }
    const t = setTimeout(() => void checkTid(tid), 400);
    return () => clearTimeout(t);
  }, [tid, editingProperty, checkTid]);

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImageFile(file); setImagePreview(URL.createObjectURL(file)); e.target.value = "";
  };

  // ── Document Vault handlers ──
  const addDocument = () => {
    setDocuments(prev => [...prev, {
      _key: `doc-${Date.now()}`,
      document_type: "Other",
      document_name: "",
      file: null,
      file_name: "",
      file_size: "",
      expiry_date: "",
      notes: "",
      upload_status: "pending",
    }]);
  };
  const removeDocument = (key: string) => setDocuments(prev => prev.filter(d => d._key !== key));
  const updateDocument = (key: string, field: keyof DraftDocument, val: any) =>
    setDocuments(prev => prev.map(d => d._key === key ? { ...d, [field]: val } : d));
  const onDocFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateDocument(key, "file", file);
    updateDocument(key, "file_name", file.name);
    updateDocument(key, "file_size", formatFileSize(file.size));
    e.target.value = "";
  };
  const onDocTypeChange = (key: string, docType: string) => {
    const doc = documents.find(d => d._key === key);
    const autoName = doc?.document_name || docType;
    updateDocument(key, "document_type", docType);
    if (!doc?.document_name || doc.document_name === doc.document_type || doc.document_name === "") {
      updateDocument(key, "document_name", docType);
    }
  };

  // ── Floor handlers ──
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

  // ── Submit ──
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError("");
    if (!tid.trim())  { setError("TID is required."); return; }
    if (tidError)     { setError(tidError); return; }
    if (showForSaleFields && !askingPrice) { setError("Asking price is required when For Sale is enabled."); return; }
    for (const f of floors) {
      if (!f.floor_number) { setError("All floors must have a floor number."); return; }
      for (const u of f.units) {
        if (!u.unit_number) { setError("All units must have a unit number."); return; }
      }
    }

    setSubmitting(true);
    try {
      const payload: any = {
        tid: tid.trim(),
        address: address || null,
        description: description || null,
        listing_status: listingStatus,
        operational_status: operationalStatus,
        category: categoryName || null,
        size: size || null,
        size_unit: sizeUnit,
        for_sale: forSale,
        sale_price: forSale && askingPrice ? Number(askingPrice) : null,
        year_built: yearBuilt ? Number(yearBuilt) : null,
        owner_name: ownerName || null,
        owner_type: ownerType || null,
        cnic_ntn: cnicNtn || null,
        ownership_pct: ownershipPct ? Number(ownershipPct) : null,
        title_deed_number: titleDeedNum || null,
        registration_date: regDate || null,
        mortgage_lien: mortgageLien,
        lender_name: mortgageLien && lenderName ? lenderName : null,
        outstanding_amount: mortgageLien && outstandingAmt ? Number(outstandingAmt) : null,
        regulatory_authority: regAuthority || null,
        purchase_price: purchasePrice ? Number(purchasePrice) : null,
        current_market_value: currentMarketValue ? Number(currentMarketValue) : null,
        asking_price: askingPrice ? Number(askingPrice) : null,
        commission_pct: commissionPct ? Number(commissionPct) : null,
        income_gl_account_id: incomeGlId ? Number(incomeGlId) : null,
        expense_gl_account_id: expenseGlId ? Number(expenseGlId) : null,
        asset_gl_account_id: assetGlId ? Number(assetGlId) : null,
        cost_centre: costCentre || null,
        location_id: locationId,
        amenity_ids: amenityIds,
      };

      if (editingProperty) {
        await propApi.updateProperty(editingProperty.id, payload);
        pushToast({ title: "Updated", message: `Property ${payload.tid} updated`, type: "success" });
      } else {
        const propRes = await propApi.createProperty(payload);
        const prop = propRes && 'data' in propRes ? (propRes as any).data : propRes;

        // Upload main image
        if (imageFile) await propApi.uploadImage(prop.id, imageFile);

        // Upload document vault files
        for (const doc of documents) {
          if (doc.file) {
            try {
              const uploadRes = await propApi.uploadAttachment(prop.id, doc.file);
              const attachment = uploadRes && 'data' in uploadRes ? (uploadRes as any).data : uploadRes;
              if (attachment?.id) {
                await propApi.updateAttachmentMeta(attachment.id, {
                  document_type: doc.document_type,
                  document_name: doc.document_name,
                  expiry_date: doc.expiry_date || undefined,
                  notes: doc.notes || undefined,
                });
              }
            } catch (err) {
              console.error("Failed to upload document:", doc.document_name, err);
            }
          }
        }

        // Create floors and units
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

        pushToast({ title: "Created", message: `Property ${payload.tid} created`, type: "success" });
      }

      reset(); setOpen(false); onRefresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to save property.");
    } finally { setSubmitting(false); }
  };

  const handleDeleteProperty = async (p: Property) => {
    await propApi.deleteProperty(p.id);
    onRefresh();
  };

  // ── Columns ──
  const columns = [
    {
      key: "tid",
      label: "TID",
      className: "font-mono text-xs text-blue-400"
    },
    {
      key: "listing_status",
      label: "Listing Status",
      render: (val: any, row: Property) => {
        const ls = row.listing_status || "available";
        const color = LISTING_COLORS[ls] ?? "#6b7280";
        return <Badge label={ls} color={color} />;
      }
    },
    {
      key: "operational_status",
      label: "Operational",
      render: (val: any, row: Property) => {
        const os = row.operational_status || "active";
        const color = OPERATIONAL_COLORS[os] ?? "#6b7280";
        return <Badge label={os} color={color} />;
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
      render: (val: any, row: Property) => {
        const s = row.size || "—";
        const u = row.size_unit || "";
        return <span className="text-secondary">{s}{u ? ` ${u}` : ""}</span>;
      }
    },
    {
      key: "occupancy",
      label: "Occupancy",
      render: (_: any, row: Property) => {
        const total = row.floors?.reduce((s, f) => s + f.units.length, 0) || 0;
        if (total === 0) return <span className="text-muted text-xs">—</span>;
        const rented = row.floors?.reduce((s, f) => s + f.units.filter(u => u.status === "rented" || u.status === "occupied").length, 0) || 0;
        const pct = Math.round((rented / total) * 100);
        const color = pct > 75 ? "#10b981" : pct > 40 ? "#f59e0b" : "#6b7280";
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-xs" style={{ color }}>{pct}%</span>
          </div>
        );
      }
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
      onClick: (row: Property) => openEditDialog(row),
    },
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      onClick: (row: Property) => setDeleteTarget(row),
    },
    {
      key: "print",
      label: "Print",
      icon: Printer,
      onClick: (row: Property) => {
        const w = window.open(`/property/${row.id}?print=true`, "_blank");
        if (w) w.onload = () => w.print();
      },
    },
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
          { label: "Under Offer", value: "under_offer" },
          { label: "Sold", value: "sold" },
          { label: "Off-Market", value: "off_market" },
          { label: "Coming Soon", value: "coming_soon" },
        ]}
        showDateFilter={true}
        toolbarActions={
          <button type="button" onClick={() => void openDialog()}
            className="btn-property flex items-center gap-2 px-3 py-2 text-xs">
            <Plus size={13} /> New Property
          </button>
        }
      />

      {/* ── Create Property Dialog ── */}
      <AppDialog isOpen={open} onClose={() => { reset(); setOpen(false); }} title={editingProperty ? `Edit ${editingProperty.tid}` : "New Property"} size="2xl">
        <form onSubmit={submit}>
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-xs border flex items-center gap-2"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          {/* ── TID ── */}
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

          {/* ── 1. BASIC INFO ── */}
          <SectionLabel title="Basic Info" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6">
            <div className="md:col-span-2">
              <input className="input-dark w-full px-4 py-2.5 text-sm" value={address}
                onChange={(e) => setAddress(e.target.value)} placeholder="Property Name / Address" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Listing Status</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={listingStatus}
                onChange={(e) => setListingStatus(e.target.value)}>
                {LISTING_STATUSES.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Operational Status</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={operationalStatus}
                onChange={(e) => setOperationalStatus(e.target.value)}>
                {OPERATIONAL_STATUSES.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Category</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}>
                <option value="">— Select category —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <div>
                <label className="block text-xs text-muted mb-1">Size</label>
                <input className="input-dark w-full px-3 py-2.5 text-sm" value={size}
                  onChange={(e) => setSize(e.target.value)} placeholder="e.g. 2500" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Unit</label>
                <select className="select-dark w-full px-2 py-2.5 text-sm" value={sizeUnit}
                  onChange={(e) => setSizeUnit(e.target.value)}>
                  {SIZE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Year Built</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)} placeholder="e.g. 2018" />
            </div>
            <div className="md:col-span-2">
              <textarea className="input-dark w-full px-4 py-2.5 text-sm resize-none" rows={2} value={description}
                onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" />
            </div>
          </div>

          {/* ── 2. OWNERSHIP & LEGAL ── */}
          <SectionLabel title="Ownership & Legal" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6 p-4 rounded-xl"
            style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <div>
              <label className="block text-xs text-muted mb-1">Owner Name</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Owner Type</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={ownerType}
                onChange={(e) => setOwnerType(e.target.value)}>
                {OWNER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">CNIC / Company NTN</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" value={cnicNtn}
                onChange={(e) => setCnicNtn(e.target.value)} placeholder="e.g. 42201-xxxxxxx-x" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Ownership %</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" min="1" max="100" value={ownershipPct}
                onChange={(e) => setOwnershipPct(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Title Deed Number</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" value={titleDeedNum}
                onChange={(e) => setTitleDeedNum(e.target.value)} placeholder="Deed #" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Registration Date</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={regDate}
                onChange={(e) => setRegDate(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-muted">Mortgage / Lien:</span>
                <Toggle value={mortgageLien} onChange={setMortgageLien} label={mortgageLien ? "Yes" : "No"} />
              </div>
              {mortgageLien && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                  <input className="input-dark px-3 py-2.5 text-sm" value={lenderName}
                    onChange={(e) => setLenderName(e.target.value)} placeholder="Lender Name" />
                  <input className="input-dark px-3 py-2.5 text-sm" type="number" value={outstandingAmt}
                    onChange={(e) => setOutstandingAmt(e.target.value)} placeholder="Outstanding Amount (Rs)" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Regulatory Authority</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={regAuthority}
                onChange={(e) => setRegAuthority(e.target.value)}>
                <option value="">— None —</option>
                {REGULATORY_AUTHORITIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* ── 3. PRICING ── */}
          <SectionLabel title="Pricing" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6">
            <div>
              <label className="block text-xs text-muted mb-1">Purchase Price (Rs)</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Current Market Value (Rs)</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={currentMarketValue}
                onChange={(e) => setCurrentMarketValue(e.target.value)} placeholder="0" />
            </div>
            <div className="md:col-span-2">
              <Toggle value={forSale} onChange={setForSale} label="For Sale" />
            </div>
            {showForSaleFields && (
              <>
                <div>
                  <label className="block text-xs text-muted mb-1">Asking Price (Rs) <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
                  <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={askingPrice}
                    onChange={(e) => setAskingPrice(e.target.value)} placeholder="Sale price" required />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Commission %</label>
                  <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" step="0.1" value={commissionPct}
                    onChange={(e) => setCommissionPct(e.target.value)} placeholder="e.g. 2.5" />
                </div>
              </>
            )}
          </div>

          {/* ── 4. CHART OF ACCOUNTS LINKAGE ── */}
          <SectionLabel title="Chart of Accounts Linkage" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6 p-4 rounded-xl"
            style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <div>
              <label className="block text-xs text-muted mb-1">Income GL Account</label>
              <SearchableSelect
                options={coaOptions.filter(o => o.sublabel === "Income")}
                value={incomeGlId}
                onChange={setIncomeGlId}
                placeholder="Select income account…"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Expense GL Account</label>
              <SearchableSelect
                options={coaOptions.filter(o => o.sublabel === "Expense")}
                value={expenseGlId}
                onChange={setExpenseGlId}
                placeholder="Select expense account…"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Asset GL Account</label>
              <SearchableSelect
                options={coaOptions.filter(o => o.sublabel === "Asset")}
                value={assetGlId}
                onChange={setAssetGlId}
                placeholder="Select asset account…"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Cost Centre</label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" value={costCentre}
                onChange={(e) => setCostCentre(e.target.value)} placeholder="Optional" />
            </div>
            <div className="md:col-span-2">
              <p className="text-[11px] text-muted italic">
                Rent income, maintenance costs and depreciation will post to these accounts automatically.
              </p>
            </div>
          </div>

          {/* ── 5. LOCATION ── */}
          <SectionLabel title="Location" />
          <div className="mb-6">
            <LocationPicker value={locationId} onChange={setLocationId} />
          </div>

          {/* ── 6. AMENITIES ── */}
          <SectionLabel title="Amenities" />
          <div className="mb-6">
            <AmenityPicker selected={amenityIds} onChange={setAmenityIds} />
          </div>

          {/* ── 7. DOCUMENT VAULT ── */}
          <SectionLabel title="Document Vault" />
          <div className="mb-6 p-4 rounded-xl" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            {documents.length === 0 && (
              <p className="text-xs text-muted mb-3">No documents added yet.</p>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
              {documents.map((doc) => (
                <div key={doc._key} className="grid gap-2 p-3 rounded-lg items-start"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr auto", border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">Type</label>
                    <select className="select-dark w-full px-2 py-1.5 text-xs" value={doc.document_type}
                      onChange={(e) => onDocTypeChange(doc._key, e.target.value)}>
                      {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">Name</label>
                    <input className="input-dark w-full px-2 py-1.5 text-xs" value={doc.document_name}
                      onChange={(e) => updateDocument(doc._key, "document_name", e.target.value)}
                      placeholder="Document name" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">File</label>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.onchange = (e: any) => {
                          const file = e.target?.files?.[0];
                          if (file) {
                            updateDocument(doc._key, "file", file);
                            updateDocument(doc._key, "file_name", file.name);
                            updateDocument(doc._key, "file_size", formatFileSize(file.size));
                          }
                        };
                        input.click();
                      }}
                        className="text-[10px] px-2 py-1.5 rounded-lg flex items-center gap-1"
                        style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
                        <Upload size={10} /> {doc.file ? "Change" : "Upload"}
                      </button>
                      {doc.file_name && (
                        <span className="text-[9px] text-muted truncate max-w-[80px]">{doc.file_name}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">Expiry</label>
                    <input className="input-dark w-full px-2 py-1.5 text-xs" type="date" value={doc.expiry_date}
                      onChange={(e) => updateDocument(doc._key, "expiry_date", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">Notes</label>
                    <input className="input-dark w-full px-2 py-1.5 text-xs" value={doc.notes}
                      onChange={(e) => updateDocument(doc._key, "notes", e.target.value)}
                      placeholder="Optional" />
                  </div>
                  <button type="button" onClick={() => removeDocument(doc._key)}
                    className="self-end text-muted hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addDocument}
              className="flex items-center gap-1.5 text-xs text-blue-400 px-3 py-1.5 rounded-lg transition-colors"
              style={{ border: "1px solid rgba(59,130,246,0.2)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <Plus size={12} /> Add Document
            </button>
          </div>

          {/* ── 8. MEDIA ── */}
          <div className="mb-6">
            <button type="button" onClick={() => setMediaExpanded((v) => !v)}
              className="w-full flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Media</span>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              {mediaExpanded ? <ChevronDown size={12} className="text-muted shrink-0" /> : <ChevronRight size={12} className="text-muted shrink-0" />}
            </button>
            {mediaExpanded && (
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
            )}
          </div>

          {/* ── 9. FLOORS & UNITS ── */}
          <div className="mb-6">
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
                                <option value="available">Available</option>
                                <option value="rented">Rented</option>
                                <option value="reserved">Reserved</option>
                                <option value="maintenance">Maintenance</option>
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

          {/* ── Submit ── */}
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="submit" disabled={submitting || !!tidError}
              className="btn-property w-full py-3 text-sm flex items-center justify-center gap-2">
               {submitting
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {editingProperty ? "Saving…" : "Creating…"}</>
                : editingProperty ? "Save Changes" : "Create Property"}
            </button>
          </div>
        </form>
      </AppDialog>

      {/* ── Delete Confirmation ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.tid ?? ""}`}
        message={`Are you sure you want to delete property "${deleteTarget?.tid}"? This will permanently remove all associated data including floors, units, leases, and attachments. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await propApi.deleteProperty(deleteTarget.id);
          pushToast({ title: "Deleted", message: `Property ${deleteTarget.tid} deleted`, type: "success" });
          setDeleteTarget(null);
          onRefresh();
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
