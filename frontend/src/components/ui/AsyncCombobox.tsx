import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { api } from "../../lib/api";

interface Props {
  endpoint: string;
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  searchParam?: string;
  queryParams?: Record<string, any>;
}

export default function AsyncCombobox({
  endpoint,
  value,
  onChange,
  placeholder = "Search or type...",
  searchParam = "search",
  queryParams,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params: Record<string, any> = { [searchParam]: search, limit: 50, ...queryParams };
        const { data } = await api.get(endpoint, { params });
        const items = Array.isArray(data) ? data : data.items ?? data.data ?? [];
        setResults(items);
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

  const selected = results.find((r) => String(r.id) === String(value));

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        ref={inputRef}
        className="dialog-input w-full text-xs"
        type="text"
        value={selected ? selected.label : search}
        onChange={(e) => {
          setSearch(e.target.value);
          if (selected && e.target.value !== selected.label) {
            onChange(null);
          }
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg shadow-xl border overflow-hidden"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", maxHeight: "280px" }}>
          <div className="overflow-y-auto max-h-[240px]">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
              </div>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-xs text-center text-muted">No results found</p>
            ) : (
              results.map((item: any) => (
                <button key={item.id} onClick={() => { onChange(item.id); setSearch(item.label); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] transition-colors"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <p className="font-medium text-primary truncate">{item.label}</p>
                  {item.subtext && (
                    <p className="text-[10px] text-muted truncate mt-0.5">{item.subtext}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
