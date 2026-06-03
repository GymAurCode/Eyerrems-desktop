import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import {
  Brain, Shield, AlertTriangle, Users, Copy, Search,
  Activity, Zap, RefreshCw, CheckCircle, XCircle, Eye,
  Clock, Trash2, ChevronRight, BarChart2, MessageSquare,
  BookOpen, Play,
} from "lucide-react";
import {
  aiApi,
  type AIDashboardStats, type AIAnomaly, type AIAlert,
  type AIRiskScore, type AIDuplicateMatch, type AIInsight,
  type AIQueryLog, type NLQueryResult, type AuditMonitorResult,
} from "../lib/aiApi";
import { printRecord } from "../components/actions";
import { DataTable } from "../components/data-table";

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#f59e0b", LOW: "#10b981",
};
const SEV_BG: Record<string, string> = {
  CRITICAL: "rgba(239,68,68,0.12)", HIGH: "rgba(249,115,22,0.12)",
  MEDIUM: "rgba(245,158,11,0.12)", LOW: "rgba(16,185,129,0.12)",
};

function SeverityBadge({ level }: { level: string }) {
  const color = SEV_COLOR[level] ?? "#64748b";
  const bg = SEV_BG[level] ?? "rgba(100,116,139,0.12)";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
      style={{ color, background: bg, border: `1px solid ${color}33` }}>
      {level}
    </span>
  );
}

function RiskBar({ score }: { score: number }) {
  const color = score >= 76 ? "#ef4444" : score >= 51 ? "#f97316" : score >= 26 ? "#f59e0b" : "#10b981";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-mono font-semibold" style={{ color }}>{score.toFixed(0)}</span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number | string; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="card-dark rounded-2xl p-5 flex items-start gap-4" style={{ border: "1px solid var(--border)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-primary">{value}</p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
}

const TABS = [
  { key: "dashboard",  label: "Dashboard",    icon: BarChart2 },
  { key: "anomalies",  label: "Anomalies",     icon: AlertTriangle },
  { key: "alerts",     label: "Alerts",        icon: Zap },
  { key: "risk",       label: "Risk Scores",   icon: Shield },
  { key: "duplicates", label: "Duplicates",    icon: Copy },
  { key: "audit",      label: "Audit Monitor", icon: BookOpen },
  { key: "query",      label: "AI Query",      icon: MessageSquare },
  { key: "insights",   label: "Insights",      icon: Brain },
] as const;
type TabKey = typeof TABS[number]["key"];

function TrendChart({ data }: { data: AIDashboardStats["risk_trend"] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full rounded-sm" style={{
            height: `${Math.max(4, (d.total / max) * 52)}px`,
            background: d.critical > 0 ? "#ef4444" : d.high > 0 ? "#f97316" : d.medium > 0 ? "#f59e0b" : "#10b981",
            opacity: 0.8,
          }} />
          <span className="text-[8px] text-muted">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}
// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ stats, onRefresh, error }: { stats: AIDashboardStats | null; onRefresh: () => void; error?: string | null }) {
  const [scanning, setScanning] = useState(false);

  const runScan = async () => {
    setScanning(true);
    try { await aiApi.runScan("all"); onRefresh(); }
    catch { /* ignore */ }
    finally { setScanning(false); }
  };

  if (error) return <div className="p-10 text-center text-red-400 text-sm">{error}</div>;
  if (!stats) return <div className="p-10 text-center text-muted text-sm">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={runScan} disabled={scanning}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-50">
          {scanning ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={12} />}
          {scanning ? "Scanning..." : "Run AI Scan"}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Anomalies"    value={stats.total_anomalies}       icon={AlertTriangle} color="#f97316" sub={`${stats.unresolved_anomalies} unresolved`} />
        <StatCard label="Critical Alerts"    value={stats.critical_anomalies}    icon={Shield}        color="#ef4444" sub="Needs immediate attention" />
        <StatCard label="Unread Alerts"      value={stats.unread_alerts}         icon={Zap}           color="#f59e0b" sub={`${stats.total_alerts} total`} />
        <StatCard label="Duplicate Records"  value={stats.duplicate_matches}     icon={Copy}          color="#8b5cf6" sub="Pending review" />
        <StatCard label="High-Risk Users"    value={stats.high_risk_users}       icon={Users}         color="#ef4444" sub="HIGH or CRITICAL" />
        <StatCard label="Finance Deletions"  value={stats.deleted_finance_today} icon={Trash2}        color="#ef4444" sub="Today" />
        <StatCard label="After-Hours Events" value={stats.after_hours_today}     icon={Clock}         color="#f59e0b" sub="Today" />
        <StatCard label="High Anomalies"     value={stats.high_anomalies}        icon={Activity}      color="#f97316" sub="Unresolved" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-dark rounded-2xl p-5" style={{ border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">7-Day Risk Trend</p>
          <TrendChart data={stats.risk_trend} />
          <div className="flex gap-4 mt-3">
            {(["critical","high","medium","low"] as const).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: SEV_COLOR[s.toUpperCase()] }} />
                <span className="text-[10px] text-muted capitalize">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {stats.latest_insight && (
          <div className="card-dark rounded-2xl p-5" style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Brain size={14} className="text-blue-400" />
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Latest AI Insight</p>
              <span className="text-[10px] text-muted ml-auto">{stats.latest_insight.period_label}</span>
            </div>
            <p className="text-sm text-secondary leading-relaxed">{stats.latest_insight.summary_text}</p>
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                { label: "Anomalies",  val: stats.latest_insight.anomaly_count,   color: "#f97316" },
                { label: "Alerts",     val: stats.latest_insight.alert_count,     color: "#f59e0b" },
                { label: "Duplicates", val: stats.latest_insight.duplicate_count, color: "#8b5cf6" },
                { label: "High Risk",  val: stats.latest_insight.high_risk_count, color: "#ef4444" },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center p-2 rounded-xl" style={{ background: `${color}10` }}>
                  <p className="text-lg font-bold" style={{ color }}>{val}</p>
                  <p className="text-[9px] text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <Zap size={13} className="text-yellow-400" />
            <span className="text-xs font-semibold text-primary">Recent Alerts</span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {stats.recent_alerts.length === 0 && <p className="px-5 py-6 text-xs text-muted text-center">No active alerts</p>}
            {stats.recent_alerts.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: SEV_COLOR[a.severity] }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-primary truncate">{a.title}</p>
                  <p className="text-[10px] text-muted mt-0.5 truncate">{a.message}</p>
                </div>
                <SeverityBadge level={a.severity} />
              </div>
            ))}
          </div>
        </div>

        <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <AlertTriangle size={13} className="text-orange-400" />
            <span className="text-xs font-semibold text-primary">Recent Anomalies</span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {stats.recent_anomalies.length === 0 && <p className="px-5 py-6 text-xs text-muted text-center">No active anomalies</p>}
            {stats.recent_anomalies.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: SEV_COLOR[a.severity] }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-primary truncate">{a.anomaly_type.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{a.description}</p>
                </div>
                <span className="text-[10px] text-muted shrink-0">{a.risk_score.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
// ── Anomalies Tab ─────────────────────────────────────────────────────────────

function AnomaliesTab() {
  const [items, setItems] = useState<AIAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState("");
  const [resolved, setResolved] = useState<boolean | undefined>(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await aiApi.getAnomalies({ severity: severity || undefined, is_resolved: resolved, limit: 100 }));
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError("Access denied: No company context. Please contact your administrator.");
      } else {
        setError("Unable to load anomalies. Please try again later.");
      }
      setItems([]);
    } finally { setLoading(false); }
  }, [severity, resolved]);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (id: number) => { await aiApi.resolveAnomaly(id, true); void load(); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="input-dark px-3 py-1.5 text-xs rounded-lg">
          <option value="">All Severities</option>
          {["CRITICAL","HIGH","MEDIUM","LOW"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={String(resolved)} onChange={(e) => setResolved(e.target.value === "true" ? true : e.target.value === "false" ? false : undefined)} className="input-dark px-3 py-1.5 text-xs rounded-lg">
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
          <option value="undefined">All</option>
        </select>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-secondary hover:text-primary transition-colors" style={{ border: "1px solid var(--border)" }}>
          <RefreshCw size={11} /> Refresh
        </button>
        <span className="text-xs text-muted ml-auto">{items.length} records</span>
      </div>
      <DataTable
        data={items}
        loading={loading}
        columns={[
          { key: "anomaly_type", label: "Type", render: (val) => <span className="font-mono text-primary text-[10px]">{val.replace(/_/g," ")}</span> },
          { key: "severity", label: "Severity", render: (val) => <SeverityBadge level={val} /> },
          { key: "module", label: "Module", render: (val) => <span className="text-secondary">{val ?? "—"}</span> },
          { key: "description", label: "Description", render: (val) => <span className="text-secondary max-w-xs"><p className="truncate" title={val}>{val}</p></span> },
          { key: "risk_score", label: "Risk", render: (val, row) => <span className="font-mono font-semibold" style={{ color: SEV_COLOR[row.severity] }}>{val.toFixed(0)}</span> },
          { key: "user_id", label: "User", render: (val) => <span className="text-secondary">{val ? `#${val}` : "—"}</span> },
          { key: "created_at", label: "Time", render: (val) => <span className="text-muted whitespace-nowrap">{new Date(val).toLocaleString()}</span> },
        ]}
        onPrint={(row) => printRecord(`Anomaly #${row.id}`, [
          { label: "Type", value: row.anomaly_type },
          { label: "Severity", value: row.severity },
          { label: "Description", value: row.description },
        ])}
        onEdit={(row) => { if (!row.is_resolved) void resolve(row.id); }}
        variant="bordered"
        searchable={false}
        emptyTitle="No anomalies found"
        emptyIcon={CheckCircle}
        error={error ?? undefined}
      />
    </div>
  );
}

// ── Alerts Tab ────────────────────────────────────────────────────────────────

function AlertsTab() {
  const [items, setItems] = useState<AIAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await aiApi.getAlerts({ is_dismissed: false, limit: 100 })); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (id: number) => { await aiApi.updateAlert(id, { is_read: true }); void load(); };
  const dismiss  = async (id: number) => { await aiApi.updateAlert(id, { is_dismissed: true }); void load(); };
  const dismissAll = async () => { await aiApi.dismissAllAlerts(); void load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-secondary hover:text-primary transition-colors" style={{ border: "1px solid var(--border)" }}>
          <RefreshCw size={11} /> Refresh
        </button>
        {items.length > 0 && (
          <button onClick={dismissAll} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-muted hover:text-red-400 transition-colors" style={{ border: "1px solid var(--border)" }}>
            <XCircle size={11} /> Dismiss All
          </button>
        )}
      </div>
      <div className="space-y-2">
        {loading && <div className="p-10 text-center text-muted text-sm">Loading...</div>}
        {!loading && items.length === 0 && (
          <div className="card-dark rounded-2xl p-10 text-center" style={{ border: "1px solid var(--border)" }}>
            <CheckCircle size={28} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-secondary">No active alerts.</p>
          </div>
        )}
        {items.map((a) => (
          <div key={a.id} className="card-dark rounded-xl p-4 flex items-start gap-4 transition-all"
            style={{ border: `1px solid ${a.is_read ? "var(--border)" : SEV_COLOR[a.severity] + "44"}`, background: a.is_read ? undefined : SEV_BG[a.severity] }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: SEV_BG[a.severity] }}>
              <Zap size={14} style={{ color: SEV_COLOR[a.severity] }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-primary">{a.title}</p>
                <SeverityBadge level={a.severity} />
                {!a.is_read && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>NEW</span>}
              </div>
              <p className="text-xs text-secondary mt-1">{a.message}</p>
              <div className="flex items-center gap-3 mt-2">
                {a.module && <span className="text-[10px] text-muted">{a.module}</span>}
                <span className="text-[10px] text-muted">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {!a.is_read && <button onClick={() => void markRead(a.id)} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors" title="Mark read"><Eye size={12} /></button>}
              <button onClick={() => void dismiss(a.id)} className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Dismiss"><XCircle size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ── Risk Tab ──────────────────────────────────────────────────────────────────

function RiskTab() {
  const [items, setItems] = useState<AIRiskScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomp] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await aiApi.getRiskScores({ limit: 100 })); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const recompute = async () => {
    setRecomp(true);
    try { await aiApi.recomputeRisks(); void load(); }
    catch { /* ignore */ }
    finally { setRecomp(false); }
  };

  const filtered = filter ? items.filter((i) => i.risk_level === filter) : items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--border)" }}>
          {["","CRITICAL","HIGH","MEDIUM","LOW"].map((l) => (
            <button key={l} onClick={() => setFilter(l)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filter === l ? "text-white" : "text-secondary hover:text-primary"}`}
              style={filter === l ? { background: "linear-gradient(135deg,#3b82f6,#6366f1)" } : {}}>
              {l || "All"}
            </button>
          ))}
        </div>
        <button onClick={recompute} disabled={recomputing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-secondary hover:text-primary transition-colors ml-auto disabled:opacity-50"
          style={{ border: "1px solid var(--border)" }}>
          {recomputing ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <RefreshCw size={11} />}
          Recompute
        </button>
      </div>
      <DataTable
        data={filtered}
        loading={loading}
        columns={[
          { key: "subject_id", label: "Subject", render: (val) => <span className="font-semibold text-primary">#{val}</span> },
          { key: "subject_type", label: "Type", render: (val) => <span className="text-secondary capitalize">{val}</span> },
          { key: "risk_level", label: "Risk Level", render: (val) => <SeverityBadge level={val} /> },
          { key: "score", label: "Score", render: (val) => <RiskBar score={val} /> },
          { key: "last_computed", label: "Last Computed", render: (val) => <span className="text-muted whitespace-nowrap">{new Date(val).toLocaleString()}</span> },
        ]}
        onPrint={(row) => printRecord(`Risk #${row.subject_id}`, [
          { label: "Type", value: row.subject_type },
          { label: "Level", value: row.risk_level },
          { label: "Score", value: String(row.score) },
        ])}
        variant="bordered"
        searchable={false}
        emptyTitle="No risk scores found"
        emptyIcon={Shield}
      />
    </div>
  );
}

// ── Duplicates Tab ────────────────────────────────────────────────────────────

function DuplicatesTab() {
  const [items, setItems] = useState<AIDuplicateMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await aiApi.getDuplicates({ entity_type: typeFilter || undefined, limit: 100 })); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { void load(); }, [load]);

  const scan = async () => {
    setScanning(true);
    try { await aiApi.runScan("duplicates"); void load(); }
    catch { /* ignore */ }
    finally { setScanning(false); }
  };

  const review = async (id: number, status: "confirmed" | "dismissed") => {
    await aiApi.reviewDuplicate(id, status); void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-dark px-3 py-1.5 text-xs rounded-lg">
          <option value="">All Types</option>
          {["tenant","client","property"].map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <button onClick={scan} disabled={scanning} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs ml-auto disabled:opacity-50">
          {scanning ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={11} />}
          Scan Duplicates
        </button>
      </div>
      <DataTable
        data={items}
        loading={loading}
        columns={[
          { key: "entity_type", label: "Type", render: (val) => <span className="capitalize font-medium text-primary">{val}</span> },
          { key: "entity_id_a", label: "Record A", render: (val) => <span className="text-secondary">#{val}</span> },
          { key: "entity_id_b", label: "Record B", render: (val) => <span className="text-secondary">#{val}</span> },
          { key: "confidence", label: "Confidence", render: (val) => {
            const pct = Math.round(val * 100);
            const confColor = pct >= 90 ? "#ef4444" : pct >= 75 ? "#f97316" : "#f59e0b";
            return <span className="font-semibold font-mono" style={{ color: confColor }}>{pct}%</span>;
          }},
          { key: "match_fields", label: "Matched Fields", render: (val) => {
            let fields: string[] = [];
            try { fields = JSON.parse(val ?? "[]"); } catch { /* ignore */ }
            return <div className="flex gap-1 flex-wrap">{fields.map((f) => <span key={f} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>{f}</span>)}</div>;
          }},
          { key: "created_at", label: "Detected", render: (val) => <span className="text-muted whitespace-nowrap">{new Date(val).toLocaleDateString()}</span> },
          { key: "actions", label: "Actions", render: (val, row) => (
            <div className="flex items-center gap-1">
              <button onClick={() => review(row.id, "confirmed")} className="p-1.5 rounded hover:bg-green-500/10 text-muted hover:text-green-400" title="Confirm"><CheckCircle size={14} /></button>
              <button onClick={() => review(row.id, "dismissed")} className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-400" title="Dismiss"><XCircle size={14} /></button>
              <button onClick={() => printRecord(`Duplicate #${row.id}`, [
                { label: "Type", value: row.entity_type },
                { label: "Record A", value: `#${row.entity_id_a}` },
                { label: "Record B", value: `#${row.entity_id_b}` },
                { label: "Confidence", value: `${Math.round(row.confidence * 100)}%` },
              ])} className="p-1.5 rounded hover:bg-emerald-500/10 text-muted hover:text-emerald-400" title="Print"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg></button>
            </div>
          )},
        ]}
        variant="bordered"
        searchable={false}
        emptyTitle="No duplicate matches found"
        emptyIcon={Copy}
      />
    </div>
  );
}
// ── Audit Monitor Tab ─────────────────────────────────────────────────────────

function AuditMonitorTab() {
  const [data, setData] = useState<AuditMonitorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [action, setAction] = useState("");
  const [module, setModule] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await aiApi.getAuditMonitor({ days, action: action || undefined, module: module || undefined, limit: 100 })); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, [days, action, module]);

  useEffect(() => { void load(); }, [load]);

  const actionColor: Record<string, string> = {
    CREATE: "#10b981", UPDATE: "#3b82f6", DELETE: "#ef4444", LOGIN: "#8b5cf6", LOGIN_FAILED: "#f97316",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input-dark px-3 py-1.5 text-xs rounded-lg">
          {[1,3,7,14,30,90].map((d) => <option key={d} value={d}>Last {d} day{d !== 1 ? "s" : ""}</option>)}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="input-dark px-3 py-1.5 text-xs rounded-lg">
          <option value="">All Actions</option>
          {["CREATE","UPDATE","DELETE","LOGIN","LOGIN_FAILED"].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input value={module} onChange={(e) => setModule(e.target.value)} placeholder="Filter by module..." className="input-dark px-3 py-1.5 text-xs rounded-lg w-36" />
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-secondary hover:text-primary transition-colors" style={{ border: "1px solid var(--border)" }}>
          <RefreshCw size={11} /> Refresh
        </button>
        {data && <span className="text-xs text-muted ml-auto">{data.total} total entries</span>}
      </div>
      {data && Object.keys(data.breakdown).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.breakdown).map(([act, cnt]) => (
            <div key={act} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
              style={{ background: `${actionColor[act] ?? "#64748b"}15`, border: `1px solid ${actionColor[act] ?? "#64748b"}30` }}>
              <span className="font-semibold" style={{ color: actionColor[act] ?? "#64748b" }}>{act}</span>
              <span className="text-muted">{cnt}</span>
            </div>
          ))}
        </div>
      )}
      <DataTable
        data={data?.logs ?? []}
        loading={loading}
        columns={[
          { key: "created_at", label: "Time", render: (val) => <span className="text-muted whitespace-nowrap">{new Date(val).toLocaleString()}</span> },
          { key: "action", label: "Action", render: (val) => (
            <span className="font-semibold font-mono text-[10px] px-2 py-0.5 rounded"
              style={{ color: actionColor[val] ?? "#64748b", background: `${actionColor[val] ?? "#64748b"}15` }}>
              {val}
            </span>
          )},
          { key: "module", label: "Module", render: (val) => <span className="text-secondary">{val ?? "—"}</span> },
          { key: "entity_type", label: "Entity", render: (val, row) => <span className="text-secondary">{val ? `${val} #${row.entity_id ?? "?"}` : "—"}</span> },
          { key: "user_id", label: "User", render: (val) => <span className="text-secondary">{val ? `#${val}` : "—"}</span> },
          { key: "description", label: "Description", render: (val) => <span className="text-muted max-w-xs"><p className="truncate" title={val ?? ""}>{val ?? "—"}</p></span> },
          { key: "ip_address", label: "IP", render: (val) => <span className="text-muted font-mono text-[10px]">{val ?? "—"}</span> },
        ]}
        onPrint={(r) => printRecord(`Audit ${r.action}`, [
          { label: "Module", value: r.module ?? "—" },
          { label: "Description", value: r.description ?? "—" },
          { label: "Time", value: new Date(r.created_at).toLocaleString() },
        ])}
        variant="bordered"
        searchable={false}
        emptyTitle="No audit entries found"
        emptyIcon={BookOpen}
      />
    </div>
  );
}

// ── Query Tab ─────────────────────────────────────────────────────────────────

const EXAMPLE_QUERIES = [
  "Show suspicious transactions",
  "Show deleted finance entries",
  "Who edited most records this month?",
  "Show high-risk users",
  "Find duplicate tenants",
  "Total rent recovery last month",
  "Show anomalies detected today",
  "Show after-hours activity",
];

function QueryTab() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NLQueryResult | null>(null);
  const [logs, setLogs] = useState<AIQueryLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const loadLogs = async () => {
    try { setLogs(await aiApi.getQueryLogs({ limit: 20 })); } catch { /* ignore */ }
  };

  const submit = async () => {
    if (!input.trim()) return;
    setLoading(true); setResult(null);
    try {
      setResult(await aiApi.query(input.trim()));
      void loadLogs();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setResult({ intent: "ERROR", blocked: true, block_reason: err?.response?.data?.detail ?? "Query failed", results: [], summary: "Query failed.", count: 0 });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}>
        <Brain size={18} className="text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-primary">AI Natural Language Query</p>
          <p className="text-xs text-secondary mt-0.5">Ask questions in plain English. The system detects intent and executes safe, pre-approved queries only. Direct database access is never allowed.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !loading) void submit(); }}
          placeholder='Ask anything... e.g. "Show suspicious transactions"'
          className="input-dark flex-1 px-4 py-3 text-sm rounded-xl" />
        <button onClick={submit} disabled={loading || !input.trim()} className="btn-primary px-5 py-3 text-sm rounded-xl flex items-center gap-2 disabled:opacity-50">
          {loading ? <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={14} />}
          Ask
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((q) => (
          <button key={q} onClick={() => setInput(q)} className="text-[10px] px-2.5 py-1 rounded-full transition-colors text-secondary hover:text-primary" style={{ border: "1px solid var(--border)" }}>{q}</button>
        ))}
      </div>
      {result && (
        <div className="card-dark rounded-2xl overflow-hidden" style={{ border: `1px solid ${result.blocked ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}` }}>
          <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)", background: result.blocked ? "rgba(239,68,68,0.05)" : "rgba(16,185,129,0.05)" }}>
            {result.blocked ? <XCircle size={14} className="text-red-400" /> : <CheckCircle size={14} className="text-emerald-400" />}
            <span className="text-xs font-semibold text-primary">{result.blocked ? "Query Blocked" : `Intent: ${result.intent.replace(/_/g," ")}`}</span>
            {!result.blocked && <span className="text-[10px] text-muted ml-auto">{result.count} results · {result.execution_ms}ms</span>}
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <Brain size={13} className="text-indigo-400 mt-0.5 shrink-0" />
              <p className="text-sm text-secondary">{result.block_reason ?? result.summary}</p>
            </div>
            {!result.blocked && result.results.length > 0 && (() => {
              const cols = Object.keys(result.results[0]).map((k) => ({
                key: k,
                label: k.replace(/_/g, " "),
                render: (v: any) => <span className="truncate block" title={String(v ?? "")}>{String(v ?? "—")}</span>,
              }));
              return (
                <DataTable
                  data={result.results}
                  columns={cols}
                  variant="bordered"
                  searchable={false}
                  emptyTitle="No results"
                />
              );
            })()}
          </div>
        </div>
      )}
      <div>
        <button onClick={() => { setShowLogs(!showLogs); if (!showLogs) void loadLogs(); }} className="flex items-center gap-2 text-xs text-secondary hover:text-primary transition-colors">
          <ChevronRight size={12} className={`transition-transform ${showLogs ? "rotate-90" : ""}`} />
          Query History
        </button>
        {showLogs && (
          <div className="mt-3 card-dark rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {logs.length === 0 ? <p className="p-4 text-xs text-muted text-center">No query history.</p>
            : (
              <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {logs.map((l) => (
                  <div key={l.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary truncate">{l.raw_query}</p>
                      {l.result_summary && <p className="text-[10px] text-muted mt-0.5 truncate">{l.result_summary}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {l.was_blocked ? <span className="text-[9px] text-red-400">BLOCKED</span> : <span className="text-[9px] text-emerald-400">{l.detected_intent}</span>}
                      <span className="text-[9px] text-muted">{new Date(l.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
// ── Insights Tab ──────────────────────────────────────────────────────────────

function InsightsTab() {
  const [items, setItems] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGen] = useState(false);
  const [period, setPeriod] = useState<"daily"|"weekly"|"monthly">("daily");

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await aiApi.getInsights({ period_type: period, limit: 20 })); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    setGen(true);
    try { await aiApi.generateInsight(period); void load(); }
    catch { /* ignore */ }
    finally { setGen(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--border)" }}>
          {(["daily","weekly","monthly"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all capitalize ${period === p ? "text-white" : "text-secondary hover:text-primary"}`}
              style={period === p ? { background: "linear-gradient(135deg,#3b82f6,#6366f1)" } : {}}>
              {p}
            </button>
          ))}
        </div>
        <button onClick={generate} disabled={generating} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs ml-auto disabled:opacity-50">
          {generating ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Brain size={11} />}
          Generate Insight
        </button>
      </div>
      {loading ? <div className="p-10 text-center text-muted text-sm">Loading...</div>
      : items.length === 0 ? (
        <div className="card-dark rounded-2xl p-10 text-center" style={{ border: "1px solid var(--border)" }}>
          <Brain size={28} className="text-muted mx-auto mb-2" />
          <p className="text-sm text-secondary">No insights yet. Click "Generate Insight" to create one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((ins) => {
            let metrics: Record<string, number> = {};
            try { metrics = JSON.parse(ins.metrics ?? "{}"); } catch { /* ignore */ }
            return (
              <div key={ins.id} className="card-dark rounded-2xl p-5" style={{ border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                    <Brain size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary capitalize">{ins.period_type} Insight</p>
                    <p className="text-[10px] text-muted">{ins.period_label} · {new Date(ins.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-sm text-secondary leading-relaxed mb-4">{ins.summary_text}</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Anomalies",  val: ins.anomaly_count,   color: "#f97316" },
                    { label: "Alerts",     val: ins.alert_count,     color: "#f59e0b" },
                    { label: "Duplicates", val: ins.duplicate_count, color: "#8b5cf6" },
                    { label: "High Risk",  val: ins.high_risk_count, color: "#ef4444" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="text-center p-2.5 rounded-xl" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                      <p className="text-xl font-bold" style={{ color }}>{val}</p>
                      <p className="text-[9px] text-muted mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                {Object.keys(metrics).length > 0 && (
                  <div className="mt-3 pt-3 flex flex-wrap gap-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    {(["fin_edits","after_hours","deletes"] as const).map((k) => metrics[k] !== undefined && (
                      <div key={k} className="text-[10px] text-muted">
                        <span className="text-secondary font-medium">{k.replace(/_/g," ")}: </span>{metrics[k]}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AIIntelligencePage() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [stats, setStats] = useState<AIDashboardStats | null>(null);
  const [statsLoading, setSL] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setSL(true);
    setStatsError(null);
    try {
      setStats(await aiApi.getDashboard());
    } catch (err) {
      setStats(null);
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setStatsError("Access denied: No company context. Please contact your administrator.");
      } else {
        setStatsError("Unable to load the AI dashboard. Please try again later.");
      }
    } finally {
      setSL(false);
    }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">AI Intelligence Center</h1>
            <p className="text-xs text-muted mt-0.5">Anomaly detection · Risk scoring · Fraud monitoring · Smart insights</p>
          </div>
        </div>
        <button onClick={loadStats} disabled={statsLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-secondary hover:text-primary transition-colors disabled:opacity-50"
          style={{ border: "1px solid var(--border)" }}>
          <RefreshCw size={11} className={statsLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {stats && stats.unread_alerts > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <Zap size={14} className="text-red-400 shrink-0" />
          <p className="text-xs text-secondary flex-1">
            <span className="font-semibold text-red-400">{stats.unread_alerts} unread alert{stats.unread_alerts !== 1 ? "s" : ""}</span>{" "}require your attention.
          </p>
          <button onClick={() => setTab("alerts")} className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
            View <ChevronRight size={11} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--border)", border: "1px solid var(--border)" }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${tab === key ? "text-white" : "text-secondary hover:text-primary"}`}
            style={tab === key ? { background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 2px 10px rgba(99,102,241,0.3)" } : {}}>
            <Icon size={12} /> {label}
            {key === "alerts" && stats && stats.unread_alerts > 0 && (
              <span className="ml-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: "#ef4444", color: "#fff" }}>
                {stats.unread_alerts > 9 ? "9+" : stats.unread_alerts}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "dashboard"  && <DashboardTab stats={stats} onRefresh={loadStats} error={statsError} />}
      {tab === "anomalies"  && <AnomaliesTab />}
      {tab === "alerts"     && <AlertsTab />}
      {tab === "risk"       && <RiskTab />}
      {tab === "duplicates" && <DuplicatesTab />}
      {tab === "audit"      && <AuditMonitorTab />}
      {tab === "query"      && <QueryTab />}
      {tab === "insights"   && <InsightsTab />}
    </div>
  );
}