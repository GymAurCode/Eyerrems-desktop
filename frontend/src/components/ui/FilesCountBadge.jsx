import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { fileService } from "../../services/fileService";

export default function FilesCountBadge({ module, recordType, recordId }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    fileService
      .getFileCount(module, recordType, String(recordId))
      .then((data) => {
        if (!cancelled) setCount(data.count);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [module, recordType, recordId]);

  if (count === null) return <span className="text-[var(--text-muted,#6b7280)]">—</span>;
  if (count === 0) return <span className="text-[var(--text-muted,#6b7280)]">—</span>;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-400">
      <Paperclip size={12} />
      {count}
    </span>
  );
}
