import { useEffect, useState } from "react";
import { Plus, Phone, MessageCircle, MessageSquare, User, Mail, CheckCircle2, XCircle, Clock } from "lucide-react";
import DataTable from '../../components/data-table/DataTable';
import { crmApi, FollowUp } from "../../lib/crmApi";
import ConfirmDialog from "../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../store/notifications";
import AppDialog from "../../components/ui/AppDialog";
import { FormField } from "../../components/crm/FormField";

const TYPE_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  call: { color: "#3b82f6", icon: Phone },
  whatsapp: { color: "#25d366", icon: MessageCircle },
  sms: { color: "#8b5cf6", icon: MessageSquare },
  meeting: { color: "#f59e0b", icon: User },
  email: { color: "#ef4444", icon: Mail },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  completed: { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  missed: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

function Badge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: s.bg, color: s.color }}>{status}</span>;
}

export default function FollowUps() {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({ lead_id: 0, date: "", time: "", fu_type: "call", fu_status: "pending", notes: "" });
  const [leads, setLeads] = useState<{ id: number; name: string }[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ item: any; type: string } | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const pageSize = 20;

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getFollowUps({ limit: pageSize, offset: (page - 1) * pageSize, fu_status: filter || undefined });
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { void fetch(); }, [page, filter]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { item, type } = deleteTarget;
      if (type === "follow_up") {
        await crmApi.updateFollowUp(item.id, { fu_status: "missed" });
        pushToast({ title: "Follow-up Cancelled", message: "Follow-up has been cancelled", type: "success" });
        void fetch();
      }
    } catch (e: any) {
      pushToast({ title: "Error", message: e?.response?.data?.detail ?? "Failed to cancel", priority: "urgent" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await crmApi.getLeads();
      const d = res as any;
      const leadList = d.items ?? d ?? [];
      setLeads((Array.isArray(leadList) ? leadList : []).map((l: any) => ({ id: l.id, name: l.name })));
    } catch { }
  };

  const openModal = () => { fetchLeads(); setModal(true); };

  const create = async () => {
    if (!form.lead_id || !form.date) { setErr("Lead and date are required"); return; }
    setSaving(true); setErr("");
    try {
      await crmApi.createFollowUp({ ...form, date: form.date, time: form.time || undefined });
      setModal(false);
      setForm({ lead_id: 0, date: "", time: "", fu_type: "call", fu_status: "pending", notes: "" });
      pushToast({ title: "Follow-up Created", message: "Follow-up has been created", type: "success" });
      void fetch();
    } catch (e: any) { setErr(e?.response?.data?.detail ?? "Failed to create"); }
    finally { setSaving(false); }
  };

  const complete = async (id: number) => {
    try {
      await crmApi.completeFollowUp(id);
      pushToast({ title: "Follow-up Completed", message: "Follow-up has been marked as completed", type: "success" });
      void fetch();
    } catch { }
  };

  const cancel = async (id: number) => {
    try {
      await crmApi.updateFollowUp(id, { fu_status: "missed" });
      void fetch();
    } catch { }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">{total} follow-ups</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="select-dark px-3 py-1.5 text-xs" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
          </select>
          <button onClick={openModal} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"><Plus size={14} /> New Follow-up</button>
        </div>
      </div>

      <DataTable
        data={items}
        loading={loading}
        searchable={false}
        pagination={{ page, pageSize, total }}
        onPaginationChange={(config) => setPage(config.page)}
        columns={[
          { key: 'fu_id', label: 'ID', width: 80, render: (value: string) => <span className="font-mono text-xs" style={{ color: "#60a5fa" }}>{value}</span> },
          { key: 'lead_name', label: 'Lead', render: (_value: any, row: any) => (
            <div>
              <span className="text-xs font-medium text-primary">{row.lead_name ?? `Lead #${row.lead_id}`}</span>
              {row.lead_phone && <span className="text-[10px] block text-muted">{row.lead_phone}</span>}
            </div>
          )},
          { key: 'fu_type', label: 'Type', width: 100, render: (value: string, row: any) => {
            const cfg = TYPE_CONFIG[value] ?? { color: "#94a3b8", icon: Clock };
            const Icon = cfg.icon;
            return <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: cfg.color }}><Icon size={12} /> {value}</span>;
          }},
          { key: 'date', label: 'Date / Time', render: (_value: any, row: any) => (
            <div>
              <span className="text-xs">{row.date}</span>
              {row.time && <span className="text-[10px] block text-muted">{row.time}</span>}
            </div>
          )},
          { key: 'assigned_user_name', label: 'Assigned To', render: (value: string) => <span className="text-xs text-secondary">{value ?? "—"}</span> },
          { key: 'fu_status', label: 'Status', align: 'center', width: 100, render: (value: string) => <Badge status={value} /> },
          { key: 'action', label: 'Actions', align: 'right', width: 180, render: (_value: any, row: any) => {
            const phone = row.lead_phone;
            const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
            return (
              <div className="flex gap-1 justify-end">
                {phone && (
                  <>
                    <button onClick={() => window.location.href = `tel:${phone}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}
                      title="Call">
                      <Phone size={12} />
                    </button>
                    <button onClick={() => window.open(`https://wa.me/${cleanPhone}`, "_blank")}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: "rgba(37,211,102,0.1)", color: "#25d366" }}
                      title="WhatsApp">
                      <MessageCircle size={12} />
                    </button>
                    <button onClick={() => window.location.href = `sms:${phone}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}
                      title="SMS">
                      <MessageSquare size={12} />
                    </button>
                  </>
                )}
                {row.fu_status === "pending" && (
                  <>
                    <button onClick={() => complete(row.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}
                      title="Complete">
                      <CheckCircle2 size={12} />
                    </button>
                    <button onClick={() => setDeleteTarget({ item: row, type: "follow_up" })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                      title="Cancel">
                      <XCircle size={12} />
                    </button>
                  </>
                )}
              </div>
            );
          }},
        ]}
      />

      {/* ── Cancel Confirmation Dialog ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Cancel Follow-up"
        message="Are you sure you want to mark this follow-up as missed?"
        confirmLabel="Mark Missed"
        variant="warning"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <AppDialog isOpen={modal} onClose={() => setModal(false)} title="New Follow-up">
        <div className="space-y-4">
          {err && <p className="text-xs text-red-400">{err}</p>}
          <FormField label="Lead" required>
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: Number(e.target.value) }))}>
              <option value={0}>Select lead...</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type">
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={form.fu_type} onChange={e => setForm(f => ({ ...f, fu_type: e.target.value }))}>
                <option value="call">Call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="meeting">Meeting</option>
                <option value="email">Email</option>
              </select>
            </FormField>
            <FormField label="Status">
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={form.fu_status} onChange={e => setForm(f => ({ ...f, fu_status: e.target.value }))}>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="missed">Missed</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" required>
              <input type="date" className="input-dark w-full px-3 py-2.5 text-sm" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Time">
              <input type="time" className="input-dark w-full px-3 py-2.5 text-sm" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea className="input-dark w-full px-3 py-2.5 text-sm resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Follow-up notes..." />
          </FormField>
          <button onClick={create} disabled={saving} className="btn-primary w-full py-3 text-sm">{saving ? "Saving..." : "Create Follow-up"}</button>
        </div>
      </AppDialog>
    </div>
  );
}
