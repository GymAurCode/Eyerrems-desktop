import { X, Reply, Trash2, Paperclip, Star, MoreHorizontal } from "lucide-react";
import type { EmailDetail } from "../../store/mail";

type Props = {
  email: EmailDetail;
  accountId: number;
  onClose: () => void;
  onReply: () => void;
  onTrash: () => void;
};

function parseAddresses(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [json];
  }
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString([], {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EmailPreview({ email, onClose, onReply, onTrash }: Props) {
  const toList = parseAddresses(email.to_addresses);
  const ccList = parseAddresses(email.cc_addresses);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header toolbar */}
      <div className="h-12 flex items-center gap-2 px-4 border-b border-theme shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-hover text-muted hover:text-primary transition-colors"
          title="Close"
        >
          <X size={15} />
        </button>
        <div className="flex-1" />
        <button
          onClick={onReply}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-theme text-secondary hover:bg-hover transition-colors"
        >
          <Reply size={13} />
          Reply
        </button>
        <button
          onClick={onTrash}
          className="p-1.5 rounded-md hover:bg-hover text-muted hover:text-red-500 transition-colors"
          title="Move to trash"
        >
          <Trash2 size={15} />
        </button>
        <button
          className="p-1.5 rounded-md hover:bg-hover text-muted hover:text-yellow-500 transition-colors"
          title="Star"
        >
          <Star size={15} className={email.is_starred ? "fill-yellow-400 text-yellow-400" : ""} />
        </button>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Subject */}
        <h1 className="text-lg font-semibold text-primary mb-4 leading-snug">
          {email.subject || "(no subject)"}
        </h1>

        {/* Envelope */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {(email.from_name || email.from_address).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold text-primary">
                {email.from_name || email.from_address}
              </span>
              {email.from_name && (
                <span className="text-xs text-muted">&lt;{email.from_address}&gt;</span>
              )}
            </div>
            <div className="text-xs text-muted mt-0.5">
              <span>To: {toList.join(", ")}</span>
              {ccList.length > 0 && <span className="ml-2">CC: {ccList.join(", ")}</span>}
            </div>
            <div className="text-[11px] text-muted mt-0.5">{formatFullDate(email.date)}</div>
          </div>
        </div>

        {/* Attachments */}
        {email.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5 p-3 rounded-lg border border-theme bg-hover">
            {email.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-theme bg-base text-xs"
              >
                <Paperclip size={12} className="text-muted shrink-0" />
                <span className="text-secondary font-medium">{att.filename}</span>
                {att.size_bytes && (
                  <span className="text-muted">{formatBytes(att.size_bytes)}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="border-t border-theme pt-4">
          {email.body_html ? (
            <iframe
              srcDoc={email.body_html}
              className="w-full min-h-[400px] border-0 rounded-lg"
              sandbox="allow-same-origin"
              title="Email body"
              onLoad={(e) => {
                const iframe = e.currentTarget;
                try {
                  const height = iframe.contentDocument?.body?.scrollHeight;
                  if (height) iframe.style.height = `${height + 32}px`;
                } catch {
                  // cross-origin sandbox restriction — ignore
                }
              }}
            />
          ) : (
            <pre className="text-sm text-secondary whitespace-pre-wrap font-sans leading-relaxed">
              {email.body_text || "(empty)"}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
