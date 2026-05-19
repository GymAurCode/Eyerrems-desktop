
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  MapPin, Building2,
} from "lucide-react";
import { RowActions, QuickRowActions } from "../../components/actions";
import type { ActionConfig } from "../../components/actions";
import Modal from "../../components/Modal";
import { FormField } from "../../components/crm/FormField";
import { townApi, TownFull, Block, Plot, BlockWithPlots } from "../../lib/townApi";

// ── Status badge — matches CRM/HR pattern ─────────────────────────────────────

const PLOT_STATUS: Record<string, [string, string]> = {
  available: ["rgba(16,185,129,0.12)",  "#10b981"],
  booked:    ["rgba(245,158,11,0.12)",  "#f59e0b"],
  sold:      ["rgba(239,68,68,0.12)",   "#ef4444"],
  reserved:  ["rgba(139,92,246,0.12)",  "#8b5cf6"],
};

function PlotStatusBadge({ status }: { status: string }) {
  const [bg, color] = PLOT_STATUS[status] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
      style={{ background: bg, color }}
    >
      {status}
    </span>
  );
}

const BLOCK_TYPE_COLORS: Record<string, [string, string]> = {
  residential: ["rgba(59,130,246,0.12)",  "#3b82f6"],
  commercial:  ["rgba(245,158,11,0.12)",  "#f59e0b"],
  mixed:       ["rgba(139,92,246,0.12)",  "#8b5cf6"],
  industrial:  ["rgba(148,163,184,0.1)",  "#94a3b8"],
};

function BlockTypeBadge({ type }: { type: string }) {
  const [bg, color] = BLOCK_TYPE_COLORS[type] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
      style={{ background: bg, color }}
    >
      {type}
    </span>
  );
}

// ── Block form modal ──────────────────────────────────────────────────────────

function BlockFormModal({
  open, onClose, initial, townId, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: Block | null;
  townId: number;
  onSaved: () => void;
}) {
  const [name, setName]         = useState("");
  const [blockType, setType]    = useState("residential");
  const [description, setDesc]  = useState("");
  const [progress, setProgress] = useState(0);
  const [workType, setWorkType] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setType(initial?.block_type ?? "residential");
      setDesc(initial?.description ?? "");
      setProgress(initial?.progress_percentage ?? 0);
      setWorkType(initial?.work_type ?? "");
      setError("");
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        town_id: townId,
        name: name.trim(),
        block_type: blockType,
        description: description.trim() || undefined,
        progress_percentage: Number(progress),
        work_type: workType.trim() || undefined,
      };
      if (initial?.id) {
        await townApi.updateBlock(initial.id, payload);
      } else {
        await townApi.createBlock(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to save block");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? "Edit Block" : "New Block"}>
      <div className="space-y-4">
        {error && (
          <p className="text-xs text-red-400 px-3 py-2 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)" }}>
            {error}
          </p>
        )}

        <FormField label="Block / Phase Name" required>
          <input
            className="input-dark w-full px-3 py-2.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Block A, Phase 1"
            autoFocus
          />
        </FormField>

        <FormField label="Type">
          <select
            className="select-dark w-full px-3 py-2.5 text-sm"
            value={blockType}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="mixed">Mixed</option>
            <option value="industrial">Industrial</option>
          </select>
        </FormField>

        <FormField label={`Construction Progress — ${progress}%`}>
          <input
            type="range"
            min={0}
            max={100}
            className="w-full accent-blue-500"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />
        </FormField>

        <FormField label="Work Type">
          <input
            className="input-dark w-full px-3 py-2.5 text-sm"
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
            placeholder="e.g. road, sewerage, electricity"
          />
        </FormField>

        <FormField label="Description">
          <textarea
            className="input-dark w-full px-3 py-2.5 text-sm resize-none"
            rows={2}
            value={description}
            onChange={(e) => setDesc(e.target.value)}
          />
        </FormField>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full py-3 text-sm"
        >
          {saving ? "Saving…" : initial?.id ? "Update Block" : "Create Block"}
        </button>
      </div>
    </Modal>
  );
}

// ── Plot form modal ───────────────────────────────────────────────────────────

function PlotFormModal({
  open, onClose, initial, blockId, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: Plot | null;
  blockId: number;
  onSaved: () => void;
}) {
  const [plotNumber, setPlotNumber] = useState("");
  const [size, setSize]             = useState("");
  const [plotType, setPlotType]     = useState("");
  const [status, setStatus]         = useState("available");
  const [price, setPrice]           = useState("");
  const [ownerName, setOwnerName]   = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [notes, setNotes]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    if (open) {
      setPlotNumber(initial?.plot_number ?? "");
      setSize(initial?.size ?? "");
      setPlotType(initial?.plot_type ?? "");
      setStatus(initial?.status ?? "available");
      setPrice(initial?.price ?? "");
      setOwnerName(initial?.owner_name ?? "");
      setOwnerPhone(initial?.owner_phone ?? "");
      setNotes(initial?.notes ?? "");
      setError("");
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!plotNumber.trim()) { setError("Plot number is required"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        block_id: blockId,
        plot_number: plotNumber.trim(),
        size: size.trim() || undefined,
        plot_type: plotType.trim() || undefined,
        status,
        price: price || undefined,
        owner_name: ownerName.trim() || undefined,
        owner_phone: ownerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (initial?.id) {
        await townApi.updatePlot(initial.id, payload);
      } else {
        await townApi.createPlot(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to save plot");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? "Edit Plot" : "New Plot"}>
      <div className="space-y-4">
        {error && (
          <p className="text-xs text-red-400 px-3 py-2 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)" }}>
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Plot Number" required>
            <input
              className="input-dark w-full px-3 py-2.5 text-sm"
              value={plotNumber}
              onChange={(e) => setPlotNumber(e.target.value)}
              placeholder="e.g. 123"
              autoFocus
            />
          </FormField>
          <FormField label="Status">
            <select
              className="select-dark w-full px-3 py-2.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="available">Available</option>
              <option value="booked">Booked</option>
              <option value="sold">Sold</option>
              <option value="reserved">Reserved</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Size">
            <input
              className="input-dark w-full px-3 py-2.5 text-sm"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="e.g. 5 Marla"
            />
          </FormField>
          <FormField label="Plot Type">
            <input
              className="input-dark w-full px-3 py-2.5 text-sm"
              value={plotType}
              onChange={(e) => setPlotType(e.target.value)}
              placeholder="e.g. corner, regular"
            />
          </FormField>
        </div>

        <FormField label="Price (PKR)">
          <input
            type="number"
            className="input-dark w-full px-3 py-2.5 text-sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Owner Name">
            <input
              className="input-dark w-full px-3 py-2.5 text-sm"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </FormField>
          <FormField label="Owner Phone">
            <input
              className="input-dark w-full px-3 py-2.5 text-sm"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Notes">
          <textarea
            className="input-dark w-full px-3 py-2.5 text-sm resize-none"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full py-3 text-sm"
        >
          {saving ? "Saving…" : initial?.id ? "Update Plot" : "Create Plot"}
        </button>
      </div>
    </Modal>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function ConfirmDeleteModal({
  open, onClose, label, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const handle = async () => {
    setDeleting(true);
    try { await onConfirm(); onClose(); }
    finally { setDeleting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Confirm Delete">
      <div className="space-y-4">
        <p className="text-sm text-secondary">{label}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handle}
            disabled={deleting}
            className="flex-1 py-2.5 text-sm rounded-xl font-medium transition-colors"
            style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── BlockRow — expandable block with plots table ──────────────────────────────

function BlockRow({
  block,
  onEditBlock,
  onDeleteBlock,
  onAddPlot,
  onEditPlot,
  onDeletePlot,
}: {
  block: BlockWithPlots;
  onEditBlock: (b: Block) => void;
  onDeleteBlock: (b: Block) => void;
  onAddPlot: (blockId: number) => void;
  onEditPlot: (p: Plot) => void;
  onDeletePlot: (p: Plot) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <>
      {/* Block header row */}
      <tr
        className="row-hover cursor-pointer"
        style={{ borderBottom: expanded ? "none" : "1px solid var(--border-subtle)" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-5 py-3.5" colSpan={2}>
          <div className="flex items-center gap-2">
            <span className="text-muted">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            <span className="font-medium text-primary">{block.name}</span>
            <span className="font-mono text-xs text-blue-400">{block.tid}</span>
            <BlockTypeBadge type={block.block_type ?? "residential"} />
          </div>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div
              className="w-20 h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${block.progress_percentage}%`,
                  background: "linear-gradient(90deg,#3b82f6,#6366f1)",
                }}
              />
            </div>
            <span className="text-xs text-secondary">
              {block.progress_percentage.toFixed(0)}%
            </span>
          </div>
        </td>
        <td className="px-5 py-3.5 text-secondary">{block.plot_count}</td>
        <td className="px-5 py-3.5">
          <span style={{ color: "#10b981" }}>{block.available_plots}</span>
          {" / "}
          <span style={{ color: "#f59e0b" }}>{block.booked_plots}</span>
          {" / "}
          <span style={{ color: "#ef4444" }}>{block.sold_plots}</span>
        </td>
        <td className="px-5 py-3.5">
          <RowActions
            row={block}
            actions={[
              {
                type: "custom",
                label: "Add Plot",
                icon: Plus,
                color: "#10b981",
                tooltip: "Add new plot to this block",
                handler: (r) => onAddPlot(r.id),
                permission: "towns:manage",
              },
              {
                type: "edit",
                handler: (r) => onEditBlock(r),
                permission: "towns:manage",
              },
              {
                type: "delete",
                handler: (r) => onDeleteBlock(r),
                permission: "towns:manage",
                confirmMessage: `Are you sure you want to delete block "${block.name}"? All plots inside will also be deleted. This action cannot be undone.`,
              },
            ]}
            variant="icon-buttons"
            compact
          />
        </td>
      </tr>

      {/* Plots sub-table */}
      {expanded && (
        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <td colSpan={6} className="px-0 py-0">
            <div style={{ background: "var(--bg-surface2)", borderTop: "1px solid var(--border-subtle)" }}>
              {block.plots.length === 0 ? (
                <div className="px-10 py-5 text-xs text-secondary">
                  No plots yet.{" "}
                  <button
                    type="button"
                    onClick={() => onAddPlot(block.id)}
                    className="text-blue-400 hover:underline"
                  >
                    Add the first plot
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      {["Plot #", "Size", "Type", "Status", "Price", "Owner", "Actions"].map((h) => (
                        <th
                          key={h}
                          className={`text-left px-5 py-2 text-xs font-semibold text-muted uppercase tracking-wider ${h === "Actions" ? "text-right" : ""}`}
                          style={{ 
                            paddingLeft: h === "Plot #" ? "2.5rem" : undefined,
                            width: h === "Actions" ? "1%" : undefined
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.plots.map((plot) => (
                      <tr
                        key={plot.id}
                        className="row-hover"
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                      >
                        <td className="py-2.5 pl-10 pr-5 font-medium text-primary">
                          {plot.plot_number}
                        </td>
                        <td className="px-5 py-2.5 text-secondary">{plot.size ?? "—"}</td>
                        <td className="px-5 py-2.5 text-secondary">{plot.plot_type ?? "—"}</td>
                        <td className="px-5 py-2.5">
                          <PlotStatusBadge status={plot.status} />
                        </td>
                        <td className="px-5 py-2.5 text-secondary">
                          {plot.price
                            ? `PKR ${Number(plot.price).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-secondary">
                          {plot.owner_name ?? "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <QuickRowActions
                            row={plot}
                            onEdit={onEditPlot}
                            onDelete={onDeletePlot}
                            editPermission="towns:manage"
                            deletePermission="towns:manage"
                            deleteConfirmMessage={`Are you sure you want to delete plot #${plot.plot_number}? This action cannot be undone.`}
                            variant="icon-buttons"
                            compact
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TownDetail() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [town, setTown]     = useState<TownFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  // Block modal
  const [blockFormOpen, setBlockFormOpen] = useState(false);
  const [editBlock, setEditBlock]         = useState<Block | null>(null);

  // Plot modal
  const [plotFormOpen, setPlotFormOpen] = useState(false);
  const [editPlot, setEditPlot]         = useState<Plot | null>(null);
  const [plotBlockId, setPlotBlockId]   = useState(0);

  // Delete modals
  const [deleteBlockOpen, setDeleteBlockOpen] = useState(false);
  const [deleteBlock, setDeleteBlock]         = useState<Block | null>(null);
  const [deletePlotOpen, setDeletePlotOpen]   = useState(false);
  const [deletePlot, setDeletePlot]           = useState<Plot | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await townApi.getTownFull(Number(id), statusFilter || undefined);
      setTown(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, statusFilter]);

  const openAddBlock  = () => { setEditBlock(null); setBlockFormOpen(true); };
  const openEditBlock = (b: Block) => { setEditBlock(b); setBlockFormOpen(true); };
  const openAddPlot   = (blockId: number) => {
    setEditPlot(null); setPlotBlockId(blockId); setPlotFormOpen(true);
  };
  const openEditPlot  = (p: Plot) => {
    setEditPlot(p); setPlotBlockId(p.block_id); setPlotFormOpen(true);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-7 w-48 rounded-lg skeleton" />
        <div className="h-24 rounded-2xl skeleton" />
        <div className="h-64 rounded-2xl skeleton" />
      </div>
    );
  }

  if (!town) {
    return (
      <div className="p-6 text-center py-20">
        <Building2 size={32} className="text-muted mx-auto mb-3" />
        <p className="text-secondary text-sm">Town not found.</p>
        <button
          type="button"
          onClick={() => navigate("/towns")}
          className="btn-primary px-4 py-2 text-sm mt-4"
        >
          Back to Towns
        </button>
      </div>
    );
  }

  const totalPlots     = (town.blocks || []).reduce((s, b) => s + (b.plot_count || 0), 0);
  const availablePlots = (town.blocks || []).reduce((s, b) => s + (b.available_plots || 0), 0);
  const soldPlots      = (town.blocks || []).reduce((s, b) => s + (b.sold_plots || 0), 0);
  const bookedPlots    = (town.blocks || []).reduce((s, b) => s + (b.booked_plots || 0), 0);

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/towns")}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary">{town.name}</h1>
            <p className="text-xs text-muted mt-0.5 flex items-center gap-2">
              <span className="font-mono text-blue-400">{town.tid}</span>
              {town.location && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={10} /> {town.location}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openAddBlock}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          <Plus size={15} /> Add Block
        </button>
      </div>

      {/* Stat cards — matches HR/Finance pattern */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Blocks",    value: town.blocks.length, bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
          { label: "Plots",     value: totalPlots,         bg: "rgba(148,163,184,0.1)",  color: "#94a3b8" },
          { label: "Available", value: availablePlots,     bg: "rgba(16,185,129,0.12)",  color: "#10b981" },
          { label: "Sold",      value: soldPlots,          bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
        ].map(({ label, value, bg, color }) => (
          <div key={label} className="stat-card">
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: bg }}
              >
                <Building2 size={18} style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-primary mb-1">{value}</p>
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted">Filter plots:</span>
        {["", "available", "booked", "sold", "reserved"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              statusFilter === s
                ? "text-white"
                : "text-secondary"
            }`}
            style={
              statusFilter === s
                ? { background: "linear-gradient(135deg,#3b82f6,#6366f1)" }
                : { border: "1px solid var(--border)" }
            }
          >
            {s === "" ? "All" : s}
          </button>
        ))}
      </div>

      {/* Blocks + Plots table */}
      <div className="detail-container">
        {town.blocks.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 size={32} className="text-muted mx-auto mb-3" />
            <p className="text-secondary text-sm">No blocks yet.</p>
            <button
              type="button"
              onClick={openAddBlock}
              className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm mx-auto mt-4"
            >
              <Plus size={15} /> Add Block
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
                  {["Block", "", "Progress", "Plots", "Avail / Booked / Sold", ""].map((h, i) => (
                    <th
                      key={i}
                      className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(town.blocks || []).map((block) => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    onEditBlock={openEditBlock}
                    onDeleteBlock={(b) => { setDeleteBlock(b); setDeleteBlockOpen(true); }}
                    onAddPlot={openAddPlot}
                    onEditPlot={openEditPlot}
                    onDeletePlot={(p) => { setDeletePlot(p); setDeletePlotOpen(true); }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <BlockFormModal
        open={blockFormOpen}
        onClose={() => setBlockFormOpen(false)}
        initial={editBlock}
        townId={town.id}
        onSaved={load}
      />
      <PlotFormModal
        open={plotFormOpen}
        onClose={() => setPlotFormOpen(false)}
        initial={editPlot}
        blockId={plotBlockId}
        onSaved={load}
      />
      <ConfirmDeleteModal
        open={deleteBlockOpen}
        onClose={() => setDeleteBlockOpen(false)}
        label={`Delete block "${deleteBlock?.name}"? All plots inside will also be deleted. This cannot be undone.`}
        onConfirm={async () => {
          if (deleteBlock) await townApi.deleteBlock(deleteBlock.id);
          await load();
        }}
      />
      <ConfirmDeleteModal
        open={deletePlotOpen}
        onClose={() => setDeletePlotOpen(false)}
        label={`Delete plot #${deletePlot?.plot_number}? This cannot be undone.`}
        onConfirm={async () => {
          if (deletePlot) await townApi.deletePlot(deletePlot.id);
          await load();
        }}
      />
    </div>
  );
}
