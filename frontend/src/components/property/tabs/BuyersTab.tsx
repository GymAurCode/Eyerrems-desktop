import { useEffect, useState, useRef } from "react";
import {
  Plus, Printer, Eye, Edit2,
  Building2, User, Archive, Mail, ChevronRight,
} from "lucide-react";
import { propApi, Contact } from "../../../lib/propertyApi";
import { printRecord } from "../../actions";
import { SmartTable } from "../../data-table";
import { api } from "../../../lib/api";
import AddBuyerDialog from "../dialogs/AddBuyerDialog";
import BuyerProfileDialog from "../dialogs/BuyerProfileDialog";
import LogInteractionDialog from "../dialogs/LogInteractionDialog";
import AddRoleDialog from "../dialogs/AddRoleDialog";
import ConfirmDialog from "../../actions/ConfirmDialog";
import { useNotifStore } from "../../../store/notifications";

type Props = { refresh: number; onRefresh: () => void };

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


export default function BuyersTab({ refresh, onRefresh }: Props) {
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const paramsRef = useRef<any>(null);

  // ── Dialog state ──
  const [addBuyerOpen, setAddBuyerOpen]         = useState(false);
  const [editBuyerContact, setEditBuyerContact] = useState<Contact | null>(null);

  const [detailOpen, setDetailOpen]             = useState(false);
  const [detailContactId, setDetailContactId]   = useState<number | null>(null);

  const [commOpen, setCommOpen]                 = useState(false);
  const [commContactId, setCommContactId]       = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const [addRoleOpen, setAddRoleOpen]           = useState(false);
  const [addRoleContactId, setAddRoleContactId] = useState(0);
  const [addRoleCurrentRole, setAddRoleCurrentRole] = useState("");

  // ── Data fetching ──
  const fetchContacts = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const res = await api.get<Contact[]>("/properties/contacts/all", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          role: "buyer",
          kyc_status: params.status || undefined,
          city: params.propertyType || undefined,
          filter: params.dateFilter || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
        }
      });
      setContacts(Array.isArray(res.data) ? res.data : []);
      setTotal(Number(res.headers["x-total-count"] || 0));
    } catch { setContacts([]); setTotal(0); }
    finally { setLoading(false); }
  };

  const refreshTable = () => { if (paramsRef.current) fetchContacts(paramsRef.current); };
  useEffect(() => { refreshTable(); }, [refresh]);

  // ── Dialog openers ──
  const openAdd = () => { setEditBuyerContact(null); setAddBuyerOpen(true); };
  const openEdit = (contact: Contact) => { setEditBuyerContact(contact); setAddBuyerOpen(true); };
  const openDetail = (contact: Contact) => { setDetailContactId(contact.id); setDetailOpen(true); };
  const openComm = (contact: Contact) => { setCommContactId(contact.id); setCommOpen(true); };
  const openAddRole = (contact: Contact) => {
    setAddRoleContactId(contact.id);
    setAddRoleCurrentRole(contact.role);
    setAddRoleOpen(true);
  };

  // ── Archive ──
  const archiveContact = async (contact: Contact) => {
    await propApi.updateContact(contact.id, { archived: true });
    pushToast({ title: "Archived", message: `${contact.name} archived`, type: "success" });
    refreshTable();
  };

  // ── Columns ──
  const columns = [
    {
      key: "name", label: "Name",
      render: (_: any, row: Contact) => (
        <div className="flex items-center gap-2">
          {row.contact_type === "company" ? <Building2 size={12} className="text-muted" /> : <User size={12} className="text-muted" />}
          <span className="text-primary font-medium text-xs">{row.name}</span>
        </div>
      ),
    },
    {
      key: "contact_type", label: "Type",
      render: (val: string) => (
        <span className="text-[10px] text-muted">{val === "company" ? "Company" : "Individual"}</span>
      ),
    },
    {
      key: "cnic", label: "CNIC / NTN",
      render: (_: any, row: Contact) => (
        <span className="text-secondary font-mono text-[10px]">{row.cnic || row.ntn || row.tax_ntn || "—"}</span>
      ),
    },
    { key: "phone", label: "Phone", render: (val: any) => <span className="text-secondary text-xs">{val || "—"}</span> },
    { key: "city", label: "City", render: (val: any) => <span className="text-secondary text-xs">{val || "—"}</span> },
    {
      key: "role", label: "Role",
      render: (val: string) => <RoleBadge role={val} />,
    },
    {
      key: "kyc_status", label: "KYC",
      render: (val: string) => <KYCStatusBadge status={val} />,
    },
    {
      key: "sale_count", label: "Linked",
      render: (_: any, row: Contact) => (
        <span className="text-secondary text-xs">{row.sale_count != null ? `${row.sale_count} sales` : "—"}</span>
      ),
    },
    {
      key: "created_at", label: "Added",
      render: (val: any) => <span className="text-secondary text-xs">{formatDate(val)}</span>,
    },
  ];

  const rowActions = [
    { key: "view", label: "View Profile", icon: Eye, onClick: (row: Contact) => openDetail(row) },
    { key: "edit", label: "Edit Contact", icon: Edit2, onClick: (row: Contact) => openEdit(row) },
    {
      key: "addRole", label: "Add Role", icon: ChevronRight,
      onClick: (row: Contact) => openAddRole(row),
      hidden: (row: Contact) => row.role.includes("both") || (row.role.includes("buyer") && row.role.includes("seller")),
    },
    {
      key: "comm", label: "Send Communication", icon: Mail,
      onClick: (row: Contact) => openComm(row),
    },
    {
      key: "archive", label: "Archive Contact", icon: Archive,
      onClick: (row: Contact) => setDeleteTarget(row),
    },
    {
      key: "print", label: "Print", icon: Printer,
      onClick: (row: Contact) => printRecord(`Contact ${row.tid}`, [
        { label: "Name", value: row.name },
        { label: "Email", value: row.email || "—" },
        { label: "Phone", value: row.phone || "—" },
        { label: "City", value: row.city || "—" },
        { label: "KYC", value: row.kyc_status },
        { label: "Role", value: row.role },
      ]),
    },
  ];

  return (
    <>
      <SmartTable
        storageKey="rems_buyers"
        data={contacts}
        columns={columns}
        rowActions={rowActions}
        loading={loading}
        total={total}
        onParamsChange={fetchContacts}
        showStatusFilter={true}
        statusOptions={[
          { label: "Pending", value: "pending" },
          { label: "In Review", value: "in_review" },
          { label: "Verified", value: "verified" },
          { label: "Rejected", value: "rejected" },
        ]}
        showTypeFilter={true}
        typeOptions={[
          { label: "All Cities", value: "" },
          ...[...new Set(contacts.map(c => c.city).filter(Boolean))].map(c => ({ label: c!, value: c! })),
        ]}
        showDateFilter={true}
        toolbarActions={
          <button type="button" onClick={openAdd}
            className="btn-property flex items-center gap-2 px-3 py-2 text-xs">
            <Plus size={13} /> Add Buyer
          </button>
        }
      />

      <AddBuyerDialog
        isOpen={addBuyerOpen}
        onClose={() => setAddBuyerOpen(false)}
        editContact={editBuyerContact}
        onSaved={() => refreshTable()}
      />

      <BuyerProfileDialog
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailContactId(null); }}
        contactId={detailContactId}
      />

      <LogInteractionDialog
        isOpen={commOpen}
        onClose={() => setCommOpen(false)}
        contactId={commContactId}
      />

      <AddRoleDialog
        isOpen={addRoleOpen}
        onClose={() => setAddRoleOpen(false)}
        contactId={addRoleContactId}
        currentRole={addRoleCurrentRole}
        onSaved={() => refreshTable()}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Archive ${deleteTarget?.name ?? ""}`}
        message={`Are you sure you want to archive ${deleteTarget?.name ?? "this contact"}? They can be restored later.`}
        confirmLabel="Archive"
        variant="warning"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await propApi.updateContact(deleteTarget.id, { archived: true });
          pushToast({ title: "Archived", message: `${deleteTarget.name} archived`, type: "success" });
          setDeleteTarget(null);
          refreshTable();
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
