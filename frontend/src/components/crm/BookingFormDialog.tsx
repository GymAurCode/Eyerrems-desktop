import { FormEvent, useEffect, useId, useState } from "react";
import { Upload, Paperclip, X, Calendar, Clock } from "lucide-react";
import Modal from "../Modal";
import { FormField, FormSection } from "./FormField";
import AsyncDebouncedSelect, { AsyncSelectOption } from "../ui/AsyncDebouncedSelect";
import { bookingApi, BookingDetail, BookingCreatePayload } from "../../lib/bookingApi";
import { attachmentApi } from "../../lib/attachmentApi";
import { syncApi } from "../../lib/financeApi";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (booking: BookingDetail) => void;
  prefillClientId?: number;
}

export default function BookingFormDialog({ open, onClose, onSaved, prefillClientId }: Props) {
  const formId = useId();

  const [clientId, setClientId] = useState<number | null>(prefillClientId ?? null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [dealerId, setDealerId] = useState<number | null>(null);

  const [propPrice, setPropPrice] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [bookingAmount, setBookingAmount] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [processingFee, setProcessingFee] = useState("");
  const [possessionCharges, setPossessionCharges] = useState("");
  const [developmentCharges, setDevelopmentCharges] = useState("");

  const [holdingDays, setHoldingDays] = useState("7");
  const [nomineeName, setNomineeName] = useState("");
  const [nomineePhone, setNomineePhone] = useState("");
  const [nomineeCnic, setNomineeCnic] = useState("");
  const [notes, setNotes] = useState("");

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setClientId(prefillClientId ?? null);
    setPropertyId(null); setUnitId(null); setDealerId(null);
    setPropPrice(""); setFinalPrice(""); setDiscount("");
    setBookingAmount(""); setDownPayment(""); setProcessingFee("");
    setPossessionCharges(""); setDevelopmentCharges("");
    setHoldingDays("7");
    setNomineeName(""); setNomineePhone(""); setNomineeCnic("");
    setNotes(""); setReceiptFile(null); setErrors({}); setSaving(false);
  };

  useEffect(() => {
    if (open) reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill property price from selected unit
  useEffect(() => {
    if (!unitId) return;
    if (!propPrice && !finalPrice) {
    }
  }, [unitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnitChange = (opt: AsyncSelectOption | null) => {
    setUnitId(opt ? Number(opt.id) : null);
    if (opt?.subtext) {
      const match = opt.subtext.match(/[\d,]+/);
      if (match) {
        const price = match[0].replace(/,/g, "");
        setPropPrice(price);
      }
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!clientId)       e.client     = "Required";
    if (!propertyId)     e.property   = "Required";
    if (!bookingAmount || Number(bookingAmount) <= 0) e.bookingAmount = "Must be > 0";
    if (!propPrice || Number(propPrice) <= 0)         e.propPrice  = "Must be > 0";
    const hd = Number(holdingDays);
    if (!hd || hd < 1 || hd > 365) e.holdingDays = "1–365 days";
    if (discount && Number(discount) < 0) e.discount = "Cannot be negative";
    if (downPayment && Number(downPayment) < 0) e.downPayment = "Cannot be negative";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: BookingCreatePayload = {
        client_id:       clientId!,
        property_id:     propertyId ?? undefined,
        unit_id:         unitId ?? undefined,
        assigned_dealer_id: dealerId ?? undefined,
        nominee_name:    nomineeName || undefined,
        nominee_phone:   nomineePhone || undefined,
        nominee_cnic:    nomineeCnic || undefined,
        property_price:  Number(propPrice),
        final_price:     finalPrice ? Number(finalPrice) : undefined,
        discount:        discount ? Number(discount) : undefined,
        booking_amount:  Number(bookingAmount),
        down_payment:    downPayment ? Number(downPayment) : undefined,
        processing_fee:  processingFee ? Number(processingFee) : undefined,
        possession_charges: possessionCharges ? Number(possessionCharges) : undefined,
        development_charges: developmentCharges ? Number(developmentCharges) : undefined,
        holding_days:    Number(holdingDays),
        notes:           notes || undefined,
      };

      const booking = await bookingApi.create(payload);

      // Sync to finance
      syncApi.bookingToken({
        booking_id: booking.id,
        amount: Number(bookingAmount),
        client_name: "",
        property_name: "",
        unit_name: "",
        payment_method: "bank",
      }).catch(() => {});

      // Upload token receipt after booking is created
      if (receiptFile) {
        await attachmentApi.upload("booking", booking.id, receiptFile, "Token Receipt", "COMPLETED");
      }

      onSaved(booking);
      onClose();
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      if (Array.isArray(d)) {
        const m: Record<string, string> = {};
        d.forEach((x: any) => { m[x.loc?.at(-1) ?? "form"] = x.msg; });
        setErrors(m);
      } else {
        setErrors({ form: d ?? "Failed to create booking" });
      }
    } finally {
      setSaving(false);
    }
  };

  const expiryDate = holdingDays
    ? new Date(Date.now() + Number(holdingDays) * 86400000)
    : null;

  const footer = (
    <>
      <button type="button" onClick={onClose}
        className="px-5 py-2 text-sm rounded-lg transition-colors"
        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        Cancel
      </button>
      <button type="submit" form={formId} disabled={saving}
        className="btn-primary px-6 py-2 text-sm disabled:opacity-50">
        {saving ? "Creating…" : "Create Booking"}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title="New Booking" size="2xl" footer={footer}>
      <form id={formId} onSubmit={submit}>
        {errors.form && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {errors.form}
          </div>
        )}

        <div className="grid grid-cols-3 gap-x-4 gap-y-3">

          {/* ── Client & Assignment ── */}
          <FormSection title="Client & Assignment" />

          <FormField label="Client" required error={errors.client} span="2">
            <AsyncDebouncedSelect
              endpoint="/crm/async-select/clients"
              placeholder="Search client by name or ID…"
              value={clientId}
              onChange={(opt: AsyncSelectOption | null) => setClientId(opt ? Number(opt.id) : null)}
            />
          </FormField>

          <FormField label="Assign Dealer (optional)">
            <AsyncDebouncedSelect
              endpoint="/crm/async-select/dealers"
              placeholder="Search dealer…"
              value={dealerId}
              onChange={(opt: AsyncSelectOption | null) => setDealerId(opt ? Number(opt.id) : null)}
            />
          </FormField>

          <FormField label="Nominee Name">
            <input className="input-dark w-full px-3 py-2 text-sm" value={nomineeName}
              onChange={(e) => setNomineeName(e.target.value)} placeholder="Optional" />
          </FormField>

          <FormField label="Nominee Phone">
            <input className="input-dark w-full px-3 py-2 text-sm" value={nomineePhone}
              onChange={(e) => setNomineePhone(e.target.value)} placeholder="03XX-XXXXXXX" />
          </FormField>

          <FormField label="Nominee CNIC">
            <input className="input-dark w-full px-3 py-2 text-sm" value={nomineeCnic}
              onChange={(e) => setNomineeCnic(e.target.value)} placeholder="XXXXX-XXXXXXX-X" />
          </FormField>

          {/* ── Property & Unit ── */}
          <FormSection title="Property & Unit" />

          <FormField label="Property" required error={errors.property} span="2">
            <AsyncDebouncedSelect
              endpoint="/crm/async-select/properties"
              placeholder="Search property…"
              value={propertyId}
              onChange={(opt: AsyncSelectOption | null) => {
                setPropertyId(opt ? Number(opt.id) : null);
                setUnitId(null);
              }}
            />
          </FormField>

          <FormField label="Unit (optional)">
            <AsyncDebouncedSelect
              endpoint={
                propertyId
                  ? `/crm/async-select/units?property_id=${propertyId}`
                  : "/crm/async-select/units"
              }
              placeholder={propertyId ? "Search unit…" : "Select property first"}
              value={unitId}
              onChange={(opt: AsyncSelectOption | null) => handleUnitChange(opt)}
              disabled={!propertyId}
            />
          </FormField>

          {/* ── Financials ── */}
          <FormSection title="Financials" />

          <FormField label="Property Price (snapshot)" required error={errors.propPrice}>
            <input type="number" className="input-dark w-full px-3 py-2 text-sm" value={propPrice}
              onChange={(e) => setPropPrice(e.target.value)} placeholder="e.g. 5000000" />
          </FormField>

          <FormField label="Final Price (optional)">
            <input type="number" className="input-dark w-full px-3 py-2 text-sm" value={finalPrice}
              onChange={(e) => setFinalPrice(e.target.value)} placeholder="Same as property price" />
          </FormField>

          <FormField label="Discount">
            <input type="number" className="input-dark w-full px-3 py-2 text-sm" value={discount}
              onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          </FormField>

          <FormField label="Booking / Token Amount" required error={errors.bookingAmount}>
            <input type="number" className="input-dark w-full px-3 py-2 text-sm" value={bookingAmount}
              onChange={(e) => setBookingAmount(e.target.value)} placeholder="e.g. 50000" />
          </FormField>

          <FormField label="Down Payment">
            <input type="number" className="input-dark w-full px-3 py-2 text-sm" value={downPayment}
              onChange={(e) => setDownPayment(e.target.value)} placeholder="0" />
          </FormField>

          <FormField label="Processing Fee">
            <input type="number" className="input-dark w-full px-3 py-2 text-sm" value={processingFee}
              onChange={(e) => setProcessingFee(e.target.value)} placeholder="0" />
          </FormField>

          <FormField label="Possession Charges">
            <input type="number" className="input-dark w-full px-3 py-2 text-sm" value={possessionCharges}
              onChange={(e) => setPossessionCharges(e.target.value)} placeholder="0" />
          </FormField>

          <FormField label="Development Charges">
            <input type="number" className="input-dark w-full px-3 py-2 text-sm" value={developmentCharges}
              onChange={(e) => setDevelopmentCharges(e.target.value)} placeholder="0" />
          </FormField>

          {/* ── Holding Period ── */}
          <FormSection title="Holding Period" />

          <FormField label="Holding Days (1–365)" required error={errors.holdingDays}>
            <input type="number" min={1} max={365} className="input-dark w-full px-3 py-2 text-sm"
              value={holdingDays} onChange={(e) => setHoldingDays(e.target.value)} />
          </FormField>

          {expiryDate && (
            <div className="flex items-end pb-0.5">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg w-full"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <Calendar size={13} style={{ color: "#fbbf24" }} />
                <div>
                  <p className="text-[10px] text-muted">Expires on</p>
                  <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>
                    {expiryDate.toLocaleDateString("en-PK", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          <FormSection title="Notes" />

          <FormField label="Internal Notes" span="full">
            <textarea className="input-dark w-full px-3 py-2 text-sm resize-none" rows={2}
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes…" />
          </FormField>

          {/* ── Token Receipt ── */}
          <FormSection title="Token Receipt" />

          <FormField label="Upload Receipt (optional)" span="full">
            {receiptFile ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                style={{ background: "var(--bg-surface2)" }}>
                <span className="flex items-center gap-1.5 truncate">
                  <Paperclip size={12} style={{ color: "var(--text-muted)" }} />
                  {receiptFile.name}
                </span>
                <button type="button" onClick={() => setReceiptFile(null)}
                  style={{ color: "var(--text-muted)" }}
                  className="hover:text-red-400 shrink-0">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs cursor-pointer border-2 border-dashed transition-colors hover:border-blue-500/50"
                style={{ borderColor: "var(--border)" }}
              >
                <Upload size={14} style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-muted)" }}>Upload token payment receipt</span>
                <input type="file" accept="image/*,.pdf" className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setReceiptFile(e.target.files[0]);
                  }} />
              </label>
            )}
          </FormField>

        </div>
      </form>
    </Modal>
  );
}
