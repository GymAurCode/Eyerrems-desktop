import { Paperclip } from "lucide-react";
import type { EmailListItem } from "../../store/mail";

type Props = {
  emails: EmailListItem[];
  loading: boolean;
  selectedId: number | null;
  activeFolder: string;
  onSelect: (id: number) => void;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function getSenderDisplay(email: EmailListItem, folder: string): string {
  if (folder === "sent" || folder === "drafts") {
    try {
      const to = JSON.parse(email.to_addresses) as string[];
      return to.length > 0 ? `To: ${to[0]}` : "No recipient";
    } catch {
      return email.to_addresses;
    }
  }
  return email.from_name || email.from_address;
}

export default function EmailList({ emails, loading, selectedId, activeFolder, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6 py-12">
        <p className="text-sm font-medium text-primary">No emails</p>
        <p className="text-xs text-muted">This folder is empty</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {emails.map((email) => {
        const isSelected = email.id === selectedId;
        const sender = getSenderDisplay(email, activeFolder);

        return (
          <button
            key={email.id}
            onClick={() => onSelect(email.id)}
            className={`w-full text-left px-3 py-3 border-b border-theme transition-colors ${
              isSelected
                ? "bg-blue-500/10 border-l-2 border-l-blue-500"
                : "hover:bg-hover"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {/* Unread dot */}
              <div className="mt-1.5 shrink-0">
                {!email.is_read ? (
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                ) : (
                  <div className="w-2 h-2" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* Row 1: sender + time */}
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className={`text-xs truncate ${
                      !email.is_read ? "font-semibold text-primary" : "font-medium text-secondary"
                    }`}
                  >
                    {sender}
                  </span>
                  <span className="text-[10px] text-muted shrink-0">{formatDate(email.date)}</span>
                </div>

                {/* Row 2: subject */}
                <p
                  className={`text-xs truncate mb-0.5 ${
                    !email.is_read ? "font-medium text-primary" : "text-secondary"
                  }`}
                >
                  {email.subject || "(no subject)"}
                </p>

                {/* Row 3: preview + attachment icon */}
                <div className="flex items-center gap-1">
                  <p className="text-[11px] text-muted truncate flex-1">
                    {email.body_text?.replace(/\s+/g, " ").trim() || ""}
                  </p>
                  {email.attachment_count > 0 && (
                    <Paperclip size={11} className="text-muted shrink-0" />
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
