import axios from "axios";
import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { Building2, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";

export default function SignupPage() {
  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await api.post("/auth/register", { full_name: fullName, email, password });
      setSuccess(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        setError(typeof detail === "string" ? detail : "Registration failed");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
        <div className="w-full max-w-sm text-center p-8 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
            <CheckCircle size={32} style={{ color: "#10b981" }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#f1f5f9" }}>Registration Submitted</h2>
          <p className="text-sm mb-6" style={{ color: "#64748b" }}>
            Your account is <span style={{ color: "#f59e0b" }}>pending admin approval</span>. You will be able to login once an administrator approves your account.
          </p>
          <button onClick={() => navigate("/login")}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
            <span>Back to Login</span><ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#0a0a0f", color: "#e2e8f0" }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden"
        style={{ background: "linear-gradient(135deg,#0d0d1a 0%,#0a0a0f 100%)", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.2) 0%, transparent 70%)" }} />
        <div className="relative z-10 text-center max-w-sm">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8"
            style={{ background: "linear-gradient(135deg,#6366f122,#6366f144)", border: "1px solid #6366f155", boxShadow: "0 0 40px rgba(99,102,241,0.3)" }}>
            <Building2 size={36} style={{ color: "#6366f1" }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#6366f1" }}>Real Estate Management</p>
          <h2 className="text-4xl font-bold mb-4" style={{ color: "#f1f5f9" }}>EyerREMS</h2>
          <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
            Create your account to access the platform. Your account will be reviewed and activated by an administrator.
          </p>
        </div>
        <div className="absolute inset-0 pointer-events-none opacity-5"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              <Building2 size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#f1f5f9" }}>EyerREMS</p>
              <p className="text-[10px]" style={{ color: "#64748b" }}>Real Estate System</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1.5" style={{ color: "#f1f5f9" }}>Create account</h1>
            <p className="text-sm" style={{ color: "#64748b" }}>Fill in your details to request access</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm border"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Full Name</label>
              <input className="input-dark w-full px-4 py-3 text-sm" type="text"
                placeholder="John Doe" value={fullName}
                onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Email address</label>
              <input className="input-dark w-full px-4 py-3 text-sm" type="email"
                placeholder="you@company.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Password</label>
              <div className="relative">
                <input className="input-dark w-full px-4 py-3 text-sm pr-11"
                  type={showPass ? "text" : "password"} placeholder="Min. 8 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "#64748b" }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Confirm Password</label>
              <input className="input-dark w-full px-4 py-3 text-sm"
                type={showPass ? "text" : "password"} placeholder="Repeat password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 mt-2">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><span>Create Account</span><ArrowRight size={15} /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-xs" style={{ color: "#64748b" }}>
            Already have an account?{" "}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
          </p>
          <p className="mt-6 text-center text-[11px]" style={{ color: "#334155" }}>
            Powered by <span className="text-blue-500 font-medium">Eyercall</span>
          </p>
        </div>
      </div>
    </div>
  );
}
