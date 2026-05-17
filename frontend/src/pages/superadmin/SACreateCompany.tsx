import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  ArrowLeft,
  CheckCircle,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import { saApi, CompanyPlan, CompanyCreateResult } from "../../lib/superAdminApi";

const PLANS: { value: CompanyPlan; label: string; desc: string; color: string }[] = [
  { value: "free",       label: "Free",       desc: "Basic access, limited modules",  color: "#64748b" },
  { value: "premium",    label: "Premium",    desc: "All modules, priority support",  color: "#f59e0b" },
  { value: "enterprise", label: "Enterprise", desc: "Unlimited, custom integrations", color: "var(--sa-accent)" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5 sa-text-secondary">{label}</label>
      {children}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="ml-2 p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
      title="Copy"
    >
      {copied ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
    </button>
  );
}

function SuccessScreen({ result, onGoToCompany }: { result: CompanyCreateResult; onGoToCompany: () => void }) {
  return (
    <div className="max-w-lg space-y-6 animate-slide-up">
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle size={48} style={{ color: "#10b981" }} />
        <p className="text-xl font-bold sa-text-primary">Company Created!</p>
        <p className="text-sm sa-text-muted text-center">
          <strong>{result.name}</strong> is ready. The admin user can log in immediately.
        </p>
      </div>

      {/* Credentials card */}
      <div
        className="rounded-2xl border p-5 space-y-4"
        style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.25)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#10b981" }}>
          Admin Login Credentials
        </p>
        <p className="text-[11px] sa-text-muted">
          Save these credentials — the password cannot be retrieved later.
        </p>

        {[
          { label: "Company", value: result.name },
          { label: "Email",   value: result.admin_user.email },
          { label: "Role",    value: result.admin_user.roles.join(", ") || "Admin" },
          { label: "Status",  value: result.admin_user.status },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs sa-text-muted w-20">{label}</span>
            <span className="text-sm font-medium sa-text-primary flex items-center">
              {value}
              <CopyButton value={value} />
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onGoToCompany}
        className="sa-btn-primary w-full py-3"
      >
        <Building2 size={14} /> Go to Company
      </button>
    </div>
  );
}

export default function SACreateCompany() {
  const navigate = useNavigate();

  // Company fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<CompanyPlan>("free");

  // Admin user fields
  const [adminName,     setAdminName]     = useState("");
  const [adminEmail,    setAdminEmail]    = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword,  setShowPassword]  = useState(false);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState<CompanyCreateResult | null>(null);

  const autoSlug = (v: string) =>
    v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const handleName = (v: string) => {
    setName(v);
    if (!slug || slug === autoSlug(name)) setSlug(autoSlug(v));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const company = await saApi.createCompany({
        name,
        slug,
        plan,
        admin_user: {
          name:     adminName,
          email:    adminEmail,
          password: adminPassword,
        },
      });
      setResult(company);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg ?? JSON.stringify(d)).join("; "));
      } else {
        setError(detail ?? "Failed to create company");
      }
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <SuccessScreen
        result={result}
        onGoToCompany={() => navigate(`/super-admin/companies/${result.id}`)}
      />
    );
  }

  return (
    <div className="max-w-lg space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/super-admin/companies")}
          className="sa-btn-ghost w-8 h-8 p-0 flex items-center justify-center"
        >
          <ArrowLeft size={14} />
        </button>
        <div>
          <h1 className="text-xl font-bold sa-text-primary">Create Company</h1>
          <p className="text-xs sa-text-muted">Register a new tenant with an admin user</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {error && <div className="sa-error">{error}</div>}

        {/* ── Company Info ─────────────────────────────────────────────── */}
        <div className="sa-card-faint p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider sa-text-muted flex items-center gap-2">
            <Building2 size={12} /> Company Info
          </p>

          <Field label="Company Name">
            <input
              className="sa-input"
              placeholder="Acme Real Estate"
              value={name}
              onChange={(e) => handleName(e.target.value)}
              required
            />
          </Field>

          <Field label="Slug (URL identifier)">
            <input
              className="sa-input"
              placeholder="acme-real-estate"
              value={slug}
              onChange={(e) => setSlug(autoSlug(e.target.value))}
              required
            />
            <p className="text-[10px] mt-1 sa-text-muted">
              Lowercase letters, digits, hyphens only
            </p>
          </Field>

          <Field label="Plan">
            <div className="grid grid-cols-3 gap-3 mt-1">
              {PLANS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlan(p.value)}
                  className="rounded-xl p-3 text-left border transition-all"
                  style={{
                    background: plan === p.value
                      ? `color-mix(in srgb, ${p.color} 12%, var(--sa-bg-surface))`
                      : "var(--sa-accent-faint)",
                    borderColor: plan === p.value
                      ? `color-mix(in srgb, ${p.color} 50%, transparent)`
                      : "var(--sa-border)",
                  }}
                >
                  <p className="text-xs font-bold mb-0.5" style={{ color: p.color }}>{p.label}</p>
                  <p className="text-[10px] sa-text-muted">{p.desc}</p>
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* ── Admin User ───────────────────────────────────────────────── */}
        <div className="sa-card-faint p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider sa-text-muted flex items-center gap-2">
            <User size={12} /> Admin User
          </p>
          <p className="text-[11px] sa-text-muted -mt-2">
            This user will be the company admin and can log in immediately after creation.
          </p>

          <Field label="Full Name">
            <div className="relative">
              <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 sa-text-muted" />
              <input
                className="sa-input pl-8"
                placeholder="Ali Khan"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
              />
            </div>
          </Field>

          <Field label="Email">
            <div className="relative">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 sa-text-muted" />
              <input
                type="email"
                className="sa-input pl-8"
                placeholder="admin@company.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </div>
          </Field>

          <Field label="Password">
            <div className="relative">
              <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 sa-text-muted" />
              <input
                type={showPassword ? "text" : "password"}
                className="sa-input pl-8 pr-10"
                placeholder="Min. 6 characters"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 sa-text-muted hover:sa-text-primary transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </Field>
        </div>

        <button type="submit" disabled={loading} className="sa-btn-primary w-full py-3">
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <><Building2 size={14} /> Create Company &amp; Admin</>
          )}
        </button>
      </form>
    </div>
  );
}
