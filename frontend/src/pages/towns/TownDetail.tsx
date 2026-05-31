import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  MapPin, Building2, Eye, FileText, CheckCircle, AlertCircle, HelpCircle,
  TrendingUp, Award, DollarSign, Layers, Sparkles, User, ShieldCheck, Compass, Info
} from "lucide-react";
import AttachmentsButton from "../../components/attachments/AttachmentsButton";
import { RowActions, QuickRowActions } from "../../components/actions";
import Modal from "../../components/Modal";
import { FormField } from "../../components/crm/FormField";
import {
  townApi, TownFull, Block, BlockWithPlots,
  TownUnit, UnitType, UnitCategory, UnitStatus,
  UNIT_TYPE_LABELS, UNIT_STATUS_CONFIG, UNIT_CATEGORY_CONFIG
} from "../../lib/townApi";
import AppTable from "../../components/data-table/AppTable";
import { TableColumn, TableAction } from "../../components/data-table/types";
import { useLookup } from "../../hooks/useLookup";

// ── Badges matching standard design systems ──────────────────────────────────

function PlotStatusBadge({ status }: { status: string }) {
  const cfg = UNIT_STATUS_CONFIG[status as UnitStatus] ?? { label: status, color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide capitalize"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function BlockTypeBadge({ type }: { type: string }) {
  const bg = type === "commercial" ? "rgba(245,158,11,0.12)" : type === "residential" ? "rgba(59,130,246,0.12)" : "rgba(139,92,246,0.12)";
  const color = type === "commercial" ? "#f59e0b" : type === "residential" ? "#3b82f6" : "#8b5cf6";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
      style={{ background: bg, color }}
    >
      {type}
    </span>
  );
}

// ── Block Form Modal ──────────────────────────────────────────────────────────

function BlockFormModal({
  open, onClose, initial, townId, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: Block | null;
  townId: number;
  onSaved: () => void;
}) {
  const [name, setName]         = useState("");
  const [blockType, setType]    = useState("residential");
  const [description, setDesc]  = useState("");
  const [progress, setProgress] = useState(0);
  const [workType, setWorkType] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setType(initial?.block_type ?? "residential");
      setDesc(initial?.description ?? "");
      setProgress(initial?.progress_percentage ?? 0);
      setWorkType(initial?.work_type ?? "");
      setError("");
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        town_id: townId,
        name: name.trim(),
        block_type: blockType,
        description: description.trim() || undefined,
        progress_percentage: Number(progress),
        work_type: workType.trim() || undefined,
      };
      if (initial?.id) {
        await townApi.updateBlock(initial.id, payload);
      } else {
        await townApi.createBlock(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to save block");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? "Edit Block" : "New Block"}>
      <div className="space-y-4">
        {error && (
          <p className="text-xs text-red-400 px-3 py-2 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)" }}>
            {error}
          </p>
        )}

        <FormField label="Block / Phase Name" required>
          <input
            className="input-dark w-full px-3 py-2.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Block A, Phase 1"
            autoFocus
          />
        </FormField>

        <FormField label="Type">
          <select
            className="select-dark w-full px-3 py-2.5 text-sm"
            value={blockType}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="mixed">Mixed</option>
            <option value="industrial">Industrial</option>
          </select>
        </FormField>

        <FormField label={`Construction Progress — ${progress}%`}>
          <input
            type="range"
            min={0}
            max={100}
            className="w-full accent-blue-500"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />
        </FormField>

        <FormField label="Work Type">
          <input
            className="input-dark w-full px-3 py-2.5 text-sm"
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
            placeholder="e.g. road, sewerage, electricity"
          />
        </FormField>

        <FormField label="Description">
          <textarea
            className="input-dark w-full px-3 py-2.5 text-sm resize-none"
            rows={2}
            value={description}
            onChange={(e) => setDesc(e.target.value)}
          />
        </FormField>

        <div className="flex items-center gap-3">
          <AttachmentsButton module="block" recordId={initial?.id} />
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 py-3 text-sm rounded-xl font-medium"
          >
            {saving ? "Saving…" : initial?.id ? "Update Block" : "Create Block"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Enterprise TownUnit Form Modal ───────────────────────────────────────────

function TownUnitFormModal({
  blocks, open, initial, units, onClose, onSaved,
}: {
  blocks: Block[]; open: boolean;
  initial: TownUnit | null;
  units: TownUnit[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { options: UNIT_TYPE_OPTS } = useLookup('unit_type');
  const [unitNumber, setUnitNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [blockId, setBlockId] = useState<number | "">("");
  const [unitType, setUnitType] = useState<UnitType>("plot");
  const [category, setCategory] = useState<UnitCategory>("residential");
  const [status, setStatus] = useState<UnitStatus>("available");
  
  // Location
  const [street, setStreet] = useState("");
  const [sector, setSector] = useState("");
  const [floorNumber, setFloorNumber] = useState<number | "">("");
  const [sizeLabel, setSizeLabel] = useState("");
  const [sizeSqft, setSizeSqft] = useState("");
  const [sizeUnit, setSizeUnit] = useState("Marla");
  const [dimensions, setDimensions] = useState("");

  // Financial
  const [totalPrice, setTotalPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [bookingAmount, setBookingAmount] = useState("");
  const [monthlyInstallment, setMonthlyInstallment] = useState("");
  const [installmentMonths, setInstallmentMonths] = useState<number | "">("");
  const [installmentAvailable, setInstallmentAvailable] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState("");

  // Features
  const [isCorner, setIsCorner] = useState(false);
  const [isFacingPark, setIsFacingPark] = useState(false);
  const [isMainBoulevard, setIsMainBoulevard] = useState(false);
  const [isPossessionReady, setIsPossessionReady] = useState(false);

  // Ownership
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerCnic, setOwnerCnic] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setUnitNumber(initial?.unit_number ?? "");
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setBlockId(initial?.block_id ?? (blocks[0]?.id ?? ""));
      setUnitType(initial?.unit_type ?? "plot");
      setCategory(initial?.category ?? "residential");
      setStatus(initial?.status ?? "available");
      
      setStreet(initial?.street ?? "");
      setSector(initial?.sector ?? "");
      setFloorNumber(initial?.floor_number ?? "");
      setSizeLabel(initial?.size_label ?? "");
      setSizeSqft(initial?.size_sqft ?? "");
      setSizeUnit(initial?.size_unit ?? "Marla");
      setDimensions(initial?.dimensions ?? "");

      setTotalPrice(initial?.total_price ?? "");
      setCostPrice(initial?.cost_price ?? "");
      setBookingAmount(initial?.booking_amount ?? "");
      setMonthlyInstallment(initial?.monthly_installment ?? "");
      setInstallmentMonths(initial?.installment_months ?? "");
      setInstallmentAvailable(initial?.installment_available ?? false);
      setReceivedAmount(initial?.received_amount ?? "");

      setIsCorner(initial?.is_corner ?? false);
      setIsFacingPark(initial?.is_facing_park ?? false);
      setIsMainBoulevard(initial?.is_main_boulevard ?? false);
      setIsPossessionReady(initial?.is_possession_ready ?? false);

      setOwnerName(initial?.owner_name ?? "");
      setOwnerPhone(initial?.owner_phone ?? "");
      setOwnerCnic(initial?.owner_cnic ?? "");
      setBuyerName(initial?.buyer_name ?? "");
      setBuyerPhone(initial?.buyer_phone ?? "");
      setTenantName(initial?.tenant_name ?? "");
      setTenantPhone(initial?.tenant_phone ?? "");
      setNotes(initial?.notes ?? "");
      
      setError("");
    }
  }, [open, initial, blocks]);

  const handleSave = async () => {
    if (!unitNumber.trim()) { setError("Unit Number is required"); return; }
    if (!blockId) { setError("Block is required"); return; }

    setSaving(true);
    setError("");
    try {
      const payload = {
        town_id: townId,
        block_id: Number(blockId),
        unit_number: unitNumber.trim(),
        title: title.trim() || null,
        description: description.trim() || null,
        unit_type: unitType,
        category: category,
        status: status,
        street: street.trim() || null,
        sector: sector.trim() || null,
        floor_number: floorNumber !== "" ? Number(floorNumber) : null,
        size_label: sizeLabel.trim() || null,
        size_sqft: sizeSqft !== "" ? sizeSqft : null,
        size_unit: sizeUnit,
        dimensions: dimensions.trim() || null,
        total_price: totalPrice !== "" ? totalPrice : null,
        cost_price: costPrice !== "" ? costPrice : null,
        booking_amount: bookingAmount !== "" ? bookingAmount : null,
        monthly_installment: monthlyInstallment !== "" ? monthlyInstallment : null,
        installment_months: installmentMonths !== "" ? Number(installmentMonths) : null,
        installment_available: installmentAvailable,
        received_amount: receivedAmount !== "" ? receivedAmount : "0",
        is_corner: isCorner,
        is_facing_park: isFacingPark,
        is_main_boulevard: isMainBoulevard,
        is_possession_ready: isPossessionReady,
        owner_name: ownerName.trim() || null,
        owner_phone: ownerPhone.trim() || null,
        owner_cnic: ownerCnic.trim() || null,
        buyer_name: buyerName.trim() || null,
        buyer_phone: buyerPhone.trim() || null,
        tenant_name: tenantName.trim() || null,
        tenant_phone: tenantPhone.trim() || null,
        notes: notes.trim() || null,
      };

      if (initial?.id) {
        await townApi.updateUnit(initial.id, payload);
      } else {
        await townApi.createUnit(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to save unit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? `Edit Unit/Plot - ${unitNumber}` : "Create New Unit/Plot"}
      size="lg"
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <p className="text-xs text-red-400 px-3 py-2 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)" }}>
            {error}
          </p>
        )}

        {/* SECTION 1: Basic Info */}
        <div>
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Unit / Plot Number" required>
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="e.g. 123-A"
                autoFocus
              />
            </FormField>

            <FormField label="Block / Phase" required>
              <select
                className="select-dark w-full px-3 py-2.5 text-sm"
                value={blockId}
                onChange={(e) => setBlockId(Number(e.target.value))}
              >
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Title / Name">
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Corner Commercial Shop"
              />
            </FormField>

            <FormField label="Unit Type">
              <select
                className="select-dark w-full px-3 py-2.5 text-sm"
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as UnitType)}
              >
                {UNIT_TYPE_OPTS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Category">
              <select
                className="select-dark w-full px-3 py-2.5 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as UnitCategory)}
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="mixed_use">Mixed Use</option>
                <option value="industrial">Industrial</option>
              </select>
            </FormField>

            <FormField label="Status">
              <select
                className="select-dark w-full px-3 py-2.5 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as UnitStatus)}
              >
                <option value="available">Available</option>
                <option value="booked">Booked</option>
                <option value="sold">Sold</option>
                <option value="rented">Rented</option>
                <option value="under_construction">Under Construction</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
          </div>
        </div>

        {/* SECTION 2: Location & Size */}
        <div>
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Location & Physical Size</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Street">
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="e.g. Street 5"
              />
            </FormField>

            <FormField label="Sector / Area">
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="e.g. Sector C"
              />
            </FormField>

            <FormField label="Floor Number">
              <input
                type="number"
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={floorNumber}
                onChange={(e) => setFloorNumber(e.target.value !== "" ? Number(e.target.value) : "")}
                placeholder="e.g. Ground = 0, First = 1"
              />
            </FormField>

            <FormField label="Size (Label)">
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={sizeLabel}
                onChange={(e) => setSizeLabel(e.target.value)}
                placeholder="e.g. 5 Marla, 1 Kanal"
              />
            </FormField>

            <FormField label="Size (Numeric Value)">
              <input
                type="number"
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={sizeSqft}
                onChange={(e) => setSizeSqft(e.target.value)}
                placeholder="Numeric value"
              />
            </FormField>

            <FormField label="Size Unit">
              <select
                className="select-dark w-full px-3 py-2.5 text-sm"
                value={sizeUnit}
                onChange={(e) => setSizeUnit(e.target.value)}
              >
                <option value="Marla">Marla</option>
                <option value="Kanal">Kanal</option>
                <option value="Sqft">Sqft</option>
                <option value="Sqyd">Sqyd</option>
                <option value="Acre">Acre</option>
              </select>
            </FormField>

            <FormField label="Dimensions">
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                placeholder="e.g. 25 x 45"
              />
            </FormField>
          </div>
        </div>

        {/* SECTION 3: Features & Attributes */}
        <div>
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Optional Features</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
            <label className="flex items-center gap-2.5 text-xs text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isCorner}
                onChange={(e) => setIsCorner(e.target.checked)}
                className="w-4.5 h-4.5 rounded bg-gray-800 border-gray-700 accent-blue-500"
              />
              <span>Is Corner Plot</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isFacingPark}
                onChange={(e) => setIsFacingPark(e.target.checked)}
                className="w-4.5 h-4.5 rounded bg-gray-800 border-gray-700 accent-blue-500"
              />
              <span>Facing Park</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isMainBoulevard}
                onChange={(e) => setIsMainBoulevard(e.target.checked)}
                className="w-4.5 h-4.5 rounded bg-gray-800 border-gray-700 accent-blue-500"
              />
              <span>Main Boulevard</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPossessionReady}
                onChange={(e) => setIsPossessionReady(e.target.checked)}
                className="w-4.5 h-4.5 rounded bg-gray-800 border-gray-700 accent-blue-500"
              />
              <span>Possession Ready</span>
            </label>
          </div>
        </div>

        {/* SECTION 4: Financial Details */}
        <div>
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Pricing & Finance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Total Sale Price (PKR)">
              <input
                type="number"
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="e.g. 5000000"
              />
            </FormField>

            <FormField label="Cost Price (PKR)">
              <input
                type="number"
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="e.g. 4000000"
              />
            </FormField>

            <FormField label="Booking Amount (PKR)">
              <input
                type="number"
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={bookingAmount}
                onChange={(e) => setBookingAmount(e.target.value)}
                placeholder="e.g. 1000000"
              />
            </FormField>

            <FormField label="Monthly Installment Amount (PKR)">
              <input
                type="number"
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={monthlyInstallment}
                onChange={(e) => setMonthlyInstallment(e.target.value)}
                placeholder="e.g. 50000"
              />
            </FormField>

            <FormField label="Installment Period (Months)">
              <input
                type="number"
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={installmentMonths}
                onChange={(e) => setInstallmentMonths(e.target.value !== "" ? Number(e.target.value) : "")}
                placeholder="e.g. 36"
              />
            </FormField>

            <FormField label="Installment Option Available">
              <select
                className="select-dark w-full px-3 py-2.5 text-sm"
                value={installmentAvailable ? "yes" : "no"}
                onChange={(e) => setInstallmentAvailable(e.target.value === "yes")}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </FormField>

            <FormField label="Received Amount (PKR)">
              <input
                type="number"
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                placeholder="0"
              />
            </FormField>
          </div>
        </div>

        {/* SECTION 5: Client Ownership details */}
        <div>
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Client Ownership Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Owner / Client Name">
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Full Name"
              />
            </FormField>

            <FormField label="Owner Phone">
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+92300..."
              />
            </FormField>

            <FormField label="Owner CNIC">
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={ownerCnic}
                onChange={(e) => setOwnerCnic(e.target.value)}
                placeholder="35201-..."
              />
            </FormField>

            <FormField label="Buyer Name">
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
              />
            </FormField>

            <FormField label="Buyer Phone">
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
              />
            </FormField>

            <FormField label="Tenant Name">
              <input
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
              />
            </FormField>
          </div>
        </div>

        <div>
          <FormField label="Internal Notes">
            <textarea
              className="input-dark w-full px-3 py-2.5 text-sm resize-none"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
        </div>

        <div className="flex items-center gap-3">
          <AttachmentsButton module="town_unit" recordId={initial?.id} />
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 py-3 text-sm rounded-xl font-semibold tracking-wide shadow-md"
          >
            {saving ? "Saving unit details..." : initial?.id ? "Update Unit Details" : "Create Enterprise Unit / Plot"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  open, onClose, label, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const handle = async () => {
    setDeleting(true);
    try { await onConfirm(); onClose(); }
    finally { setDeleting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Confirm Delete">
      <div className="space-y-4">
        <p className="text-sm text-secondary">{label}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handle}
            disabled={deleting}
            className="flex-1 py-2.5 text-sm rounded-xl font-medium transition-colors"
            style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Unit View Sidebar / Read-only Details ────────────────────────────────────

function UnitDetailModal({
  open, onClose, unit,
}: {
  open: boolean;
  onClose: () => void;
  unit: TownUnit | null;
}) {
  if (!unit) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Unit plot Details - ${unit.unit_number}`} size="lg">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        <div className="flex items-center justify-between bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
          <div>
            <span className="text-xs text-muted block">Status & Code</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-sm font-semibold text-blue-400">{unit.tid}</span>
              <PlotStatusBadge status={unit.status} />
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted block">Property Category</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-white bg-indigo-500/10 border border-indigo-500/20 mt-1 capitalize">
              {unit.category}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Column A: Specifications */}
          <div className="bg-gray-800/20 p-4 rounded-2xl border border-gray-700/30 space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide border-b border-gray-700 pb-1.5">Specifications</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-muted block">Unit Type</span><span className="text-primary font-medium">{UNIT_TYPE_LABELS[unit.unit_type] ?? unit.unit_type}</span></div>
              <div><span className="text-muted block">Size Label</span><span className="text-primary font-medium">{unit.size_label ?? "—"}</span></div>
              <div><span className="text-muted block">Area Value</span><span className="text-primary font-medium">{unit.size_sqft ? `${unit.size_sqft} ${unit.size_unit || "Marla"}` : "—"}</span></div>
              <div><span className="text-muted block">Dimensions</span><span className="text-primary font-medium">{unit.dimensions ?? "—"}</span></div>
              <div><span className="text-muted block">Street / Sector</span><span className="text-primary font-medium">{[unit.street, unit.sector].filter(Boolean).join(", ") || "—"}</span></div>
              <div><span className="text-muted block">Floor #</span><span className="text-primary font-medium">{unit.floor_number !== null ? `Floor ${unit.floor_number}` : "—"}</span></div>
            </div>
            
            <div className="border-t border-gray-700/50 pt-2.5">
              <span className="text-muted text-[11px] block mb-1.5">Special Features</span>
              <div className="flex flex-wrap gap-2">
                {unit.is_corner && <span className="bg-green-500/10 border border-green-500/20 text-[10px] text-green-400 px-2 py-0.5 rounded-full font-medium">Corner</span>}
                {unit.is_facing_park && <span className="bg-green-500/10 border border-green-500/20 text-[10px] text-green-400 px-2 py-0.5 rounded-full font-medium">Facing Park</span>}
                {unit.is_main_boulevard && <span className="bg-green-500/10 border border-green-500/20 text-[10px] text-green-400 px-2 py-0.5 rounded-full font-medium">Main Boulevard</span>}
                {unit.is_possession_ready ? (
                  <span className="bg-green-500/10 border border-green-500/20 text-[10px] text-green-400 px-2 py-0.5 rounded-full font-medium">Possession Ready</span>
                ) : (
                  <span className="bg-gray-500/10 border border-gray-500/20 text-[10px] text-muted px-2 py-0.5 rounded-full">Possession Pending</span>
                )}
              </div>
            </div>
          </div>

          {/* Column B: Financial Summary */}
          <div className="bg-gray-800/20 p-4 rounded-2xl border border-gray-700/30 space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide border-b border-gray-700 pb-1.5">Financial Snapshot</h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between"><span className="text-muted">Total Price:</span><span className="text-primary font-bold">PKR {Number(unit.total_price || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted">Cost Price:</span><span className="text-secondary">PKR {unit.cost_price ? Number(unit.cost_price).toLocaleString() : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted">Booking Price:</span><span className="text-secondary">PKR {unit.booking_amount ? Number(unit.booking_amount).toLocaleString() : "—"}</span></div>
              <div className="flex justify-between border-t border-gray-700/50 pt-2"><span className="text-muted">Received Amount:</span><span className="text-green-400 font-semibold">PKR {Number(unit.received_amount || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted">Remaining Balance:</span><span className="text-red-400 font-semibold">PKR {Number(unit.remaining_balance || 0).toLocaleString()}</span></div>
              
              <div className="border-t border-gray-700/50 pt-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">Installment Plan:</span>
                  <span className="font-medium text-primary">
                    {unit.installment_available ? `Yes (${unit.installment_months || 0} Months)` : "No Plan"}
                  </span>
                </div>
                {unit.installment_available && unit.monthly_installment && (
                  <p className="text-[10px] text-muted mt-0.5 text-right">
                    PKR {Number(unit.monthly_installment).toLocaleString()} / Month
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ownership Summary */}
        <div className="bg-gray-800/20 p-4 rounded-2xl border border-gray-700/30 space-y-2">
          <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide border-b border-gray-700 pb-1.5">Ownership & Contacts</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-muted block">Primary Owner / Client</span>
              <span className="text-primary font-semibold text-sm mt-0.5 block">{unit.owner_name || "—"}</span>
              {unit.owner_phone && <span className="text-muted block text-[11px] mt-0.5">{unit.owner_phone}</span>}
              {unit.owner_cnic && <span className="text-muted block text-[11px] font-mono">{unit.owner_cnic}</span>}
            </div>

            <div>
              <span className="text-muted block">Registered Buyer</span>
              <span className="text-primary font-semibold text-sm mt-0.5 block">{unit.buyer_name || "—"}</span>
              {unit.buyer_phone && <span className="text-muted block text-[11px] mt-0.5">{unit.buyer_phone}</span>}
            </div>

            <div>
              <span className="text-muted block">Active Tenant</span>
              <span className="text-primary font-semibold text-sm mt-0.5 block">{unit.tenant_name || "—"}</span>
              {unit.tenant_phone && <span className="text-muted block text-[11px] mt-0.5">{unit.tenant_phone}</span>}
            </div>
          </div>
        </div>

        {unit.notes && (
          <div className="bg-gray-800/10 p-3.5 rounded-xl border border-gray-800 text-xs">
            <span className="text-muted font-semibold block mb-1">Internal Notes / Log</span>
            <p className="text-secondary leading-relaxed font-sans">{unit.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Legacy Plot mapping component for Block rendering ────────────────────────

function LegacyBlockRow({
  block,
  onEditBlock,
  onDeleteBlock,
  onAddUnit,
  onEditUnit,
  onDeleteUnit,
  onViewUnit,
}: {
  block: BlockWithPlots;
  onEditBlock: (b: Block) => void;
  onDeleteBlock: (b: Block) => void;
  onAddUnit: (blockId: number) => void;
  onEditUnit: (u: TownUnit) => void;
  onDeleteUnit: (u: TownUnit) => void;
  onViewUnit: (u: TownUnit) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  // Map legacy Plot objects into our standard TownUnit shape inside the block list
  const mappedUnits = useMemo(() => {
    return (block.plots || []).map(p => ({
      id: p.id,
      tid: p.tid,
      unit_number: p.plot_number,
      title: null,
      description: p.notes,
      block_id: p.block_id,
      town_id: block.town_id,
      unit_type: (p.plot_type || "plot") as UnitType,
      category: "residential" as UnitCategory,
      status: p.status as UnitStatus,
      street: null,
      sector: null,
      floor_number: null,
      size_label: p.size,
      size_sqft: null,
      size_unit: "Marla",
      dimensions: null,
      total_price: p.price,
      cost_price: null,
      booking_amount: null,
      monthly_installment: null,
      installment_months: null,
      installment_available: false,
      received_amount: "0",
      remaining_balance: null,
      is_corner: false,
      is_facing_park: false,
      is_main_boulevard: false,
      is_possession_ready: false,
      owner_name: p.owner_name,
      owner_phone: p.owner_phone,
      owner_cnic: null,
      buyer_name: null,
      buyer_phone: null,
      tenant_name: null,
      tenant_phone: null,
      property_id: null,
      plot_id: p.id,
      notes: p.notes,
      created_by: null,
      created_at: "",
      updated_at: "",
      block_name: block.name,
      town_name: null,
    } as TownUnit));
  }, [block.plots, block.name, block.town_id]);

  return (
    <>
      <tr
        className="row-hover cursor-pointer"
        style={{ borderBottom: expanded ? "none" : "1px solid var(--border-subtle)" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-5 py-3.5" colSpan={2}>
          <div className="flex items-center gap-2">
            <span className="text-muted">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            <span className="font-medium text-primary">{block.name}</span>
            <span className="font-mono text-xs text-blue-400">{block.tid}</span>
            <BlockTypeBadge type={block.block_type ?? "residential"} />
          </div>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div
              className="w-20 h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${block.progress_percentage}%`,
                  background: "linear-gradient(90deg,#3b82f6,#6366f1)",
                }}
              />
            </div>
            <span className="text-xs text-secondary">
              {block.progress_percentage.toFixed(0)}%
            </span>
          </div>
        </td>
        <td className="px-5 py-3.5 text-secondary">{block.plot_count}</td>
        <td className="px-5 py-3.5">
          <span style={{ color: "#10b981" }}>{block.available_plots}</span>
          {" / "}
          <span style={{ color: "#f59e0b" }}>{block.booked_plots}</span>
          {" / "}
          <span style={{ color: "#ef4444" }}>{block.sold_plots}</span>
        </td>
        <td className="px-5 py-3.5">
          <RowActions
            row={block}
            actions={[
              {
                type: "custom",
                label: "Add Unit",
                icon: Plus,
                color: "#10b981",
                tooltip: "Add new unit/plot to this block",
                handler: (r) => onAddUnit(r.id),
                permission: "towns:manage",
              },
              {
                type: "edit",
                handler: (r) => onEditBlock(r),
                permission: "towns:manage",
              },
              {
                type: "delete",
                handler: (r) => onDeleteBlock(r),
                permission: "towns:manage",
                confirmMessage: `Are you sure you want to delete block "${block.name}"? All plots inside will also be deleted. This action cannot be undone.`,
              },
            ]}
            variant="icon-buttons"
            compact
          />
        </td>
      </tr>

      {expanded && (
        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <td colSpan={6} className="px-0 py-0">
            <div style={{ background: "var(--bg-surface2)", borderTop: "1px solid var(--border-subtle)" }}>
              {mappedUnits.length === 0 ? (
                <div className="px-10 py-5 text-xs text-secondary">
                  No units yet.{" "}
                  <button
                    type="button"
                    onClick={() => onAddUnit(block.id)}
                    className="text-blue-400 hover:underline"
                  >
                    Add the first unit/plot
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      {["Plot #", "Size", "Type", "Status", "Price", "Owner", "Actions"].map((h) => (
                        <th
                          key={h}
                          className={`text-left px-5 py-2 text-xs font-semibold text-muted uppercase tracking-wider ${h === "Actions" ? "text-right" : ""}`}
                          style={{ 
                            paddingLeft: h === "Plot #" ? "2.5rem" : undefined,
                            width: h === "Actions" ? "1%" : undefined
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedUnits.map((u) => (
                      <tr
                        key={u.id}
                        className="row-hover"
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                      >
                        <td className="py-2.5 pl-10 pr-5 font-medium text-primary">
                          {u.unit_number}
                        </td>
                        <td className="px-5 py-2.5 text-secondary">{u.size_label ?? "—"}</td>
                        <td className="px-5 py-2.5 text-secondary capitalize">{u.unit_type}</td>
                        <td className="px-5 py-2.5">
                          <PlotStatusBadge status={u.status} />
                        </td>
                        <td className="px-5 py-2.5 text-secondary">
                          {u.total_price
                            ? `PKR ${Number(u.total_price).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-secondary">
                          {u.owner_name ?? "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewUnit(u)}
                              className="p-1 rounded text-muted hover:text-white hover:bg-gray-800 transition-colors"
                              title="View full specs"
                            >
                              <Eye size={13} />
                            </button>
                            <QuickRowActions
                              row={u}
                              onEdit={(row) => {
                                // Find full unit object or map it properly
                                onEditUnit(row);
                              }}
                              onDelete={(row) => {
                                onDeleteUnit(row);
                              }}
                              editPermission="towns:manage"
                              deletePermission="towns:manage"
                              deleteConfirmMessage={`Are you sure you want to delete unit #${u.unit_number}? This action cannot be undone.`}
                              variant="icon-buttons"
                              compact
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function TownDetail() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [town, setTown] = useState<TownFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "blocks" | "units">("overview");

  // Finance summaries
  const [finance, setFinance] = useState<any>(null);

  // Server-side paginated units state
  const [units, setUnits] = useState<TownUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [unitsPagination, setUnitsPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  const [unitsFilters, setUnitsFilters] = useState({
    search: "",
    status: "",
    propertyType: "", // maps to unit_type in backend
    startDate: "",
    endDate: "",
  });

  // Block modal
  const [blockFormOpen, setBlockFormOpen] = useState(false);
  const [editBlock, setEditBlock]         = useState<Block | null>(null);

  // Unit modal
  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [editUnit, setEditUnit]         = useState<TownUnit | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<number>(0);

  // Read-only modal
  const [viewUnit, setViewUnit] = useState<TownUnit | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  // Delete modals
  const [deleteBlockOpen, setDeleteBlockOpen] = useState(false);
  const [deleteBlock, setDeleteBlock]         = useState<Block | null>(null);
  const [deleteUnitOpen, setDeleteUnitOpen]   = useState(false);
  const [deleteUnit, setDeleteUnit]           = useState<TownUnit | null>(null);

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await townApi.getTownFull(Number(id));
      setTown(data);
      try {
        const finData = await townApi.getFinanceSummary(Number(id));
        setFinance(finData);
      } catch (e) {
        console.error("Finance summary endpoint failed or offline", e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [id]);

  // Load paginated unit listing
  const fetchUnitsList = async (
    page: number = unitsPagination.page,
    pageSize: number = unitsPagination.pageSize,
    filters = unitsFilters
  ) => {
    if (!id) return;
    setUnitsLoading(true);
    setUnitsError(null);
    try {
      const params = {
        town_id: Number(id),
        skip: (page - 1) * pageSize,
        limit: pageSize,
        search: filters.search || undefined,
        status: filters.status || undefined,
        unit_type: filters.propertyType || undefined,
      };

      const [data, totalCount] = await Promise.all([
        townApi.listUnits(params),
        townApi.countUnits({
          town_id: Number(id),
          status: filters.status || undefined,
          unit_type: filters.propertyType || undefined,
        }).catch(() => ({ count: 0 }))
      ]);

      setUnits(data);
      setUnitsPagination({
        page,
        pageSize,
        total: (totalCount && typeof totalCount === "object" ? (totalCount as any).count : totalCount) || data.length,
      });
    } catch (err: any) {
      setUnitsError(err?.message || "Failed to load society units");
    } finally {
      setUnitsLoading(false);
    }
  };

  // Sync server side units on tab activate or filters change
  useEffect(() => {
    if (activeTab === "units") {
      fetchUnitsList(unitsPagination.page, unitsPagination.pageSize);
    }
  }, [activeTab, unitsFilters.search, unitsFilters.status, unitsFilters.propertyType]);

  const openAddBlock  = () => { setEditBlock(null); setBlockFormOpen(true); };
  const openEditBlock = (b: Block) => { setEditBlock(b); setBlockFormOpen(true); };
  const openAddUnit   = (blockId?: number) => {
    setEditUnit(null);
    setSelectedBlockId(blockId || town?.blocks[0]?.id || 0);
    setUnitFormOpen(true);
  };
  
  const openEditUnit = async (u: TownUnit) => {
    // If unit is legacy and missing rich metadata, try fetching full specs
    try {
      const fullUnit = await townApi.getUnit(u.id);
      setEditUnit(fullUnit);
    } catch {
      setEditUnit(u);
    }
    setUnitFormOpen(true);
  };

  const openViewUnit = async (u: TownUnit) => {
    try {
      const fullUnit = await townApi.getUnit(u.id);
      setViewUnit(fullUnit);
    } catch {
      setViewUnit(u);
    }
    setViewOpen(true);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-7 w-48 rounded-lg skeleton" />
        <div className="h-24 rounded-2xl skeleton" />
        <div className="h-64 rounded-2xl skeleton" />
      </div>
    );
  }

  if (!town) {
    return (
      <div className="p-6 text-center py-20">
        <Building2 size={32} className="text-muted mx-auto mb-3" />
        <p className="text-secondary text-sm">Society town was not found.</p>
        <button
          type="button"
          onClick={() => navigate("/towns")}
          className="btn-primary px-4 py-2 text-sm mt-4"
        >
          Back to Towns
        </button>
      </div>
    );
  }

  // Count metrics
  const totalUnits     = (town.blocks || []).reduce((s, b) => s + (b.plot_count || 0), 0);
  const availablePlots = (town.blocks || []).reduce((s, b) => s + (b.available_plots || 0), 0);
  const soldPlots      = (town.blocks || []).reduce((s, b) => s + (b.sold_plots || 0), 0);

  // AppTable Column Configurations
  const unitColumns: TableColumn<TownUnit>[] = [
    {
      key: "unit_number",
      label: "Unit / Plot #",
      sortable: true,
      render: (u) => (
        <div>
          <span className="font-semibold text-primary block">{u.unit_number}</span>
          <span className="text-[10px] text-muted font-mono">{u.tid}</span>
        </div>
      ),
    },
    {
      key: "block_name",
      label: "Block / Phase",
      render: (u) => <span className="text-secondary font-medium">{u.block_name || "—"}</span>,
    },
    {
      key: "unit_type",
      label: "Type",
      render: (u) => (
        <div>
          <span className="text-secondary capitalize block">{UNIT_TYPE_LABELS[u.unit_type as UnitType] || u.unit_type}</span>
          <span className="text-[10px] text-muted capitalize">{u.category.replace("_", " ")}</span>
        </div>
      ),
    },
    {
      key: "size_label",
      label: "Size",
      render: (u) => (
        <div>
          <span className="text-secondary block font-medium">{u.size_label || "—"}</span>
          {u.dimensions && <span className="text-[10px] text-muted">{u.dimensions}</span>}
        </div>
      ),
    },
    {
      key: "total_price",
      label: "Total Price",
      render: (u) => (
        <div>
          <span className="text-primary block font-bold">
            {u.total_price ? `PKR ${Number(u.total_price).toLocaleString()}` : "—"}
          </span>
          {u.installment_available && (
            <span className="text-[9px] text-green-400 font-medium bg-green-500/10 px-1 rounded">
              Installments available
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (u) => <PlotStatusBadge status={u.status} />,
    },
    {
      key: "owner_name",
      label: "Owner / Contacts",
      render: (u) => (
        <div>
          <span className="text-secondary font-medium block">{u.owner_name || u.buyer_name || "—"}</span>
          <span className="text-[10px] text-muted">{u.owner_phone || u.buyer_phone || ""}</span>
        </div>
      ),
    },
  ];

  // AppTable Action Definitions
  const unitActions: TableAction<TownUnit>[] = [
    {
      key: "view",
      label: "View Specs",
      icon: Eye,
      onClick: (row) => openViewUnit(row),
    },
    {
      key: "edit",
      label: "Edit",
      icon: Edit2,
      onClick: (row) => openEditUnit(row),
    },
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      onClick: (row) => {
        setDeleteUnit(row);
        setDeleteUnitOpen(true);
      },
    },
  ];

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/towns")}
            className="p-2 rounded-xl transition-all hover:bg-gray-800 hover:text-white text-muted"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">{town.name}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{town.tid}</span>
              {town.location && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <MapPin size={12} className="text-red-400" /> {town.location}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openAddBlock}
            className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm"
          >
            <Plus size={15} /> Add Block
          </button>
          <button
            type="button"
            onClick={() => openAddUnit()}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm"
          >
            <Plus size={15} /> Add Unit / Plot
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-px">
        {[
          { id: "overview", label: "Overview", icon: Info },
          { id: "blocks", label: "Blocks & Sectors", icon: Layers },
          { id: "units", label: "Units & Plots Directory", icon: Compass },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all capitalize -mb-px ${
                active
                  ? "border-blue-500 text-blue-400 bg-blue-500/5 rounded-t-lg"
                  : "border-transparent text-secondary hover:text-white"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="space-y-5">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left side: descriptions & quick stats */}
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-gray-900/40 p-5 rounded-2xl border border-gray-800/80 backdrop-blur-md">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-3">
                  <Sparkles size={14} className="text-yellow-400" />
                  About the Society
                </h3>
                <p className="text-secondary text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {town.description || "No description provided for this society town project. Update town details to add historical information, future planning details, or specific block limits."}
                </p>
              </div>

              {/* Society Inventory counts breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Sectors / Blocks", value: town.blocks.length, bg: "rgba(59,130,246,0.08)", color: "#3b82f6" },
                  { label: "Total Plots", value: totalUnits, bg: "rgba(148,163,184,0.06)", color: "#94a3b8" },
                  { label: "Available Inventory", value: availablePlots, bg: "rgba(16,185,129,0.08)", color: "#10b981" },
                  { label: "Sold Out", value: soldPlots, bg: "rgba(239,68,68,0.08)", color: "#ef4444" },
                ].map(({ label, value, bg, color }) => (
                  <div key={label} className="bg-gray-900/40 border border-gray-800 p-4 rounded-2xl flex flex-col justify-between">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
                      <Building2 size={15} style={{ color }} />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-primary">{value}</p>
                      <p className="text-[10px] font-semibold text-muted uppercase mt-0.5 tracking-wider">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side: Finance snapshots */}
            <div className="space-y-5">
              <div className="bg-gray-900/40 p-5 rounded-2xl border border-gray-800/80 backdrop-blur-md space-y-4">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2 border-b border-gray-800 pb-2">
                  <DollarSign size={14} className="text-green-400" />
                  Society Financial Status
                </h3>
                
                {finance ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] text-muted uppercase tracking-wider block">Total Bookings Revenue</span>
                      <span className="text-lg font-bold text-primary">PKR {Number(finance.booking_revenue || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted uppercase tracking-wider block">Total Installments Collected</span>
                      <span className="text-lg font-bold text-green-400">PKR {Number(finance.installment_revenue || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted uppercase tracking-wider block">Total Outstanding Balance</span>
                      <span className="text-lg font-bold text-red-400">PKR {Number(finance.outstanding_balance || 0).toLocaleString()}</span>
                    </div>
                    <div className="border-t border-gray-800 pt-3">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>Total Paid Transactions:</span>
                        <span className="font-bold text-primary">{finance.transaction_count}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted">
                    <TrendingUp size={24} className="text-muted mx-auto mb-2 opacity-30" />
                    Finance module indicators will show once payment transactions are posted.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "blocks" && (
          <div className="detail-container overflow-hidden">
            {town.blocks.length === 0 ? (
              <div className="p-12 text-center bg-gray-900/20 rounded-2xl border border-gray-800">
                <Building2 size={32} className="text-muted mx-auto mb-3" />
                <p className="text-secondary text-sm">No blocks registered for this society town.</p>
                <button
                  type="button"
                  onClick={openAddBlock}
                  className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm mx-auto mt-4"
                >
                  <Plus size={15} /> Add Block
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
                      {["Block / Phase", "", "Progress", "Plots Count", "Avail / Booked / Sold", "Actions"].map((h, i) => (
                        <th
                          key={i}
                          className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(town.blocks || []).map((block) => (
                      <LegacyBlockRow
                        key={block.id}
                        block={block}
                        onEditBlock={openEditBlock}
                        onDeleteBlock={(b) => { setDeleteBlock(b); setDeleteBlockOpen(true); }}
                        onAddUnit={openAddUnit}
                        onEditUnit={openEditUnit}
                        onDeleteUnit={(u) => { setDeleteUnit(u); setDeleteUnitOpen(true); }}
                        onViewUnit={openViewUnit}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "units" && (
          <div className="space-y-4 animate-fadeIn">
            <AppTable<TownUnit>
              columns={unitColumns}
              data={units}
              loading={unitsLoading}
              error={unitsError}
              onRetry={() => fetchUnitsList()}
              pagination={unitsPagination}
              onPageChange={({ page, pageSize }) => {
                setUnitsPagination(p => ({ ...p, page, pageSize }));
                fetchUnitsList(page, pageSize);
              }}
              onFilterChange={(filters) => {
                setUnitsFilters({
                  search: filters.search,
                  status: filters.status,
                  propertyType: filters.propertyType,
                  startDate: filters.startDate,
                  endDate: filters.endDate,
                });
              }}
              title="Society Units & Plots Directory"
              subtitle="Comprehensive enterprise index of commercial plots, residential houses, shops, and apartments inside the blocks."
              storageKey={`town-units:${id}`}
              rowActions={unitActions}
              showDateFilter={false}
              showStatusFilter={true}
              statusOptions={[
                { label: "Available", value: "available" },
                { label: "Booked", value: "booked" },
                { label: "Sold", value: "sold" },
                { label: "Rented", value: "rented" },
                { label: "Under Construction", value: "under_construction" },
                { label: "Inactive", value: "inactive" },
              ]}
              showTypeFilter={true}
              typeOptions={Object.entries(UNIT_TYPE_LABELS).map(([k, v]) => ({ label: v, value: k }))}
              toolbarActions={
                <button
                  onClick={() => openAddUnit()}
                  className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
                >
                  <Plus size={14} /> Add Plot / Property
                </button>
              }
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <BlockFormModal
        open={blockFormOpen}
        onClose={() => setBlockFormOpen(false)}
        initial={editBlock}
        townId={town.id}
        onSaved={loadAll}
      />
      
      <TownUnitFormModal
        open={unitFormOpen}
        onClose={() => setUnitFormOpen(false)}
        initial={editUnit}
        townId={town.id}
        blocks={town.blocks}
        onSaved={loadAll}
      />

      <UnitDetailModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        unit={viewUnit}
      />

      <ConfirmDeleteModal
        open={deleteBlockOpen}
        onClose={() => setDeleteBlockOpen(false)}
        label={`Delete block "${deleteBlock?.name}"? All plots inside will also be deleted. This cannot be undone.`}
        onConfirm={async () => {
          if (deleteBlock) await townApi.deleteBlock(deleteBlock.id);
          await loadAll();
        }}
      />
      
      <ConfirmDeleteModal
        open={deleteUnitOpen}
        onClose={() => setDeleteUnitOpen(false)}
        label={`Delete unit #${deleteUnit?.unit_number}? This cannot be undone.`}
        onConfirm={async () => {
          if (deleteUnit) {
            // Check if plot_id is populated or standalone unit id is used
            const targetId = deleteUnit.id;
            await townApi.deleteUnit(targetId);
          }
          await loadAll();
          if (activeTab === "units") fetchUnitsList();
        }}
      />
    </div>
  );
}
