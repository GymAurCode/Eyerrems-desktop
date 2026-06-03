import { useState, FormEvent, useRef, useCallback, useEffect } from "react";
import {
  Plus, X, Trash2, Hash, AlertTriangle,
  ImagePlus, FileText, ChevronDown, ChevronRight, Building2
} from "lucide-react";
import ModuleDialog from "../../ui/ModuleDialog";
import FormSection from "../../ui/FormSection";
import LocationPicker from "../LocationPicker";
import AmenityPicker from "../AmenityPicker";
import SearchableSelect from "../../ui/SearchableSelect";
import { propApi, PropertyCategory } from "../../../lib/propertyApi";
import { accountsApi } from "../../../lib/financeApi";

interface AddPropertyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: PropertyCategory[];
}

type DraftUnit  = { _key: string; unit_number: string; size: string; rent_amount: string; status: string };
type DraftFloor = { _key: string; floor_number: string; units: DraftUnit[] };
type DraftDocument = {
  _key: string; document_type: string; document_name: string;
  file: File | null; file_name: string; file_size: string;
  expiry_date: string; notes: string;
  upload_status: "pending" | "uploaded" | "error"; server_id?: number;
};

const LISTING_STATUSES = ["available", "under_offer", "sold", "off_market", "coming_soon"];
const OPERATIONAL_STATUSES = ["active", "under_renovation", "vacant", "archived"];
const SIZE_UNITS = ["sqft", "sqm", "marla", "kanal"];
const OWNER_TYPES = ["Individual", "Company"];
const DOC_TYPES = [
  "Title Deed", "NOC", "Insurance Policy", "Valuation Report",
  "Survey Map", "Lease Agreement", "Utility Bill", "Tax Certificate", "Other"
];

export default function AddPropertyDialog({ isOpen, onClose, onSaved, categories }: AddPropertyDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [tid, setTid] = useState(""); const [tidError, setTidError] = useState(""); const [tidChecking, setTidChecking] = useState(false);
  const [address, setAddress] = useState(""); const [desc, setDesc] = useState("");
  const [listingStatus, setListingStatus] = useState("available");
  const [operationalStatus, setOperationalStatus] = useState("active");
  const [categoryName, setCategoryName] = useState(""); const [size, setSize] = useState(""); const [sizeUnit, setSizeUnit] = useState("sqft"); const [yearBuilt, setYearBuilt] = useState("");
  const [ownerName, setOwnerName] = useState(""); const [ownerType, setOwnerType] = useState("Individual");
  const [cnicNtn, setCnicNtn] = useState(""); const [ownershipPct, setOwnershipPct] = useState("100");
  const [titleDeedNum, setTitleDeedNum] = useState(""); const [regDate, setRegDate] = useState("");
  const [mortgageLien, setMortgageLien] = useState(false); const [lenderName, setLenderName] = useState("");
  const [outstandingAmt, setOutstandingAmt] = useState(""); const [regAuthority, setRegAuthority] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(""); const [currentMarketValue, setCurrentMarketValue] = useState("");
  const [forSale, setForSale] = useState(false); const [askingPrice, setAskingPrice] = useState(""); const [commissionPct, setCommissionPct] = useState("");
  const [incomeGlId, setIncomeGlId] = useState(""); const [expenseGlId, setExpenseGlId] = useState("");
  const [assetGlId, setAssetGlId] = useState(""); const [costCentre, setCostCentre] = useState("");
  const [locationId, setLocationId] = useState<number | null>(null); const [amenityIds, setAmenityIds] = useState<number[]>([]);
  const [documents, setDocuments] = useState<DraftDocument[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null); const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [floors, setFloors] = useState<DraftFloor[]>([]); const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const [floorsExpanded, setFloorsExpanded] = useState(false); const [mediaExpanded, setMediaExpanded] = useState(true);
  const [glOptions, setGlOptions] = useState<{ label: string; value: string }[]>([]);
  const [glLoading, setGlLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const docFileRefs = useRef<Record<string, HTMLInputElement>>({});

  useEffect(() => {
    if (!isOpen) return;
    reset();
    void loadGlAccounts();
    void loadPreviewTid();
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (tid.trim() && tid !== "PRO-0001") checkTid(tid);
    }, 400);
    return () => clearTimeout(timer);
  }, [tid]);

  const loadGlAccounts = async () => {
    setGlLoading(true);
    try {
      const res = await accountsApi.list({ type: "all", limit: 500 });
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      setGlOptions(list.map((a: any) => ({ label: `${a.code} — ${a.name}`, value: String(a.id) })));
    } catch { setGlOptions([]); }
    finally { setGlLoading(false); }
  };

  const loadPreviewTid = async () => {
    try {
      const res = await propApi.previewTid();
      const data = res && "data" in res ? (res as any).data : res;
      setTid(data?.tid ?? "PRO-0001");
    } catch { setTid("PRO-0001"); }
  };

  const checkTid = async (value: string) => {
    if (!value.trim()) { setTidError("TID is required"); return; }
    setTidChecking(true);
    try {
      const res = await propApi.checkTid(value.trim());
      const data = res && "data" in res ? (res as any).data : res;
      setTidError(data?.available ? "" : `TID "${value}" is already in use`);
    } catch { setTidError(""); }
    finally { setTidChecking(false); }
  };

  const reset = () => {
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

  const addFloor = () => {
    const num = floors.length + 1;
    const key = String(Date.now());
    setFloors([...floors, { _key: key, floor_number: String(num), units: [] }]);
    setExpandedFloors(new Set(expandedFloors).add(key));
  };

  const removeFloor = (key: string) => {
    setFloors(floors.filter((f) => f._key !== key));
    const s = new Set(expandedFloors); s.delete(key); setExpandedFloors(s);
  };

  const addUnit = (floorKey: string) => {
    setFloors(floors.map((f) =>
      f._key === floorKey
        ? { ...f, units: [...f.units, { _key: String(Date.now()), unit_number: "", size: "", rent_amount: "", status: "available" }] }
        : f
    ));
  };

  const removeUnit = (floorKey: string, unitKey: string) => {
    setFloors(floors.map((f) =>
      f._key === floorKey ? { ...f, units: f.units.filter((u) => u._key !== unitKey) } : f
    ));
  };

  const setUnit = (floorKey: string, unitKey: string, field: keyof DraftUnit, value: string) => {
    setFloors(floors.map((f) =>
      f._key === floorKey
        ? { ...f, units: f.units.map((u) => (u._key === unitKey ? { ...u, [field]: value } : u)) }
        : f
    ));
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addDocument = () => {
    setDocuments([...documents, {
      _key: String(Date.now()), document_type: DOC_TYPES[0], document_name: "",
      file: null, file_name: "", file_size: "",
      expiry_date: "", notes: "", upload_status: "pending",
    }]);
  };

  const removeDocument = (key: string) => setDocuments(documents.filter((d) => d._key !== key));

  const setDoc = (key: string, field: string, value: string | File) => {
    setDocuments(documents.map((d) => d._key === key ? { ...d, [field]: value } : d));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError("");
    if (!address.trim()) { setError("Address is required"); return; }
    if (!ownerName.trim()) { setError("Owner name is required"); return; }
    setSubmitting(true);
    try {
      const isCompany = ownerType === "Company";
      const payload = {
        tid: tid.trim() || undefined,
        address, description: desc,
        listing_status: listingStatus, operational_status: operationalStatus,
        category_id: categories.find((c) => c.name === categoryName)?.id ?? null,
        size: size ? Number(size) : null, size_unit: sizeUnit || null,
        year_built: yearBuilt || null,
        owner_name: ownerName, owner_type: ownerType,
        cnic: isCompany ? null : (cnicNtn || null), ntn: isCompany ? (cnicNtn || null) : null,
        ownership_percentage: ownershipPct ? Number(ownershipPct) : null,
        title_deed_number: titleDeedNum || null,
        registration_date: regDate || null,
        mortgage_lien: mortgageLien, lender_name: lenderName || null,
        outstanding_amount: outstandingAmt ? Number(outstandingAmt) : null,
        regulatory_authority: regAuthority || null,
        purchase_price: purchasePrice ? Number(purchasePrice) : null,
        current_market_value: currentMarketValue ? Number(currentMarketValue) : null,
        for_sale: forSale, asking_price: forSale && askingPrice ? Number(askingPrice) : null,
        commission_percentage: commissionPct ? Number(commissionPct) : null,
        income_gl_account_id: incomeGlId ? Number(incomeGlId) : null,
        expense_gl_account_id: expenseGlId ? Number(expenseGlId) : null,
        asset_gl_account_id: assetGlId ? Number(assetGlId) : null,
        cost_centre: costCentre || null,
        location_id: locationId, amenity_ids: amenityIds,
        floors: floors.map((f) => ({
          floor_number: Number(f.floor_number),
          units: f.units.map((u) => ({
            unit_number: u.unit_number, size: u.size ? Number(u.size) : null,
            rent_amount: u.rent_amount ? Number(u.rent_amount) : null, status: u.status,
          })),
        })),
      };
      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));
      documents.forEach((d) => {
        if (d.file) formData.append("documents", d.file, d.file_name);
      });
      if (imageFile) formData.append("image", imageFile);

      await propApi.create(formData);
      onSaved();
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : (detail?.msg || "Failed to create property"));
    } finally { setSubmitting(false); }
  };

  const toggleFloor = (key: string) => {
    const s = new Set(expandedFloors);
    s.has(key) ? s.delete(key) : s.add(key);
    setExpandedFloors(s);
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg text-sm border transition-colors duration-150 outline-none";
  const inputStyle = (light: React.CSSProperties = {}): React.CSSProperties => ({
    background: "var(--surface-input, #1A1D24)",
    borderColor: "var(--border, #2E3340)",
    color: "var(--text-primary, #E8ECF0)",
    ...light,
  });

  return (
    <ModuleDialog
      isOpen={isOpen}
      onClose={onClose}
      title="New Property"
      subtitle="Add a new property to the system"
      icon={<Building2 size={18} style={{ color: "var(--property-accent, #34D399)" }} />}
      size="xl"
      footer={
        <>
          <button type="button" onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              border: "1px solid var(--border, #2E3340)",
              color: "var(--text-secondary, #9BA3AF)",
              background: "transparent",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover, #2C3140)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Cancel
          </button>
          <button type="button" onClick={(e) => submit(e as any)}
            disabled={submitting}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={{
              background: "var(--property-accent, #34D399)",
              color: "#fff",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {submitting ? "Saving..." : "Create Property"}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-xs border flex items-center gap-2"
            style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {/* ── Section 1: Basic Info ── */}
        <FormSection title="Basic Info">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                TID <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div className="relative">
                <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted, #6B7280)" }} />
                <input className={`${inputClass} pl-8`} style={inputStyle()} value={tid}
                  onChange={(e) => setTid(e.target.value)} placeholder="PRO-0001" />
              </div>
              {tidError && <p className="text-xs mt-1" style={{ color: "#f87171" }}>{tidError}</p>}
              {tidChecking && <p className="text-xs mt-1" style={{ color: "var(--text-muted, #6B7280)" }}>Checking...</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Category
              </label>
              <select className={inputClass} style={inputStyle()} value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Address <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input className={inputClass} style={inputStyle()} value={address}
                onChange={(e) => setAddress(e.target.value)} placeholder="Full property address" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Owner Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input className={inputClass} style={inputStyle()} value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner name" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Owner Type
              </label>
              <select className={inputClass} style={inputStyle()} value={ownerType}
                onChange={(e) => setOwnerType(e.target.value)}>
                {OWNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                {ownerType === "Company" ? "NTN" : "CNIC"}
              </label>
              <input className={inputClass} style={inputStyle()} value={cnicNtn}
                onChange={(e) => setCnicNtn(e.target.value)}
                placeholder={ownerType === "Company" ? "NTN number" : "CNIC number"} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Ownership %
              </label>
              <input type="number" className={inputClass} style={inputStyle()} value={ownershipPct}
                onChange={(e) => setOwnershipPct(e.target.value)} min={1} max={100} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Listing Status
              </label>
              <select className={inputClass} style={inputStyle()} value={listingStatus}
                onChange={(e) => setListingStatus(e.target.value)}>
                {LISTING_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Operational Status
              </label>
              <select className={inputClass} style={inputStyle()} value={operationalStatus}
                onChange={(e) => setOperationalStatus(e.target.value)}>
                {OPERATIONAL_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
        </FormSection>

        {/* ── Section 2: Location ── */}
        <FormSection title="Location">
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
              Location
            </label>
            <LocationPicker value={locationId} onChange={setLocationId} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
              Description
            </label>
            <textarea className={inputClass} style={inputStyle()} rows={3} value={desc}
              onChange={(e) => setDesc(e.target.value)} placeholder="Property description..." />
          </div>
        </FormSection>

        {/* ── Section 3: Specifications ── */}
        <FormSection title="Specifications">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Total Area
              </label>
              <div className="flex gap-2">
                <input type="number" className={inputClass} style={inputStyle()} value={size}
                  onChange={(e) => setSize(e.target.value)} placeholder="0" />
                <select className={`${inputClass} w-24 shrink-0`} style={inputStyle()} value={sizeUnit}
                  onChange={(e) => setSizeUnit(e.target.value)}>
                  {SIZE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Year Built
              </label>
              <input type="number" className={inputClass} style={inputStyle()} value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)} placeholder="e.g. 2024" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Title Deed Number
              </label>
              <input className={inputClass} style={inputStyle()} value={titleDeedNum}
                onChange={(e) => setTitleDeedNum(e.target.value)} placeholder="Deed ref" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Registration Date
              </label>
              <input type="date" className={inputClass} style={inputStyle()} value={regDate}
                onChange={(e) => setRegDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Regulatory Authority
              </label>
              <select className={inputClass} style={inputStyle()} value={regAuthority}
                onChange={(e) => setRegAuthority(e.target.value)}>
                <option value="">Select</option>
                {["RERA", "DHA", "LDA", "CDA", "Private", "Other"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2.5">
              <div className="flex items-center gap-3 w-full">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={mortgageLien}
                    onChange={() => setMortgageLien(!mortgageLien)} />
                  <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                    style={{ background: mortgageLien ? "var(--property-accent, #34D399)" : "var(--bg-active, #313849)" }} />
                </label>
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                  Mortgage / Lien
                </span>
              </div>
            </div>
          </div>
          {mortgageLien && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>Lender Name</label>
                <input className={inputClass} style={inputStyle()} value={lenderName}
                  onChange={(e) => setLenderName(e.target.value)} placeholder="Bank / institution" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>Outstanding Amount</label>
                <input type="number" className={inputClass} style={inputStyle()} value={outstandingAmt}
                  onChange={(e) => setOutstandingAmt(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          )}
          <div className="mt-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
              Amenities
            </label>
            <AmenityPicker value={amenityIds} onChange={setAmenityIds} />
          </div>
        </FormSection>

        {/* ── Section 4: Financials ── */}
        <FormSection title="Financials">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Purchase Price
              </label>
              <input type="number" className={inputClass} style={inputStyle()} value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Current Market Value
              </label>
              <input type="number" className={inputClass} style={inputStyle()} value={currentMarketValue}
                onChange={(e) => setCurrentMarketValue(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={forSale}
                onChange={() => setForSale(!forSale)} />
              <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                style={{ background: forSale ? "var(--property-accent, #34D399)" : "var(--bg-active, #313849)" }} />
            </label>
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
              For Sale
            </span>
          </div>
          {forSale && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>Asking Price</label>
                <input type="number" className={inputClass} style={inputStyle()} value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>Commission %</label>
                <input type="number" className={inputClass} style={inputStyle()} value={commissionPct}
                  onChange={(e) => setCommissionPct(e.target.value)} placeholder="0" min={0} max={100} />
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Income GL Account
              </label>
              <SearchableSelect
                options={glOptions}
                value={incomeGlId}
                onChange={setIncomeGlId}
                placeholder="Select income account..."
                loading={glLoading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Expense GL Account
              </label>
              <SearchableSelect
                options={glOptions}
                value={expenseGlId}
                onChange={setExpenseGlId}
                placeholder="Select expense account..."
                loading={glLoading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Asset GL Account
              </label>
              <SearchableSelect
                options={glOptions}
                value={assetGlId}
                onChange={setAssetGlId}
                placeholder="Select asset account..."
                loading={glLoading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Cost Centre
              </label>
              <input className={inputClass} style={inputStyle()} value={costCentre}
                onChange={(e) => setCostCentre(e.target.value)} placeholder="Cost centre code" />
            </div>
          </div>
        </FormSection>

        {/* ── Section 5: Media ── */}
        <FormSection title="Media">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
              Property Image
            </span>
            <label className="cursor-pointer flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--property-accent, #34D399)", background: "var(--property-accent-soft, rgba(52,211,153,0.12))" }}>
              <ImagePlus size={12} /> Choose Image
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </label>
          </div>
          {imagePreview && (
            <div className="relative w-full max-w-xs rounded-lg overflow-hidden mb-4"
              style={{ border: "1px solid var(--border, #2E3340)" }}>
              <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover" />
              <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.6)" }}>
                <X size={12} style={{ color: "#fff" }} />
              </button>
            </div>
          )}

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Document Vault
              </span>
              <button type="button" onClick={addDocument}
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded transition-colors"
                style={{ color: "var(--property-accent, #34D399)", background: "var(--property-accent-soft, rgba(52,211,153,0.12))" }}>
                <Plus size={11} /> Add Document
              </button>
            </div>
            {documents.map((doc) => (
              <div key={doc._key} className="flex items-center gap-2 p-2 mb-2 rounded-lg"
                style={{ background: "var(--bg-tertiary, #252932)", border: "1px solid var(--border-subtle, #252932)" }}>
                <select className={inputClass} style={inputStyle({ width: "140px" })} value={doc.document_type}
                  onChange={(e) => setDoc(doc._key, "document_type", e.target.value)}>
                  {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className={`${inputClass} flex-1`} style={inputStyle()} value={doc.document_name}
                  onChange={(e) => setDoc(doc._key, "document_name", e.target.value)} placeholder="Document name" />
                <label className="cursor-pointer px-2 py-1.5 rounded text-xs font-medium transition-colors shrink-0"
                  style={{ color: "var(--property-accent, #34D399)", background: "var(--property-accent-soft, rgba(52,211,153,0.12))" }}>
                  <FileText size={12} className="inline mr-1" />{doc.file ? doc.file.name.slice(0, 15) + "..." : "Upload"}
                  <input type="file" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setDoc(doc._key, "file", f); setDoc(doc._key, "file_name", f.name); setDoc(doc._key, "file_size", `${(f.size / 1024).toFixed(1)} KB`); }
                    }} />
                </label>
                <input className={`${inputClass} w-28`} style={inputStyle()} type="date" value={doc.expiry_date}
                  onChange={(e) => setDoc(doc._key, "expiry_date", e.target.value)} />
                <button type="button" onClick={() => removeDocument(doc._key)}
                  className="p-1 rounded transition-colors shrink-0"
                  style={{ color: "var(--text-muted, #6B7280)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted, #6B7280)")}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* ── Floors & Units ── */}
          <div className="mt-6">
            <div
              className="flex items-center justify-between p-3 rounded-lg cursor-pointer select-none"
              style={{ background: "var(--bg-tertiary, #252932)", border: "1px solid var(--border, #2E3340)" }}
              onClick={() => setFloorsExpanded(!floorsExpanded)}
            >
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                {floors.length} floor{floors.length !== 1 ? "s" : ""} configured
              </span>
              {floorsExpanded ? <ChevronDown size={14} style={{ color: "var(--text-muted, #6B7280)" }} />
                : <ChevronRight size={14} style={{ color: "var(--text-muted, #6B7280)" }} />}
            </div>

            {floorsExpanded && (
              <div className="mt-3 space-y-3">
                {floors.map((floor) => (
                  <div key={floor._key}
                    className="rounded-lg overflow-hidden"
                    style={{ border: "1px solid var(--border, #2E3340)" }}>
                    <div className="flex items-center justify-between px-3 py-2 cursor-pointer"
                      style={{ background: "var(--bg-tertiary, #252932)" }}
                      onClick={() => toggleFloor(floor._key)}>
                      <span className="text-xs font-medium" style={{ color: "var(--text-primary, #E8ECF0)" }}>
                        Floor {floor.floor_number} ({floor.units.length} units)
                      </span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={(e) => { e.stopPropagation(); addUnit(floor._key); }}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{ color: "var(--property-accent, #34D399)", background: "var(--property-accent-soft, rgba(52,211,153,0.12))" }}>
                          + Unit
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeFloor(floor._key); }}
                          className="p-1 rounded transition-colors"
                          style={{ color: "var(--text-muted, #6B7280)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted, #6B7280)")}>
                          <Trash2 size={12} />
                        </button>
                        {expandedFloors.has(floor._key)
                          ? <ChevronDown size={12} style={{ color: "var(--text-muted, #6B7280)" }} />
                          : <ChevronRight size={12} style={{ color: "var(--text-muted, #6B7280)" }} />}
                      </div>
                    </div>
                    {expandedFloors.has(floor._key) && floor.units.map((unit) => (
                      <div key={unit._key} className="flex items-center gap-2 px-3 py-2"
                        style={{ borderTop: "1px solid var(--border-subtle, #252932)" }}>
                        <input className={`${inputClass} flex-1`} style={inputStyle()} value={unit.unit_number}
                          onChange={(e) => setUnit(floor._key, unit._key, "unit_number", e.target.value)}
                          placeholder="Unit #" />
                        <input className={`${inputClass} w-20`} style={inputStyle()} value={unit.size}
                          onChange={(e) => setUnit(floor._key, unit._key, "size", e.target.value)}
                          placeholder="Size" type="number" />
                        <input className={`${inputClass} w-24`} style={inputStyle()} value={unit.rent_amount}
                          onChange={(e) => setUnit(floor._key, unit._key, "rent_amount", e.target.value)}
                          placeholder="Rent" type="number" />
                        <select className={`${inputClass} w-28`} style={inputStyle()} value={unit.status}
                          onChange={(e) => setUnit(floor._key, unit._key, "status", e.target.value)}>
                          {["available", "occupied", "reserved", "maintenance"].map((s) =>
                            <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button type="button" onClick={() => removeUnit(floor._key, unit._key)}
                          className="p-1 rounded shrink-0 transition-colors"
                          style={{ color: "var(--text-muted, #6B7280)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted, #6B7280)")}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
                <button type="button" onClick={addFloor}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                  style={{ color: "var(--property-accent, #34D399)", background: "var(--property-accent-soft, rgba(52,211,153,0.12))" }}>
                  <Plus size={12} /> Add Floor
                </button>
              </div>
            )}
          </div>
        </FormSection>
      </form>
    </ModuleDialog>
  );
}
