import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  meta?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  disabled,
  loading,
  emptyMessage = "No results",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(query) ||
        o.sublabel?.toLowerCase().includes(query) ||
        o.meta?.toLowerCase().includes(query),
    );
  }, [options, q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((o) => !o)}
        className="select-dark w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left disabled:opacity-50"
      >
        <span className="truncate">
          {loading ? "Loading…" : selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className="shrink-0 opacity-60" />
      </button>

      {open && !disabled && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl shadow-xl overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          <div className="p-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                className="input-dark w-full pl-7 pr-7 py-1.5 text-xs"
                placeholder="Type to search…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
              {q && (
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setQ("")}>
                  <X size={12} style={{ color: "var(--text-muted)" }} />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-center" style={{ color: "var(--text-muted)" }}>{emptyMessage}</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                  className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5"
                  style={{
                    background: o.value === value ? "rgba(59,130,246,0.12)" : "transparent",
                    color: o.value === value ? "#60a5fa" : "var(--text-primary)",
                  }}
                >
                  <p className="font-medium truncate">{o.label}</p>
                  {(o.sublabel || o.meta) && (
                    <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {[o.sublabel, o.meta].filter(Boolean).join(" · ")}
                    </p>
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
