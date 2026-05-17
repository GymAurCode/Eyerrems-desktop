import { useRef, useState } from "react";
import { X, Paperclip, Send, Bold, Italic, Underline, List, AlignLeft, Minus } from "lucide-react";
import { api } from "../../lib/api";
import type { EmailAccount, EmailDetail } from "../../store/mail";

type Props = {
  accounts: EmailAccount[];
  defaultAccountId?: number;
  replyTo?: EmailDetail;
  onClose: () => void;
  onSent: () => void;
};

type AttachmentFile = { file: File; id: string };

export default function ComposeModal({ accounts, defaultAccountId, replyTo, onClose, onSent }: Props) {
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const [accountId, setAccountId] = useState(defaultAccountId ?? safeAccounts[0]?.id ?? 0);
  const [to, setTo] = useState(
    replyTo ? replyTo.from_address : ""
  );
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(
    replyTo ? `Re: ${replyTo.subject}` : ""
  );
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [
      ...prev,
      ...files.map((f) => ({ file: f, id: Math.random().toString(36).slice(2) })),
    ]);
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = async () => {
    if (!to.trim()) { setError("Recipient (To) is required"); return; }
    if (!subject.trim()) { setError("Subject is required"); return; }

    // Check if account is verified
    const selectedAccount = safeAccounts.find(a => a.id === accountId);
    if (selectedAccount && !selectedAccount.is_verified) {
      setError("This email account is not verified. Please go to Email Settings and verify it first.");
      return;
    }

    const bodyHtml = editorRef.current?.innerHTML || "";
    const bodyText = editorRef.current?.innerText || "";

    const toList = to.split(",").map((s) => s.trim()).filter(Boolean);
    const ccList = cc.split(",").map((s) => s.trim()).filter(Boolean);
    const bccList = bcc.split(",").map((s) => s.trim()).filter(Boolean);

    const formData = new FormData();
    formData.append("account_id", String(accountId));
    formData.append("to_addresses", JSON.stringify(toList));
    formData.append("cc_addresses", JSON.stringify(ccList));
    formData.append("bcc_addresses", JSON.stringify(bccList));
    formData.append("subject", subject);
    formData.append("body_html", bodyHtml);
    formData.append("body_text", bodyText);
    if (replyTo) formData.append("reply_to_email_id", String(replyTo.id));
    attachments.forEach((a) => formData.append("files", a.file));

    setSending(true);
    setError(null);
    try {
      await api.post("/mail/send", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSent();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e?.response?.data?.detail || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    const bodyHtml = editorRef.current?.innerHTML || "";
    const bodyText = editorRef.current?.innerText || "";
    const toList = to.split(",").map((s) => s.trim()).filter(Boolean);
    const ccList = cc.split(",").map((s) => s.trim()).filter(Boolean);

    setSavingDraft(true);
    try {
      await api.post("/mail/drafts", {
        account_id: accountId,
        to_addresses: toList,
        cc_addresses: ccList,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
      });
      onClose();
    } catch {
      // silently fail draft save
    } finally {
      setSavingDraft(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-2xl rounded-xl shadow-2xl border border-theme bg-base flex flex-col"
        style={{ maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
          <h2 className="text-sm font-semibold text-primary">
            {replyTo ? "Reply" : "New Message"}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="text-xs text-muted hover:text-primary px-2 py-1 rounded hover:bg-hover transition-colors disabled:opacity-50"
            >
              {savingDraft ? "Saving…" : "Save Draft"}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-hover text-muted hover:text-primary transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Form fields */}
        <div className="flex flex-col overflow-y-auto flex-1">
          {/* Account selector */}
          {safeAccounts.length > 1 && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-theme">
              <span className="text-xs text-muted w-12 shrink-0">From</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(Number(e.target.value))}
                className="flex-1 text-xs bg-transparent text-primary focus:outline-none"
              >
                {safeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name} &lt;{a.email_address}&gt;
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* To */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-theme">
            <span className="text-xs text-muted w-12 shrink-0">To</span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com, another@example.com"
              className="flex-1 text-xs bg-transparent text-primary placeholder:text-muted focus:outline-none"
            />
            <button
              onClick={() => setShowCcBcc(!showCcBcc)}
              className="text-[10px] text-muted hover:text-primary transition-colors"
            >
              CC/BCC
            </button>
          </div>

          {/* CC / BCC */}
          {showCcBcc && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-theme">
                <span className="text-xs text-muted w-12 shrink-0">CC</span>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                  className="flex-1 text-xs bg-transparent text-primary placeholder:text-muted focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-theme">
                <span className="text-xs text-muted w-12 shrink-0">BCC</span>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com"
                  className="flex-1 text-xs bg-transparent text-primary placeholder:text-muted focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-theme">
            <span className="text-xs text-muted w-12 shrink-0">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="flex-1 text-xs bg-transparent text-primary placeholder:text-muted focus:outline-none"
            />
          </div>

          {/* Formatting toolbar */}
          <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-theme">
            {[
              { icon: Bold, cmd: "bold", title: "Bold" },
              { icon: Italic, cmd: "italic", title: "Italic" },
              { icon: Underline, cmd: "underline", title: "Underline" },
            ].map(({ icon: Icon, cmd, title }) => (
              <button
                key={cmd}
                onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }}
                title={title}
                className="p-1.5 rounded hover:bg-hover text-muted hover:text-primary transition-colors"
              >
                <Icon size={13} />
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onMouseDown={(e) => { e.preventDefault(); execCmd("insertUnorderedList"); }}
              title="Bullet list"
              className="p-1.5 rounded hover:bg-hover text-muted hover:text-primary transition-colors"
            >
              <List size={13} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); execCmd("justifyLeft"); }}
              title="Align left"
              className="p-1.5 rounded hover:bg-hover text-muted hover:text-primary transition-colors"
            >
              <AlignLeft size={13} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); execCmd("insertHorizontalRule"); }}
              title="Horizontal rule"
              className="p-1.5 rounded hover:bg-hover text-muted hover:text-primary transition-colors"
            >
              <Minus size={13} />
            </button>
          </div>

          {/* Body editor */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="flex-1 min-h-[200px] px-4 py-3 text-sm text-primary focus:outline-none"
            style={{ lineHeight: "1.6" }}
            data-placeholder="Write your message…"
            onInput={() => {}}
          />

          {/* Attachments list */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 py-2 border-t border-theme">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-theme text-xs bg-hover"
                >
                  <Paperclip size={11} className="text-muted" />
                  <span className="text-secondary">{a.file.name}</span>
                  <span className="text-muted">{formatBytes(a.file.size)}</span>
                  <button
                    onClick={() => removeAttachment(a.id)}
                    className="ml-1 text-muted hover:text-red-500 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-theme shrink-0">
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-opacity"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
          >
            <Send size={14} />
            {sending ? "Sending…" : "Send"}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted hover:text-primary hover:bg-hover border border-theme transition-colors"
          >
            <Paperclip size={14} />
            Attach
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleAttach}
          />
        </div>
      </div>

      {/* Placeholder style */}
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: var(--muted, #9ca3af);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
