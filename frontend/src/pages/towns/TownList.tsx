import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Building2, MapPin, Search } from "lucide-react";
import AttachmentsButton from "../../components/attachments/AttachmentsButton";
import { printRecord } from "../../components/actions";
import DataTable from "../../components/data-table/DataTable";
import type { TableColumn, TableAction } from "../../components/data-table/types";
import AppDialog from "../../components/ui/AppDialog";
import { FormField } from "../../components/crm/FormField";
import { townApi, Town } from "../../lib/townApi";
import ConfirmDialog from "../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../store/notifications";

// ── Status / count badge ──────────────────────────────────────────────────────

function CountBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center px-4 py-2 min-w-[72px]">
      <span className="text-lg font-bold text-primary">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}

// ── Town form modal ───────────────────────────────────────────────────────────

function TownFormModal({
  open, onClose, initial, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: Town | null;
  onSaved: () => void;
}) {
  const [name, setName]               = useState("");
  const [location, setLocation]       = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const pushToast = useNotifStore((s) => s.pushToast);

  // Sync form when modal opens
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setLocation(initial?.location ?? "");
      setDescription(initial?.description ?? "");
      setError("");
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      };
      if (initial?.id) {
        await townApi.updateTown(initial.id, payload);
        pushToast({ title: "Town updated", message: `"${name.trim()}" has been updated.`, type: "success" });
      } else {
        await townApi.createTown(payload);
        pushToast({ title: "Town created", message: `"${name.trim()}" has been created.`, type: "success" });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to save town");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog
      isOpen={open}
      onClose={onClose}
      title={initial?.id ? "Edit Town" : "New Town"}
    >
      <div className="space-y-4">
        {error && (
          <p className="text-xs text-red-400 px-3 py-2 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)" }}>
            {error}
          </p>
        )}

        <FormField label="Town / Society Name" required>
          <input
            className="input-dark w-full px-3 py-2.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. DHA Phase 6"
            autoFocus
          />
        </FormField>

        <FormField label="Location">
          <input
            className="input-dark w-full px-3 py-2.5 text-sm"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Lahore, Punjab"
          />
        </FormField>

        <FormField label="Description">
          <textarea
            className="input-dark w-full px-3 py-2.5 text-sm resize-none"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description…"
          />
        </FormField>

        <div className="flex items-center gap-3">
          <AttachmentsButton module="town" recordId={initial?.id} />
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 py-3 text-sm"
          >
            {saving ? "Saving…" : initial?.id ? "Update Town" : "Create Town"}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({
  open, onClose, town, onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  town: Town | null;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const pushToast = useNotifStore((s) => s.pushToast);

  const handleDelete = async () => {
    if (!town) return;
    setDeleting(true);
    try {
      await townApi.deleteTown(town.id);
      pushToast({ title: "Town deleted", message: `"${town.name}" has been deleted.`, type: "success" });
      onDeleted();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppDialog isOpen={open} onClose={onClose} title="Delete Town">
      <div className="space-y-4">
        <p className="text-sm text-secondary">
          This will permanently delete{" "}
          <strong className="text-primary">{town?.name}</strong> and all its
          blocks and plots. This action cannot be undone.
        </p>
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
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-2.5 text-sm rounded-xl font-medium transition-colors"
            style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            {deleting ? "Deleting…" : "Delete Town"}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TownList() {
  const navigate = useNavigate();
  const [towns, setTowns]     = useState<Town[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  const [formOpen, setFormOpen]   = useState(false);
  const [editTown, setEditTown]   = useState<Town | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTown, setDeleteTown] = useState<Town | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);
  const [deleteTarget, setDeleteTarget] = useState<{ item: any; type?: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await townApi.listTowns();
      setTowns(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = (towns || []).filter(
    (t) =>
      t && t.name && (
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.location ?? "").toLowerCase().includes(search.toLowerCase())
      )
  );

  const openCreate = () => { setEditTown(null); setFormOpen(true); };
  const openEdit   = (t: Town) => { setEditTown(t); setFormOpen(true); };
  const openDelete = (t: Town) => { setDeleteTown(t); setDeleteOpen(true); };

  const handleDeleteTown = (town: Town) => {
    setDeleteTarget({ item: town });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await townApi.deleteTown(deleteTarget.item.id);
      pushToast({ title: "Town deleted", message: `"${deleteTarget.item.name}" has been deleted.`, type: "success" });
      setDeleteTarget(null);
      await load();
    } catch {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Town Management</h1>
          <p className="text-xs text-muted mt-0.5">
            {(towns || []).length} town{(towns || []).length !== 1 ? "s" : ""} ·{" "}
            {(towns || []).reduce((s, t) => s + (t.block_count || 0), 0)} blocks ·{" "}
            {(towns || []).reduce((s, t) => s + (t.plot_count || 0), 0)} plots
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          <Plus size={15} /> New Town
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search towns…"
            className="input-dark pl-8 pr-3 py-2 text-sm w-56"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={filtered}
        columns={[
          { key: 'tid', label: 'TID', render: (v) => <span className="font-mono text-xs text-blue-400">{v}</span> },
          { key: 'name', label: 'Name', render: (v) => <span className="font-medium text-primary">{v}</span> },
          { key: 'location', label: 'Location', render: (v) => v ? <span className="flex items-center gap-1.5"><MapPin size={11} style={{ color: "var(--text-muted)" }} />{v as string}</span> : "—" },
          { key: 'block_count', label: 'Blocks', render: (v) => <span className="text-secondary">{v}</span> },
          { key: 'plot_count', label: 'Plots', render: (v) => <span className="text-secondary">{v}</span> },
        ]}
        loading={loading}
        searchable={false}
        hoverable
        emptyTitle={search ? "No towns match your search." : "No towns yet."}
        emptyIcon={Building2}
        onView={(t) => navigate(`/towns/${t.id}`)}
        onEdit={openEdit}
        onDelete={handleDeleteTown}
        onPrint={(t) => printRecord(`Town ${t.tid}`, [
          { label: "Name", value: t.name },
          { label: "Location", value: t.location ?? "—" },
          { label: "Blocks", value: String(t.block_count) },
          { label: "Plots", value: String(t.plot_count) },
        ])}
      />

      {/* Modals */}
      <TownFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editTown}
        onSaved={load}
      />
      <DeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        town={deleteTown}
        onDeleted={load}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Town"
        message={`Permanently delete "${deleteTarget?.item?.name}" and all its blocks and plots? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
