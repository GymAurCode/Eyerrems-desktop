import { useState, useEffect } from "react";
import {
  X, Check, Loader2, FileText, AlertTriangle, RotateCcw,
  Send, ThumbsUp, Ban, ArrowUpRight, Clock, Eye, User, Hash, Calendar
} from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import {
  journalsApi, type Journal, type JournalEntry
} from "../../lib/financeApi";
import AppDialog from "../ui/AppDialog";
import AttachmentPanel from "../attachments/AttachmentPanel";
import { MODULE_COLORS } from "../../config/moduleColors";

const ACCENT = MODULE_COLORS.finance.primary;

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", submitted: "#3b82f6", approved: "#8b5cf6",
  posted: "#10b981", reversed: "#ef4444", cancelled: "#6b7280",
};

const STATUS_FLOW = ["draft", "submitted", "approved", "posted"];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  journalId: number;
  onRefresh?: () => void;
}

export default function JournalDetailView({ isOpen, onClose, journalId, onRefresh }: Props) {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reverseReason, setReverseReason] = useState("");
  const [showReverse, setShowReverse] = useState(false);

  useEffect(() => {
    if (!isOpen || !journalId) return;
    setLoading(true); setError("");
    journalsApi.get(journalId).then(setJournal).catch(() => setError("Failed to load journal")).finally(() => setLoading(false));
  }, [isOpen, journalId]);

  const handleAction = async (action: string, payload?: any) => {
    setActionLoading(action); setError("");
    try {
      let updated: Journal;
      if (action === "submit") updated = await journalsApi.submit(journalId, payload);
      else if (action === "approve") updated = await journalsApi.approve(journalId, payload);
      else if (action === "post") updated = await journalsApi.post(journalId, payload);
      else if (action === "reverse") updated = await journalsApi.reverse(journalId, { reason: reverseReason, ...payload });
      else return;
      setJournal(updated);
      setShowReverse(false); setReverseReason("");
      onRefresh?.();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || `Failed to ${action} journal`);
    } finally { setActionLoading(null); }
  };

  const drTotal = journal?.entries?.reduce((s: number, e: any) => s + Number(e.debit), 0) || 0;
  const crTotal = journal?.entries?.reduce((s: number, e: any) => s + Number(e.credit), 0) || 0;
  const balanced = drTotal === crTotal;
  const statusStep = journal ? STATUS_FLOW.indexOf(journal.status) : -1;

  return (
    <AppDialog isOpen={isOpen} onClose={onClose}
      title={`Journal ${journal?.journal_number || `#${journalId}`}`}
      subtitle={journal ? `${new Date(journal.date).toLocaleDateString()} · ${journal.reference_type} · ${journal.status}` : ""}
      size="2xl">

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: ACCENT }} /></div>
      ) : journal ? (
        <div className="space-y-4">

          {/* Status Timeline */}
          <div className="flex items-center gap-1 px-1">
            {STATUS_FLOW.map((s, i) => {
              const isActive = i <= statusStep;
              const isCurrent = s === journal.status;
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${isCurrent ? "ring-2" : ""}`}
                      style={{ background: isActive ? (STATUS_COLORS[s] || "#94a3b8") : "var(--border)",
                        "--tw-ring-color": isCurrent ? (STATUS_COLORS[s] || "#94a3b8") : "transparent",
                      } as React.CSSProperties} />
                    <span className="text-[9px]" style={{ color: isCurrent ? (STATUS_COLORS[s] || "#94a3b8") : "var(--text-muted)" }}>
                      {s.replace(/_/g, " ")}
                    </span>
                  </div>
                  {i < STATUS_FLOW.length - 1 && (
                    <div className="flex-1 h-px" style={{ background: isActive ? (STATUS_COLORS[s] || "#94a3b8") : "var(--border)" }} />
                  )}
                </div>
              );
            })}
            {journal.status === "reversed" && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 ring-2" style={{ "--tw-ring-color": "#ef4444" } as React.CSSProperties} />
                <span className="text-[9px] text-red-400 font-semibold">reversed</span>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {journal.status === "draft" && (
              <button onClick={() => handleAction("submit")} disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white" style={{ background: ACCENT }}>
                {actionLoading === "submit" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Submit
              </button>
            )}
            {journal.status === "submitted" && (
              <>
                <button onClick={() => handleAction("approve")} disabled={actionLoading !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white" style={{ background: "#8b5cf6" }}>
                  {actionLoading === "approve" ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />} Approve
                </button>
                <button onClick={() => {
                  const reason = prompt("Rejection reason:");
                  if (reason) handleAction("reject", { reason });
                }} disabled={actionLoading !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg" style={{ border: "1px solid #ef444444", color: "#ef4444" }}>
                  <Ban size={12} /> Reject
                </button>
              </>
            )}
            {(journal.status === "draft" || journal.status === "approved") && (
              <button onClick={() => handleAction("post")} disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white" style={{ background: "#10b981" }}>
                {actionLoading === "post" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Post
              </button>
            )}
            {journal.status === "posted" && !journal.is_reversal && (
              <button onClick={() => setShowReverse(!showReverse)} disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg" style={{ border: "1px solid #f59e0b44", color: "#f59e0b" }}>
                <RotateCcw size={12} /> Reverse
              </button>
            )}
          </div>

          {error && <div className="flex items-center gap-2 p-2 rounded-lg text-[10px]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}><AlertTriangle size={12} /> {error}</div>}

          {/* Reverse section */}
          {showReverse && (
            <div className="p-3 rounded-lg space-y-2" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p className="text-[10px] font-semibold text-yellow-400">Reverse This Journal</p>
              <p className="text-[9px] text-muted">A new journal with opposite debit/credit values will be created.</p>
              <textarea className="dialog-input w-full text-xs min-h-[50px] resize-y" value={reverseReason}
                onChange={e => setReverseReason(e.target.value)} placeholder="Reason for reversal..." autoFocus />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowReverse(false); setReverseReason(""); }} className="btn-ghost px-3 py-1.5 text-[10px]">Cancel</button>
                <button onClick={() => handleAction("reverse")} disabled={!reverseReason.trim() || actionLoading !== null}
                  className="btn-primary px-3 py-1.5 text-[10px] flex items-center gap-1" style={{ background: "#f59e0b" }}>
                  {actionLoading === "reverse" ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />} Confirm Reverse
                </button>
              </div>
            </div>
          )}

          {/* Journal Info */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg text-xs" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div><span className="text-muted">Journal #:</span> <span className="font-semibold text-primary">{journal.journal_number || `JE-${journal.id}`}</span></div>
            <div><span className="text-muted">Status:</span> <span className="font-medium capitalize" style={{ color: STATUS_COLORS[journal.status] || "#94a3b8" }}>{journal.status}</span></div>
            <div><span className="text-muted">Date:</span> <span className="text-primary">{new Date(journal.date).toLocaleDateString()}</span></div>
            <div><span className="text-muted">Type:</span> <span className="capitalize text-primary">{journal.reference_type.replace(/_/g, " ")}</span></div>
            <div className="col-span-2"><span className="text-muted">Description:</span> <span className="text-primary">{journal.description || "—"}</span></div>
            {journal.source_module && <div className="col-span-2"><span className="text-muted">Source:</span> <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{journal.source_module} {journal.source_document_number ? `#${journal.source_document_number}` : ""}</span></div>}
            {journal.reversal_of && <div className="col-span-2"><span className="text-muted">Reversal Of:</span> <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">JE #{journal.reversal_of}</span></div>}
            {journal.reversal_reason && <div className="col-span-2"><span className="text-muted">Reversal Reason:</span> <span className="text-red-400">{journal.reversal_reason}</span></div>}
          </div>

          {/* Entries Table */}
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full text-xs">
              <thead><tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
                <th className="p-2 text-left text-muted">#</th>
                <th className="p-2 text-left text-muted">Account</th>
                <th className="p-2 text-left text-muted">Narration</th>
                <th className="p-2 text-right text-muted">Debit</th>
                <th className="p-2 text-right text-muted">Credit</th>
              </tr></thead>
              <tbody>
                {journal.entries.map((e: JournalEntry, i: number) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="p-2 text-muted">{i + 1}</td>
                    <td className="p-2">
                      <span className="text-primary">{e.account_name || `#${e.account_id}`}</span>
                      {e.cost_center && <span className="text-[9px] text-muted ml-1">[{e.cost_center}]</span>}
                    </td>
                    <td className="p-2 text-muted">{e.narration || e.description || "—"}</td>
                    <td className="p-2 text-right font-medium text-emerald-400">{Number(e.debit) > 0 ? formatCurrency(e.debit) : "—"}</td>
                    <td className="p-2 text-right font-medium text-blue-400">{Number(e.credit) > 0 ? formatCurrency(e.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--bg-card)" }}>
                  <td colSpan={3} className="p-2 text-xs font-semibold text-right text-primary">Totals</td>
                  <td className="p-2 text-right font-bold text-emerald-400">{formatCurrency(drTotal)}</td>
                  <td className="p-2 text-right font-bold text-blue-400">{formatCurrency(crTotal)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="p-2 text-xs font-semibold text-right text-primary">Status</td>
                  <td colSpan={2} className="p-2 text-right font-bold">
                    {balanced
                      ? <span className="text-emerald-400">✓ Balanced</span>
                      : <span className="text-red-400">✗ Unbalanced</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Approval / Audit Info */}
          {(journal.approved_by || journal.posted_by || journal.submitted_by) && (
            <div className="grid grid-cols-3 gap-3 text-[10px] p-3 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              {journal.submitted_by && <div><span className="text-muted">Submitted By:</span> <span className="text-primary">#{journal.submitted_by}</span></div>}
              {journal.approved_by && <div><span className="text-muted">Approved By:</span> <span className="text-primary">#{journal.approved_by}</span></div>}
              {journal.posted_by && <div><span className="text-muted">Posted By:</span> <span className="text-primary">#{journal.posted_by}</span></div>}
            </div>
          )}

          {/* Attachments */}
          <AttachmentPanel module="finance" recordId={journal.id} />
        </div>
      ) : (
        <div className="flex flex-col items-center py-12 text-muted"><X size={24} className="mb-2 opacity-50" /><p className="text-sm">Journal not found</p></div>
      )}
    </AppDialog>
  );
}
