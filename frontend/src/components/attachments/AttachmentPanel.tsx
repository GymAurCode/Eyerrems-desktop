import { useState, useEffect, useRef, useCallback } from "react";
import { Paperclip, Upload, Eye, Trash2, Printer, Loader2 } from "lucide-react";
import { attachmentApi, AttachmentItem } from "../../lib/attachmentApi";
import { getFileIcon, formatFileSize } from "../../utils/fileHelpers";
import AttachmentPreviewModal from "./AttachmentPreviewModal";
import ConfirmDialog from "../actions/ConfirmDialog";
import { useNotifStore } from "../../store/notifications";

interface Props {
  module: string;
  recordId: string | number;
  title?: string;
}

export default function AttachmentPanel({
  module,
  recordId,
  title = "Attachments",
}: Props) {
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AttachmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pushToast = useNotifStore((s) => s.pushToast);

  const fetchAttachments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await attachmentApi.list(module, recordId);
      setAttachments(data.data ?? []);
    } catch {
      pushToast({ title: "Error", message: "Failed to load attachments", priority: "high" });
    } finally {
      setLoading(false);
    }
  }, [module, recordId, pushToast]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxBytes = 20 * 1024 * 1024;

    for (const file of Array.from(files)) {
      if (file.size > maxBytes) {
        pushToast({
          title: "File too large",
          message: `${file.name} exceeds 20 MB limit`,
          priority: "high",
        });
        continue;
      }

      setUploading(file.name);
      setUploadProgress(0);

      try {
        await attachmentApi.upload(module, recordId, file, "", "PENDING", (pct) =>
          setUploadProgress(pct)
        );
        pushToast({
          title: "Uploaded",
          message: `${file.name} uploaded successfully`,
          priority: "low",
        });
      } catch {
        pushToast({
          title: "Upload failed",
          message: `Failed to upload ${file.name}`,
          priority: "high",
        });
      }
    }

    setUploading(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchAttachments();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await attachmentApi.remove(deleteTarget.id);
      setAttachments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      pushToast({
        title: "Deleted",
        message: `${deleteTarget.document_name} deleted`,
        priority: "low",
      });
    } catch {
      pushToast({
        title: "Error",
        message: "Failed to delete attachment",
        priority: "high",
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handlePrint = (att: AttachmentItem) => {
    const downloadUrl = attachmentApi.downloadUrl(att.id);
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.src = downloadUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.print();
      } catch {
        window.open(downloadUrl, "_blank");
      }
    };
    setTimeout(() => document.body.removeChild(iframe), 60000);
  };

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paperclip size={16} className="text-blue-400" />
          <h3 className="text-sm font-medium text-gray-200">{title}</h3>
          {!loading && (
            <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
              {attachments.length}
            </span>
          )}
        </div>

        {/* Upload button */}
        <label className="flex items-center gap-1.5 text-xs text-blue-400 cursor-pointer hover:text-blue-300 transition-colors">
          <Upload size={14} />
          Upload Files
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            onChange={handleFilesSelected}
          />
        </label>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="mb-3 bg-gray-800/60 rounded p-2.5">
          <div className="flex items-center gap-2 text-xs text-gray-300 mb-1">
            <Loader2 size={12} className="animate-spin" />
            Uploading {uploading}...
          </div>
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-4 text-gray-500 text-xs">
          <Loader2 size={14} className="animate-spin mr-2" />
          Loading attachments...
        </div>
      )}

      {/* Empty state */}
      {!loading && attachments.length === 0 && (
        <div className="text-center py-6 text-gray-500 text-xs border border-dashed border-gray-700 rounded-lg">
          No attachments yet. Click "Upload Files" to add.
        </div>
      )}

      {/* Attachments list */}
      {!loading && attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/40 hover:bg-gray-800/70 transition-colors group"
            >
              {/* File icon */}
              <span className="text-lg shrink-0">{getFileIcon(att.file_type)}</span>

              {/* File info */}
              <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{att.document_name}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(att.file_size_kb)} &middot;{" "}
                  {new Date(att.created_at).toLocaleDateString()}
                  {att.uploaded_by ? ` \u00B7 ${att.uploaded_by}` : ""}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setPreviewAttachment(att)}
                  className="p-1.5 rounded text-gray-400 hover:text-blue-400 hover:bg-gray-700 transition-colors"
                  title="View"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => handlePrint(att)}
                  className="p-1.5 rounded text-gray-400 hover:text-green-400 hover:bg-gray-700 transition-colors"
                  title="Print"
                >
                  <Printer size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(att)}
                  className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      <AttachmentPreviewModal
        open={!!previewAttachment}
        attachment={previewAttachment as any}
        attachments={attachments as any}
        onClose={() => setPreviewAttachment(null)}
        onNavigate={(a: any) => setPreviewAttachment(a)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Attachment"
        message={`Are you sure you want to delete "${deleteTarget?.document_name}"?`}
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
