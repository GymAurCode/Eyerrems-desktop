import { useState, useEffect } from "react";
import {
  Building2, User, Phone, Mail, FileText, Download, Plus,
} from "lucide-react";
import ModuleDialog from "../../ui/ModuleDialog";
import { propApi, Contact, ContactDocument, ContactInteraction } from "../../../lib/propertyApi";
import { formatCurrency } from "../../../lib/currency";
import { uploadsUrl } from "../../../lib/config";
import LogInteractionDialog from "./LogInteractionDialog";
import { DataTable } from "../../data-table";

const ROLE_LABELS: Record<string, string> = {
  buyer: "Buyer", seller: "Seller", agent: "Agent", other: "Other",
};
const ROLE_COLORS: Record<string, string> = {
  buyer: "#3b82f6", seller: "#10b981", agent: "#8b5cf6", both: "#8b5cf6", other: "#6b7280",
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

interface BuyerProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: number | null;
}

export default function BuyerProfileDialog({ isOpen, onClose, contactId }: BuyerProfileDialogProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [tab, setTab] = useState<"info" | "transactions" | "docs" | "communication">("info");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [docs, setDocs] = useState<ContactDocument[]>([]);
  const [interactions, setInteractions] = useState<ContactInteraction[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !contactId) return;
    setTab("info");
    setContact(null);
    setTransactions([]);
    setDocs([]);
    setInteractions([]);
    (async () => {
      try {
        const d = await propApi.getContact(contactId);
        setContact(d);
      } catch {}
    })();
    propApi.getContactTransactions(contactId).then(t => {
      if (t && 'data' in t) setTransactions((t as any).data || []);
      else setTransactions(Array.isArray(t) ? t : []);
    }).catch(() => setTransactions([]));
    propApi.listContactDocuments(contactId).then(dd => {
      if (dd && 'data' in dd) setDocs((dd as any).data || []);
      else setDocs(Array.isArray(dd) ? dd : []);
    }).catch(() => setDocs([]));
    propApi.listContactInteractions(contactId).then(ci => {
      if (ci && 'data' in ci) setInteractions((ci as any).data || []);
      else setInteractions(Array.isArray(ci) ? ci : []);
    }).catch(() => setInteractions([]));
  }, [isOpen, contactId]);

  const refreshInteractions = async () => {
    if (!contactId) return;
    const ci = await propApi.listContactInteractions(contactId);
    if (ci && 'data' in ci) setInteractions((ci as any).data || []);
    else setInteractions(Array.isArray(ci) ? ci : []);
  };

  if (!isOpen) return null;

  return (
    <>
      <ModuleDialog isOpen={isOpen} onClose={onClose} title="Contact Profile" size="xl">
        {contact ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                  {contact.contact_type === "company" ? <Building2 size={16} /> : <User size={16} />}
                  {contact.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <RoleBadge role={contact.role} />
                  <KYCStatusBadge status={contact.kyc_status} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                  {contact.phone && <span><Phone size={10} className="inline" /> {contact.phone}</span>}
                  {contact.email && <span><Mail size={10} className="inline" /> {contact.email}</span>}
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Purchases", value: String(contact.purchase_count ?? 0), color: "#3b82f6" },
                { label: "Total Sales", value: String(contact.sale_count ?? 0), color: "#10b981" },
                { label: "Total Transaction Value", value: formatCurrency(contact.total_transaction_value ?? 0), color: "#8b5cf6" },
                { label: "KYC Status", value: contact.kyc_status.replace(/_/g, " "), color: KYC_COLORS[contact.kyc_status] ?? "#6b7280" },
              ].map(card => (
                <div key={card.label} className="rounded-lg px-3 py-2.5" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                  <p className="text-[9px] uppercase tracking-wider text-muted">{card.label}</p>
                  <p className="text-sm font-semibold" style={{ color: card.color }}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg p-0.5" style={{ border: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
              {(["info", "transactions", "docs", "communication"] as const).map(t => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-md transition-colors capitalize"
                  style={tab === t ? { background: "var(--bg-surface)", color: "var(--text-primary)" } : { color: "var(--text-muted)" }}>
                  {t === "info" ? "Details" : t === "docs" ? "Documents" : t === "communication" ? "Communication" : t}
                </button>
              ))}
            </div>

            {/* Info tab */}
            {tab === "info" && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ["Contact ID", contact.tid],
                  ["Contact Type", contact.contact_type === "company" ? "Company" : "Individual"],
                  ["CNIC", contact.cnic || "—"],
                  ["Date of Birth", formatDate(contact.date_of_birth)],
                  ["Nationality", contact.nationality || "—"],
                  ["Profession", contact.profession || "—"],
                  ["Company Name", contact.company_name || "—"],
                  ["NTN", contact.ntn || "—"],
                  ["Company Reg No.", contact.company_reg_no || "—"],
                  ["Authorized Person", contact.authorized_person || "—"],
                  ["Email", contact.email || "—"],
                  ["Phone", contact.phone || "—"],
                  ["WhatsApp", contact.whatsapp || "—"],
                  ["Secondary Phone", contact.secondary_phone || "—"],
                  ["Address", contact.address || "—"],
                  ["City", contact.city || "—"],
                  ["Tax NTN", contact.tax_ntn || "—"],
                  ["Source of Funds", contact.source_of_funds || "—"],
                  ["Annual Income Range", contact.annual_income_range || "—"],
                  ["Bank Name", contact.bank_name || "—"],
                  ["Bank Account", contact.bank_account_no || "—"],
                  ["KYC Status", contact.kyc_status.replace(/_/g, " ")],
                  ["Internal Notes", contact.internal_notes || "—"],
                ].map(([l, v]) => (
                  <div key={l} className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted">{l}</span>
                    <span className="text-primary">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Transactions tab */}
            {tab === "transactions" && (
              <DataTable
                data={transactions}
                columns={[
                  { key: 'tid', label: 'ID', render: (val) => <span className="text-blue-400 font-mono text-xs">{val}</span> },
                  { key: 'role', label: 'Role', render: (_: any, row: any) => {
                    const isBuyer = row.buyer_contact_id === contact!.id;
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

            {/* Documents tab */}
            {tab === "docs" && (
              <div>
                {docs.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">No documents uploaded.</p>
                ) : (
                  <div className="space-y-1">
                    {docs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ border: "1px solid var(--border)" }}>
                        <div className="flex items-center gap-2">
                          <FileText size={12} className="text-muted" />
                          <span className="text-xs text-primary">{doc.filename}</span>
                          <span className="text-[9px] text-muted">{doc.document_type}</span>
                          <KYCStatusBadge status={doc.status} />
                        </div>
                        <div className="flex items-center gap-2">
                          <select className="select-dark px-1.5 py-0.5 text-[9px]" value={doc.status}
                            onChange={async (e) => {
                              await propApi.updateContactDocumentStatus(contact!.id, doc.id, e.target.value);
                              const updated = await propApi.listContactDocuments(contact!.id);
                              if (updated && 'data' in updated) setDocs((updated as any).data || []);
                              else setDocs(Array.isArray(updated) ? updated : []);
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

            {/* Communication tab */}
            {tab === "communication" && (
              <div>
                <button type="button" onClick={() => setLogOpen(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg mb-3"
                  style={{ border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
                  <Plus size={11} /> Log Interaction
                </button>
                {interactions.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">No interactions logged.</p>
                ) : (
                  <div className="space-y-2">
                    {interactions.map(ci => (
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
      </ModuleDialog>

      <LogInteractionDialog
        isOpen={logOpen}
        onClose={() => setLogOpen(false)}
        contactId={contactId ?? 0}
        onSaved={refreshInteractions}
      />
    </>
  );
}
