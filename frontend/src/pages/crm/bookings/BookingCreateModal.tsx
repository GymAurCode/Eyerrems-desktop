import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, AlertCircle, CheckCircle2, Building2, User,
  ChevronDown, Search, Calendar, DollarSign, FileText,
} from "lucide-react";
import AttachmentsButton from "../../../components/attachments/AttachmentsButton";
import { bookingApi, BookingCreatePayload } from "../../../lib/bookingApi";
import { crmApi, Client, Dealer } from "../../../lib/crmApi";
import { propApi, Property, FloorWithUnits, Unit } from "../../../lib/propertyApi";
import { formatCurrency } from "../../../lib/currency";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{children}</span>
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

// ── Client search dropdown ────────────────────────────────────────────────────

function ClientSearch({
  clients,
  value,
  onChange,
}: {
  clients: Client[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selected = clients.find(c => c.id === value);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.client_id.toLowerCase().includes(q.toLowerCase()) ||
    (c.phone ?? "").includes(q)
  ).slice(0, 12);

  return (
    <div className="relative">
      <div
        className="input-dark flex items-center gap-2 px-3 py-2.5 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        {selected ? (
          <>
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
              style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}
            >
              {selected.name[0].toUpperCase()}
            </div>
            <span className="text-sm text-primary flex-1">{selected.name}</span>
            <span className="text-[10px] text-muted font-mono">{selected.client_id}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(null); setQ(""); }}
              className="text-muted hover:text-primary"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <Search size={13} className="text-muted" />
            <span className="text-sm text-muted flex-1">Search client by name or ID…</span>
            <ChevronDown size={13} className="text-muted" />
          </>
        )}
      </div>

      {open && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
          }}
        >
          <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                className="input-dark w-full pl-7 pr-3 py-2 text-sm"
                placeholder="Type to filter…"
                value={q}
                onChange={e => setQ(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No clients found</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); setQ(""); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-surface2)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}
                  >
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-primary truncate">{c.name}</p>
                    <p className="text-[10px] text-muted">{c.client_id} · {c.phone ?? "—"}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Unit availability badge ───────────────────────────────────────────────────

function UnitOption({
  unit,
  available,
  selected,
  onClick,
}: {
  unit: Unit;
  available: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!available}
      onClick={onClick}
      className="relative flex flex-col items-center justify-center p-2.5 rounded-xl text-center transition-all"
      style={{
        border: selected
          ? "2px solid #60a5fa"
          : available
          ? "1px solid var(--border)"
          : "1px solid var(--border-subtle)",
        background: selected
          ? "rgba(59,130,246,0.1)"
          : available
          ? "var(--bg-surface2)"
          : "var(--bg-surface)",
        opacity: available ? 1 : 0.45,
        cursor: available ? "pointer" : "not-allowed",
      }}
    >
      {!available && (
        <span
          className="absolute -top-1.5 -right-1.5 text-[8px] px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: "#f87171", color: "white" }}
        >
          Booked
        </span>
      )}
      <p className="text-xs font-semibold text-primary">{unit.unit_number}</p>
      {unit.sale_price && (
        <p className="text-[9px] text-muted mt-0.5">{formatCurrency(unit.sale_price)}</p>
      )}
      {unit.size && (
        <p className="text-[9px] text-muted">{unit.size}</p>
      )}
    </button>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

type Props = {
  onClose: () => void;
  onCreated: () => void;
  prefillClientId?: number;
};

type AvailabilityMap = Record<number, boolean>; // unit_id → available

export default function BookingCreateModal({ onClose, onCreated, prefillClientId }: Props) {
  // Data
  const [clients, setClients]   = useState<Client[]>([]);
  const [dealers, setDealers]   = useState<Dealer[]>([]);
  const [properties, setProps]  = useState<Property[]>([]);
  const [floors, setFloors]     = useState<FloorWithUnits[]>([]);
  const [availability, setAvail] = useState<AvailabilityMap>({});

  // Form state
  const [clientId, setClientId]     = useState<number | null>(prefillClientId ?? null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [unitId, setUnitId]         = useState<number | null>(null);
  const [bookingAmt, setBookingAmt] = useState("");
  const [propPrice, setPropPrice]   = useState("");
  const [holdingDays, setHolding]   = useState("7");
  const [dealerId, setDealerId]     = useState<number | null>(null);
  const [nomineeName, setNomName]   = useState("");
  const [nomineePhone, setNomPhone] = useState("");
  const [nomineeCnic, setNomCnic]   = useState("");
  const [notes, setNotes]           = useState("");

  // UI state
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [checkingAvail, setCheckingAvail] = useState(false);

  // Load initial data
  useEffect(() => {
    Promise.all([
      crmApi.getClients(),
      crmApi.getDealers(),
      propApi.getProperties(),
    ]).then(([cRes, dRes, pRes]) => {
      const clientsData = cRes && 'data' in cRes ? (cRes as any).data : cRes;
      const dealersData = dRes && 'data' in dRes ? (dRes as any).data : dRes;
      const propsData = pRes && 'data' in pRes ? (pRes as any).data : pRes;
      setClients(Array.isArray(clientsData) ? clientsData : []);
      setDealers(Array.isArray(dealersData) ? dealersData : []);
      setProps(Array.isArray(propsData) ? propsData : []);
    });
  }, []);

  // Load floors/units when property changes
  useEffect(() => {
    if (!propertyId) { setFloors([]); setUnitId(null); setAvail({}); return; }
    setLoadingUnits(true);
    setUnitId(null);
    propApi.getProperty(propertyId).then(res => {
      const data = res && 'data' in res ? (res as any).data : res;
      const floorsList = data?.floors || [];
      setFloors(floorsList);
      // Check availability for all units
      const allUnits = floorsList.flatMap((f: any) => f.units);
      checkAllUnits(allUnits.map((u: any) => u.id));
    }).finally(() => setLoadingUnits(false));
  }, [propertyId]);

  // Auto-fill price from selected unit
  useEffect(() => {
    if (!unitId) return;
    const allUnits = floors.flatMap(f => f.units);
    const unit = allUnits.find(u => u.id === unitId);
    if (unit?.sale_price) setPropPrice(String(unit.sale_price));
  }, [unitId, floors]);

  // Auto-fill price from property if no unit
  useEffect(() => {
    if (unitId || !propertyId) return;
    const prop = properties.find(p => p.id === propertyId);
    if (prop?.sale_price) setPropPrice(String(prop.sale_price));
  }, [propertyId, unitId, properties]);

  const checkAllUnits = async (unitIds: number[]) => {
    setCheckingAvail(true);
    const results: AvailabilityMap = {};
    await Promise.all(
      unitIds.map(async uid => {
        try {
          const r = await bookingApi.checkAvailability({ unit_id: uid });
          results[uid] = r.available;
        } catch {
          results[uid] = true; // assume available on error
        }
      })
    );
    setAvail(results);
    setCheckingAvail(false);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!clientId)    e.client   = "Select a client";
    if (!propertyId)  e.property = "Select a property";
    if (!bookingAmt || Number(bookingAmt) <= 0) e.bookingAmt = "Enter booking amount";
    if (!propPrice  || Number(propPrice)  <= 0) e.propPrice  = "Enter property price";
    const hd = Number(holdingDays);
    if (!hd || hd < 1 || hd > 365) e.holdingDays = "1–365 days";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setErrors({});
    try {
      const payload: BookingCreatePayload = {
        client_id:    clientId!,
        property_id:  unitId ? undefined : propertyId ?? undefined,
        unit_id:      unitId ?? undefined,
        booking_amount: Number(bookingAmt),
        property_price: Number(propPrice),
        holding_days:   Number(holdingDays),
        assigned_dealer_id: dealerId ?? undefined,
        nominee_name:  nomineeName || undefined,
        nominee_phone: nomineePhone || undefined,
        nominee_cnic:  nomineeCnic || undefined,
        notes:         notes || undefined,
      };
      await bookingApi.create(payload);
      onCreated();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (Array.isArray(detail)) {
        const m: Record<string, string> = {};
        detail.forEach((d: any) => { m[d.loc?.at(-1) ?? "form"] = d.msg; });
        setErrors(m);
      } else {
        setErrors({ form: typeof detail === "string" ? detail : "Failed to create booking" });
      }
    } finally {
      setSaving(false);
    }
  };

  const allUnits = floors.flatMap(f => f.units);
  const selectedUnit = allUnits.find(u => u.id === unitId);
  const selectedProp = properties.find(p => p.id === propertyId);
  const expiryDate = holdingDays
    ? new Date(Date.now() + Number(holdingDays) * 86400000).toLocaleDateString("en-PK", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: "modalFadeIn 0.18s ease-out both" }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: "min(680px, 95vw)",
          maxHeight: "92vh",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "18px",
          boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
          animation: "modalSlideUp 0.22s ease-out both",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2 className="text-sm font-bold text-primary">New Booking</h2>
            <p className="text-xs text-muted mt-0.5">Reserve a property or unit for a client</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--border)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {errors.form && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <AlertCircle size={13} /> {errors.form}
            </div>
          )}

          {/* ── Client ── */}
          <div className="space-y-3">
            <SectionTitle><User size={10} className="inline mr-1" />Client</SectionTitle>
            <Field label="Select Client" required error={errors.client}>
              <ClientSearch clients={clients} value={clientId} onChange={setClientId} />
            </Field>
          </div>

          {/* ── Property & Unit ── */}
          <div className="space-y-3">
            <SectionTitle><Building2 size={10} className="inline mr-1" />Property & Unit</SectionTitle>

            <Field label="Property" required error={errors.property}>
              <div className="relative">
                <select
                  className="select-dark w-full px-3 py-2.5 text-sm appearance-none pr-8"
                  value={propertyId ?? ""}
                  onChange={e => {
                    setPropertyId(e.target.value ? Number(e.target.value) : null);
                    setUnitId(null);
                  }}
                >
                  <option value="">Select property…</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.tid}{p.address ? ` — ${p.address}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </Field>

            {/* Unit grid */}
            {propertyId && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">
                  Select Unit
                  {checkingAvail && <span className="ml-2 text-blue-400 normal-case font-normal">Checking availability…</span>}
                </p>
                {loadingUnits ? (
                  <div className="flex items-center gap-2 text-xs text-muted py-3">
                    <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    Loading units…
                  </div>
                ) : allUnits.length === 0 ? (
                  <div
                    className="px-3 py-2.5 rounded-xl text-xs text-muted"
                    style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}
                  >
                    No units found for this property. Booking will apply to the full property.
                  </div>
                ) : (
                  <>
                    {floors.map(floor => (
                      <div key={floor.id} className="mb-3">
                        <p className="text-[10px] text-muted mb-1.5">Floor {floor.floor_number}</p>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {floor.units.map(unit => (
                            <UnitOption
                              key={unit.id}
                              unit={unit}
                              available={availability[unit.id] !== false}
                              selected={unitId === unit.id}
                              onClick={() => setUnitId(unitId === unit.id ? null : unit.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    {unitId === null && (
                      <p className="text-[10px] text-muted mt-1">
                        No unit selected — booking will apply to the full property.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Price snapshot */}
            {(selectedUnit || selectedProp) && (
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}
              >
                <CheckCircle2 size={14} style={{ color: "#60a5fa" }} />
                <div>
                  <p className="text-xs font-semibold text-primary">
                    {selectedUnit
                      ? `Unit ${selectedUnit.unit_number}`
                      : selectedProp?.name ?? selectedProp?.tid}
                  </p>
                  <p className="text-[10px] text-muted">
                    Listed price: {formatCurrency(selectedUnit?.sale_price ?? selectedProp?.sale_price ?? null)}
                    {selectedUnit?.size && ` · ${selectedUnit.size}`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Financials ── */}
          <div className="space-y-3">
            <SectionTitle><DollarSign size={10} className="inline mr-1" />Financials</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Booking / Token Amount" required error={errors.bookingAmt}>
                <input
                  type="number"
                  className="input-dark w-full px-3 py-2.5 text-sm"
                  placeholder="e.g. 50000"
                  value={bookingAmt}
                  onChange={e => setBookingAmt(e.target.value)}
                />
              </Field>
              <Field label="Property Price (snapshot)" required error={errors.propPrice}>
                <input
                  type="number"
                  className="input-dark w-full px-3 py-2.5 text-sm"
                  placeholder="e.g. 5000000"
                  value={propPrice}
                  onChange={e => setPropPrice(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* ── Holding Period ── */}
          <div className="space-y-3">
            <SectionTitle><Calendar size={10} className="inline mr-1" />Holding Period</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Holding Days (1–365)" required error={errors.holdingDays}>
                <input
                  type="number"
                  min={1}
                  max={365}
                  className="input-dark w-full px-3 py-2.5 text-sm"
                  value={holdingDays}
                  onChange={e => setHolding(e.target.value)}
                />
              </Field>
              <div className="flex flex-col justify-end pb-0.5">
                {expiryDate && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}
                  >
                    <Calendar size={13} style={{ color: "#fbbf24" }} />
                    <div>
                      <p className="text-[10px] text-muted">Expires on</p>
                      <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>{expiryDate}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Assignment ── */}
          <div className="space-y-3">
            <SectionTitle><User size={10} className="inline mr-1" />Assignment</SectionTitle>
            <Field label="Assign Dealer (optional)">
              <div className="relative">
                <select
                  className="select-dark w-full px-3 py-2.5 text-sm appearance-none pr-8"
                  value={dealerId ?? ""}
                  onChange={e => setDealerId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— No dealer —</option>
                  {dealers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.dealer_id})</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Nominee Name">
                <input
                  className="input-dark w-full px-3 py-2.5 text-sm"
                  placeholder="Optional"
                  value={nomineeName}
                  onChange={e => setNomName(e.target.value)}
                />
              </Field>
              <Field label="Nominee Phone">
                <input
                  className="input-dark w-full px-3 py-2.5 text-sm"
                  placeholder="Optional"
                  value={nomineePhone}
                  onChange={e => setNomPhone(e.target.value)}
                />
              </Field>
              <Field label="Nominee CNIC">
                <input
                  className="input-dark w-full px-3 py-2.5 text-sm"
                  placeholder="XXXXX-XXXXXXX-X"
                  value={nomineeCnic}
                  onChange={e => setNomCnic(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="space-y-3">
            <SectionTitle><FileText size={10} className="inline mr-1" />Notes</SectionTitle>
            <textarea
              className="input-dark w-full px-3 py-2.5 text-sm resize-none"
              rows={3}
              placeholder="Any additional notes about this booking…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="text-xs text-muted">
            {clientId && propertyId && (
              <span>
                Booking for <strong className="text-primary">{clients.find(c => c.id === clientId)?.name}</strong>
                {unitId && <> · Unit <strong className="text-primary">{selectedUnit?.unit_number}</strong></>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <AttachmentsButton module="booking" />
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40 flex items-center gap-2"
            >
              {saving
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
                : "Create Booking"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
