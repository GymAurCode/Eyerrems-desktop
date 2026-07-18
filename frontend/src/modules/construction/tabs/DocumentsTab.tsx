import { useEffect, useState } from "react";
import {
  FileText, Plus, Folder, Search, Download, Trash2,
  FileImage, File, FileSpreadsheet, ExternalLink, Users,
} from "lucide-react";
import { constructionApi, Document } from "../../../lib/constructionApi";
import DataTable from "../../../components/data-table/DataTable";
import type { TableColumn } from "../../../components/data-table/types";
import ConfirmDialog from "../../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../../store/notifications";

const FOLDERS = [
  "Legal", "Engineering", "Architecture", "Structural Drawings",
  "Electrical Drawings", "Plumbing Drawings", "Contracts", "Invoices",
  "Government Approvals", "Completion Certificates", "Inspection Reports",
  "Photos", "Videos", "Blueprints", "Other",
];

const FOLDER_ICONS: Record<string, string> = {
  "Legal": "⚖️", "Engineering": "🔧", "Architecture": "🏛️",
  "Structural Drawings": "📐", "Electrical Drawings": "⚡",
  "Plumbing Drawings": "🚰", "Contracts": "📝", "Invoices": "💰",
  "Government Approvals": "🏛️", "Completion Certificates": "🎓",
  "Inspection Reports": "🔍", "Photos": "📸", "Videos": "🎥",
  "Blueprints": "📋", "Other": "📁",
};

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold text-primary">{title}</p>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function DocumentsTab({ projectId }: { projectId: number }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ folder: "Other", doc_type: "", tags: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const load = async () => {
    setLoading(true);
    try {
      const docs = await constructionApi.listDocuments(projectId);
      setDocuments(docs);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      await constructionApi.uploadDocument(
        projectId, uploadFile, uploadForm.doc_type || uploadFile.name.split(".").pop() || "other",
        uploadForm.folder || undefined, uploadForm.tags || undefined
      );
      pushToast({ title: "Document uploaded", message: `${uploadFile.name} has been uploaded.`, type: "success" });
      setShowUpload(false);
      setUploadFile(null);
      setUploadForm({ folder: "Other", doc_type: "", tags: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Upload failed"); }
    finally { setUploading(false); }
  };

  const getFolderDocs = (folder: string) => documents.filter(d => (d.folder ?? "Other") === folder);
  const folderCounts = FOLDERS.map(f => ({ folder: f, count: getFolderDocs(f).length }));
  const activeDocs = activeFolder ? getFolderDocs(activeFolder) : documents;

  const columns: TableColumn<Document>[] = [
    { key: 'name', label: 'Name', render: (v, r) => (
      <div className="flex items-center gap-2">
        <span className="text-sm">{FOLDER_ICONS[r.folder ?? "Other"] ?? "📄"}</span>
        <div>
          <span className="text-xs font-medium text-primary">{v}</span>
          <p className="text-[10px] text-muted">{r.doc_type} · {r.file_size ? `${(r.file_size / 1024).toFixed(0)} KB` : ""} · v{r.version}</p>
        </div>
      </div>
    )},
    { key: 'folder', label: 'Folder', render: (v) => <span className="text-xs text-muted">{v ?? "Other"}</span> },
    { key: 'tags', label: 'Tags', render: (v) => v ? (
      <div className="flex gap-1 flex-wrap">
        {v.split(",").map((t, i) => (
          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted">{t.trim()}</span>
        ))}
      </div>
    ) : <span className="text-xs text-muted">—</span>},
    { key: 'created_at', label: 'Uploaded', render: (v) => <span className="text-xs text-muted">{v ? new Date(v).toLocaleDateString() : "—"}</span> },
    { key: 'actions', label: '', render: (_, r) => (
      <div className="flex items-center gap-1">
        <a href={r.file_url} target="_blank" rel="noopener noreferrer"
          className="p-1 text-muted hover:text-blue-400" title="Download">
          <Download size={11} />
        </a>
        <button onClick={() => setDeleteTarget(r.id)}
          className="p-1 text-muted hover:text-red-400" title="Delete">
          <Trash2 size={11} />
        </button>
      </div>
    )},
  ];

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Folder Grid */}
      <SectionCard title="Document Folders">
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          <button onClick={() => setActiveFolder(null)}
            className={`p-3 rounded-xl text-center transition-all ${
              activeFolder === null ? "bg-blue-600/20 ring-1 ring-blue-500" : "hover:bg-white/5"
            }`}>
            <Folder size={18} className="mx-auto mb-1 text-blue-400" />
            <span className="text-[10px] text-primary block">All</span>
            <span className="text-[9px] text-muted">{documents.length}</span>
          </button>
          {folderCounts.filter(f => f.count > 0).map(({ folder, count }) => (
            <button key={folder} onClick={() => setActiveFolder(folder)}
              className={`p-3 rounded-xl text-center transition-all ${
                activeFolder === folder ? "bg-blue-600/20 ring-1 ring-blue-500" : "hover:bg-white/5"
              }`}>
              <span className="text-lg mb-1 block">{FOLDER_ICONS[folder] ?? "📁"}</span>
              <span className="text-[10px] text-primary block truncate">{folder}</span>
              <span className="text-[9px] text-muted">{count}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Documents List */}
      <SectionCard title={activeFolder ? `Documents: ${activeFolder}` : "All Documents"}
        action={
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Plus size={10} /> Upload
          </button>
        }>
        <DataTable data={activeDocs} columns={columns} searchable
          emptyTitle="No documents"
          emptyDescription={activeFolder ? "This folder is empty." : "Upload documents to get started."} />
      </SectionCard>

      {/* Upload Dialog */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowUpload(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-md" style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">Upload Document</h3>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">File *</label>
                <input type="file" onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-primary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Folder</label>
                  <select value={uploadForm.folder} onChange={e => setUploadForm(p => ({ ...p, folder: e.target.value }))} className="dialog-select">
                    {FOLDERS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Doc Type</label>
                  <input value={uploadForm.doc_type} onChange={e => setUploadForm(p => ({ ...p, doc_type: e.target.value }))} className="dialog-input" placeholder="pdf, jpg, etc." />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Tags (comma separated)</label>
                <input value={uploadForm.tags} onChange={e => setUploadForm(p => ({ ...p, tags: e.target.value }))} className="dialog-input" placeholder="structural, floor-plan" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleUpload} disabled={uploading || !uploadFile}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (deleteTarget !== null) {
            await constructionApi.deleteDocument(deleteTarget);
            pushToast({ title: "Document deleted", message: "The document has been deleted.", type: "success" });
            setDeleteTarget(null);
            load();
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
