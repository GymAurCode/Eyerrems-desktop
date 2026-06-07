import { useNavigate } from "react-router-dom";
import { Lock, ArrowLeft } from "lucide-react";

export default function AccessDeniedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-primary)" }}>
      <div className="text-center max-w-sm">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <Lock size={28} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-2">Access Denied</h1>
        <p className="text-sm text-muted mb-8">
          You don't have permission to view this page.
          Contact your administrator to request access.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <ArrowLeft size={14} />
          Go Back
        </button>
      </div>
    </div>
  );
}
