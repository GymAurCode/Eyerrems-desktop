import axios from "axios";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/auth";
// Note: axios is imported only for axios.isAxiosError — all API calls go through ../lib/api
import { Building2, Package, Zap, Eye, EyeOff, ArrowRight } from "lucide-react";

// ── Centralized app theme map — single source of truth ───────────────────────
// Each entry defines the brand identity AND the color that drives:
//   • left-panel icon, border, glow
//   • login form border glow + inner aurora
// To change a theme color, update it here only.
const SLIDES = [
  {
    themeId:     "eyercall",
    icon:        Zap,
    brand:       "Eyercall",
    tagline:     "Software Solutions",
    description: "Empowering businesses with cutting-edge software tailored for growth, efficiency, and scale.",
    color:       "#3b82f6",                  // Blue
    glow:        "rgba(59,130,246,0.28)",
  },
  {
    themeId:     "eyerflow",
    icon:        Package,
    brand:       "EyerFlow",
    tagline:     "Inventory & Business System",
    description: "Streamline your operations with intelligent inventory management and real-time business insights.",
    color:       "#8b5cf6",                  // Purple
    glow:        "rgba(139,92,246,0.28)",
  },
  {
    themeId:     "eyerrems",
    icon:        Building2,
    brand:       "EyerREMS",
    tagline:     "Real Estate Management",
    description: "Manage properties, clients, and finances from a single premium platform built for real estate professionals.",
    color:       "#10b981",                  // Green
    glow:        "rgba(16,185,129,0.28)",
  },
];

// Login is always dark — it's a branded landing page, not part of the app shell
export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [slide, setSlide]       = useState(0);
  const [animating, setAnimating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => { setSlide((s) => (s + 1) % SLIDES.length); setAnimating(false); }, 300);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      // Route super-admins to their own panel, everyone else to company dashboard
      const { isSuperAdmin } = useAuthStore.getState();
      navigate(isSuperAdmin ? "/super-admin" : "/");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        setError(typeof detail === "string" ? detail : "Invalid credentials");
      } else {
        setError("Sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const current = SLIDES[slide];
  const SlideIcon = current.icon;

  return (
    // Login page is intentionally always dark — it's a branded splash screen
    <div className="min-h-screen flex" style={{ background: "#0f1117", color: "#e2e8f0" }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden"
        style={{ background: "linear-gradient(135deg,#131525 0%,#0f1117 100%)", borderRight: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="absolute inset-0 pointer-events-none transition-all duration-700"
          style={{ background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${current.glow} 0%, transparent 65%)` }} />

        <div className="relative z-10 text-center max-w-sm transition-all duration-300"
          style={{ opacity: animating ? 0 : 1, transform: animating ? "translateY(12px)" : "translateY(0)" }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 transition-all duration-300"
            style={{
              background: `linear-gradient(135deg,${current.color}22,${current.color}44)`,
              border: `1px solid ${current.color}55`,
              boxShadow: `0 0 40px ${current.glow}`,
            }}>
            <SlideIcon size={36} style={{ color: current.color }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: current.color }}>
            {current.tagline}
          </p>
          <h2 className="text-4xl font-bold mb-4" style={{ color: "#f1f5f9" }}>{current.brand}</h2>
          <p className="text-sm leading-relaxed" style={{ color: "#7c8fa8" }}>{current.description}</p>
        </div>

        <div className="absolute bottom-10 flex gap-2">
          {SLIDES.map((s, i) => (
            <button key={i} type="button"
              onClick={() => { setSlide(i); setAnimating(false); }}
              title={s.brand}
              className="transition-all duration-300 rounded-full"
              style={{
                width:      i === slide ? "24px" : "6px",
                height:     "6px",
                background: i === slide ? current.color : "rgba(255,255,255,0.2)",
              }} />
          ))}
        </div>

        <div className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        {/* Keyframes for the animated inner glow */}
        <style>{`
          @keyframes loginAurora {
            0%   { transform: translate(-20%, -20%) rotate(0deg);   opacity: 0.40; }
            33%  { transform: translate(10%, -30%) rotate(120deg);  opacity: 0.30; }
            66%  { transform: translate(-10%, 20%) rotate(240deg);  opacity: 0.40; }
            100% { transform: translate(-20%, -20%) rotate(360deg); opacity: 0.40; }
          }
          @keyframes loginAurora2 {
            0%   { transform: translate(20%, 20%) rotate(0deg);   opacity: 0.25; }
            33%  { transform: translate(-15%, 30%) rotate(120deg); opacity: 0.32; }
            66%  { transform: translate(15%, -20%) rotate(240deg); opacity: 0.25; }
            100% { transform: translate(20%, 20%) rotate(360deg);  opacity: 0.25; }
          }
          @keyframes loginPulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.72; }
          }
        `}</style>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
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

          {/* Form card — border glow tracks the active left-panel product color */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              border: `1px solid ${current.color}55`,
              background: "rgba(22,24,38,0.90)",
              backdropFilter: "blur(16px)",
              boxShadow: `0 0 0 1px rgba(255,255,255,0.06) inset,
                          0 20px 40px rgba(0,0,0,0.28),
                          0 0 22px 3px ${current.color}38,
                          0 0  8px 1px ${current.color}22`,
              transition: "box-shadow 0.5s ease, border-color 0.5s ease",
              animation: "loginPulse 4s ease-in-out infinite",
            }}
          >
            {/* Animated aurora blob 1 — tracks active color */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: "10%", left: "20%",
                width: "260px", height: "260px",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${current.color}2e 0%, ${current.color}17 50%, transparent 70%)`,
                filter: "blur(40px)",
                animation: "loginAurora 9s ease-in-out infinite",
                pointerEvents: "none",
                zIndex: 0,
                transition: "background 0.5s ease",
              }}
            />
            {/* Animated aurora blob 2 — tracks active color */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                bottom: "10%", right: "15%",
                width: "200px", height: "200px",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${current.color}24 0%, ${current.color}0f 50%, transparent 70%)`,
                filter: "blur(36px)",
                animation: "loginAurora2 11s ease-in-out infinite",
                pointerEvents: "none",
                zIndex: 0,
                transition: "background 0.5s ease",
              }}
            />

            {/* Actual form content — sits above the glow */}
            <div className="relative z-10 p-8">
              <div className="mb-8">
                <h1 className="text-2xl font-bold mb-1.5" style={{ color: "#f1f5f9" }}>Welcome back</h1>
                <p className="text-sm" style={{ color: "#7c8fa8" }}>Sign in to your account to continue</p>
              </div>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl text-sm border"
                  style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }}>
                  {error}
                </div>
              )}

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Email address</label>
                  <input className="input-dark w-full px-4 py-3 text-sm" type="email"
                    placeholder="you@company.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                    style={{ background: "rgba(30,33,52,0.8)", borderColor: "rgba(99,102,241,0.2)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Password</label>
                  <div className="relative">
                    <input className="input-dark w-full px-4 py-3 text-sm pr-11"
                      type={showPass ? "text" : "password"} placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      required autoComplete="current-password"
                      style={{ background: "rgba(30,33,52,0.8)", borderColor: "rgba(99,102,241,0.2)" }} />
                    <button type="button" onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: "#64748b" }}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 mt-2">
                  {loading
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><span>Sign In</span><ArrowRight size={15} /></>}
                </button>
              </form>

              <p className="mt-8 text-center text-[11px]" style={{ color: "#4a5568" }}>
                Powered by <span className="text-blue-500 font-medium">Eyercall</span>
              </p>
              <p className="mt-3 text-center text-xs" style={{ color: "#7c8fa8" }}>
                Don't have an account?{" "}
                <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium">Create one</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
