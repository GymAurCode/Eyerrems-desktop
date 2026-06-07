import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { Building2, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";

export default function SlugSetupPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/api/rbac/setup-slug", { company_slug: slug.trim().toLowerCase() });
      if (data.access_token) {
        const { setAuthToken: setToken } = await import("../lib/api");
        setToken(data.access_token);
      }
      const u = data.user;
      useAuthStore.setState({
        token: data.access_token || token,
        user: u ? {
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          role: u.role_name ?? "role_user",
          roles: [],
          permissions: [],
          approval_status: "approved",
          status: "active",
          is_active: true,
          is_approved: true,
          company_id: null,
          is_super_admin: false,
          features: {},
          user_type: "role_user",
          role_name: u.role_name,
          company_slug: u.company_slug,
          slug_locked: u.slug_locked,
          must_change_password: u.must_change_password,
          rbac_permissions: u.permissions ?? {},
        } : user,
      });
      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Company not found. Check the slug and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-primary mb-1">Connected!</h2>
          <p className="text-sm text-muted">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-primary)" }}>
      <div
        className="w-full max-w-[480px] rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <div className="p-8 space-y-6">
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
            >
              <Building2 size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-primary">Connect to Your Company</h1>
            <p className="text-sm text-muted mt-2 leading-relaxed">
              Enter the company slug provided by your administrator.
              You can only set this once.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <input
                autoFocus
                className="input-dark w-full px-4 py-3 text-sm text-center"
                placeholder="company-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={loading}
              />
              <p className="text-[10px] text-muted text-center mt-1.5">
                e.g. rems-pk, acme-properties
              </p>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <AlertCircle size={12} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !slug.trim()}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Connect
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={logout}
              className="text-xs text-muted hover:text-primary transition-colors underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
