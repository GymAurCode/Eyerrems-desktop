import { X, Bell, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { useNotifStore } from "../../store/notifications";

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "border-red-500/60 bg-red-500/10",
  high:   "border-orange-500/60 bg-orange-500/10",
  medium: "border-blue-500/60 bg-blue-500/10",
  low:    "border-gray-500/40 bg-gray-500/10",
};

const PRIORITY_ICONS: Record<string, React.ReactNode> = {
  urgent: <AlertCircle size={16} className="text-red-400 shrink-0" />,
  high:   <AlertTriangle size={16} className="text-orange-400 shrink-0" />,
  medium: <Bell size={16} className="text-blue-400 shrink-0" />,
  low:    <Info size={16} className="text-gray-400 shrink-0" />,
};

export default function ToastContainer() {
  const toasts = useNotifStore((s) => s.toasts);
  const dismiss = useNotifStore((s) => s.dismissToast);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-xl backdrop-blur-sm
            animate-slide-in ${PRIORITY_STYLES[t.priority] ?? PRIORITY_STYLES.medium}`}
        >
          {PRIORITY_ICONS[t.priority] ?? PRIORITY_ICONS.medium}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{t.title}</p>
            <p className="text-xs text-secondary mt-0.5">{t.message}</p>
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 text-muted hover:text-primary transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
