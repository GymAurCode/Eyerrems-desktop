import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api";
import { Settings, Upload, Trash2, Loader2 } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { useNotifStore } from "../../store/notifications";

interface SettingsData {
  company_name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  reg_no: string;
  footer_note: string;
  show_logo_watermark: boolean;
  logo_url: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-secondary mb-1">{label}</label>
      {children}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-theme p-4 space-y-3">
      <p className="text-xs font-semibold text-primary">{title}</p>
      {children}
    </div>
  );
}

export default function ReportSettingsModal({ open, onClose }: Props) {
  const pushToast = useNotifStore((s) => s.pushToast);
  const [form, setForm] = useState<SettingsData>({
    company_name: "",
    tagline: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    reg_no: "",
    footer_note: "",
    show_logo_watermark: true,
    logo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    api.get("/reports/settings").then(({ data }) => {
      setForm({
        company_name: data.company_name || "",
        tagline: data.tagline || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
        website: data.website || "",
        reg_no: data.reg_no || "",
        footer_note: data.footer_note || "",
        show_logo_watermark: data.show_logo_watermark !== false,
        logo_url: data.logo_url || "",
      });
    }).catch(() => setError("Failed to load settings"));
  }, [open]);

  const update = (key: keyof SettingsData, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await api.put("/reports/settings", {
        company_name: form.company_name,
        tagline: form.tagline,
        address: form.address,
        phone: form.phone,
        email: form.email,
        website: form.website,
        reg_no: form.reg_no,
        footer_note: form.footer_note,
        show_logo_watermark: form.show_logo_watermark,
      });
      pushToast({ title: "Success", message: "Settings saved", type: "success" });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      setError("Only PNG, JPEG, and SVG files are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("File too large. Maximum size is 2MB");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/reports/settings/logo", fd);
      update("logo_url", data.logo_url);
      pushToast({ title: "Success", message: "Logo uploaded", type: "success" });
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    setUploading(true);
    setError("");
    try {
      await api.delete("/reports/settings/logo");
      update("logo_url", "");
      pushToast({ title: "Success", message: "Logo removed", type: "success" });
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to remove logo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppDialog
      isOpen={open}
      onClose={onClose}
      title="Report Settings"
      subtitle="Configure company details used in all generated reports"
      size="lg"
      icon={<Settings size={16} />}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border border-theme text-secondary hover:bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      }
    >
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
          {error}
        </div>
      )}

      <SectionCard title="Company Details">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company Name">
            <input
              type="text"
              className="dialog-input"
              value={form.company_name}
              onChange={(e) => update("company_name", e.target.value)}
            />
          </Field>
          <Field label="Tagline / Slogan">
            <input
              type="text"
              className="dialog-input"
              value={form.tagline}
              onChange={(e) => update("tagline", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Address">
          <textarea
            className="dialog-textarea"
            rows={2}
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </Field>
        <Field label="Registration No.">
          <input
            type="text"
            className="dialog-input"
            value={form.reg_no}
            onChange={(e) => update("reg_no", e.target.value)}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Contact">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input
              type="text"
              className="dialog-input"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="dialog-input"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Website">
          <input
            type="text"
            className="dialog-input"
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Company Logo">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-lg border border-theme flex items-center justify-center overflow-hidden shrink-0 bg-tertiary">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-lg font-bold text-muted">
                {(form.company_name || "RE").slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-theme text-secondary hover:bg-hover transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? "Uploading..." : "Upload Logo"}
            </button>
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg" className="hidden" onChange={handleUploadLogo} />
            {form.logo_url && (
              <button
                onClick={handleRemoveLogo}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-theme text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} />
                Remove Logo
              </button>
            )}
            <p className="text-xs text-muted">PNG, JPEG, or SVG. Max 2MB.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Watermark">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.show_logo_watermark}
            onChange={(e) => update("show_logo_watermark", e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-500"
          />
          <span className="text-sm text-secondary">Show logo as watermark on reports</span>
        </label>
        <p className="text-xs text-muted mt-1">
          When enabled, the logo appears faded behind report content on every page.
        </p>
      </SectionCard>

      <SectionCard title="Default Footer Note">
        <textarea
          className="dialog-textarea"
          rows={3}
          value={form.footer_note}
          onChange={(e) => update("footer_note", e.target.value)}
          placeholder="Disclaimer, terms, or other default footer text..."
        />
      </SectionCard>
    </AppDialog>
  );
}
