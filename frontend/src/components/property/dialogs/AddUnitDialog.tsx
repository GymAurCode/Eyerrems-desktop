import { useState, useEffect, FormEvent } from "react";
import { Hash } from "lucide-react";
import AppDialog from "../../ui/AppDialog";
import FormSection from "../../ui/FormSection";
import { propApi, Floor, Unit } from "../../../lib/propertyApi";

interface AddUnitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  floors: Floor[];
  editUnit?: Unit | null;
}

const FURNISHING_OPTIONS = ["", "furnished", "semi-furnished", "unfurnished"];
const AREA_UNITS = ["sqft", "sqm", "marla"];
const UNIT_TYPE_OPTIONS = ["", "Studio", "1BR", "2BR", "3BR", "4BR", "Penthouse", "Duplex", "Shop", "Office", "Warehouse"];

interface UnitFormData {
  unitNumber: string;
  floorId: number | "";
  status: string;
  unitType: string;
  area: string;
  areaUnit: string;
  rentAmount: string;
  salePrice: string;
  furnishingStatus: string;
  securityDeposit: string;
  currentTenant: string;
  leaseEndDate: string;
  notes: string;
}

const INITIAL_FORM: UnitFormData = {
  unitNumber: "", floorId: "", status: "available", unitType: "",
  area: "", areaUnit: "sqft", rentAmount: "", salePrice: "",
  furnishingStatus: "", securityDeposit: "", currentTenant: "",
  leaseEndDate: "", notes: "",
};

export default function AddUnitDialog({ isOpen, onClose, onSaved, floors, editUnit }: AddUnitDialogProps) {
  const [form, setForm] = useState<UnitFormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Unit | null>(null);

  const set = (field: keyof UnitFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const loadUnit = (unit: Unit) => {
    setEditing(unit);
    setForm({
      unitNumber: unit.unit_number,
      floorId: unit.floor_id,
      status: unit.status,
      unitType: unit.unit_type || "",
      area: unit.area?.toString() || "",
      areaUnit: unit.area_unit || "sqft",
      rentAmount: unit.rent_amount?.toString() || "",
      salePrice: unit.sale_price?.toString() || "",
      furnishingStatus: unit.furnishing_status || "",
      securityDeposit: unit.security_deposit?.toString() || "",
      currentTenant: unit.current_tenant_name || "",
      leaseEndDate: unit.lease_end_date || "",
      notes: unit.notes || "",
    });
  };

  useEffect(() => {
    if (editUnit) loadUnit(editUnit);
    else setEditing(null);
  }, [editUnit]);

  const reset = () => {
    setForm(INITIAL_FORM);
    setEditing(null);
    setError("");
  };

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.unitNumber.trim()) { setError("Unit number is required."); return; }
    if (!form.floorId) { setError("Floor is required."); return; }

    setSubmitting(true);
    try {
      const payload = {
        floor_id: Number(form.floorId),
        unit_number: form.unitNumber.trim(),
        status: form.status,
        unit_type: form.unitType || null,
        area: form.area ? Number(form.area) : null,
        area_unit: form.areaUnit || null,
        rent_amount: form.rentAmount ? Number(form.rentAmount) : null,
        sale_price: form.salePrice ? Number(form.salePrice) : null,
        furnishing_status: form.furnishingStatus || null,
        security_deposit: form.securityDeposit ? Number(form.securityDeposit) : null,
        current_tenant_name: form.currentTenant || null,
        lease_end_date: form.leaseEndDate || null,
        notes: form.notes || null,
      };

      if (editing) {
        await propApi.updateUnit(editing.id, payload);
      } else {
        await propApi.createUnit(payload);
      }

      reset();
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to save unit.");
    } finally { setSubmitting(false); }
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title={editing ? `Edit Unit ${editing.unit_number}` : "Add Unit"}
      subtitle={editing ? `Updating unit on floor ${editing.floor_number}` : "Add a new unit to the selected property"}
      icon={<Hash size={18} style={{ color: "var(--property-accent, #34D399)" }} />}
      size="lg"
      footer={
        <>
          <button type="button" onClick={() => { reset(); onClose(); }}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              border: "1px solid var(--border, #2E3340)",
              color: "var(--text-secondary, #9BA3AF)",
              background: "transparent",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover, #2C3140)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            Cancel
          </button>
          <button type="button" onClick={(e) => submit(e as any)}
            disabled={submitting}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={{
              background: "var(--property-accent, #34D399)",
              color: "#fff",
              opacity: submitting ? 0.6 : 1,
            }}>
            {submitting && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {submitting ? "Saving..." : editing ? "Update Unit" : "Add Unit"}
          </button>
        </>
      }>
      <form onSubmit={submit}>
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-xs border flex items-center gap-2"
            style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}

        {/* ── Section 1: Unit Info ── */}
        <FormSection title="Unit Info">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Unit Number <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>
              </label>
              <input className="dialog-input" value={form.unitNumber}
                onChange={(e) => set("unitNumber", e.target.value)} placeholder="e.g. 101" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Floor <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>
              </label>
              <select className="dialog-select" value={form.floorId}
                onChange={(e) => set("floorId", e.target.value)}>
                <option value="">Select floor</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>Floor {f.floor_number} ({f.tid})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Unit Type
              </label>
              <select className="dialog-select" value={form.unitType}
                onChange={(e) => set("unitType", e.target.value)}>
                {UNIT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t || "Select"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Status
              </label>
              <select className="dialog-select" value={form.status}
                onChange={(e) => set("status", e.target.value)}>
                <option value="available">Available</option>
                <option value="rented">Rented</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>
        </FormSection>

        {/* ── Section 2: Size & Price ── */}
        <FormSection title="Size & Price">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Area
              </label>
              <div className="flex gap-2">
                <input type="number" className="dialog-input" value={form.area}
                  onChange={(e) => set("area", e.target.value)} placeholder="e.g. 1200" />
                <select className="dialog-select w-24 shrink-0" value={form.areaUnit}
                  onChange={(e) => set("areaUnit", e.target.value)}>
                  {AREA_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Monthly Rent (Rs)
              </label>
              <input type="number" className="dialog-input" value={form.rentAmount}
                onChange={(e) => set("rentAmount", e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Sale Price (Rs)
              </label>
              <input type="number" className="dialog-input" value={form.salePrice}
                onChange={(e) => set("salePrice", e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Security Deposit (Rs)
              </label>
              <input type="number" className="dialog-input" value={form.securityDeposit}
                onChange={(e) => set("securityDeposit", e.target.value)} placeholder="0" />
            </div>
          </div>
        </FormSection>

        {/* ── Section 3: Features ── */}
        <FormSection title="Features">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Furnishing Status
              </label>
              <select className="dialog-select" value={form.furnishingStatus}
                onChange={(e) => set("furnishingStatus", e.target.value)}>
                {FURNISHING_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t || "None"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Current Tenant
              </label>
              <input className="dialog-input" value={form.currentTenant}
                onChange={(e) => set("currentTenant", e.target.value)} placeholder="Tenant name" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary, #9BA3AF)" }}>
                Lease End Date
              </label>
              <input type="date" className="dialog-input" value={form.leaseEndDate}
                onChange={(e) => set("leaseEndDate", e.target.value)} />
            </div>
          </div>
        </FormSection>

        {/* ── Section 4: Notes ── */}
        <FormSection title="Notes">
          <textarea className="dialog-textarea" rows={3} value={form.notes}
            onChange={(e) => set("notes", e.target.value)} placeholder="Internal notes..." />
        </FormSection>
      </form>
    </AppDialog>
  );
}
