import { Inbox, Send, FileText, Trash2, Settings, Mail } from "lucide-react";
import type { EmailAccount, MailboxStats } from "../../store/mail";

type Props = {
  accounts: EmailAccount[];
  activeFolder: string;
  stats: MailboxStats | null;
  onFolderChange: (folder: string) => void;
  onOpenSetup: () => void;
};

const FOLDERS = [
  { key: "inbox",  label: "Inbox",  icon: Inbox,    statKey: "inbox_unread" as const },
  { key: "sent",   label: "Sent",   icon: Send,     statKey: "sent_count" as const },
  { key: "drafts", label: "Drafts", icon: FileText,  statKey: "drafts_count" as const },
  { key: "trash",  label: "Trash",  icon: Trash2,   statKey: "trash_count" as const },
];

export default function MailSidebar({ accounts, activeFolder, stats, onFolderChange, onOpenSetup }: Props) {
  // Safety guard — ensure accounts is always an array
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  return (
    <aside className="w-48 shrink-0 flex flex-col border-r border-theme bg-sidebar overflow-y-auto">
      {/* Header */}
      <div className="h-12 flex items-center gap-2 px-4 border-b border-theme shrink-0">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
        >
          <Mail size={12} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-primary">Mail</span>
      </div>

      {/* Account selector */}
      {safeAccounts.length > 0 && (
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">Account</p>
          {safeAccounts.map((acc) => (
            <div key={acc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                {acc.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-primary truncate">{acc.display_name}</p>
                <p className="text-[10px] text-muted truncate">{acc.email_address}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Folders */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider px-2 mb-1.5">Folders</p>
        {FOLDERS.map(({ key, label, icon: Icon, statKey }) => {
          const count = stats?.[statKey] ?? 0;
          const isActive = activeFolder === key;
          return (
            <button
              key={key}
              onClick={() => onFolderChange(key)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-500/10 text-blue-500 font-medium"
                  : "text-muted hover:bg-hover hover:text-primary"
              }`}
            >
              <Icon size={15} />
              <span className="flex-1 text-left">{label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    key === "inbox" && count > 0
                      ? "bg-blue-500 text-white"
                      : "bg-hover text-muted"
                  }`}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="px-2 pb-3 border-t border-theme pt-2">
        <button
          onClick={onOpenSetup}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted hover:bg-hover hover:text-primary transition-colors"
        >
          <Settings size={15} />
          <span>Email Settings</span>
        </button>
      </div>
    </aside>
  );
}
