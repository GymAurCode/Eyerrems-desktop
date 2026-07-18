import { useState, useEffect, useRef } from "react";
import { Search, X, User, Phone, Hash, Loader2, Mail, Check } from "lucide-react";
import { api } from "../../lib/api";
import { MODULE_COLORS } from "../../config/moduleColors";

const ACCENT = MODULE_COLORS.finance.primary;

export interface TenantOption {
  id: number;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cnic: string | null;
}

interface Props {
  value: { id: number; name: string } | null;
  onChange: (tenant: { id: number; name: string; phone?: string; email?: string; cnic?: string } | null) => void;
}

export default function TenantSelect({ value, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/tenants/", { params: { search, limit: 50 } });
        setResults(Array.isArray(data) ? data : []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {value ? (
        <div className="flex items-center justify-between dialog-input px-3"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <User size={14} className="text-emerald-400 shrink-0" />
            <div className="truncate">
              <p className="text-xs font-medium text-primary truncate">{value.name}</p>
            </div>
          </div>
          <button onClick={() => onChange(null)} className="text-muted hover:text-red-400 shrink-0 ml-2">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button onClick={() => setIsOpen(!isOpen)}
          className="dialog-input w-full flex items-center gap-2 text-xs text-muted hover:text-primary">
          <Search size={12} />
          Search tenant...
        </button>
      )}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg shadow-xl border overflow-hidden"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", maxHeight: "280px" }}>
          <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 px-2 py-1 rounded-md" style={{ background: "var(--bg-primary)" }}>
              <Search size={12} className="text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type tenant name, phone, ID..."
                className="bg-transparent text-xs w-full outline-none text-primary placeholder:text-muted" autoFocus />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[200px]">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin" style={{ color: ACCENT }} />
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-muted">
                <User size={20} className="mb-1 opacity-50" />
                <p className="text-[10px]">No tenants found</p>
              </div>
            ) : (
              results.map((t) => (
                <button key={t.id} onClick={() => { onChange({ id: t.id, name: t.name, phone: t.phone || undefined, email: t.email || undefined, cnic: t.cnic || undefined }); setIsOpen(false); }}
                  className="w-full p-2.5 text-left hover:bg-[var(--bg-hover)] transition-all flex items-start gap-3"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <User size={14} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-primary">{t.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {t.tenant_id && <span className="text-[9px] text-muted flex items-center gap-1"><Hash size={8} /> {t.tenant_id}</span>}
                      {t.phone && <span className="text-[9px] text-muted flex items-center gap-1"><Phone size={8} /> {t.phone}</span>}
                      {t.cnic && <span className="text-[9px] text-muted flex items-center gap-1"><Hash size={8} /> CNIC: {t.cnic}</span>}
                    </div>
                    {t.email && <p className="text-[9px] text-muted flex items-center gap-1 mt-0.5"><Mail size={8} /> {t.email}</p>}
                  </div>
                  <Check size={12} className="mt-1 shrink-0 opacity-0" style={{ color: ACCENT }} />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
