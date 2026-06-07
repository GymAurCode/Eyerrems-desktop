import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AppDialog from "../ui/AppDialog";
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
    <AppDialog isOpen={open && attachment !== null} onClose={onClose} title={attachment?.file_name ?? ""} size="lg">
      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 mb-2">
        {currentIndex > 0 && (
          <button onClick={goPrev} className="p-2 rounded-full hover:bg-hover transition-colors">
            <ChevronLeft size={20} />
          </button>
        )}
        <span className="text-xs text-muted">
          {attachments.length > 1 && attachment
            ? `${currentIndex + 1} / ${attachments.length}`
            : attachment?.file_name ?? ""}
        </span>
        {currentIndex < attachments.length - 1 && (
          <button onClick={goNext} className="p-2 rounded-full hover:bg-hover transition-colors">
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {attachment && isImage(attachment.file_type) && (
        <img src={downloadUrl} alt={attachment.file_name} className="max-w-full max-h-[70vh] object-contain rounded mx-auto" />
      )}

      {attachment && isPDF(attachment.file_type) && (
        <iframe src={downloadUrl} title={attachment.file_name} className="w-full h-[70vh] rounded" />
      )}

      {attachment && !isImage(attachment.file_type) && !isPDF(attachment.file_type) && (
        <div className="text-center py-8">
          <p className="text-sm mb-2">Preview not available</p>
          <a href={downloadUrl} download={attachment.file_name} className="text-blue-500 underline hover:text-blue-400">
            Download {attachment.file_name}
          </a>
        </div>
      )}
    </AppDialog>
  );
}
