import { useEffect, useState } from "react";
import { Plus, MapPin, Building2, MessageSquareText } from "lucide-react";
import DataTable from '../../components/data-table/DataTable';
import { crmApi, SiteVisit } from "../../lib/crmApi";
import AppDialog from "../../components/ui/AppDialog";
import { FormField } from "../../components/crm/FormField";

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  scheduled: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  completed: { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  cancelled: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  no_show:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
};

function Badge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: s.bg, color: s.color }}>{status.replace("_", " ")}</span>;
}

export default function SiteVisits() {
  const [items, setItems] = useState<SiteVisit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Create form state
  const [form, setForm] = useState({ lead_id: 0, property_id: 0, dealer_id: 0, date: "", time: "", remarks: "" });

  // Completion feedback state
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [completingRef, setCompletingRef] = useState("");
  const [feedbackText, setFeedbackText] = useState("");

  // View feedback state
  const [viewingFeedback, setViewingFeedback] = useState<{ ref: string; text: string } | null>(null);

  const [leads, setLeads] = useState<{ id: number; name: string }[]>([]);
  const [properties, setProperties] = useState<{ id: number; name: string }[]>([]);
  const [dealers, setDealers] = useState<{ id: number; name: string }[]>([]);

  const pageSize = 20;

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getSiteVisits({ limit: pageSize, offset: (page - 1) * pageSize, sv_status: filter || undefined });
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { void fetch(); }, [page, filter]);

  const openModal = async () => {
    try {
      const [lRes, pRes, dRes] = await Promise.all([
        crmApi.getLeads(), import("../../lib/propertyApi").then(m => m.propApi.getProperties()),
        crmApi.getDealers(),
      ]);
      const ldata = lRes as any;
      const leadList = ldata.items ?? ldata ?? [];
      setLeads((Array.isArray(leadList) ? leadList : []).map((l: any) => ({ id: l.id, name: l.name })));
      setProperties((Array.isArray(pRes) ? pRes : []).map((p: any) => ({ id: p.id, name: p.name ?? `Property #${p.id}` })));
      setDealers((Array.isArray(dRes) ? dRes : []).map((d: any) => ({ id: d.id, name: d.name })));
    } catch { }
    setModal(true);
  };

  const updateStatus = async (id: number, status: string, feedback?: string) => {
    try {
      await crmApi.updateSiteVisit(id, { sv_status: status, feedback: feedback || undefined });
      void fetch();
    } catch { }
  };

  const handleCompleteWithFeedback = async () => {
    if (!completingId) return;
    setSaving(true);
    await updateStatus(completingId, "completed", feedbackText);
    setCompletingId(null);
    setFeedbackText("");
    setSaving(false);
  };

  const create = async () => {
    if (!form.lead_id || !form.date) { setErr("Lead and date are required"); return; }
    setSaving(true); setErr("");
    try {
      await crmApi.createSiteVisit({
        lead_id: form.lead_id,
        property_id: form.property_id || undefined,
        dealer_id: form.dealer_id || undefined,
        date: form.date,
        time: form.time || undefined,
        remarks: form.remarks || undefined,
      });
      setModal(false);
      setForm({ lead_id: 0, property_id: 0, dealer_id: 0, date: "", time: "", remarks: "" });
      void fetch();
    } catch (e: any) { setErr(e?.response?.data?.detail ?? "Failed to create"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><p className="text-xs text-muted">{total} site visits</p></div>
        <div className="flex items-center gap-3">
          <select className="select-dark px-3 py-1.5 text-xs" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
          <button onClick={openModal} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"><Plus size={14} /> New Visit</button>
        </div>
      </div>

      <DataTable
        data={items}
        loading={loading}
        searchable={false}
        pagination={{ page, pageSize, total }}
        onPaginationChange={(config) => setPage(config.page)}
        columns={[
          { key: 'visit_id', label: 'ID', width: 80, render: (value: string) => <span className="font-mono text-xs" style={{ color: "#60a5fa" }}>{value}</span> },
          { key: 'lead_name', label: 'Lead', render: (_value: any, row: any) => (
            <div>
              <span className="text-xs font-medium text-primary">{row.lead_name ?? `Lead #${row.lead_id}`}</span>
              {row.lead_phone && <span className="text-[10px] block text-muted">{row.lead_phone}</span>}
            </div>
          )},
          { key: 'property_name', label: 'Property', render: (value: string) => <span className="text-xs text-secondary">{value ?? "—"}</span> },
          { key: 'dealer_name', label: 'Dealer', render: (value: string) => <span className="text-xs text-secondary">{value ?? "—"}</span> },
          { key: 'date', label: 'Date / Time', render: (_value: any, row: any) => (
            <div>
              <span className="text-xs">{row.date}</span>
              {row.time && <span className="text-[10px] block text-muted">{row.time}</span>}
            </div>
          )},
          { key: 'sv_status', label: 'Status', align: 'center', width: 100, render: (value: string) => <Badge status={value} /> },
          { key: 'feedback', label: 'Feedback', width: 100, render: (value: string, row: any) => value ? (
            <button type="button" onClick={() => setViewingFeedback({ ref: row.visit_id, text: value })}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors" style={{ color: "#a78bfa" }}>
              <MessageSquareText size={10} /> View
            </button>
          ) : <span className="text-[10px] text-muted">—</span> },
          { key: 'action', label: 'Actions', align: 'right', width: 140, render: (_value: any, row: any) => row.sv_status === "scheduled" ? (
            <div className="flex gap-1 justify-end">
              <button onClick={() => { setCompletingId(row.id); setCompletingRef(row.visit_id); setFeedbackText(""); }}
                className="text-[10px] px-2 py-1 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                Complete
              </button>
              <button onClick={() => updateStatus(row.id, "cancelled")}
                className="text-[10px] px-2 py-1 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                Cancel
              </button>
            </div>
          ) : null },
        ]}
      />

      {/* ── Create Modal ── */}
      <AppDialog isOpen={modal} onClose={() => setModal(false)} title="New Site Visit">
        <div className="space-y-4">
          {err && <p className="text-xs text-red-400">{err}</p>}
          <FormField label="Lead" required>
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: Number(e.target.value) }))}>
              <option value={0}>Select lead...</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Property">
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: Number(e.target.value) }))}>
                <option value={0}>Select property...</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label="Dealer">
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={form.dealer_id} onChange={e => setForm(f => ({ ...f, dealer_id: Number(e.target.value) }))}>
                <option value={0}>Select dealer...</option>
                {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
          <FormField label="Remarks">
            <textarea className="input-dark w-full px-3 py-2.5 text-sm resize-none" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Visit remarks..." />
          </FormField>
          <button onClick={create} disabled={saving} className="btn-primary w-full py-3 text-sm">{saving ? "Saving..." : "Create Site Visit"}</button>
        </div>
      </AppDialog>

      {/* ── Complete with Feedback Modal ── */}
      <AppDialog
        isOpen={completingId !== null}
        onClose={() => { setCompletingId(null); setFeedbackText(""); }}
        title={`Complete Visit — ${completingRef}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-muted">Record post-visit client feedback before marking this visit as completed.</p>
          <FormField label="Post-Visit Client Feedback" span="full">
            <textarea
              className="input-dark w-full px-3 py-2.5 text-sm resize-none"
              rows={5}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Client feedback, questions raised, objections, next steps discussed..."
            />
          </FormField>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setCompletingId(null); setFeedbackText(""); }}
              className="flex-1 py-2.5 text-sm rounded-lg"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCompleteWithFeedback}
              disabled={saving}
              className="flex-1 py-2.5 text-sm rounded-lg font-medium disabled:opacity-50"
              style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}
            >
              {saving ? "Saving..." : "Mark Completed"}
            </button>
          </div>
        </div>
      </AppDialog>

      {/* ── View Feedback Modal ── */}
      <AppDialog
        isOpen={viewingFeedback !== null}
        onClose={() => setViewingFeedback(null)}
        title={`Feedback — ${viewingFeedback?.ref ?? ""}`}
      >
        <div
          className="px-4 py-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap"
          style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}
        >
          {viewingFeedback?.text ?? "No feedback recorded."}
        </div>
      </AppDialog>
    </div>
  );
}
