import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown, Search, X, Loader2 } from "lucide-react";
import { api } from "../../lib/api";

export interface AsyncSelectOption {
  id: number | string;
  label: string;
  subtext?: string;
}

interface AsyncDebouncedSelectProps {
  endpoint: string;
  searchParam?: string;
  placeholder?: string;
  value: number | string | null;
  onChange: (option: AsyncSelectOption | null) => void;
  disabled?: boolean;
  pageSize?: number;
}

export default function AsyncDebouncedSelect({
  endpoint,
  searchParam = "search",
  placeholder = "Search…",
  value,
  onChange,
  disabled,
  pageSize = 20,
}: AsyncDebouncedSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<AsyncSelectOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selected = options.find((o) => o.id === value);

  // ── Fetch helper ────────────────────────────────────────────────────────────
  const fetchOptions = useCallback(
    async (search: string, pageNum: number, append: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!append) setLoading(true);
      else setLoadingPage(true);
      setError(null);

      try {
        const params: Record<string, string | number> = {
          [searchParam]: search,
          page: pageNum,
          limit: pageSize,
        };
        const { data } = await api.get(endpoint, {
          params,
          signal: controller.signal,
        });

        const items: AsyncSelectOption[] = data.items ?? data.data ?? [];
        const total = data.totalPages ?? data.total_pages ?? 1;

        setOptions((prev) => (append ? [...prev, ...items] : items));
        setTotalPages(total);
      } catch (err: any) {
        if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
          setError(err?.response?.data?.detail ?? "Failed to load options");
        }
      } finally {
        setLoading(false);
        setLoadingPage(false);
      }
    },
    [endpoint, searchParam, pageSize],
  );

  // ── Debounced search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchOptions(q, 1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, open, fetchOptions]);

  // ── Infinite scroll via IntersectionObserver ─────────────────────────────────
  useEffect(() => {
    if (!open || !sentinelRef.current) return;
    const sentinel = sentinelRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !loadingPage && !loading && page < totalPages) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchOptions(q, nextPage, true);
        }
      },
      { root: sentinel.parentElement, rootMargin: "100px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, page, totalPages, loadingPage, loading, q, fetchOptions]);

  // ── Click outside ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // ── Re-fetch when endpoint changes while open ────────────────────────────────
  useEffect(() => {
    if (open) {
      setPage(1);
      fetchOptions(q, 1, false);
    }
  }, [endpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSelect = (opt: AsyncSelectOption) => {
    onChange(opt);
    setOpen(false);
    setQ("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setQ("");
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* ── Trigger ─────────────────────────────────────────────────────────── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="select-dark w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left disabled:opacity-50"
      >
        {value !== null && value !== undefined && selected ? (
          <span className="truncate">{selected.label}</span>
        ) : (
          <span style={{ color: "var(--text-muted)" }} className="truncate">
            {placeholder}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {value !== null && value !== undefined && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              style={{ color: "var(--text-muted)" }}
              className="hover:opacity-80"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={14} className="opacity-60" />
        </div>
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────────────── */}
      {open && !disabled && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl shadow-xl overflow-hidden"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
        >
          {/* ── Search input ──────────────────────────────────────────────── */}
          <div style={{ borderBottom: "1px solid var(--border-subtle)" }} className="p-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                ref={inputRef}
                className="input-dark w-full pl-7 pr-7 py-1.5 text-xs"
                placeholder="Type to search…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
              {q && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setQ("")}
                  style={{ color: "var(--text-muted)" }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* ── Options list ──────────────────────────────────────────────── */}
          <div className="max-h-60 overflow-y-auto" style={{ scrollBehavior: "smooth" }}>
            {/* Initial load */}
            {loading && options.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading…</span>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <p className="px-3 py-4 text-xs text-center" style={{ color: "#ef4444" }}>
                {error}
              </p>
            )}

            {/* Empty state */}
            {!loading && !error && options.length === 0 && (
              <p className="px-3 py-4 text-xs text-center" style={{ color: "var(--text-muted)" }}>
                No results found
              </p>
            )}

            {/* Options */}
            {options.map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt)}
                className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5"
                style={{
                  background:
                    opt.id === value ? "rgba(59,130,246,0.12)" : "transparent",
                  color: opt.id === value ? "#60a5fa" : "var(--text-primary)",
                  borderBottom:
                    idx < options.length - 1
                      ? "1px solid var(--border-subtle)"
                      : undefined,
                }}
              >
                <p className="font-medium truncate">{opt.label}</p>
                {opt.subtext && (
                  <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {opt.subtext}
                  </p>
                )}
              </button>
            ))}

            {/* Page-loading spinner */}
            {loadingPage && (
              <div className="flex items-center justify-center py-3">
                <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} />
              </div>
            )}

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-px" />
          </div>
        </div>
      )}
    </div>
  );
}
