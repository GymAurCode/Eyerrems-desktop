import { useEffect, useState } from "react";
import {
  Save, AlertCircle, CheckCircle, Building2, FileText,
  Phone, Mail, Globe, DollarSign, Camera
} from "lucide-react";
import { api } from "../../../lib/api";

interface ReportSettings {
  company_name: string;
  tagline: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  uan_helpline: string;
  logo_url: string;
  currency_symbol: string;
  currency_code: string;
  thousands_separator: string;
  decimal_places: number;
  default_paper_size: string;
  default_orientation: string;
  show_seal_config: string;
  footer_note: string;
}

const DEFAULTS: ReportSettings = {
  company_name: "",
  tagline: "",
  address: "",
  phone: "",
  whatsapp: "",
  email: "",
  uan_helpline: "",
  logo_url: "",
  currency_symbol: "PKR",
  currency_code: "PKR",
  thousands_separator: ",",
  decimal_places: 2,
  default_paper_size: "A4",
  default_orientation: "portrait",
  show_seal_config: "",
  footer_note: "",
};

export default function ReportSettingsTab() {
  const [form, setForm] = useState<ReportSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/reports/settings");
      setForm({ ...DEFAULTS, ...data });
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErr("");
    setSaved(false);
    try {
      await api.put("/reports/settings", form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const update = (k: keyof ReportSettings, v: any) =>
    setForm((p) => ({ ...p, [k]: v }));

  const inputCls =
    "w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg,#3b82f6,#6366f1)",
            }}
          >
            <FileText size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-primary">
              Report Settings
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Configure company details used in all generated reports.
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {saving ? "Saving\u2026" : "Save Settings"}
        </button>
      </div>

      {err && (
        <div
          className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <AlertCircle size={12} /> {err}
        </div>
      )}
      {saved && (
        <div
          className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-2 rounded-lg"
          style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
          }}
        >
          <CheckCircle size={12} /> Report settings saved successfully.
        </div>
      )}

      {/* ── Company Info ───────────────────────────────── */}
      <Section icon={Building2} title="Company / Developer Information">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company Name">
            <input
              className={inputCls}
              value={form.company_name}
              onChange={(e) => update("company_name", e.target.value)}
            />
          </Field>
          <Field label="Tagline / Slogan">
            <input
              className={inputCls}
              value={form.tagline}
              onChange={(e) => update("tagline", e.target.value)}
            />
          </Field>
          <Field label="Address" span={2}>
            <textarea
              className={inputCls}
              rows={2}
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* ── Contact ─────────────────────────────────────── */}
      <Section icon={Phone} title="Contact Details">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <input
              className={inputCls}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </Field>
          <Field label="WhatsApp">
            <input
              className={inputCls}
              value={form.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
            />
          </Field>
          <Field label="Email">
            <input
              className={inputCls}
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>
          <Field label="UAN / Helpline">
            <input
              className={inputCls}
              value={form.uan_helpline}
              onChange={(e) => update("uan_helpline", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* ── Logo ────────────────────────────────────────── */}
      <Section icon={Camera} title="Logo / Branding">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Logo URL">
            <input
              className={inputCls}
              placeholder="https://example.com/logo.png"
              value={form.logo_url}
              onChange={(e) => update("logo_url", e.target.value)}
            />
          </Field>
          <Field label="Currency Symbol">
            <input
              className={inputCls}
              value={form.currency_symbol}
              onChange={(e) => update("currency_symbol", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* ── Formatting ──────────────────────────────────── */}
      <Section icon={DollarSign} title="Number & Paper Formatting">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Currency Code">
            <select
              className={inputCls}
              value={form.currency_code}
              onChange={(e) => update("currency_code", e.target.value)}
            >
              <option value="PKR">PKR - Pakistani Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="AED">AED - Dirham</option>
              <option value="SAR">SAR - Riyal</option>
              <option value="GBP">GBP - Pound</option>
              <option value="EUR">EUR - Euro</option>
            </select>
          </Field>
          <Field label="Decimal Places">
            <input
              type="number"
              className={inputCls}
              min={0}
              max={4}
              value={form.decimal_places}
              onChange={(e) =>
                update("decimal_places", parseInt(e.target.value) || 2)
              }
            />
          </Field>
          <Field label="Paper Size">
            <select
              className={inputCls}
              value={form.default_paper_size}
              onChange={(e) => update("default_paper_size", e.target.value)}
            >
              <option value="A4">A4</option>
              <option value="LETTER">Letter</option>
              <option value="LEGAL">Legal</option>
            </select>
          </Field>
          <Field label="Thousand Separator">
            <input
              className={inputCls}
              maxLength={2}
              value={form.thousands_separator}
              onChange={(e) =>
                update("thousands_separator", e.target.value)
              }
            />
          </Field>
          <Field label="Orientation">
            <select
              className={inputCls}
              value={form.default_orientation}
              onChange={(e) => update("default_orientation", e.target.value)}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* ── Footer ──────────────────────────────────────── */}
      <Section icon={FileText} title="Footer & Disclaimers">
        <Field label="Footer Note / Disclaimer">
          <textarea
            className={inputCls}
            rows={3}
            value={form.footer_note}
            onChange={(e) => update("footer_note", e.target.value)}
          />
        </Field>
      </Section>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="card-dark rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      <div
        className="px-5 py-4 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Icon size={14} className="text-indigo-400" />
        <p className="text-xs font-semibold text-primary uppercase tracking-wider">
          {title}
        </p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  span,
}: {
  label: string;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-muted mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
