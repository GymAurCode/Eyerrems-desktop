import { useEffect, useState } from "react";
import { useMailStore } from "../store/mail";
import { useAuthStore } from "../store/auth";
import MailSidebar from "../components/mail/MailSidebar";
import EmailList from "../components/mail/EmailList";
import EmailPreview from "../components/mail/EmailPreview";
import ComposeModal from "../components/mail/ComposeModal";
import AccountSetupModal from "../components/mail/AccountSetupModal";
import { PenSquare, RefreshCw, Settings } from "lucide-react";

export default function MailPage() {
  const {
    accounts,
    activeAccountId,
    activeFolder,
    emails,
    selectedEmail,
    stats,
    loading,
    syncing,
    fetchAccounts,
    fetchEmails,
    fetchStats,
    syncInbox,
    setActiveFolder,
    fetchEmail,
    clearSelectedEmail,
  } = useMailStore();

  const [composeOpen, setComposeOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  // Only fetch once the user is authenticated
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  // Load accounts — wait for both token AND user object to be ready
  useEffect(() => {
    if (token && user) {
      fetchAccounts().finally(() => setAccountsLoaded(true));
    }
  }, [token, user?.id]); // depend on user.id so it only re-runs when the actual user changes

  // When active account or folder changes, reload emails + stats
  useEffect(() => {
    if (activeAccountId) {
      fetchEmails(activeAccountId, activeFolder, search || undefined);
      fetchStats(activeAccountId);
    }
  }, [activeAccountId, activeFolder]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (activeAccountId) {
      fetchEmails(activeAccountId, activeFolder, q || undefined);
    }
  };

  const handleSync = async () => {
    if (!activeAccountId) return;
    const count = await syncInbox(activeAccountId);
    if (count > 0) {
      fetchEmails(activeAccountId, activeFolder);
      fetchStats(activeAccountId);
    }
  };

  const handleSelectEmail = (emailId: number) => {
    if (activeAccountId) fetchEmail(activeAccountId, emailId);
  };

  const noAccounts = accountsLoaded && accounts.length === 0;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-base">
      {/* Mail Sidebar */}
      <MailSidebar
        accounts={accounts}
        activeFolder={activeFolder}
        stats={stats}
        onFolderChange={(folder) => {
          setActiveFolder(folder);
          clearSelectedEmail();
        }}
        onOpenSetup={() => setSetupOpen(true)}
      />

      {/* Main area */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        {noAccounts ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              <PenSquare size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold text-primary">No email account configured</h2>
            <p className="text-muted text-sm max-w-xs">
              Connect your company email (Gmail, Outlook, or custom SMTP/IMAP) to start sending and receiving emails.
            </p>
            <button
              onClick={() => setSetupOpen(true)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
            >
              Configure Email Account
            </button>
          </div>
        ) : (
          <>
            {/* Email list panel */}
            <div className={`flex flex-col border-r border-theme ${selectedEmail ? "w-80 shrink-0" : "flex-1"}`}>
              {/* Toolbar */}
              <div className="h-12 flex items-center gap-2 px-3 border-b border-theme shrink-0">
                <button
                  onClick={() => setComposeOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
                >
                  <PenSquare size={13} />
                  Compose
                </button>
                <input
                  type="text"
                  placeholder="Search emails…"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="flex-1 h-7 px-2.5 rounded-md text-xs bg-hover border border-theme text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  title="Sync inbox"
                  className="p-1.5 rounded-md hover:bg-hover text-muted hover:text-primary transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => setSetupOpen(true)}
                  title="Email settings"
                  className="p-1.5 rounded-md hover:bg-hover text-muted hover:text-primary transition-colors"
                >
                  <Settings size={14} />
                </button>
              </div>

              {/* List */}
              <EmailList
                emails={emails}
                loading={loading}
                selectedId={selectedEmail?.id ?? null}
                onSelect={handleSelectEmail}
                activeFolder={activeFolder}
              />
            </div>

            {/* Preview panel */}
            {selectedEmail && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <EmailPreview
                  email={selectedEmail}
                  accountId={activeAccountId!}
                  onClose={clearSelectedEmail}
                  onReply={() => setComposeOpen(true)}
                  onTrash={() => {
                    if (activeAccountId) {
                      useMailStore.getState().moveToTrash(activeAccountId, [selectedEmail.id]);
                    }
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {composeOpen && (
        <ComposeModal
          accounts={accounts}
          defaultAccountId={activeAccountId ?? undefined}
          replyTo={selectedEmail ?? undefined}
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setComposeOpen(false);
            if (activeAccountId) {
              fetchEmails(activeAccountId, activeFolder);
              fetchStats(activeAccountId);
            }
          }}
        />
      )}

      {setupOpen && (
        <AccountSetupModal
          accounts={accounts}
          onClose={() => setSetupOpen(false)}
          onSaved={() => {
            setSetupOpen(false);
            fetchAccounts();
          }}
        />
      )}
    </div>
  );
}
