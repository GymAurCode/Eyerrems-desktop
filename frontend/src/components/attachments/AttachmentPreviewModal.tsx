import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { attachmentApi } from "../../lib/attachmentApi";
import { isImage, isPDF } from "../../utils/fileHelpers";

interface Props {
  open: boolean;
  attachment: any;
  attachments: any[];
  onClose: () => void;
  onNavigate: (attachment: any) => void;
}

export default function AttachmentPreviewModal({
  open,
  attachment,
  attachments,
  onClose,
  onNavigate,
}: Props) {
  const currentIndex = attachment ? attachments.findIndex((a) => a.id === attachment.id) : -1;

  const goNext = useCallback(() => {
    if (currentIndex < attachments.length - 1) {
      onNavigate(attachments[currentIndex + 1]);
    }
  }, [currentIndex, attachments, onNavigate]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(attachments[currentIndex - 1]);
    }
  }, [currentIndex, attachments, onNavigate]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, goNext, goPrev]);

  if (!open || !attachment) return null;

  const downloadUrl = attachmentApi.downloadUrl(attachment.id);
  const isPdf = isPDF(attachment.file_type);

  const handlePrint = () => {
    const w = window.open(downloadUrl, "_blank");
    if (w) {
      w.onload = () => { try { w.print(); } catch {} };
    }
  };

  return (
    <AppDialog isOpen={open} onClose={onClose} title={attachment.document_name ?? ""} size={isPdf ? "2xl" : "lg"}>
      {/* Toolbar */}
      {isPdf && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {currentIndex > 0 && (
              <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-hover transition-colors" title="Previous">
                <ChevronLeft size={18} />
              </button>
            )}
            <span className="text-xs text-muted">
              {attachments.length > 1
                ? `${currentIndex + 1} / ${attachments.length}`
                : "1 / 1"}
            </span>
            {currentIndex < attachments.length - 1 && (
              <button onClick={goNext} className="p-1.5 rounded-lg hover:bg-hover transition-colors" title="Next">
                <ChevronRight size={18} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <a
              href={downloadUrl}
              download={attachment.document_name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "var(--bg-surface2)", color: "var(--text-primary)" }}
            >
              <Download size={14} /> Download
            </a>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "var(--bg-surface2)", color: "var(--text-primary)" }}
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>
      )}

      {/* Image */}
      {!isPdf && isImage(attachment.file_type) && (
        <div className="flex items-center justify-center">
          <img src={downloadUrl} alt={attachment.document_name} className="max-w-full max-h-[70vh] object-contain rounded" />
        </div>
      )}

      {/* PDF */}
      {isPdf && (
        <div className="w-full rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", background: "#525659", height: "70vh" }}>
          <object data={downloadUrl} type="application/pdf" className="w-full h-full">
            <iframe src={downloadUrl} title={attachment.document_name} className="w-full h-full" />
          </object>
        </div>
      )}

      {/* Fallback for other types */}
      {!isPdf && !isImage(attachment.file_type) && (
        <div className="text-center py-12">
          <p className="text-sm text-muted mb-3">Preview not available for this file type</p>
          <a
            href={downloadUrl}
            download={attachment.document_name}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--accent-primary, #f6ce3a)", color: "#000" }}
          >
            <Download size={16} /> Download {attachment.document_name}
          </a>
        </div>
      )}
    </AppDialog>
  );
}
