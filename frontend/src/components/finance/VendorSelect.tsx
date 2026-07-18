import { useState, useEffect, useRef } from "react";
import { Search, X, Building2, Phone, MapPin, Hash, Check, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import { MODULE_COLORS } from "../../config/moduleColors";

const ACCENT = MODULE_COLORS.finance.primary;

export interface Vendor {
  id: number;
  vendor_code: string | null;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  ntn: string | null;
  strn: string | null;
  payment_terms: string | null;
  credit_limit: number | null;
  outstanding_amount: number;
  is_active: boolean;
}

interface Props {
  value: { id: number; name: string } | null;
  onChange: (vendor: { id: number; name: string; phone?: string; email?: string; address?: string; ntn?: string; strn?: string } | null) => void;
  label?: string;
}

export default function VendorSelect({ value, onChange, label = "Vendor" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/finance/vendors/search", { params: { q: search } });
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
      <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
        {label} <span className="text-[11px] text-muted">(search & select)</span>
      </label>
      {value ? (
        <div className="flex items-center justify-between p-2 rounded-lg"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <Building2 size={14} className="text-emerald-400 shrink-0" />
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
          className="w-full flex items-center gap-2 p-2 rounded-lg text-xs text-muted hover:text-primary transition-all"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <Search size={12} />
          Search vendor...
        </button>
      )}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg shadow-xl border overflow-hidden"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", maxHeight: "280px" }}>
          <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 px-2 py-1 rounded-md" style={{ background: "var(--bg-primary)" }}>
              <Search size={12} className="text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type vendor name, phone, NTN..."
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
                <Building2 size={20} className="mb-1 opacity-50" />
                <p className="text-[10px]">No vendors found</p>
              </div>
            ) : (
              results.map((v) => (
                <button key={v.id} onClick={() => { onChange({ id: v.id, name: v.name, phone: v.phone || undefined, email: v.email || undefined, address: v.address || undefined, ntn: v.ntn || undefined, strn: v.strn || undefined }); setIsOpen(false); }}
                  className="w-full p-2.5 text-left hover:bg-[var(--bg-hover)] transition-all flex items-start gap-3"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <Building2 size={14} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-primary">{v.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {v.phone && <span className="text-[9px] text-muted flex items-center gap-1"><Phone size={8} /> {v.phone}</span>}
                      {v.ntn && <span className="text-[9px] text-muted flex items-center gap-1"><Hash size={8} /> NTN: {v.ntn}</span>}
                      {v.strn && <span className="text-[9px] text-muted flex items-center gap-1"><Hash size={8} /> STRN: {v.strn}</span>}
                      {v.outstanding_amount > 0 && <span className="text-[9px] text-yellow-400">Outstanding: PKR {v.outstanding_amount.toLocaleString()}</span>}
                    </div>
                    {v.address && <p className="text-[9px] text-muted flex items-center gap-1 mt-0.5"><MapPin size={8} /> {v.address}</p>}
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
