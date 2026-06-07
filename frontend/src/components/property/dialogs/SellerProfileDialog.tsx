import { useEffect, useState } from "react";
import { Building2, User, Phone, Mail, FileText, Download, Plus } from "lucide-react";
import AppDialog from "../../ui/AppDialog";
import { propApi, Contact, ContactDocument, ContactInteraction } from "../../../lib/propertyApi";
import { formatCurrency } from "../../../lib/currency";
import { uploadsUrl } from "../../../lib/config";
import LogInteractionDialog from "./LogInteractionDialog";
import { DataTable } from "../../data-table";

interface SellerProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: number | null;
}

const ROLE_COLORS: Record<string, string> = {
  buyer: "#3b82f6", seller: "#10b981", agent: "#8b5cf6", both: "#8b5cf6", other: "#6b7280",
};
const ROLE_LABELS: Record<string, string> = {
  buyer: "Buyer", seller: "Seller", agent: "Agent", other: "Other",
};
const KYC_COLORS: Record<string, string> = {
  pending: "#f59e0b", in_review: "#3b82f6", verified: "#10b981", rejected: "#ef4444",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function RoleBadge({ role }: { role: string }) {
  const roles = role.split(",").map(r => r.trim()).filter(Boolean);
  return (
    <div className="flex gap-1 flex-wrap">
      {roles.map(r => {
        const c = ROLE_COLORS[r] ?? "#6b7280";
        return (
          <span key={r} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: `${c}18`, color: c }}>
            {ROLE_LABELS[r] ?? r}
          </span>
        );
      })}
    </div>
  );
}

function KYCStatusBadge({ status }: { status: string }) {
  const c = KYC_COLORS[status] ?? "#6b7280";
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
      style={{ background: `${c}18`, color: c }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function SellerProfileDialog({ isOpen, onClose, contactId }: SellerProfileDialogProps) {
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "transactions" | "docs" | "communication">("info");
  const [detailTransactions, setDetailTransactions] = useState<any[]>([]);
  const [detailDocs, setDetailDocs] = useState<ContactDocument[]>([]);
  const [detailInteractions, setDetailInteractions] = useState<ContactInteraction[]>([]);
  const [commOpen, setCommOpen] = useState(false);

  useEffect(() => {
    if (isOpen && contactId) {
      setDetailTab("info");
      propApi.getContact(contactId).then(setDetailContact).catch(() => {});
      propApi.getContactTransactions(contactId).then(t => {
        if (t && 'data' in t) setDetailTransactions((t as any).data || []);
        else setDetailTransactions(Array.isArray(t) ? t : []);
      }).catch(() => setDetailTransactions([]));
      propApi.listContactDocuments(contactId).then(dd => {
        if (dd && 'data' in dd) setDetailDocs((dd as any).data || []);
        else setDetailDocs(Array.isArray(dd) ? dd : []);
      }).catch(() => setDetailDocs([]));
      propApi.listContactInteractions(contactId).then(ci => {
        if (ci && 'data' in ci) setDetailInteractions((ci as any).data || []);
        else setDetailInteractions(Array.isArray(ci) ? ci : []);
      }).catch(() => setDetailInteractions([]));
    } else if (!isOpen) {
      setDetailContact(null);
      setDetailTransactions([]);
      setDetailDocs([]);
      setDetailInteractions([]);
    }
  }, [isOpen, contactId]);

  const refreshInteractions = async () => {
    if (!contactId) return;
    const ci = await propApi.listContactInteractions(contactId);
    if (ci && 'data' in ci) setDetailInteractions((ci as any).data || []);
    else setDetailInteractions(Array.isArray(ci) ? ci : []);
  };

  return (
    <>
      <AppDialog
        isOpen={isOpen}
        onClose={onClose}
        title="Contact Profile"
        size="xl">
        {detailContact ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                  {detailContact.contact_type === "company" ? <Building2 size={16} /> : <User size={16} />}
                  {detailContact.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <RoleBadge role={detailContact.role} />
                  <KYCStatusBadge status={detailContact.kyc_status} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                  {detailContact.phone && <span><Phone size={10} className="inline" /> {detailContact.phone}</span>}
                  {detailContact.email && <span><Mail size={10} className="inline" /> {detailContact.email}</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Purchases", value: String(detailContact.purchase_count ?? 0), color: "#3b82f6" },
                { label: "Total Sales", value: String(detailContact.sale_count ?? 0), color: "#10b981" },
                { label: "Total Transaction Value", value: formatCurrency(detailContact.total_transaction_value ?? 0), color: "#8b5cf6" },
                { label: "KYC Status", value: detailContact.kyc_status.replace(/_/g, " "), color: KYC_COLORS[detailContact.kyc_status] ?? "#6b7280" },
              ].map(card => (
                <div key={card.label} className="rounded-lg px-3 py-2.5" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                  <p className="text-[9px] uppercase tracking-wider text-muted">{card.label}</p>
                  <p className="text-sm font-semibold" style={{ color: card.color }}>{card.value}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-1 rounded-lg p-0.5" style={{ border: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
              {(["info", "transactions", "docs", "communication"] as const).map(t => (
                <button key={t} type="button" onClick={() => setDetailTab(t)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-md transition-colors capitalize"
                  style={detailTab === t ? { background: "var(--bg-surface)", color: "var(--text-primary)" } : { color: "var(--text-muted)" }}>
                  {t === "info" ? "Details" : t === "docs" ? "Documents" : t === "communication" ? "Communication" : t}
                </button>
              ))}
            </div>

            {detailTab === "info" && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ["Contact ID", detailContact.tid],
                  ["Contact Type", detailContact.contact_type === "company" ? "Company" : "Individual"],
                  ["CNIC", detailContact.cnic || "—"],
                  ["Date of Birth", formatDate(detailContact.date_of_birth)],
                  ["Nationality", detailContact.nationality || "—"],
                  ["Profession", detailContact.profession || "—"],
                  ["Company Name", detailContact.company_name || "—"],
                  ["NTN", detailContact.ntn || "—"],
                  ["Company Reg No.", detailContact.company_reg_no || "—"],
                  ["Authorized Person", detailContact.authorized_person || "—"],
                  ["Email", detailContact.email || "—"],
                  ["Phone", detailContact.phone || "—"],
                  ["WhatsApp", detailContact.whatsapp || "—"],
                  ["Secondary Phone", detailContact.secondary_phone || "—"],
                  ["Address", detailContact.address || "—"],
                  ["City", detailContact.city || "—"],
                  ["Tax NTN", detailContact.tax_ntn || "—"],
                  ["Source of Funds", detailContact.source_of_funds || "—"],
                  ["Annual Income Range", detailContact.annual_income_range || "—"],
                  ["Bank Name", detailContact.bank_name || "—"],
                  ["Bank Account", detailContact.bank_account_no || "—"],
                  ["KYC Status", detailContact.kyc_status.replace(/_/g, " ")],
                  ["Internal Notes", detailContact.internal_notes || "—"],
                ].map(([l, v]) => (
                  <div key={l} className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted">{l}</span>
                    <span className="text-primary">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "transactions" && (
              <DataTable
                data={detailTransactions}
                columns={[
                  { key: 'tid', label: 'ID', render: (val) => <span className="text-blue-400 font-mono text-xs">{val}</span> },
                  { key: 'role', label: 'Role', render: (_: any, row: any) => {
                    const isBuyer = row.buyer_contact_id === detailContact!.id;
                    return (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: isBuyer ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)", color: isBuyer ? "#3b82f6" : "#10b981" }}>
                        {isBuyer ? "Buyer" : "Seller"}
                      </span>
                    );
                  }},
                  { key: 'sale_price', label: 'Amount', align: 'right', render: (val) => <span className="font-medium">{formatCurrency(val)}</span> },
                  { key: 'stage', label: 'Stage', render: (_: any, row: any) => row.sale_stage || row.status },
                  { key: 'date', label: 'Date', render: (_: any, row: any) => <span className="text-muted">{formatDate(row.agreement_date || row.sale_date)}</span> },
                ]}
                searchable={false}
                sortable={false}
              />
            )}

            {detailTab === "docs" && (
              <div>
                {detailDocs.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">No documents uploaded.</p>
                ) : (
                  <div className="space-y-1">
                    {detailDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ border: "1px solid var(--border)" }}>
                        <div className="flex items-center gap-2">
                          <FileText size={12} className="text-muted" />
                          <span className="text-xs text-primary">{doc.filename}</span>
                          <span className="text-[9px] text-muted">{doc.document_type}</span>
                          <KYCStatusBadge status={doc.status} />
                        </div>
                        <div className="flex items-center gap-2">
                          <select className="dialog-select px-1.5 py-0.5 text-[9px]" value={doc.status}
                            onChange={async (e) => {
                              if (!contactId) return;
                              await propApi.updateContactDocumentStatus(contactId, doc.id, e.target.value);
                              const docs = await propApi.listContactDocuments(contactId);
                              if (docs && 'data' in docs) setDetailDocs((docs as any).data || []);
                              else setDetailDocs(Array.isArray(docs) ? docs : []);
                            }}>
                            <option value="pending">Pending</option>
                            <option value="verified">Verified</option>
                            <option value="rejected">Rejected</option>
                          </select>
                          <a href={uploadsUrl(doc.file_path)} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs" style={{ color: "#60a5fa" }}>
                            <Download size={10} /> Download
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailTab === "communication" && (
              <div>
                <button type="button" onClick={() => setCommOpen(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg mb-3"
                  style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
                  <Plus size={11} /> Log Interaction
                </button>
                {detailInteractions.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">No interactions logged.</p>
                ) : (
                  <div className="space-y-2">
                    {detailInteractions.map(ci => (
                      <div key={ci.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg text-xs"
                        style={{ border: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
                        <div className="w-16 shrink-0">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase"
                            style={{
                              background: ci.type === "call" ? "rgba(59,130,246,0.15)" : ci.type === "email" ? "rgba(139,92,246,0.15)" : ci.type === "meeting" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                              color: ci.type === "call" ? "#3b82f6" : ci.type === "email" ? "#8b5cf6" : ci.type === "meeting" ? "#10b981" : "#f59e0b",
                            }}>
                            {ci.type}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-primary">{ci.notes || "—"}</p>
                        </div>
                        <span className="text-muted shrink-0">{formatDate(ci.interaction_date)}</span>
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

      {contactId && (
        <LogInteractionDialog
          isOpen={commOpen}
          onClose={() => setCommOpen(false)}
          onSaved={() => { refreshInteractions(); }}
          contactId={contactId}
        />
      )}
    </>
  );
}
