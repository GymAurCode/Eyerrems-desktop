import axios from "axios";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import {
  Building2, Package, Zap, Eye, EyeOff, ArrowRight,
} from "lucide-react";

// ── Edison bulb SVG ──
function BulbShape({ on }: { on: boolean }) {
  const glassFill = on ? "rgba(255,248,220,0.18)" : "rgba(255,255,255,0.02)";
  const glassStroke = on ? "rgba(246,206,58,0.25)" : "rgba(255,255,255,0.05)";
  const wireColor = on ? "rgba(246,206,58,0.35)" : "rgba(255,255,255,0.06)";
  return (
    <svg width="30" height="56" viewBox="0 0 30 56" fill="none" style={{ display: "block" }}>
      <defs>
        <filter id="fg" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="bg" cx="40%" cy="30%" r="60%">
          <stop offset="0%" stopColor={on ? "#FFF8DC" : "rgba(255,255,255,0.04)"} />
          <stop offset="100%" stopColor={on ? "rgba(246,206,58,0.15)" : "rgba(255,255,255,0.01)"} />
        </radialGradient>
      </defs>
      <rect x="11.5" y="0" width="7" height="14" rx="1.5" fill={on ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)"} stroke={glassStroke} strokeWidth="0.5" />
      <line x1="11.5" y1="4" x2="18.5" y2="4" stroke={on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"} strokeWidth="0.5" />
      <line x1="11.5" y1="7" x2="18.5" y2="7" stroke={on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"} strokeWidth="0.5" />
      <line x1="11.5" y1="10" x2="18.5" y2="10" stroke={on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"} strokeWidth="0.5" />
      <path d="M10 16 C10 12 12 10 15 10 C18 10 20 12 20 16 C22 20 25 30 24 42 C23 48 19 52 15 52 C11 52 7 48 6 42 C5 30 8 20 10 16 Z" fill={on ? "url(#bg)" : glassFill} stroke={glassStroke} strokeWidth="0.7" />
      <path d="M12 18 C12 15 13.5 13 15 13 C16.5 13 18 15 18 18 C19.5 20 22 28 21 38 C20.5 44 18 48 15 48 C12 48 9.5 44 9 38 C8 28 10.5 20 12 18 Z" fill="rgba(255,255,255,0.03)" stroke="none" />
      <line x1="13" y1="12" x2="13" y2="28" stroke={wireColor} strokeWidth="0.5" />
      <line x1="17" y1="12" x2="17" y2="28" stroke={wireColor} strokeWidth="0.5" />
      <line x1="13" y1="44" x2="13" y2="46" stroke={wireColor} strokeWidth="0.5" />
      <line x1="17" y1="44" x2="17" y2="46" stroke={wireColor} strokeWidth="0.5" />
      {on && (
        <g filter="url(#fg)">
          <path d="M13 32 L14 30 L16 34 L17 32 L17 42 L16 44 L14 40 L13 42 Z" fill="#F6CE3A" opacity={0.9} />
          <path d="M13 32 L14 30 L16 34 L17 32 L17 42 L16 44 L14 40 L13 42 Z" fill="#FFF8DC" opacity={0.5} stroke="none" />
        </g>
      )}
      {!on && (
        <path d="M13 32 L14 30 L16 34 L17 32 L17 42 L16 44 L14 40 L13 42 Z" fill="rgba(255,255,255,0.06)" stroke="none" />
      )}
      <circle cx="15" cy="52" r="1.2" fill={on ? "rgba(246,206,58,0.15)" : "rgba(255,255,255,0.03)"} />
    </svg>
  );
}

// ── Product Data ──
interface ProductData {
  id: string;
  Icon: typeof Building2;
  name: string;
  subtitle: string;
  features: string;
  color: string;
  isFlagship?: boolean;
}

const PRODUCTS: ProductData[] = [
  {
    id: "eyerflow",
    Icon: Package,
    name: "EyerFlow",
    subtitle: "Inventory Management System",
    features: "Warehouse, Stock, Purchase & Sales Management",
    color: "#14B8A6",
  },
  {
    id: "eyerrems",
    Icon: Building2,
    name: "EyerREMS",
    subtitle: "Real Estate Management Software",
    features: "Property, Leads, Deals & Client Management",
    color: "#F6CE3A",
    isFlagship: true,
  },
  {
    id: "eyercall",
    Icon: Zap,
    name: "Eyercall",
    subtitle: "AI Powered Web Conference Platform",
    features: "Meetings, Collaboration & AI Assistance",
    color: "#A78BFA",
  },
];

// ── Main Component ──
export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // ── Slideshow state ──
  const [slideIndex, setSlideIndex] = useState(0);
  const slideTimerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    slideTimerRef.current = setInterval(() => {
      setSlideIndex((p) => (p + 1) % PRODUCTS.length);
    }, 4000);
    return () => clearInterval(slideTimerRef.current);
  }, []);

  const goToSlide = useCallback((i: number) => {
    setSlideIndex(i);
    clearInterval(slideTimerRef.current);
    slideTimerRef.current = setInterval(() => {
      setSlideIndex((p) => (p + 1) % PRODUCTS.length);
    }, 4000);
  }, []);

  // ── Light / Pull state ──
  const [lightOn, setLightOn] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [swingAngle, setSwingAngle] = useState(0);
  const dragStartY = useRef(0);
  const dragStartX = useRef(0);
  const pullRef = useRef(0);
  const swingRef = useRef(0);
  const rafRef = useRef<number>(0);
  const velocityRef = useRef(0);
  const isAnimatingSwing = useRef(false);
  const lightOnRef = useRef(false);

  // ── Spring animation for wire swing ──
  const animateSwing = useCallback(() => {
    if (!isAnimatingSwing.current) return;
    const damping = 0.92;
    const stiffness = 0.08;
    velocityRef.current *= damping;
    swingRef.current += velocityRef.current;
    velocityRef.current += -swingRef.current * stiffness;
    setSwingAngle(swingRef.current);
    if (Math.abs(swingRef.current) > 0.05 || Math.abs(velocityRef.current) > 0.05) {
      rafRef.current = requestAnimationFrame(animateSwing);
    } else {
      swingRef.current = 0;
      velocityRef.current = 0;
      setSwingAngle(0);
      isAnimatingSwing.current = false;
    }
  }, []);

  const startSwing = useCallback((impulse: number) => {
    velocityRef.current += impulse;
    if (!isAnimatingSwing.current) {
      isAnimatingSwing.current = true;
      rafRef.current = requestAnimationFrame(animateSwing);
    }
  }, [animateSwing]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Drag handlers ──
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    dragStartX.current = clientX;
    dragStartY.current = clientY;
    setIsDragging(true);
  }, []);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dy = clientY - dragStartY.current;
    const dx = clientX - dragStartX.current;
    const clampedDy = Math.max(0, Math.min(dy, 200));
    const clampedDx = Math.max(-80, Math.min(dx, 80));
    pullRef.current = clampedDy;
    setPullY(clampedDy);
    setSwingAngle(clampedDx * 0.3);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (pullRef.current > 60) {
      const willBeOn = !lightOnRef.current;
      lightOnRef.current = willBeOn;
      setLightOn(willBeOn);
      startSwing(swingRef.current * 0.5 || 2);
    } else {
      startSwing(swingRef.current * 0.3 || 1);
    }
    pullRef.current = 0;
    setPullY(0);
  }, [isDragging, startSwing]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onUp = () => handleDragEnd();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    handleDragStart(t.clientX, t.clientY);
  }, [handleDragStart]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      handleDragMove(t.clientX, t.clientY);
    };
    const onEnd = () => handleDragEnd();
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleClick = useCallback(() => {
    const willBeOn = !lightOnRef.current;
    lightOnRef.current = willBeOn;
    setLightOn(willBeOn);
    startSwing(3);
  }, [startSwing]);

  // ── Auth submit ──
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      const { isSuperAdmin, companyId } = useAuthStore.getState();
      if (isSuperAdmin) {
        navigate("/superadmin");
      } else if (companyId) {
        navigate("/");
      } else {
        navigate("/");
      }
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

  const wireLength = (lightOnRef.current && !isDragging ? 100 : 80) + (isDragging ? pullY : 0);
  const restTop = lightOnRef.current ? 100 : 80;

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "#020d0d", color: "#c0efef" }}>
      <style>{`
        @keyframes lightBloom {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>

      {/* ═══════ FLEX LAYOUT: Left + Right sections ═══════ */}
      <div className="flex min-h-screen">
        {/* ── LEFT SECTION — Product Showcase ── */}
        <div
          className="hidden lg:flex w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden transition-all duration-1000"
          style={{
            opacity: lightOn ? 1 : 0,
            transform: lightOn ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)",
            pointerEvents: lightOn ? "auto" : "none",
            background: "linear-gradient(160deg, #020d0d 0%, #041515 50%, #020d0d 100%)",
            borderRight: "none",
          }}
        >
          <div className="relative w-full max-w-md">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-10">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(20,184,166,0.3), rgba(20,184,166,0.1))",
                  border: "1px solid rgba(20,184,166,0.3)",
                }}
              >
                <Building2 size={20} style={{ color: "#14B8A6" }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#f1f5f9" }}>EyerREMS</p>
                <p className="text-[10px] tracking-wider" style={{ color: "#5a8080" }}>REAL ESTATE MANAGEMENT</p>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <p
                className="text-xs font-semibold uppercase tracking-[0.15em] mb-2"
                style={{ color: "#14B8A6" }}
              >
                Product Suite
              </p>
              <h2
                className="text-2xl font-bold tracking-tight"
                style={{ color: "#14B8A6" }}
              >
                Everything you need to scale
              </h2>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "#64748b" }}>
                A unified ecosystem of powerful tools for modern real estate and business management.
              </p>
            </div>

            {/* Slideshow - fade transition */}
            <div className="relative" style={{ minHeight: 130 }}>
              {PRODUCTS.map((p, i) => {
                const active = i === slideIndex;
                return (
                  <div
                    key={p.id}
                    className="absolute inset-0 transition-all duration-500"
                    style={{
                      opacity: active ? 1 : 0,
                      transform: active ? "translateY(0)" : "translateY(10px)",
                      pointerEvents: active ? "auto" : "none",
                    }}
                  >
                    <div
                      className="flex items-start gap-4 p-5 rounded-xl"
                      style={{
                        background: active ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                        border: active ? "1px solid rgba(20,184,166,0.3)" : "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: "linear-gradient(135deg, rgba(20,184,166,0.25), rgba(20,184,166,0.45))",
                          border: "1px solid rgba(20,184,166,0.5)",
                        }}
                      >
                        <p.Icon size={20} style={{ color: "#14B8A6" }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <h3 className="text-base font-semibold tracking-tight" style={{ color: "#f1f5f9" }}>
                            {p.name}
                          </h3>
                          {p.isFlagship && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full"
                              style={{
                                background: "rgba(246,206,58,0.15)",
                                color: "#F6CE3A",
                                border: "1px solid rgba(246,206,58,0.25)",
                              }}
                            >
                              Flagship
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium mb-0.5" style={{ color: "#14B8A6" }}>{p.subtitle}</p>
                        <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>{p.features}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation dots */}
            <div className="flex items-center justify-center gap-2.5 mt-6">
              {PRODUCTS.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goToSlide(i)}
                  className="rounded-full transition-all duration-500"
                  style={{
                    width: i === slideIndex ? 28 : 6,
                    height: 6,
                    background: i === slideIndex ? "rgba(20,184,166,0.2)" : "rgba(255,255,255,0.06)",
                    border: i === slideIndex ? "1px solid rgba(20,184,166,0.45)" : "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(8px)",
                  }}
                  aria-label={p.name}
                />
              ))}
            </div>
          </div>


        </div>

        {/* ── RIGHT SECTION — Login ── */}
        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden select-none"
          style={{
            background: "linear-gradient(160deg, #020d0d 0%, #041212 50%, #020d0d 100%)",
          }}
        >
          {/* Dark overlay for ambient depth */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 30%, transparent 30%, rgba(2,13,13,0.7) 100%)" }} />

          {/* Warm illumination from lamp */}
          <div
            className="absolute inset-0 pointer-events-none transition-all duration-1000"
            style={{
              opacity: lightOn ? 1 : 0,
              background: "radial-gradient(ellipse 90% 65% at 30% 15%, rgba(246,206,58,0.08) 0%, rgba(246,206,58,0.03) 25%, transparent 55%)",
              transition: "opacity 1.2s ease",
            }}
          />

          {/* Login form area */}
          <div
            className="w-full max-w-sm px-6 relative"
            style={{
              zIndex: 5,
              marginTop: "3rem",
              opacity: lightOn ? 1 : 0,
              transform: lightOn ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)",
              pointerEvents: lightOn ? "auto" : "none",
            }}
          >
            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 mb-6 lg:hidden">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg,rgba(20,184,166,0.3),rgba(20,184,166,0.1))",
                  border: "1px solid rgba(20,184,166,0.3)",
                }}
              >
                <Building2 size={18} style={{ color: "#14B8A6" }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#f1f5f9" }}>EyerREMS</p>
                <p className="text-[10px]" style={{ color: "#64748b" }}>Real Estate System</p>
              </div>
            </div>

            {/* Glassmorphism Card */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(4, 28, 28, 0.8)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow: lightOn
                  ? `0 0 0 1px rgba(255,255,255,0.06) inset,
                     0 24px 48px rgba(0,0,0,0.4),
                     0 0 40px rgba(246,206,58,0.1),
                     0 0  8px rgba(246,206,58,0.05)`
                  : `0 0 0 1px rgba(255,255,255,0.06) inset,
                     0 20px 40px rgba(0,0,0,0.3)`,
                transition: "box-shadow 1s ease",
              }}
            >
              {/* Warm light blobs inside card */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute transition-opacity duration-1000"
                style={{
                  top: "5%",
                  left: "15%",
                  width: 200,
                  height: 200,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(246,206,58,0.06) 0%, transparent 60%)",
                  filter: "blur(40px)",
                  opacity: lightOn ? 1 : 0,
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute transition-opacity duration-1000"
                style={{
                  bottom: "5%",
                  right: "15%",
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(20,184,166,0.04) 0%, transparent 60%)",
                  filter: "blur(32px)",
                  opacity: lightOn ? 1 : 0,
                }}
              />

              <div className="relative p-5">
                <div className="mb-3">
                  <h1 className="text-xl font-bold mb-0.5" style={{ color: "#f1f5f9" }}>
                    {lightOn ? "Welcome back" : "Power off"}
                  </h1>
                  <p className="text-xs" style={{ color: "#64748b" }}>
                    {lightOn ? "Sign in to your account to continue" : "Pull the cord to begin"}
                  </p>
                </div>

                {error && (
                  <div
                    className="mb-3 px-3.5 py-2.5 rounded-lg text-xs border"
                    style={{
                      color: "#f87171",
                      background: "rgba(239,68,68,0.08)",
                      borderColor: "rgba(239,68,68,0.2)",
                    }}
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={submit} className="space-y-3">
                  <div>
                    <label htmlFor="email" className="block text-[11px] font-medium mb-1" style={{ color: "#94a3b8" }}>
                      Email address <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="login-input w-full px-3.5 py-2.5 text-xs"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#f1f5f9",
                        borderRadius: 10,
                        outline: "none",
                        transition: "border-color 0.2s, box-shadow 0.2s",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "rgba(20,184,166,0.5)";
                        e.target.style.boxShadow = "0 0 0 3px rgba(20,184,166,0.08)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(255,255,255,0.08)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-[11px] font-medium mb-1" style={{ color: "#94a3b8" }}>
                      Password <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPass ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="login-input w-full px-3.5 py-2.5 text-xs pr-10"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "#f1f5f9",
                          borderRadius: 10,
                          outline: "none",
                          transition: "border-color 0.2s, box-shadow 0.2s",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "rgba(20,184,166,0.5)";
                          e.target.style.boxShadow = "0 0 0 3px rgba(20,184,166,0.08)";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "rgba(255,255,255,0.08)";
                          e.target.style.boxShadow = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md transition-all duration-200"
                        style={{
                          width: 28,
                          height: 28,
                          background: "rgba(20,184,166,0.1)",
                          backdropFilter: "blur(12px)",
                          border: "1px solid rgba(20,184,166,0.3)",
                          color: "#14B8A6",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(20,184,166,0.18)";
                          e.currentTarget.style.borderColor = "rgba(20,184,166,0.5)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(20,184,166,0.1)";
                          e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)";
                        }}
                      >
                        {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded"
                        style={{
                          accentColor: "#14B8A6",
                          width: 12,
                          height: 12,
                        }}
                      />
                      <span className="text-[11px]" style={{ color: "#94a3b8" }}>
                        Remember me
                      </span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-[11px] font-medium transition-all duration-200"
                      style={{ color: "#14B8A6", textDecoration: "none" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#5EEAD4"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#14B8A6"; }}
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 rounded-lg transition-all duration-300"
                    style={{
                      background: "rgba(20, 184, 166, 0.1)",
                      backdropFilter: "blur(16px)",
                      WebkitBackdropFilter: "blur(16px)",
                      border: "1px solid rgba(20, 184, 166, 0.3)",
                      color: "#14B8A6",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.background = "rgba(20, 184, 166, 0.18)";
                        e.currentTarget.style.borderColor = "rgba(20, 184, 166, 0.5)";
                        e.currentTarget.style.boxShadow = "0 0 24px rgba(20, 184, 166, 0.12), 0 2px 8px rgba(0,0,0,0.12)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.currentTarget.style.background = "rgba(20, 184, 166, 0.1)";
                        e.currentTarget.style.borderColor = "rgba(20, 184, 166, 0.3)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }
                    }}
                    onMouseDown={(e) => {
                      if (!loading) {
                        e.currentTarget.style.transform = "scale(0.97)";
                        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1)";
                      }
                    }}
                    onMouseUp={(e) => {
                      if (!loading) {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 0 24px rgba(20, 184, 166, 0.12), 0 2px 8px rgba(0,0,0,0.12)";
                      }
                    }}
                  >
                    {loading ? (
                      <span
                        className="w-3.5 h-3.5 rounded-full animate-spin"
                        style={{
                          borderWidth: "2px",
                          borderStyle: "solid",
                          borderColor: "rgba(20,184,166,0.2)",
                          borderTopColor: "#14B8A6",
                        }}
                      />
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <p className="text-[11px]" style={{ color: "#64748b" }}>
                    Don't have an account?{" "}
                    <Link
                      to="/signup"
                      className="font-medium transition-all duration-200"
                      style={{ color: "#14B8A6", textDecoration: "none" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#5EEAD4"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#14B8A6"; }}
                    >
                      Create one
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ GLOBAL FOOTER ═══════ */}
      <div
        className="fixed bottom-0 left-0 right-0 text-center pb-3 transition-opacity duration-1000"
        style={{
          opacity: lightOn ? 1 : 0,
          zIndex: 40,
          pointerEvents: lightOn ? "auto" : "none",
        }}
      >
        <p className="text-sm" style={{ color: "#4a5568" }}>
          Powered by <span style={{ color: "#14B8A6", fontWeight: 500 }}>Eyercall</span>
        </p>
      </div>

      {/* ═══════ FIXED OVERLAY: Wire + Lamp ═══════ */}
      <div className="fixed inset-0 pointer-events-none z-50">
        {/* Wire */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            width: 2,
            height: wireLength,
            marginLeft: -1,
            background: lightOnRef.current
              ? "linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0.08))"
              : "linear-gradient(180deg, rgba(255,255,255,0.15), rgba(255,255,255,0.03))",
            transformOrigin: "top center",
            transform: `rotate(${swingAngle}deg)`,
            transition: isDragging ? "none" : "height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.05s linear",
            pointerEvents: "none",
          }}
        />

        {/* Warm light cone casting down into the right section */}
        <div
          style={{
            position: "absolute",
            pointerEvents: "none",
            opacity: lightOn ? 1 : 0,
            top: wireLength + 59,
            left: "50%",
            transform: "translateX(-50%)",
            width: "70%",
            height: "70%",
            background: "linear-gradient(180deg, rgba(246,206,58,0.12) 0%, rgba(246,206,58,0.04) 25%, transparent 65%)",
            clipPath: "polygon(50% 0%, 5% 100%, 95% 100%)",
            transition: "opacity 1s ease, top 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            zIndex: 1,
          }}
        />

        {/* Lamp fixture + bulb (interactive) */}
        <div
          style={{
            position: "absolute",
            top: restTop + (isDragging ? pullY : 0),
            left: "50%",
            transform: `translateX(-50%) rotate(${swingAngle}deg)`,
            transition: isDragging
              ? "none"
              : "top 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.05s linear",
            pointerEvents: "auto",
            cursor: "grab",
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onClick={handleClick}
        >
          {/* Fixture canopy */}
          <div
            className="mx-auto rounded-t-md"
            style={{
              width: 16,
              height: 6,
              background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
              border: "1px solid rgba(255,255,255,0.08)",
              borderBottom: "none",
            }}
          />
          {/* Fixture mount */}
          <div
            className="mx-auto"
            style={{
              width: 24,
              height: 14,
              background: lightOn
                ? "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))"
                : "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))",
              borderLeft: lightOn ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.06)",
              borderRight: lightOn ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.06)",
              borderBottom: lightOn ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.06)",
              borderRadius: "0 0 6px 6px",
              backdropFilter: "blur(4px)",
              transition: "all 0.6s ease",
            }}
          />
          {/* Bulb */}
          <div className="flex justify-center" style={{ marginTop: 2 }}>
            <BulbShape on={lightOn} />
          </div>
          {/* Light bloom */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: "40%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(246,206,58,0.08) 0%, rgba(246,206,58,0.03) 40%, transparent 70%)",
              opacity: lightOn ? 1 : 0,
              transition: "opacity 1s ease",
              animation: lightOn ? "lightBloom 3s ease-in-out infinite" : "none",
            }}
          />
        </div>

        {/* Pull hint */}
        {!isDragging && pullY === 0 && (
          <div
            className="absolute pointer-events-none"
            style={{
              top: 86,
              left: "50%",
              transform: "translateX(18px)",
              animation: "floatSlow 2.5s ease-in-out infinite",
            }}
          >
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#64748b",
                whiteSpace: "nowrap",
              }}
            >
              <ArrowRight size={10} style={{ transform: "rotate(90deg)" }} />
              {lightOn ? "Pull to turn off" : "Pull to power"}
            </div>
          </div>
        )}

        {/* Pull progress indicator */}
        {isDragging && (
          <div
            className="absolute pointer-events-none flex flex-col items-center"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className="text-[11px] font-medium tracking-wider uppercase"
              style={{
                color: pullY > 60 ? "#F6CE3A" : "#64748b",
                opacity: 0.8,
                transition: "color 0.2s",
              }}
            >
              {pullY > 60 ? (lightOn ? "Release to power off" : "Release to power on") : "Pull down"}
            </div>
            <div
              className="mt-2 rounded-full"
              style={{
                width: 60,
                height: 3,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (pullY / 60) * 100)}%`,
                  background: pullY > 60 ? "#F6CE3A" : "rgba(255,255,255,0.2)",
                  borderRadius: "inherit",
                  transition: "background 0.2s",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
