import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Template } from "../../lib/remindersApi";
import { remindersApi } from "../../lib/remindersApi";
import ConfirmDialog from "../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../store/notifications";

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [titleTemplate, setTitleTemplate] = useState("");
  const [descriptionTemplate, setDescriptionTemplate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [repeat, setRepeat] = useState("none");
  const [reminderBefore, setReminderBefore] = useState(0);
  const [saving, setSaving] = useState(false);
  const pushToast = useNotifStore((s) => s.pushToast);
  const [deleteTarget, setDeleteTarget] = useState<{ item: any; type?: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await remindersApi.getTemplates();
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !titleTemplate.trim()) return;
    setSaving(true);
    try {
      await remindersApi.createTemplate({
        name: name.trim(),
        title_template: titleTemplate.trim(),
        description_template: descriptionTemplate.trim() || undefined,
        priority,
        repeat,
        reminder_before: reminderBefore,
      });
      setName("");
      setTitleTemplate("");
      setDescriptionTemplate("");
      setPriority("medium");
      setRepeat("none");
      setReminderBefore(0);
      load();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteTarget({ item: id });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remindersApi.deleteTemplate(deleteTarget.item as number);
      pushToast({ title: "Template deleted", message: "Template has been deleted successfully", type: "success" });
      pushToast({ title: "Template created", message: "Template has been created successfully", type: "success" });
      load();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-theme bg-surface p-5">
        <p className="text-sm font-semibold text-primary mb-4">New Template</p>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Name *</label>
              <input
                required
                maxLength={120}
                className="input-field w-full text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Priority</label>
              <select className="input-field w-full text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Title Template *</label>
            <input
              required
              maxLength={200}
              className="input-field w-full text-sm font-mono"
              placeholder="e.g. Rent Due for {{tenant_name}}"
              value={titleTemplate}
              onChange={(e) => setTitleTemplate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Description Template</label>
            <textarea
              rows={2}
              className="input-field w-full text-sm font-mono resize-none"
              placeholder="e.g. Rent of {{amount}} is due on {{due_date}}"
              value={descriptionTemplate}
              onChange={(e) => setDescriptionTemplate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Repeat</label>
              <select className="input-field w-full text-sm" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Remind Before (mins)</label>
              <input type="number" min={0} max={10080} className="input-field w-full text-sm" value={reminderBefore} onChange={(e) => setReminderBefore(Number(e.target.value))} />
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary text-sm px-4 py-2">
            {saving ? "Saving..." : "Create Template"}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-muted">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted border border-dashed border-theme rounded-xl">No templates yet.</div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-start gap-3 p-4 rounded-xl border border-theme bg-surface">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">{t.name}</p>
                <p className="text-xs text-secondary mt-0.5 font-mono">{t.title_template}</p>
                {t.description_template && (
                  <p className="text-xs text-muted mt-0.5 line-clamp-1 font-mono">{t.description_template}</p>
                )}
                <div className="flex gap-3 mt-1 text-[10px] text-muted">
                  <span>Priority: {t.priority}</span>
                  <span>Repeat: {t.repeat}</span>
                  <span>Before: {t.reminder_before}m</span>
                </div>
              </div>
              <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded text-muted hover:text-red-400 transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Template"
        message="Delete this template?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
