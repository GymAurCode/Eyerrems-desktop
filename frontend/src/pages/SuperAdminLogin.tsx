import axios from "axios";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";

export default function SuperAdminLoginPage() {
  const loginSuperAdmin = useAuthStore((s) => s.loginSuperAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginSuperAdmin(email, password);
      navigate("/superadmin");
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "#020d0d", color: "#c0efef" }}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 p-8 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl" style={{ background: "rgba(13,32,32,0.8)" }}>
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Super Admin</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Super Admin Login</h1>
          <p className="mt-2 text-sm" style={{ color: "#3a7070" }}>Access the master tenant admin console.</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium" style={{ color: "#5a9999" }}>Email <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-500"
              style={{ background: "#0f2828", borderColor: "rgba(0,128,128,0.22)", color: "#c0efef" }}
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium" style={{ color: "#5a9999" }}>Password <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-500"
              style={{ background: "#0f2828", borderColor: "rgba(0,128,128,0.22)", color: "#c0efef" }}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
