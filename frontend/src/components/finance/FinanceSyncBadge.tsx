import { useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { syncApi } from "../../lib/financeApi";

interface Props {
  module: string;
  recordType: string;
  recordId: number;
  posted?: boolean;
  journalId?: number | null;
  className?: string;
}

export default function FinanceSyncBadge({ module, recordType, recordId, posted, journalId, className = "" }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "posted" | "failed">(
    posted ? "posted" : "idle"
  );
  const [logId, setLogId] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);

  const handleCheck = async () => {
    setStatus("loading");
    try {
      const res = await syncApi.status(module, recordType, recordId);
      if (res.posted_to_finance || res.status === "success") {
        setStatus("posted");
        setLogId(res.log_id ?? null);
      } else if (res.status === "failed") {
        setStatus("failed");
        setLogId(res.log_id ?? null);
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("failed");
    }
  };

  const handleRetry = async () => {
    if (!logId) { await handleCheck(); return; }
    setRetrying(true);
    try {
      await syncApi.retry(logId);
      setStatus("posted");
    } catch {
      setStatus("failed");
    } finally {
      setRetrying(false);
    }
  };

  if (status === "loading") {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${className}`} style={{ color: "#94a3b8" }}>
        <Loader2 size={10} className="animate-spin" /> Checking…
      </span>
    );
  }

  if (status === "posted" || posted) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${className}`} style={{ color: "#10b981" }}>
        <CheckCircle2 size={10} /> Posted{journalId ? ` JE-${journalId}` : ""}
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${className}`} style={{ color: "#ef4444" }}>
        <XCircle size={10} /> Failed
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded"
          style={{ background: "rgba(239,68,68,0.12)" }}
        >
          {retrying ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
          Retry
        </button>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${className}`} style={{ color: "#94a3b8" }}>
      <XCircle size={10} /> Pending
      <button
        onClick={handleCheck}
        className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded"
        style={{ background: "rgba(148,163,184,0.12)" }}
      >
        <RefreshCw size={9} /> Check
      </button>
    </span>
  );
}
