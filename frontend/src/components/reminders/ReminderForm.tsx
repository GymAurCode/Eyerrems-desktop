import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { remindersApi } from "../../lib/remindersApi";
import type { Reminder } from "../../lib/remindersApi";
import { useUIStore } from "../../store/ui";

const CATEGORIES = [
  { value: "", label: "None" },
  { value: "general", label: "General" },
  { value: "meeting", label: "Meeting" },
  { value: "task", label: "Task" },
  { value: "followup", label: "Follow-up" },
  { value: "deadline", label: "Deadline" },
  { value: "inventory", label: "Inventory" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const REPEATS = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const REMIND_BEFORE = [
  { value: 0, label: "At time" },
  { value: 5, label: "5 min before" },
  { value: 10, label: "10 min before" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hr before" },
  { value: 120, label: "2 hrs before" },
  { value: 1440, label: "1 day before" },
  { value: 10080, label: "1 week before" },
];

function toLocalDatetimeString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editReminder?: Reminder | null;
}

const TEAL = "#14B8A6";
const YELLOW = "#f6ce3a";

export default function ReminderForm({ open, onClose, onSaved, editReminder }: Props) {
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === "dark";
  const accent = isDark ? YELLOW : TEAL;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [priority, setPriority] = useState("medium");
  const [repeat, setRepeat] = useState("none");
  const [reminderBefore, setReminderBefore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (editReminder) {
        setTitle(editReminder.title);
        setDescription(editReminder.description || "");
        setCategory(editReminder.category || "");
        setRemindAt(toLocalDatetimeString(new Date(editReminder.remind_at)));
        setPriority(editReminder.priority);
        setRepeat(editReminder.repeat);
        setReminderBefore(editReminder.reminder_before);
      } else {
        const defaultTime = new Date(Date.now() + 3600000);
        setTitle("");
        setDescription("");
        setCategory("");
        setRemindAt(toLocalDatetimeString(defaultTime));
        setPriority("medium");
        setRepeat("none");
        setReminderBefore(0);
      }
      setError("");
    }
  }, [open, editReminder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    if (!remindAt) { setError("Date & time is required"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        remind_at: new Date(remindAt).toISOString(),
        priority,
        repeat,
        reminder_before: reminderBefore,
      };
      if (editReminder) {
        await remindersApi.updateReminder(editReminder.id, payload);
      } else {
        await remindersApi.createReminder(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save reminder");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="rounded-xl p-6 w-full max-w-lg shadow-2xl"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-primary">
            {editReminder ? "Edit Reminder" : "New Reminder"}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-primary">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1">Title *</label>
            <input
              required
              maxLength={200}
              className="input-field w-full text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Description</label>
            <textarea
              rows={2}
              className="input-field w-full text-sm resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Date & Time *</label>
              <input
                required
                type="datetime-local"
                className="input-field w-full text-sm"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Category</label>
              <select
                className="input-field w-full text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Priority</label>
              <select
                className="input-field w-full text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Repeat</label>
              <select
                className="input-field w-full text-sm"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              >
                {REPEATS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Remind Me</label>
            <select
              className="input-field w-full text-sm"
              value={reminderBefore}
              onChange={(e) => setReminderBefore(Number(e.target.value))}
            >
              {REMIND_BEFORE.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{
                background: isDark ? "rgba(246,206,58,0.15)" : accent,
                color: isDark ? YELLOW : "#fff",
                border: isDark ? "1px solid rgba(246,206,58,0.3)" : "none",
                backdropFilter: isDark ? "blur(6px)" : "none",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : editReminder ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
