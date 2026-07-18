import { useEffect, useRef } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useNotifStore, type ToastType } from "../../store/notifications";

const TYPE_CONFIG: Record<ToastType, { icon: React.ReactNode; accent: string }> = {
  success: {
    icon: <CheckCircle size={18} className="shrink-0" style={{ color: "#10b981" }} />,
    accent: "#10b981",
  },
  error: {
    icon: <AlertCircle size={18} className="shrink-0" style={{ color: "#ef4444" }} />,
    accent: "#ef4444",
  },
  warning: {
    icon: <AlertTriangle size={18} className="shrink-0" style={{ color: "#f59e0b" }} />,
    accent: "#f59e0b",
  },
  info: {
    icon: <Info size={18} className="shrink-0" style={{ color: "#3b82f6" }} />,
    accent: "#3b82f6",
  },
};

export default function ToastContainer() {
  const toasts = useNotifStore((s) => s.toasts);
  const dismiss = useNotifStore((s) => s.dismissToast);
  const pause = useNotifStore((s) => s.pauseToast);
  const resume = useNotifStore((s) => s.resumeToast);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 w-full pointer-events-none"
      style={{ maxWidth: "min(400px, calc(100vw - 32px))" }}
      role="log"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const config = TYPE_CONFIG[t.type] ?? TYPE_CONFIG.info;
        return (
          <ToastItem
            key={t.id}
            id={t.id}
            config={config}
            title={t.title}
            message={t.message}
            onDismiss={dismiss}
            onPause={pause}
            onResume={resume}
          />
        );
      })}
    </div>
  );
}

function ToastItem({
  id, config, title, message, onDismiss, onPause, onResume,
}: {
  id: string;
  config: { icon: React.ReactNode; accent: string };
  title: string;
  message: string;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-auto overflow-hidden animate-slide-up"
      onMouseEnter={() => onPause(id)}
      onMouseLeave={() => onResume(id)}
      role="alert"
      aria-live="assertive"
    >
      <div
        style={{
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}
        className="flex items-start gap-3 px-4 py-3.5"
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${config.accent}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {config.icon}
        </div>

        <div className="flex-1 min-w-0" style={{ marginTop: 1 }}>
          <p
            className="text-sm font-semibold truncate"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            {title}
          </p>
          {message && (
            <p
              className="text-xs mt-0.5 leading-relaxed"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              {message}
            </p>
          )}
        </div>

        <button
          onClick={() => onDismiss(id)}
          className="shrink-0 rounded-lg p-1 transition-all duration-150 hover:bg-white/10 active:scale-90"
          style={{ color: "rgba(255,255,255,0.4)" }}
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>

      <div
        style={{
          height: 2,
          background: "rgba(255,255,255,0.06)",
          borderRadius: "0 0 18px 18px",
          marginTop: -2,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          className="toast-progress-bar"
          style={{
            height: "100%",
            background: config.accent,
            borderRadius: "0 0 18px 18px",
            width: "100%",
            animation: "toastProgress 3s linear forwards",
            transformOrigin: "left center",
          }}
        />
      </div>
    </div>
  );
}
