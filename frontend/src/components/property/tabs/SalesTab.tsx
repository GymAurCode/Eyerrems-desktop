import { useEffect, useState, useRef } from "react";
import {
  Plus, Printer, Eye, ChevronRight, FileText, CheckCircle, Ban,
} from "lucide-react";
import { propApi, PropertySale, Property, Buyer, Seller } from "../../../lib/propertyApi";
import { formatCurrency } from "../../../lib/currency";
import { printRecord } from "../../actions";
import { SmartTable } from "../../data-table";
import { api } from "../../../lib/api";
import RecordSaleDialog from "../dialogs/RecordSaleDialog";
import SaleDetailsDialog from "../dialogs/SaleDetailsDialog";
import UpdateSaleStageDialog from "../dialogs/UpdateSaleStageDialog";
import RecordPaymentDialog from "../dialogs/RecordPaymentDialog";
import CancelSaleDialog from "../dialogs/CancelSaleDialog";
import CompleteSaleDialog from "../dialogs/CompleteSaleDialog";

type Props = { refresh: number; onRefresh: () => void };

const STAGES = [
  "enquiry", "offer_made", "due_diligence", "spa_signed",
  "token_paid", "payment_processing", "transfer", "completed", "cancelled",
] as const;

const STAGE_LABELS: Record<string, string> = {
  enquiry: "Enquiry", offer_made: "Offer Made", due_diligence: "Due Diligence",
  spa_signed: "SPA Signed", token_paid: "Token Paid",
  payment_processing: "Payment Processing", transfer: "Transfer",
  completed: "Completed", cancelled: "Cancelled",
};

const STAGE_COLOR: Record<string, string> = {
  completed: "#10b981",
  spa_signed: "#3b82f6", token_paid: "#3b82f6",
  enquiry: "#f59e0b", offer_made: "#f59e0b",
  due_diligence: "#f59e0b", payment_processing: "#f59e0b", transfer: "#f59e0b",
  cancelled: "#ef4444",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StageBadge({ stage }: { stage: string }) {
  const sc = STAGE_COLOR[stage] ?? "#94a3b8";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: `${sc}18`, color: sc }}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

export default function SalesTab({ refresh, onRefresh }: Props) {
  const [sales, setSales]           = useState<PropertySale[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [buyers, setBuyers]         = useState<Buyer[]>([]);
  const [sellers, setSellers]       = useState<Seller[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const paramsRef = useRef<any>(null);

  // ── Record Sale Dialog ──
  const [open, setOpen] = useState(false);

  // ── Detail modal ──
  const [detailSale, setDetailSale]     = useState<PropertySale | null>(null);
  const [detailOpen, setDetailOpen]     = useState(false);

  // ── Stage change ──
  const [stageOpen, setStageOpen]       = useState(false);
  const [stageSaleId, setStageSaleId]   = useState(0);
  const [stageValue, setStageValue]     = useState("");

  // ── Payment modal ──
  const [payOpen, setPayOpen]           = useState(false);
  const [paySaleId, setPaySaleId]       = useState(0);
  const [paySalePrice, setPaySalePrice] = useState(0);

  // ── Cancel modal ──
  const [cancelOpen, setCancelOpen]     = useState(false);
  const [cancelSaleId, setCancelSaleId] = useState(0);

  // ── Complete modal ──
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeSaleId, setCompleteSaleId] = useState(0);

  // ── Data fetching ──
  const fetchSales = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const res = await api.get<PropertySale[]>("/properties/sales/all", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          sale_stage: params.status || undefined,
          property_id: params.propertyType || undefined,
          filter: params.dateFilter || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
        }
      });
      const data = res.data;
      setSales(Array.isArray(data) ? data : []);
      const tc = Number(res.headers["x-total-count"] || res.headers["X-Total-Count"] || (Array.isArray(data) ? data.length : 0));
      setTotal(tc);
    } catch {
      setSales([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const refreshTable = () => {
    if (paramsRef.current) fetchSales(paramsRef.current);
  };

  useEffect(() => { refreshTable(); }, [refresh]);

  useEffect(() => {
    Promise.all([
      propApi.getProperties(), propApi.getBuyers(), propApi.getSellers(),
    ]).then(([p, b, s]) => {
      const pD = p && 'data' in p ? (p as any).data : p;
      const bD = b && 'data' in b ? (b as any).data : b;
      const sD = s && 'data' in s ? (s as any).data : s;
      setProperties(Array.isArray(pD) ? pD : []);
      setBuyers(Array.isArray(bD) ? bD : []);
      setSellers(Array.isArray(sD) ? sD : []);
    });
  }, []);

  // ── Detail view ──
  const openDetail = async (sale: PropertySale) => {
    try {
      const d = await propApi.getSale(sale.id);
      setDetailSale(d);
      setDetailOpen(true);
    } catch {}
  };

  // ── Stage change ──
  const openStageChange = (sale: PropertySale) => {
    setStageSaleId(sale.id);
    setStageValue(sale.sale_stage);
    setStageOpen(true);
  };

  // ── Record Payment ──
  const openPay = (sale: PropertySale) => {
    setPaySaleId(sale.id);
    setPaySalePrice(sale.sale_price);
    setPayOpen(true);
  };

  // ── Cancel Sale ──
  const openCancel = (sale: PropertySale) => {
    setCancelSaleId(sale.id);
    setCancelOpen(true);
  };

  // ── Complete Sale ──
  const openComplete = (sale: PropertySale) => {
    setCompleteSaleId(sale.id);
    setCompleteOpen(true);
  };

  const refreshAndRefreshDetail = async () => {
    refreshTable();
    if (detailOpen && detailSale) {
      try {
        const d = await propApi.getSale(detailSale.id);
        setDetailSale(d);
      } catch {}
    }
  };

  const refreshAndCloseDetail = () => {
    setDetailOpen(false);
    setDetailSale(null);
    refreshTable();
  };

  // ── Columns ──
  const columns = [
    { key: "tid", label: "Sale ID", className: "font-mono text-xs text-blue-400" },
    {
      key: "property_id", label: "Property / Unit",
      render: (_: any, row: PropertySale) => {
        const prop = properties.find(p => p.id === row.property_id);
        const propName = prop?.name || row.property_id || "—";
        return <span className="text-xs text-secondary">{propName}</span>;
      },
    },
    {
      key: "buyer_id", label: "Buyer",
      render: (val: number) => {
        const b = buyers.find(x => x.id === val);
        return <span className="text-primary font-medium text-xs">{b?.name ?? val}</span>;
      },
    },
    {
      key: "seller_id", label: "Seller",
      render: (val: number) => {
        const s = sellers.find(x => x.id === val);
        return <span className="text-primary font-medium text-xs">{s?.name ?? val}</span>;
      },
    },
    {
      key: "sale_price", label: "Agreed Price",
      render: (val: any) => <span className="text-emerald-400 font-semibold text-xs">{formatCurrency(val)}</span>,
    },
    {
      key: "commission_amount", label: "Commission",
      render: (val: any) => <span className="text-secondary text-xs">{val ? formatCurrency(val) : "—"}</span>,
    },
    {
      key: "sale_stage", label: "Sale Stage",
      render: (val: string) => <StageBadge stage={val} />,
    },
    {
      key: "agreement_date", label: "Agreement Date",
      render: (val: any, row: PropertySale) => (
        <span className="text-secondary text-xs">{formatDate(val || row.sale_date)}</span>
      ),
    },
  ];

  const rowActions = [
    {
      key: "view", label: "View Sale Details", icon: Eye,
      onClick: (row: PropertySale) => openDetail(row),
    },
    {
      key: "stage", label: "Update Stage", icon: ChevronRight,
      onClick: (row: PropertySale) => openStageChange(row),
      hidden: (row: PropertySale) => row.sale_stage === "completed" || row.sale_stage === "cancelled",
    },
    {
      key: "payment", label: "Record Payment", icon: FileText,
      onClick: (row: PropertySale) => openPay(row),
      hidden: (row: PropertySale) => row.sale_stage === "cancelled" || row.payment_type !== "instalment",
    },
    {
      key: "complete", label: "Mark As Completed", icon: CheckCircle,
      onClick: (row: PropertySale) => openComplete(row),
      hidden: (row: PropertySale) => row.sale_stage === "completed" || row.sale_stage === "cancelled",
    },
    {
      key: "cancel", label: "Cancel Sale", icon: Ban,
      onClick: (row: PropertySale) => openCancel(row),
      hidden: (row: PropertySale) => row.sale_stage === "completed" || row.sale_stage === "cancelled",
    },
    {
      key: "print", label: "Print", icon: Printer,
      onClick: (row: PropertySale) => {
        const buyer = buyers.find(b => b.id === row.buyer_id);
        const seller = sellers.find(s => s.id === row.seller_id);
        printRecord(`Sale ${row.tid}`, [
          { label: "Buyer", value: buyer?.name ?? String(row.buyer_id) },
          { label: "Seller", value: seller?.name ?? String(row.seller_id) },
          { label: "Price", value: formatCurrency(row.sale_price) },
          { label: "Stage", value: STAGE_LABELS[row.sale_stage] ?? row.sale_stage },
          { label: "Date", value: row.agreement_date || row.sale_date || "—" },
        ]);
      },
    },
  ];

  return (
    <>
      {/* ── SALES LIST TABLE ── */}
      <SmartTable
        storageKey="rems_property_sales"
        data={sales}
        columns={columns}
        rowActions={rowActions}
        loading={loading}
        total={total}
        onParamsChange={fetchSales}
        showStatusFilter={true}
        statusOptions={STAGES.filter(s => s !== "cancelled").map(s => ({
          label: STAGE_LABELS[s] ?? s,
          value: s,
        }))}
        showTypeFilter={true}
        typeOptions={properties.map(p => ({ label: `${p.tid} — ${p.name}`, value: String(p.id) }))}
        showDateFilter={true}
        toolbarActions={
          <button type="button" onClick={() => setOpen(true)}
            className="btn-property flex items-center gap-2 px-3 py-2 text-xs">
            <Plus size={13} /> New Sale
          </button>
        }
      />

      <RecordSaleDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onSaved={onRefresh}
        properties={properties}
        buyers={buyers}
        sellers={sellers}
      />

      <SaleDetailsDialog
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailSale(null); }}
        sale={detailSale}
        properties={properties}
        buyers={buyers}
        sellers={sellers}
      />

      <UpdateSaleStageDialog
        isOpen={stageOpen}
        onClose={() => setStageOpen(false)}
        onSaved={refreshAndRefreshDetail}
        saleId={stageSaleId}
        currentStage={stageValue}
      />

      <RecordPaymentDialog
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        onSaved={refreshAndRefreshDetail}
        saleId={paySaleId}
        salePrice={paySalePrice}
      />

      <CancelSaleDialog
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onSaved={refreshAndCloseDetail}
        saleId={cancelSaleId}
      />

      <CompleteSaleDialog
        isOpen={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onSaved={refreshAndCloseDetail}
        saleId={completeSaleId}
      />
    </>
  );
}
