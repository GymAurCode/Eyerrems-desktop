import { useState, useEffect, useCallback } from "react";
import { Plus, X, Check, Trash2, Search, Loader2 } from "lucide-react";
import { lookupApi, LookupValue } from "../lib/lookupApi";
import { invalidateLookupCache } from "../hooks/useLookup";
import ConfirmDialog from "../components/actions/ConfirmDialog";
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
};

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");

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
  const [newRows, setNewRows] = useState<number[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editStates, setEditStates] = useState<Record<string, RowEditState>>({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await lookupApi.getAll();
      setCategories(data);
      if (!selectedCategory && Object.keys(data).length > 0) {
        setSelectedCategory(Object.keys(data)[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchAll();
  }, []);

  const currentValues = selectedCategory ? categories[selectedCategory] ?? [] : [];
  const filteredCategories = Object.keys(categories).filter((cat) =>
    (CATEGORY_LABELS[cat] ?? cat).toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSaveRow = async (data: Partial<LookupValue> & { id?: number }) => {
    if (!selectedCategory) return;
    if (data.id) {
      await lookupApi.update(data.id, {
        label: data.label,
        value: data.value,
        sort_order: data.sort_order,
        is_default: data.is_default,
        is_active: data.is_active,
      });
    } else {
      await lookupApi.create({
        category: selectedCategory,
        label: data.label!,
        value: data.value!,
        sort_order: data.sort_order,
        is_default: data.is_default,
      });
    }
    invalidateLookupCache(selectedCategory);
    await fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await lookupApi.remove(deleteTarget.id);
      invalidateLookupCache(selectedCategory!);
      await fetchAll();
    } catch {
      // ignore
    } finally {
      setDeleteTarget(null);
    }
  };

  const addNewRow = () => {
    setNewRows((prev) => [...prev, Date.now()]);
  };

  const removeNewRow = (key: number) => {
    setNewRows((prev) => prev.filter((k) => k !== key));
  };

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

  const updateEdit = (rk: string, patch: Partial<RowEditState>) => {
    setEditStates((prev) => ({ ...prev, [rk]: { ...prev[rk], ...patch } }));
  };

  const handleSaveEdit = async (rk: string, item: Partial<LookupValue> & { id?: number }) => {
    const st = editStates[rk];
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
  };

  const combinedData = [
    ...newRows.map((key) => ({ _key: `n-${key}`, _isNew: true, sort_order: currentValues.length + 1, is_active: true } as any)),
    ...currentValues.map((item) => ({ _key: `v-${item.id}`, _isNew: false, ...item })),
  ];

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
          const active = vals.filter((v) => v.is_active).length;
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
              <div className="flex items-center justify-between">
                <span>{label}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(59,130,246,0.12)",
                    color: "#3b82f6",
                  }}
                >
                  {active}
                </span>
              </div>
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

            <DataTable
              data={combinedData}
              getRowId={(row) => row._key}
              columns={[
                { key: "sort_order", label: "Sort Order", width: 80, render: (val, row) => {
                  const st = editStates[row._key];
                  if (!st) return val;
                  return (
                    <input type="number" value={st.sort_order}
                      onChange={(e) => updateEdit(row._key, { sort_order: Number(e.target.value) })}
                      className="w-14 px-1.5 py-1 text-xs rounded outline-none text-center"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    />
                  );
                }},
                { key: "label", label: "Label", render: (val, row) => {
                  const st = editStates[row._key];
                  if (!st) return val;
                  return (
                    <input type="text" value={st.label}
                      onChange={(e) => { updateEdit(row._key, { label: e.target.value }); if (row._isNew && !editStates[row._key]?.value) updateEdit(row._key, { value: slugify(e.target.value) }); }}
                      className="w-full px-1.5 py-1 text-xs rounded outline-none"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    />
                  );
                }},
                { key: "value", label: "Value", render: (val, row) => {
                  const st = editStates[row._key];
                  if (!st) return val;
                  return (
                    <input type="text" value={st.value}
                      onChange={(e) => updateEdit(row._key, { value: e.target.value })}
                      className="w-full px-1.5 py-1 text-xs rounded outline-none font-mono"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    />
                  );
                }},
                { key: "is_default", label: "Default", align: "center", render: (val, row) => {
                  const st = editStates[row._key];
                  if (!st) return val ? "✓" : "";
                  return <input type="radio" name="default-radio" checked={st.is_default} onChange={() => updateEdit(row._key, { is_default: true })} />;
                }},
                { key: "is_active", label: "Active", align: "center", render: (val, row) => {
                  const st = editStates[row._key];
                  if (!st) return val ? "✓" : "";
                  return (
                    <button type="button" onClick={() => updateEdit(row._key, { is_active: !st.is_active })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${st.is_active ? "bg-green-500" : "bg-tertiary"}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${st.is_active ? "translate-x-4" : "translate-x-1"}`} />
                    </button>
                  );
                }},
                { key: "actions", label: "Actions", align: "center", render: (val, row) => {
                  const st = editStates[row._key];
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
              ]}
              variant="bordered"
              searchable={false}
              emptyTitle="No values found"
              emptyDescription='Click "+ Add New Value" to get started'
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Value"
        message={`Delete '${deleteTarget?.label}'? This will remove it from the dropdown.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
