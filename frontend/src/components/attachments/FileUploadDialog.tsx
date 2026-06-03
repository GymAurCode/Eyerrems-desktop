import { useState, useEffect, useRef, useCallback } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import Modal from "../Modal";
import { attachmentApi, AttachmentItem } from "../../lib/attachmentApi";
import { DataTable } from "../data-table";
import type { PaginationConfig } from "../data-table";

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

  const doFetch = useCallback(async (search: string, pg: number) => {
    try {
      setLoading(true);
      const res = await attachmentApi.list(module, recordId, {
        search: search || undefined,
        page: pg,
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
  }, [module, recordId]);

  const fetchAttachments = useCallback(() => doFetch(searchText, page), [doFetch, searchText, page]);

  const [selectedAttachmentRows, setSelectedAttachmentRows] = useState<AttachmentItem[]>([]);

  const handleSelectionChange = (rows: AttachmentItem[]) => {
    setSelectedAttachmentRows(rows);
    setSelectedIds(rows.map(r => r.id));
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    setPage(1);
    doFetch(value, 1);
  };

  const handlePaginationChange = (config: PaginationConfig) => {
    setPage(config.page);
    doFetch(searchText, config.page);
  };

  useEffect(() => {
    if (open) {
      doFetch("", 1);
      setSelectedFiles([]);
      setDescription("");
      setDocumentStatus("VERIFIED");
      setSearchText("");
      setSelectedIds([]);
      setEditingId(null);
      setPage(1);
      setSelectedAttachmentRows([]);
    }
  }, [open]);

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

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await attachmentApi.bulkDelete(selectedIds);
      setSelectedIds([]);
      setSelectedAttachmentRows([]);
      await doFetch(searchText, page);
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
      await doFetch(searchText, page);
    } catch {
      // silently fail
    }
  };

  const handleReset = () => {
    setEditingId(null);
    setEditValues({ document_name: "", description: "" });
    setSelectedIds([]);
    setSelectedAttachmentRows([]);
    setSearchText("");
    setPage(1);
    doFetch("", 1);
  };

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

          <DataTable
            data={attachments}
            columns={[
              {
                key: 'document_name',
                label: 'Document Name',
                render: (val: any, row: any) => editingId === row.id ? (
                  <input type="text" value={editValues.document_name}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, document_name: e.target.value }))}
                    className="w-full px-1 py-0.5 rounded text-xs outline-none"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                ) : val,
              },
              {
                key: 'description',
                label: 'Description',
                render: (val: any, row: any) => editingId === row.id ? (
                  <input type="text" value={editValues.description}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-1 py-0.5 rounded text-xs outline-none"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                ) : (val ?? "-"),
              },
              { key: 'serial_no', label: 'Document SI' },
              { key: 'file_size_kb', label: 'File Size in KBs', render: (val: any) => `${Number(val).toFixed(2)} KB` },
              {
                key: 'download',
                label: 'Download',
                render: (_: any, row: any) => (
                  <a href={attachmentApi.downloadUrl(row.id)} target="_blank" rel="noopener noreferrer"
                    className="hover:underline" style={{ color: "#3b82f6" }}>Download</a>
                ),
              },
            ]}
            selectable={true}
            selectedRows={selectedAttachmentRows}
            onSelectionChange={handleSelectionChange}
            loading={loading}
            searchable={true}
            searchValue={searchText}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search All Text Columns"
            sortable={false}
            pagination={{ page, pageSize: perPage, total }}
            onPaginationChange={handlePaginationChange}
            variant="compact"
            customToolbar={
              <div className="flex items-center gap-1">
                <div className="relative group">
                  <button type="button" className="px-2 py-1 text-xs rounded transition-colors"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    Actions ▼
                  </button>
                  <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:block min-w-[140px] rounded-lg shadow-lg"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                    <button type="button" onClick={handleBulkDelete}
                      disabled={selectedIds.length === 0}
                      className="block w-full text-left px-3 py-1.5 text-xs hover:opacity-80 disabled:opacity-40"
                      style={{ color: "#ef4444" }}>Delete Selected</button>
                  </div>
                </div>
                <button type="button" onClick={handleEdit} disabled={selectedIds.length === 0}
                  className="px-2 py-1 text-xs rounded transition-colors disabled:opacity-40"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  Edit
                </button>
                <button type="button" onClick={handleSave} disabled={editingId === null}
                  className="px-2 py-1 text-xs rounded transition-colors disabled:opacity-40"
                  style={{ background: editingId !== null ? "#22c55e" : "var(--bg-surface)", border: "1px solid var(--border)", color: editingId !== null ? "#fff" : "var(--text-primary)" }}>
                  Save
                </button>
                <button type="button" onClick={handleReset}
                  className="px-2 py-1 text-xs rounded transition-colors"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  Reset
                </button>
              </div>
            }
          />
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
