import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Building2, Calculator, User, Zap } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import SearchableSelect from "../ui/SearchableSelect";
import AttachmentPanel from "../attachments/AttachmentPanel";
import { crmApi } from "../../lib/crmApi";
import {
  commissionsApi,
  syncApi,
  type DealerCommissionContext,
  type CommissionCalculateResult,
} from "../../lib/financeApi";
import { formatCurrency } from "../../lib/currency";
import { useAuthStore } from "../../store/auth";
import { useNotifStore } from "../../store/notifications";

interface CommissionWorkflowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CommissionWorkflow({ isOpen, onClose, onSuccess }: CommissionWorkflowProps) {
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const pushToast = useNotifStore((s) => s.pushToast);

  const [dealers, setDealers] = useState<Awaited<ReturnType<typeof crmApi.getDealers>>>([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [dealerId, setDealerId] = useState("");
  const [ctx, setCtx] = useState<DealerCommissionContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);

  const [propertyId, setPropertyId] = useState("");
  const [dealId, setDealId] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [amountOverride, setAmountOverride] = useState("");
  const [allowOverride, setAllowOverride] = useState(false);
  const [calc, setCalc] = useState<CommissionCalculateResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const [type, setType] = useState<"earned" | "paid">("earned");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdCommissionId, setCreatedCommissionId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingDealers(true);
    crmApi.getDealers()
      .then(setDealers)
      .catch(() => setError("Failed to load dealers"))
      .finally(() => setLoadingDealers(false));
  }, [isOpen]);

  useEffect(() => {
    if (!dealerId) {
      setCtx(null);
      setPropertyId("");
      setDealId("");
      return;
    }
    setLoadingCtx(true);
    commissionsApi.dealerContext(Number(dealerId))
      .then((data) => {
        setCtx(data);
        if (data.dealer.commission_rate != null) {
          setCommissionRate(String(data.dealer.commission_rate));
        }
      })
      .catch(() => setError("Failed to load dealer context"))
      .finally(() => setLoadingCtx(false));
  }, [dealerId]);

  const dealerOptions = useMemo(
    () =>
      dealers.map((d) => ({
        value: String(d.id),
        label: d.name,
        sublabel: d.dealer_id,
        meta: d.phone ?? undefined,
      })),
    [dealers],
  );

  const propertyOptions = useMemo(() => {
    if (!ctx) return [];
    return ctx.properties.map((p) => ({
      value: String(p.id),
      label: p.name,
      sublabel: p.code,
      meta: p.sale_price != null ? formatCurrency(p.sale_price) : undefined,
    }));
  }, [ctx]);

  const dealOptions = useMemo(() => {
    if (!ctx) return [];
    const list = propertyId
      ? ctx.deals.filter((d) => d.property_id === Number(propertyId))
      : ctx.deals;
    return list.map((d) => ({
      value: String(d.id),
      label: d.deal_title || d.deal_id,
      sublabel: d.client_name ?? undefined,
      meta: formatCurrency(d.deal_value),
    }));
  }, [ctx, propertyId]);

  const runCalculate = useCallback(async () => {
    if (!dealerId || !propertyId) return;
    setCalculating(true);
    setError("");
    try {
      const result = await commissionsApi.calculate({
        dealer_id: Number(dealerId),
        property_id: Number(propertyId),
        deal_id: dealId ? Number(dealId) : null,
        sale_amount: saleAmount ? Number(saleAmount) : null,
        commission_rate: commissionRate ? Number(commissionRate) : null,
      });
      setCalc(result);
      setSaleAmount(String(result.sale_amount));
      setCommissionRate(String(result.commission_rate));
      if (!allowOverride) setAmountOverride(String(result.calculated_amount));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Calculation failed");
    } finally {
      setCalculating(false);
    }
  }, [dealerId, propertyId, dealId, saleAmount, commissionRate, allowOverride]);

  useEffect(() => {
    if (dealerId && propertyId) {
      const t = setTimeout(() => void runCalculate(), 400);
      return () => clearTimeout(t);
    }
    setCalc(null);
  }, [dealerId, propertyId, dealId, commissionRate, runCalculate]);

  const reset = () => {
    setDealerId("");
    setCtx(null);
    setPropertyId("");
    setDealId("");
    setSaleAmount("");
    setCommissionRate("");
    setAmountOverride("");
    setCalc(null);
    setError("");
    setType("earned");
    setReference("");
    setDescription("");
    setCreatedCommissionId(null);
  };

  const handleDone = () => {
    reset();
    onSuccess();
    onClose();
  };

  const handleSubmit = async () => {
    if (!dealerId || !propertyId) {
      setError("Select dealer and property");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const commission = await commissionsApi.create({
        dealer_id: Number(dealerId),
        property_id: Number(propertyId),
        deal_id: dealId ? Number(dealId) : null,
        sale_amount: saleAmount ? Number(saleAmount) : null,
        commission_rate: commissionRate ? Number(commissionRate) : null,
        amount: amountOverride ? Number(amountOverride) : null,
        allow_override: allowOverride && isAdmin,
        type,
        reference: reference || undefined,
        description: description || undefined,
      });
      pushToast({ title: "Commission Created", message: `Commission #${commission.id} recorded successfully`, type: "success" });
      // Sync commission earned to finance
      syncApi.commissionEarned({
        deal_id: dealId ? Number(dealId) : null,
        dealer_id: Number(dealerId),
        dealer_name: ctx?.dealer?.name || "Unknown",
        amount: finalAmount || Number(amountOverride) || 0,
        property_name: "",
      }).catch(() => {});
      setCreatedCommissionId(commission.id);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to record commission");
    } finally {
      setSubmitting(false);
    }
  };

  const finalAmount = amountOverride ? Number(amountOverride) : calc?.calculated_amount;

  return (
    <AppDialog isOpen={isOpen} onClose={handleDone} title={createdCommissionId ? "Commission Recorded" : "Record Commission"} size="xl">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {createdCommissionId ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
              <p className="text-sm font-semibold text-emerald-400">Commission #{createdCommissionId} recorded successfully</p>
              <p className="text-xs text-muted mt-1">You can now attach files below</p>
            </div>
            <AttachmentPanel module="finance" recordId={createdCommissionId} title="Attachments" />
            <div className="flex justify-end">
              <button type="button" onClick={handleDone} className="btn-primary px-5 py-2 text-sm">Done</button>
            </div>
          </div>
        ) : (
        <>
        {error && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Step 1 — Dealer
            </p>
            <SearchableSelect
              options={dealerOptions}
              value={dealerId}
              onChange={setDealerId}
              placeholder="Search dealer / agent…"
              loading={loadingDealers}
            />

            {ctx && (
              <div className="p-3 rounded-xl space-y-2" style={{ background: "var(--hover-bg-sm)", border: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-2">
                  <User size={14} style={{ color: "#60a5fa" }} />
                  <span className="text-sm font-semibold text-primary">{ctx.dealer.name}</span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {ctx.dealer.dealer_id} · {ctx.dealer.phone ?? "—"}
                </p>
                <p className="text-xs">
                  Rate: <strong>{ctx.dealer.commission_rate ?? "—"}</strong>
                  {ctx.dealer.commission_type === "percentage" ? "%" : " (fixed)"}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {ctx.deals.length} deals · {ctx.properties.length} properties
                </p>
              </div>
            )}

            <p className="text-[10px] font-bold uppercase tracking-widest pt-2" style={{ color: "var(--text-muted)" }}>
              Step 2 — Property & deal
            </p>
            <SearchableSelect
              options={propertyOptions}
              value={propertyId}
              onChange={(v) => { setPropertyId(v); setDealId(""); }}
              placeholder="Search property…"
              disabled={!dealerId}
              loading={loadingCtx}
              emptyMessage="No properties linked to this dealer"
            />
            <SearchableSelect
              options={dealOptions}
              value={dealId}
              onChange={setDealId}
              placeholder="Optional: link deal…"
              disabled={!dealerId}
              emptyMessage="No deals for selected property"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Sale value</label>
                <input className="input-dark w-full px-2 py-1.5 text-xs" type="number" value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Rate %</label>
                <input className="input-dark w-full px-2 py-1.5 text-xs" type="number" step="0.01" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Commission preview
            </p>
            <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <div className="flex items-center gap-2">
                <Calculator size={16} style={{ color: "#60a5fa" }} />
                <span className="text-sm font-semibold text-primary">Breakdown</span>
                {calculating && <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>Calculating…</span>}
              </div>
              {calc ? (
                <>
                  <Row label="Sale amount" value={formatCurrency(calc.sale_amount)} />
                  <Row label="Rate" value={`${calc.commission_rate}% (${calc.commission_type})`} />
                  <Row label="Calculated" value={formatCurrency(calc.calculated_amount)} accent />
                </>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Select dealer and property to calculate</p>
              )}
            </div>

            {isAdmin && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={allowOverride} onChange={(e) => setAllowOverride(e.target.checked)} />
                Allow manual amount override (admin)
              </label>
            )}
            {allowOverride && isAdmin && (
              <div>
                <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Override amount</label>
                <input className="input-dark w-full px-2 py-1.5 text-xs" type="number" value={amountOverride} onChange={(e) => setAmountOverride(e.target.value)} />
              </div>
            )}

            <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: "var(--hover-bg-sm)", border: "1px solid var(--border-subtle)" }}>
              <p className="font-semibold flex items-center gap-1"><Zap size={12} /> Finance posting</p>
              <p style={{ color: "var(--text-muted)" }}>
                {type === "earned"
                  ? "DR Commission Receivable · CR Commission Income + dealer ledger"
                  : "DR Commission Expense · CR Bank"}
              </p>
            </div>

            <select className="select-dark w-full text-xs" value={type} onChange={(e) => setType(e.target.value as "earned" | "paid")}>
              <option value="earned">Earned (accrual)</option>
              <option value="paid">Paid (payout)</option>
            </select>
            <input className="input-dark w-full px-2 py-1.5 text-xs" placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            <input className="input-dark w-full px-2 py-1.5 text-xs" placeholder="Notes" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button type="button" className="px-4 py-2 text-xs rounded-lg border" style={{ borderColor: "var(--border)" }} onClick={() => { reset(); onClose(); }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !finalAmount}
            onClick={() => void handleSubmit()}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
          >
            {submitting ? "Saving…" : `Record ${finalAmount ? formatCurrency(finalAmount) : ""}`}
          </button>
        </div>
        </>
      )}
      </div>
    </AppDialog>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={accent ? "font-bold" : "font-medium"} style={accent ? { color: "#60a5fa" } : undefined}>{value}</span>
    </div>
  );
}
