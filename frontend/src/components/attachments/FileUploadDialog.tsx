import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Paperclip, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import Modal from "../Modal";
import { attachmentApi, AttachmentItem } from "../../lib/attachmentApi";

interface Props {
  open: boolean;
  onClose: () => void;
  module: string;
  recordId: string | number;
  title?: string;
}

export default function FileUploadDialog({
  open,
  onClose,
  module,
  recordId,
  title = "File Upload",
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [documentStatus, setDocumentStatus] = useState<"VERIFIED" | "PENDING" | "REJECTED">("VERIFIED");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ document_name: string; description: string }>({
    document_name: "",
    description: "",
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const perPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await attachmentApi.list(module, recordId, {
        search: searchText || undefined,
        page,
        per_page: perPage,
      });
      setAttachments(res.data ?? []);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [module, recordId, searchText, page]);

  useEffect(() => {
    if (open) {
      fetchAttachments();
      setSelectedFiles([]);
      setDescription("");
      setDocumentStatus("VERIFIED");
      setSearchText("");
      setSelectedIds([]);
      setEditingId(null);
      setPage(1);
    }
  }, [open, fetchAttachments]);

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (!description.trim()) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        await attachmentApi.upload(module, recordId, file, description, documentStatus);
      }
      setSelectedFiles([]);
      setDescription("");
      setDocumentStatus("VERIFIED");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchAttachments();
    } catch {
      // silently fail
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchAttachments();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(attachments.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await attachmentApi.bulkDelete(selectedIds);
      setSelectedIds([]);
      await fetchAttachments();
    } catch {
      // silently fail
    }
  };

  const handleEdit = () => {
    if (selectedIds.length === 0) return;
    const id = selectedIds[selectedIds.length - 1];
    const att = attachments.find((a) => a.id === id);
    if (att) {
      setEditingId(id);
      setEditValues({
        document_name: att.document_name,
        description: att.description ?? "",
      });
    }
  };

  const handleSave = async () => {
    if (editingId === null) return;
    try {
      await attachmentApi.update(editingId, editValues);
      setEditingId(null);
      await fetchAttachments();
    } catch {
      // silently fail
    }
  };

  const handleReset = () => {
    setEditingId(null);
    setEditValues({ document_name: "", description: "" });
    setSelectedIds([]);
    setSearchText("");
    setPage(1);
    fetchAttachments();
  };

  const firstPage = () => { setPage(1); };
  const prevPage = () => { setPage((p) => Math.max(1, p - 1)); };
  const nextPage = () => { setPage((p) => Math.min(totalPages, p + 1)); };
  const lastPage = () => { setPage(totalPages); };

  const allSelected = attachments.length > 0 && selectedIds.length === attachments.length;

  return (
    <Modal open={open} title={title} onClose={onClose} size="2xl">
      <div className="space-y-4">
        {/* ── Top Section: File Select, Description, Status ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              * Select File
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFilePick}
                className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                style={{
                  background: "var(--bg-surface-hover, #2a2a3a)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <Paperclip size={14} className="inline mr-1" />
                Choose Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilesChange}
              />
            </div>
            {selectedFiles.length > 0 && (
              <p className="text-xs mt-1 truncate" style={{ color: "var(--text-secondary)" }}>
                {selectedFiles.map((f) => f.name).join(", ")}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              * Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg outline-none"
              style={{
                background: "var(--bg-surface-hover, #2a2a3a)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Document Status
            </label>
            <select
              value={documentStatus}
              onChange={(e) => setDocumentStatus(e.target.value as "VERIFIED" | "PENDING" | "REJECTED")}
              className="w-full px-3 py-1.5 text-xs rounded-lg outline-none"
              style={{
                background: "var(--bg-surface-hover, #2a2a3a)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="VERIFIED">VERIFIED</option>
              <option value="PENDING">PENDING</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </div>

        {/* ── Uploaded Files Section ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Uploaded Files
            </h3>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || selectedFiles.length === 0 || !description.trim()}
              className="px-4 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{
                background: "#3b82f6",
                color: "#fff",
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={12} className="inline animate-spin mr-1" />
                  Uploading...
                </>
              ) : (
                "Upload File"
              )}
            </button>
          </div>

          {/* ── Toolbar ── */}
          <div
            className="flex items-center justify-between mb-2 p-2 rounded-lg"
            style={{ background: "var(--bg-surface-hover, #2a2a3a)" }}
          >
            <div className="flex items-center gap-2">
              <Search size={14} style={{ color: "var(--text-secondary)" }} />
              <input
                type="text"
                placeholder="Search All Text Columns"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="px-2 py-1 text-xs rounded outline-none w-48"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="button"
                onClick={handleSearch}
                className="px-3 py-1 text-xs rounded transition-colors"
                style={{ background: "#3b82f6", color: "#fff" }}
              >
                Go
              </button>
            </div>

            <div className="flex items-center gap-1">
              <div className="relative group">
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded transition-colors"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  Actions ▼
                </button>
                <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:block min-w-[140px] rounded-lg shadow-lg"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={selectedIds.length === 0}
                    className="block w-full text-left px-3 py-1.5 text-xs hover:opacity-80 disabled:opacity-40"
                    style={{ color: "#ef4444" }}
                  >
                    Delete Selected
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEdit}
                disabled={selectedIds.length === 0}
                className="px-2 py-1 text-xs rounded transition-colors disabled:opacity-40"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={editingId === null}
                className="px-2 py-1 text-xs rounded transition-colors disabled:opacity-40"
                style={{
                  background: editingId !== null ? "#22c55e" : "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: editingId !== null ? "#fff" : "var(--text-primary)",
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2 py-1 text-xs rounded transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--bg-surface-hover, #2a2a3a)" }}>
                  <th className="p-2 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="p-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>
                    Document Name
                  </th>
                  <th className="p-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>
                    Description
                  </th>
                  <th className="p-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>
                    Document SI
                  </th>
                  <th className="p-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>
                    File Size in KBs
                  </th>
                  <th className="p-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>
                    Download
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center" style={{ color: "var(--text-secondary)" }}>
                      <Loader2 size={14} className="inline animate-spin mr-2" />
                      Loading...
                    </td>
                  </tr>
                ) : attachments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center" style={{ color: "var(--text-secondary)" }}>
                      No data found
                    </td>
                  </tr>
                ) : (
                  attachments.map((att) => (
                    <tr
                      key={att.id}
                      className="border-t transition-colors hover:opacity-90"
                      style={{
                        borderColor: "var(--border)",
                        background: selectedIds.includes(att.id) ? "rgba(59,130,246,0.08)" : "transparent",
                      }}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(att.id)}
                          onChange={(e) => handleSelectOne(att.id, e.target.checked)}
                        />
                      </td>
                      <td className="p-2" style={{ color: "var(--text-primary)" }}>
                        {editingId === att.id ? (
                          <input
                            type="text"
                            value={editValues.document_name}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, document_name: e.target.value }))
                            }
                            className="w-full px-1 py-0.5 rounded text-xs outline-none"
                            style={{
                              background: "var(--bg-surface)",
                              border: "1px solid var(--border)",
                              color: "var(--text-primary)",
                            }}
                          />
                        ) : (
                          att.document_name
                        )}
                      </td>
                      <td className="p-2" style={{ color: "var(--text-primary)" }}>
                        {editingId === att.id ? (
                          <input
                            type="text"
                            value={editValues.description}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, description: e.target.value }))
                            }
                            className="w-full px-1 py-0.5 rounded text-xs outline-none"
                            style={{
                              background: "var(--bg-surface)",
                              border: "1px solid var(--border)",
                              color: "var(--text-primary)",
                            }}
                          />
                        ) : (
                          att.description ?? "-"
                        )}
                      </td>
                      <td className="p-2" style={{ color: "var(--text-secondary)" }}>
                        {att.serial_no}
                      </td>
                      <td className="p-2" style={{ color: "var(--text-secondary)" }}>
                        {att.file_size_kb.toFixed(2)} KB
                      </td>
                      <td className="p-2">
                        <a
                          href={attachmentApi.downloadUrl(att.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                          style={{ color: "#3b82f6" }}
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-1 mt-2">
              <button
                type="button"
                onClick={firstPage}
                disabled={page <= 1}
                className="px-2 py-1 text-xs rounded disabled:opacity-40 transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                |&lt;
              </button>
              <button
                type="button"
                onClick={prevPage}
                disabled={page <= 1}
                className="px-2 py-1 text-xs rounded disabled:opacity-40 transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <ChevronLeft size={12} />
              </button>
              <span className="px-2 py-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Page {page}
              </span>
              <button
                type="button"
                onClick={nextPage}
                disabled={page >= totalPages}
                className="px-2 py-1 text-xs rounded disabled:opacity-40 transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <ChevronRight size={12} />
              </button>
              <button
                type="button"
                onClick={lastPage}
                disabled={page >= totalPages}
                className="px-2 py-1 text-xs rounded disabled:opacity-40 transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                &gt;|
              </button>
            </div>
          )}
        </div>

        {/* ── Close button ── */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: "#ef4444",
              color: "#fff",
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
