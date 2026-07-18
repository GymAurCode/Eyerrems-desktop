import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, X, Check, Trash2, Search, Loader2, RefreshCw, Eye } from "lucide-react";
import { lookupApi, LookupValue, SeedPreviewItem } from "../lib/lookupApi";
import { invalidateLookupCache } from "../hooks/useLookup";
import AppDialog from "../components/ui/AppDialog";
import { useNotifStore } from "../store/notifications";
import { DataTable } from "../components/data-table";

const CATEGORY_LABELS: Record<string, string> = {
  property_type: "Property Type",
  property_status: "Property Status",
  unit_type: "Unit Type",
  furnishing_status: "Furnishing Status",
  tenant_status: "Tenant Status",
  id_type: "ID Type",
  nationality: "Nationality",
  lease_type: "Lease Type",
  lease_status: "Lease Status",
  payment_method: "Payment Method",
  lead_status: "Lead Status",
  lead_source: "Lead Source",
  priority: "Priority",
  client_status: "Client Status",
  dealer_status: "Dealer Status",
  employee_status: "Employee Status",
  department: "Department",
  employment_type: "Employment Type",
  maintenance_category: "Maintenance Category",
  maintenance_status: "Maintenance Status",
  maintenance_priority: "Maintenance Priority",
  expense_category: "Expense Category",
  invoice_status: "Invoice Status",
  document_status: "Document Status",
  booking_status: "Booking Status",
  unit_status: "Unit Status",
  deal_status: "Deal Status",
  down_payment_status: "Down Payment Status",
  commission_type: "Commission Type",
  client_role: "Client Role",
  gender: "Gender",
  payment_status: "Payment Status",
  account_type: "Account Type",

  installment_type: "Installment Type",
  listing_status: "Listing Status",
  operational_status: "Operational Status",
  size_unit: "Size Unit",
  owner_type: "Owner Type",
  regulatory_authority: "Regulatory Authority",
  unit_ownership: "Unit Ownership",
  contact_type: "Contact Type",
  payment_frequency: "Payment Frequency",
};

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");

const getRowId = (row: any) => row._key;

interface RowEditState {
  label: string;
  value: string;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  saving: boolean;
  saved: boolean;
}

export default function AdvanceOptionsPage() {
  const [categories, setCategories] = useState<Record<string, LookupValue[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pushToast = useNotifStore((s) => s.pushToast);
  const [newRows, setNewRows] = useState<number[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editStates, setEditStates] = useState<Record<string, RowEditState>>({});
  const editStatesRef = useRef(editStates);
  editStatesRef.current = editStates;
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seedPreview, setSeedPreview] = useState<SeedPreviewItem[]>([]);
  const [seedPreviewLoaded, setSeedPreviewLoaded] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await lookupApi.getAll(true);
      setCategories(data);
    } catch (e) {
      setLoadError("Failed to load options. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    lookupApi.getSeedDefaults().then(setSeedPreview).catch(() => {}).finally(() => setSeedPreviewLoaded(true));
  }, [fetchAll]);

  useEffect(() => {
    if (!selectedCategory && Object.keys(categories).length > 0) {
      setSelectedCategory(Object.keys(categories)[0]);
    }
  }, [selectedCategory, categories]);

  const handleSeedDefaults = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const result = await lookupApi.seedDefaults();
      setSeedMessage(result.message);
      invalidateLookupCache();
      await fetchAll();
    } catch {
      setSeedMessage("Failed to seed default values.");
    } finally {
      setSeeding(false);
      setTimeout(() => setSeedMessage(null), 5000);
    }
  };

  const currentValues = useMemo(
    () => (selectedCategory ? categories[selectedCategory] ?? [] : []),
    [categories, selectedCategory],
  );
  const filteredCategories = useMemo(
    () => {
      const allKeys = new Set([
        ...Object.keys(categories),
        ...Object.keys(CATEGORY_LABELS),
      ]);
      return Array.from(allKeys).filter((cat) =>
        (CATEGORY_LABELS[cat] ?? cat).toLowerCase().includes(searchTerm.toLowerCase()),
      );
    },
    [categories, searchTerm],
  );

  const handleSaveRow = useCallback(async (data: Partial<LookupValue> & { id?: number }) => {
    if (!selectedCategory) return;
    if (data.id) {
      await lookupApi.update(data.id, {
        label: data.label,
        value: data.value,
        sort_order: data.sort_order,
        is_default: data.is_default,
        is_active: data.is_active,
      });
      pushToast({ title: "Success", message: "Value updated", type: "success" });
    } else {
      await lookupApi.create({
        category: selectedCategory,
        label: data.label!,
        value: data.value!,
        sort_order: data.sort_order,
        is_default: data.is_default,
      });
      pushToast({ title: "Success", message: "Value created", type: "success" });
    }
    invalidateLookupCache(selectedCategory);
    await fetchAll();
  }, [selectedCategory, fetchAll]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await lookupApi.remove(deleteTarget.id);
      pushToast({ title: "Success", message: `"${deleteTarget.label}" deleted`, type: "success" });
      invalidateLookupCache(selectedCategory!);
      await fetchAll();
    } catch {
      pushToast({ title: "Error", message: "Failed to delete value", type: "error" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const addNewRow = useCallback(() => {
    setNewRows((prev) => [...prev, Date.now()]);
  }, []);

  const removeNewRow = useCallback((key: number) => {
    setNewRows((prev) => prev.filter((k) => k !== key));
  }, []);

  useEffect(() => {
    const next: Record<string, RowEditState> = {};
    currentValues.forEach((item) => {
      const k = `v-${item.id}`;
      next[k] = {
        label: item.label ?? "",
        value: item.value ?? "",
        sort_order: item.sort_order ?? 0,
        is_default: item.is_default ?? false,
        is_active: item.is_active ?? true,
        saving: false,
        saved: false,
      };
    });
    newRows.forEach((key) => {
      const k = `n-${key}`;
      next[k] = {
        label: "",
        value: "",
        sort_order: currentValues.length + 1,
        is_default: false,
        is_active: true,
        saving: false,
        saved: false,
      };
    });
    setEditStates(next);
  }, [currentValues, newRows]);

  const updateEdit = useCallback((rk: string, patch: Partial<RowEditState>) => {
    setEditStates((prev) => ({ ...prev, [rk]: { ...prev[rk], ...patch } }));
  }, []);

  const handleSaveEdit = useCallback(async (rk: string, item: Partial<LookupValue> & { id?: number }) => {
    const st = editStatesRef.current[rk];
    if (!st || !st.label.trim() || !st.value.trim()) return;
    updateEdit(rk, { saving: true });
    try {
      await handleSaveRow({
        id: item.id,
        label: st.label.trim(),
        value: st.value.trim(),
        sort_order: st.sort_order,
        is_default: st.is_default,
        is_active: st.is_active,
      });
      updateEdit(rk, { saved: true, saving: false });
      setTimeout(() => updateEdit(rk, { saved: false }), 2000);
    } catch {
      updateEdit(rk, { saving: false });
    }
  }, [handleSaveRow]);

  const combinedData = useMemo(
    () => [
      ...newRows.map((key) => ({ _key: `n-${key}`, _isNew: true, sort_order: currentValues.length + 1, is_active: true } as const)),
      ...currentValues.map((item) => ({ _key: `v-${item.id}`, _isNew: false as const, ...item })),
    ],
    [newRows, currentValues],
  );

  const columns = useMemo(
    () => [
      { key: "sort_order", label: "Sort Order", width: 80, render: (val: any, row: any) => {
        const st = editStatesRef.current[row._key];
        if (!st) return val;
        return (
          <input type="number" value={st.sort_order}
            onChange={(e) => updateEdit(row._key, { sort_order: Number(e.target.value) })}
            className="w-14 px-1.5 py-1 text-xs rounded outline-none text-center"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
        );
      }},
      { key: "label", label: "Label", render: (val: any, row: any) => {
        const st = editStatesRef.current[row._key];
        if (!st) return val;
        return (
          <input type="text" value={st.label}
            onChange={(e) => { updateEdit(row._key, { label: e.target.value }); if (row._isNew && !editStatesRef.current[row._key]?.value) updateEdit(row._key, { value: slugify(e.target.value) }); }}
            className="w-full px-1.5 py-1 text-xs rounded outline-none"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
        );
      }},
      { key: "value", label: "Value", render: (val: any, row: any) => {
        const st = editStatesRef.current[row._key];
        if (!st) return val;
        return (
          <input type="text" value={st.value}
            onChange={(e) => updateEdit(row._key, { value: e.target.value })}
            className="w-full px-1.5 py-1 text-xs rounded outline-none font-mono"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          />
        );
      }},
      { key: "is_default", label: "Default", align: "center" as const, render: (val: any, row: any) => {
        const st = editStatesRef.current[row._key];
        if (!st) return val ? "✓" : "";
        return <input type="radio" name="default-radio" checked={st.is_default} onChange={() => updateEdit(row._key, { is_default: true })} />;
      }},
      { key: "is_active", label: "Active", align: "center" as const, render: (val: any, row: any) => {
        const st = editStatesRef.current[row._key];
        if (!st) return val ? "✓" : "";
        return (
          <button type="button" onClick={() => updateEdit(row._key, { is_active: !st.is_active })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${st.is_active ? "bg-green-500" : "bg-tertiary"}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${st.is_active ? "translate-x-4" : "translate-x-1"}`} />
          </button>
        );
      }},
      { key: "usage_count", label: "Used In", align: "center" as const, width: 64, render: (val: any, row: any) => {
        if (row._isNew) return <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>—</span>;
        const count = Number(val) || 0;
        return (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{
            background: count > 0 ? "rgba(59,130,246,0.12)" : "transparent",
            color: count > 0 ? "#3b82f6" : "var(--text-tertiary)",
          }}>
            {count > 0 ? `${count} record${count === 1 ? "" : "s"}` : "none"}
          </span>
        );
      }},
      { key: "actions", label: "Actions", align: "center" as const, render: (val: any, row: any) => {
        const st = editStatesRef.current[row._key];
        const saving = st?.saving;
        const saved = st?.saved;
        const canSave = st?.label.trim() && st?.value.trim();
        return (
          <div className="flex items-center gap-1">
            {saving ? (
              <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
            ) : (
              <button type="button" onClick={() => handleSaveEdit(row._key, row)} disabled={!canSave}
                className="p-1 rounded transition-colors disabled:opacity-40"
                style={{ color: saved ? "#22c55e" : "#3b82f6" }} title={saved ? "Saved" : "Save"}>
                <Check size={14} />
              </button>
            )}
            {row._isNew ? (
              <button type="button" onClick={() => removeNewRow(Number(row._key.slice(2)))}
                className="p-1 rounded transition-colors" style={{ color: "#ef4444" }} title="Cancel">
                <X size={14} />
              </button>
            ) : (
              <button type="button" onClick={() => setDeleteTarget({ id: row.id, label: row.label })}
                className="p-1 rounded transition-colors hover:bg-red-500/20" style={{ color: "#ef4444" }} title="Delete">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      }},
    ],
    [updateEdit, handleSaveEdit, removeNewRow, setDeleteTarget],
  );

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0">
      {/* ── Left sidebar: category list ── */}
      <div
        className="w-64 shrink-0 overflow-y-auto p-3"
        style={{ borderRight: "1px solid var(--border)", background: "var(--bg-surface)" }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          Advance Options
        </h2>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none"
            style={{
              background: "var(--bg-surface-hover)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        {filteredCategories.map((cat) => {
          const vals = categories[cat] ?? [];
          const label = CATEGORY_LABELS[cat] ?? cat;
          const active = vals.filter((v) => v.is_active);
          const displayVals = active.slice(0, 3);
          const remaining = active.length - 3;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mb-0.5"
              style={{
                background: selectedCategory === cat ? "var(--bg-surface-hover)" : "transparent",
                color: "var(--text-primary)",
                border: selectedCategory === cat ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              <div className="mb-1">
                <span className="font-medium">{label}</span>
              </div>
              {displayVals.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {displayVals.map((v) => (
                    <span
                      key={v.id}
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: "var(--bg-surface)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-subtle, var(--border))",
                      }}
                    >
                      {v.label}
                    </span>
                  ))}
                  {remaining > 0 && (
                    <span className="text-[10px] text-muted">+{remaining} more</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
        {filteredCategories.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: "var(--text-secondary)" }}>
            No categories found
          </p>
        )}
      </div>

      {/* ── Right panel: values table ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{loadError}</p>
            <button
              type="button"
              onClick={fetchAll}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors"
              style={{ background: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        ) : !selectedCategory ? (
          <div className="flex items-center justify-center py-12 text-xs" style={{ color: "var(--text-secondary)" }}>
            Select a category from the left panel
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {CATEGORY_LABELS[selectedCategory] ?? selectedCategory}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSeedDefaults}
                  disabled={seeding}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  title="Add default values for all empty categories"
                >
                  {seeding ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {seeding ? "Restoring..." : "Add Default Values"}
                </button>
                <button
                  type="button"
                  onClick={addNewRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                  style={{ background: "#22c55e", color: "#fff" }}
                >
                  <Plus size={14} />
                  Add New Value
                </button>
              </div>
            </div>
            {seedMessage && (
              <div
                className="mb-3 px-3 py-2 text-xs rounded-lg"
                style={{
                  background: seedMessage.includes("Failed") ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                  color: seedMessage.includes("Failed") ? "#ef4444" : "#22c55e",
                  border: `1px solid ${seedMessage.includes("Failed") ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                }}
              >
                {seedMessage}
              </div>
            )}

            {currentValues.length === 0 && seedPreviewLoaded && (
              <div
                className="mb-4 rounded-lg p-3"
                style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Eye size={14} style={{ color: "#3b82f6" }} />
                  <span className="text-xs font-medium" style={{ color: "#3b82f6" }}>
                    Default Values Available
                  </span>
                </div>
                <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
                  The following defaults will be added when you click "Add Default Values":
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {seedPreview
                    .filter((s) => s.category === selectedCategory)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded"
                        style={{
                          background: s.is_default
                            ? "rgba(34,197,94,0.12)"
                            : "var(--bg-surface)",
                          color: s.is_default ? "#22c55e" : "var(--text-primary)",
                          border: s.is_default
                            ? "1px solid rgba(34,197,94,0.3)"
                            : "1px solid var(--border)",
                        }}
                      >
                        {s.label}
                        {s.is_default && <span className="text-[10px] opacity-70">default</span>}
                      </span>
                    ))}
                </div>
              </div>
            )}

            <DataTable
              data={combinedData}
              getRowId={getRowId}
              columns={columns}
              variant="bordered"
              searchable={false}
              emptyTitle="No values found"
              emptyDescription='Click "+ Add New Value" to get started'
            />
          </>
        )}
      </div>

      <AppDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Value"
        accentColor="#ef4444"
      >
        <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
          Delete '{deleteTarget?.label}'? This will remove it from the dropdown.
        </p>
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={() => setDeleteTarget(null)} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
          <button onClick={handleDelete} className="px-4 py-2 text-xs font-medium rounded-lg" style={{ background: "#ef4444", color: "#fff" }}>Delete</button>
        </div>
      </AppDialog>
    </div>
  );
}
