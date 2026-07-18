import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  Paperclip,
  Upload,
  ExternalLink,
  Trash2,
  Loader2,
  File,
  FileText,
  Image,
  FileSpreadsheet,
  Cloud,
} from "lucide-react";
import { fileService } from "../../services/fileService";

const FILE_ICONS = {
  pdf: { icon: FileText, color: "#ef4444" },
  image: { icon: Image, color: "#3b82f6" },
  word: { icon: FileText, color: "#2563eb" },
  excel: { icon: FileSpreadsheet, color: "#22c55e" },
  document: { icon: File, color: "#6b7280" },
};

function getFileIconConfig(fileType) {
  const key = fileService.getFileIcon(fileType);
  return FILE_ICONS[key] || FILE_ICONS.document;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const FileUpload = forwardRef(function FileUpload({
  module,
  recordType,
  recordId,
  documentTypes = null,
  maxFiles = 10,
  disabled = false,
  compact = false,
  onUploadComplete = null,
}, ref) {
  const noRecordId = !recordId || String(recordId).trim() === "";
  const isEffectivelyDisabled = disabled;

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(
    documentTypes && documentTypes.length > 0 ? documentTypes[0] : null
  );
  const [confirmDelete, setConfirmDelete] = useState(null);
  const fileInputRef = useRef(null);
  const pendingQueueRef = useRef([]);

  useImperativeHandle(ref, () => ({
    getPendingFiles: () => pendingQueueRef.current,
    clearPending: () => { pendingQueueRef.current = []; },
  }), []);

  const fetchFiles = useCallback(async () => {
    if (noRecordId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await fileService.getFiles(module, recordType, recordId);
      setFiles(data.files || []);
    } catch (err) {
      console.error("[FileUpload] Failed to fetch files:", err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [module, recordType, recordId, noRecordId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isEffectivelyDisabled) setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (isEffectivelyDisabled) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFilePick = () => {
    if (!isEffectivelyDisabled) fileInputRef.current?.click();
  };

  const handleInputChange = (e) => {
    if (isEffectivelyDisabled) return;
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleFiles = async (newFiles) => {
    const remaining = maxFiles - files.length;
    const toUpload = newFiles.slice(0, remaining);

    for (const file of toUpload) {
      const tempId = `pending-${Date.now()}-${Math.random()}`;

      if (noRecordId) {
        pendingQueueRef.current.push({ file, documentType: selectedDocType });
        setFiles((prev) => [
          ...prev,
          {
            id: tempId,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            _originalFile: file,
            _pending: true,
            _queued: true,
            _progress: 0,
            _error: null,
          },
        ]);
        continue;
      }

      setFiles((prev) => [
        ...prev,
        {
          id: tempId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          _originalFile: file,
          _pending: true,
          _progress: 0,
          _error: null,
        },
      ]);

      setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));

      try {
        await fileService.uploadFile({
          file: file,
          module: module,
          recordType: recordType,
          recordId: recordId,
          documentType: selectedDocType,
          onProgress: (pct) => {
            setUploadProgress((prev) => ({ ...prev, [tempId]: pct }));
            setFiles((prev) =>
              prev.map((f) =>
                f.id === tempId ? { ...f, _progress: pct } : f
              )
            );
          },
        });

        setFiles((prev) => prev.filter((f) => f.id !== tempId));
        await fetchFiles();
        if (onUploadComplete) onUploadComplete();
      } catch (err) {
        setUploadErrors((prev) => ({ ...prev, [tempId]: err.message }));
        setFiles((prev) =>
          prev.map((f) =>
            f.id === tempId ? { ...f, _error: err.message, _pending: false } : f
          )
        );
      }
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await fileService.deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      setConfirmDelete(null);
    } catch {
      // silently fail
    }
  };

  const handleRetry = async (pendingFile) => {
    const file = pendingFile._originalFile;
    if (!file) return;

    setFiles((prev) =>
      prev.map((f) =>
        f.id === pendingFile.id
          ? { ...f, _pending: true, _error: null, _progress: 0 }
          : f
      )
    );

    try {
      await fileService.uploadFile({
        file: file,
        module: module,
        recordType: recordType,
        recordId: recordId,
        documentType: selectedDocType,
        onProgress: (pct) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === pendingFile.id ? { ...f, _progress: pct } : f
            )
          );
        },
      });

      setFiles((prev) => prev.filter((f) => f.id !== pendingFile.id));
      await fetchFiles();
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === pendingFile.id
            ? { ...f, _error: err.message, _pending: false }
            : f
        )
      );
    }
  };

  const removeQueued = (fileId) => {
    const idx = files.findIndex((f) => f.id === fileId);
    if (idx !== -1) {
      const removed = files[idx];
      pendingQueueRef.current = pendingQueueRef.current.filter(
        (entry) => entry.file !== removed._originalFile
      );
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  };

  const nonPendingFiles = files.filter((f) => !f._pending && !f._queued);
  const queuedFiles = files.filter((f) => f._queued);

  const uploadArea = (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleFilePick}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 ${
        dragOver
          ? "border-blue-500 bg-blue-500/5"
          : "border-[var(--border,#E2E8F0)] bg-[var(--bg-surface2,#F8FAFC)]"
      } ${isEffectivelyDisabled ? "opacity-50 cursor-not-allowed" : "hover:border-blue-400/50"}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
        onChange={handleInputChange}
        disabled={isEffectivelyDisabled}
      />
      <div className="flex flex-col items-center justify-center py-6 px-4">
        <Cloud size={32} className="mb-2 text-[var(--text-muted,#6b7280)]" />
        <p className="text-sm font-medium text-[var(--text-primary,#e0e0e0)]">
          {noRecordId ? "Select files to attach after saving" : "Drop files here or click to browse"}
        </p>
        <p className="text-xs text-[var(--text-muted,#6b7280)] mt-1">
          {noRecordId ? "Files will upload after this record is saved" : "PDF, Images, Word, Excel — max 10MB per file"}
        </p>
      </div>
    </div>
  );

  const compactUploadBtn = (
    <button
      type="button"
      onClick={handleFilePick}
      disabled={isEffectivelyDisabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 hover:bg-[var(--bg-surface-hover,#2a2a3a)]"
      style={{
        border: "1px solid var(--border, #3a3a4e)",
        color: "var(--text-primary, #e0e0e0)",
      }}
    >
      <Paperclip size={14} />
      {noRecordId ? "Queue Files" : "Attach Files"}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
        onChange={handleInputChange}
        disabled={isEffectivelyDisabled}
      />
    </button>
  );

  const fileList = (
    <div className="space-y-1 mt-3">
      {files.map((file) => {
        const isPending = file._pending;
        const isError = file._error;
        const isQueued = file._queued;
        const progress = file._progress || 0;
        const iconConfig = getFileIconConfig(file.file_type);
        const IconComponent = iconConfig.icon;

        return (
          <div
            key={file.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isPending
                ? "bg-blue-500/5"
                : isError
                ? "bg-red-500/5"
                : isQueued
                ? "bg-amber-500/5"
                : "bg-[var(--bg-tertiary,#232333)] hover:bg-[var(--bg-hover,#2a2a3a)]"
            }`}
          >
            <IconComponent
              size={18}
              style={{ color: iconConfig.color }}
              className="shrink-0"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm text-[var(--text-primary,#e0e0e0)] truncate" title={file.file_name}>
                  {file.file_name}
                </p>
                {isQueued && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                    Queued
                  </span>
                )}
                {file.document_type && !isPending && !isQueued && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      background: "var(--bg-surface-hover, #2a2a3a)",
                      color: "var(--text-muted, #6b7280)",
                      border: "1px solid var(--border, #3a3a4e)",
                    }}
                  >
                    {file.document_type}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted,#6b7280)]">
                <span>{fileService.formatFileSize(file.file_size)}</span>
                {file.uploaded_at && !isPending && !isQueued && (
                  <>
                    <span>·</span>
                    <span>{formatDate(file.uploaded_at)}</span>
                  </>
                )}
                {isQueued && !isPending && (
                  <span style={{ color: "#f59e0b" }}>Will upload after save</span>
                )}
              </div>

              {isPending && !isQueued && (
                <div className="mt-1.5 w-full h-1 bg-[var(--bg-surface-hover,#2a2a3a)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {isError && (
                <p className="text-xs text-red-400 mt-0.5">{file._error}</p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isPending && !isQueued ? (
                <Loader2 size={14} className="animate-spin text-blue-400" />
              ) : isError ? (
                <button
                  type="button"
                  onClick={() => handleRetry(file)}
                  className="p-1.5 rounded text-xs text-blue-400 hover:bg-blue-500/10 transition-colors"
                  title="Retry"
                >
                  <Upload size={14} />
                </button>
              ) : (
                <>
                  {!isQueued && file.cloudinary_url && (
                    <a
                      href={file.cloudinary_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded text-[var(--text-muted,#6b7280)] hover:text-blue-400 hover:bg-[var(--bg-hover,#2a2a3a)] transition-colors"
                      title="Open file"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {!isEffectivelyDisabled && (
                    <button
                      type="button"
                      onClick={() => isQueued ? removeQueued(file.id) : setConfirmDelete(file)}
                      className="p-1.5 rounded text-[var(--text-muted,#6b7280)] hover:text-red-400 hover:bg-[var(--bg-hover,#2a2a3a)] transition-colors"
                      title={isQueued ? "Remove" : "Delete"}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const emptyState = !loading && nonPendingFiles.length === 0 && (
    <div className="text-center py-6 text-xs text-[var(--text-muted,#6b7280)] border border-dashed border-[var(--border,#3a3a4e)] rounded-lg">
      No files attached yet
    </div>
  );

  const loadingSkeleton = loading && (
    <div className="space-y-2 mt-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-tertiary,#232333)] animate-pulse"
        >
          <div className="w-5 h-5 rounded bg-[var(--bg-surface-hover,#2a2a3a)]" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-48 rounded bg-[var(--bg-surface-hover,#2a2a3a)]" />
            <div className="h-2 w-24 rounded bg-[var(--bg-surface-hover,#2a2a3a)]" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip size={16} className="text-blue-400" />
          <h3 className="text-sm font-medium text-[var(--text-primary,#e0e0e0)]">
            Attachments
          </h3>
          {!loading && nonPendingFiles.length > 0 && (
            <span className="text-xs text-[var(--text-muted,#6b7280)] bg-[var(--bg-tertiary,#232333)] px-1.5 py-0.5 rounded">
              {nonPendingFiles.length}
            </span>
          )}
        </div>

        {compact && !isEffectivelyDisabled && compactUploadBtn}
        {noRecordId && queuedFiles.length > 0 && !compact && (
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
            {queuedFiles.length} queued
          </span>
        )}
      </div>

      {documentTypes && documentTypes.length > 0 && !isEffectivelyDisabled && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--text-secondary,#9ca3af)] shrink-0">
            Document Type:
          </label>
          <select
            value={selectedDocType || ""}
            onChange={(e) => setSelectedDocType(e.target.value || null)}
            className="text-xs px-2 py-1 rounded-lg outline-none"
            style={{
              background: "var(--bg-surface-hover, #2a2a3a)",
              border: "1px solid var(--border, #3a3a4e)",
              color: "var(--text-primary, #e0e0e0)",
            }}
          >
            <option value="">None</option>
            {documentTypes.map((dt) => (
              <option key={dt} value={dt}>
                {dt}
              </option>
            ))}
          </select>
        </div>
      )}

      {!compact && !isEffectivelyDisabled && uploadArea}

      {queuedFiles.length > 0 && (
        <div className="px-3 py-2 rounded-lg text-xs text-center"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", color: "var(--text-muted)" }}>
          {queuedFiles.length} file{queuedFiles.length > 1 ? "s" : ""} queued — will upload after saving
        </div>
      )}

      {loadingSkeleton}

      {!loading && nonPendingFiles.length > 0 && fileList}

      {emptyState}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div
            className="rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl"
            style={{
              background: "var(--bg-surface, #1a1a2e)",
              border: "1px solid var(--border, #3a3a4e)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-medium text-[var(--text-primary,#e0e0e0)] mb-2">
              Delete file?
            </h4>
            <p className="text-xs text-[var(--text-muted,#6b7280)] mb-4">
              Delete <strong>{confirmDelete.file_name}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                style={{
                  background: "var(--bg-surface-hover, #2a2a3a)",
                  border: "1px solid var(--border, #3a3a4e)",
                  color: "var(--text-primary, #e0e0e0)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete.id)}
                className="px-3 py-1.5 text-xs rounded-lg transition-colors bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default FileUpload;
