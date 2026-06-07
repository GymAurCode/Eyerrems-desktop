import { useState } from "react";
import { ChevronRight, FileText, Download } from "lucide-react";
import AppDialog from "../../ui/AppDialog";
import { PropertySale, Property, Buyer, Seller } from "../../../lib/propertyApi";
import { formatCurrency } from "../../../lib/currency";
import { uploadsUrl } from "../../../lib/config";
import { DataTable } from "../../data-table";

interface SaleDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sale: PropertySale | null;
  properties: Property[];
  buyers: Buyer[];
  sellers: Seller[];
}

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

export default function SaleDetailsDialog({ isOpen, onClose, sale, properties, buyers, sellers }: SaleDetailsDialogProps) {
  const [tab, setTab] = useState<"info" | "instalments" | "history" | "docs">("info");

  if (!isOpen) return null;

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Sale Details"
      size="xl"
    >
      {sale ? (
        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg p-0.5" style={{ border: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
            {(["info", "instalments", "history", "docs"] as const).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className="flex-1 px-3 py-1.5 text-xs rounded-md transition-colors capitalize"
                style={tab === t ? { background: "var(--bg-surface)", color: "var(--text-primary)" } : { color: "var(--text-muted)" }}>
                {t === "info" ? "Details" : t === "docs" ? "Documents" : t === "instalments" ? "Instalments" : "Stage History"}
              </button>
            ))}
          </div>

          {tab === "info" && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ["Sale ID", sale.tid],
                ["Property", properties.find(p => p.id === sale.property_id)?.name || sale.property_id || "—"],
                ["Buyer", buyers.find(b => b.id === sale.buyer_id)?.name || "—"],
                ["Seller", sellers.find(s => s.id === sale.seller_id)?.name || "—"],
                ["Agreed Price", formatCurrency(sale.sale_price)],
                ["Token Amount", sale.token_amount ? formatCurrency(sale.token_amount) : "—"],
                ["Token Date", formatDate(sale.token_date)],
                ["Payment Type", sale.payment_type ? sale.payment_type.replace(/_/g, " ") : "—"],
                ["Commission %", sale.commission_pct ? `${sale.commission_pct}%` : "—"],
                ["Commission Amount", sale.commission_amount ? formatCurrency(sale.commission_amount) : "—"],
                ["Commission Paid To", sale.commission_paid_to || "—"],
                ["Stamp Duty", sale.stamp_duty ? formatCurrency(sale.stamp_duty) : "—"],
                ["Registration Fee", sale.registration_fee ? formatCurrency(sale.registration_fee) : "—"],
                ["Agreement Date", formatDate(sale.agreement_date || sale.sale_date)],
                ["Transfer Date", formatDate(sale.transfer_date)],
                ["Transfer Deed #", sale.transfer_deed_number || "—"],
                ["Sale Stage", STAGE_LABELS[sale.sale_stage] ?? sale.sale_stage],
                ["Cancellation Reason", sale.cancellation_reason || "—"],
                ["Notes", sale.notes || "—"],
              ].filter(Boolean).map(([l, v]) => (
                <div key={l} className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-muted">{l}</span>
                  <span className="text-primary">{v}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "instalments" && (
            <div>
              {(!sale.instalments || sale.instalments.length === 0) ? (
                <p className="text-xs text-muted py-4 text-center">No instalment plan set up.</p>
              ) : (
                <div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Total Amount", value: formatCurrency(sale.instalments.reduce((s, i) => s + i.amount, 0)), color: "#3b82f6" },
                      { label: "Total Paid", value: formatCurrency(sale.instalments.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0)), color: "#10b981" },
                      { label: "Outstanding", value: formatCurrency(sale.instalments.filter(i => i.status !== "paid").reduce((s, i) => s + i.amount, 0)), color: "#f59e0b" },
                      { label: "Installments", value: `${sale.instalments.filter(i => i.status === "paid").length}/${sale.instalments.length} paid`, color: "#8b5cf6" },
                    ].map(card => (
                      <div key={card.label} className="rounded-lg px-3 py-2.5" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                        <p className="text-[9px] uppercase tracking-wider text-muted">{card.label}</p>
                        <p className="text-sm font-semibold" style={{ color: card.color }}>{card.value}</p>
                      </div>
                    ))}
                  </div>
                  <DataTable
                    data={sale.instalments}
                    columns={[
                      { key: 'milestone_name', label: 'Milestone', render: (val) => <span className="text-xs text-primary">{val}</span> },
                      { key: 'due_date', label: 'Due Date', render: (val) => <span className="text-xs text-secondary">{formatDate(val)}</span> },
                      { key: 'amount', label: 'Amount', align: 'right', render: (val) => <span className="text-xs text-secondary">{formatCurrency(val)}</span> },
                      { key: 'status', label: 'Status', render: (_: any, row: any) => {
                        const today = new Date();
                        const due = new Date(row.due_date);
                        let status = row.status;
                        let sc = "#6b7280";
                        if (status === "paid") { sc = "#10b981"; }
                        else if (status === "overdue" || (status === "pending" && due < today)) { status = "overdue"; sc = "#ef4444"; }
                        else if (status === "pending") { sc = "#f59e0b"; }
                        return (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: `${sc}18`, color: sc }}>{status}</span>
                        );
                      }},
                    ]}
                    searchable={false}
                    sortable={false}
                  />
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div>
              {(!sale.stage_history || sale.stage_history.length === 0) ? (
                <p className="text-xs text-muted py-4 text-center">No stage changes recorded.</p>
              ) : (
                <div className="space-y-2">
                  {sale.stage_history.map(h => (
                    <div key={h.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                      style={{ border: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-2">
                        {h.from_stage && <StageBadge stage={h.from_stage} />}
                        {h.from_stage && <ChevronRight size={12} className="text-muted" />}
                        <StageBadge stage={h.to_stage} />
                      </div>
                      <div className="flex items-center gap-3 text-muted">
                        <span>{h.changed_by || "System"}</span>
                        <span>{formatDate(h.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "docs" && (
            <div>
              {(!sale.documents || sale.documents.length === 0) ? (
                <p className="text-xs text-muted py-4 text-center">No documents uploaded.</p>
              ) : (
                <div className="space-y-1">
                  {sale.documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ border: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-2">
                        <FileText size={12} className="text-muted" />
                        <span className="text-xs text-primary">{doc.filename}</span>
                        {doc.document_type && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                            style={{ background: "var(--bg-surface2)", color: "var(--text-muted)" }}>
                            {doc.document_type.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      <a href={uploadsUrl(doc.file_path)} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs" style={{ color: "#60a5fa" }}>
                        <Download size={10} /> Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}
    </AppDialog>
  );
}
