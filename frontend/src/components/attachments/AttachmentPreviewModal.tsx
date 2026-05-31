import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { attachmentApi } from "../../lib/attachmentApi";
import { isImage, isPDF } from "../../utils/fileHelpers";

interface AttachmentItem {
  id: number;
  file_name: string;
  file_type: string;
}

interface Props {
  open: boolean;
  attachment: AttachmentItem | null;
  attachments: AttachmentItem[];
  onClose: () => void;
  onNavigate: (attachment: AttachmentItem) => void;
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

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white/80 hover:text-white bg-black/40 rounded-full p-1.5 transition-colors"
      >
        <X size={24} />
      </button>

      {/* Previous */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 rounded-full p-2 transition-colors"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {/* Next */}
      {currentIndex < attachments.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 rounded-full p-2 transition-colors"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Content */}
      <div
        className="max-w-[90vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white/90 text-sm mb-2 truncate max-w-full">
          {attachment.file_name}
          {attachments.length > 1 && (
            <span className="text-white/50 ml-2">
              ({currentIndex + 1} / {attachments.length})
            </span>
          )}
        </p>

        {isImage(attachment.file_type) && (
          <img
            src={downloadUrl}
            alt={attachment.file_name}
            className="max-w-full max-h-[80vh] object-contain rounded"
          />
        )}

        {isPDF(attachment.file_type) && (
          <iframe
            src={downloadUrl}
            title={attachment.file_name}
            className="w-[90vw] h-[80vh] rounded"
          />
        )}

        {!isImage(attachment.file_type) && !isPDF(attachment.file_type) && (
          <div className="text-white/70 text-center py-8">
            <p className="text-lg mb-2">Preview not available</p>
            <a
              href={downloadUrl}
              download={attachment.file_name}
              className="text-blue-400 underline hover:text-blue-300"
              onClick={(e) => e.stopPropagation()}
            >
              Download {attachment.file_name}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
