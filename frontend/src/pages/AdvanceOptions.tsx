import { useState, useEffect, useCallback } from "react";
import { Plus, X, Check, Trash2, Search, Loader2 } from "lucide-react";
import { lookupApi, LookupValue } from "../lib/lookupApi";
import { invalidateLookupCache } from "../hooks/useLookup";
import ConfirmDialog from "../components/actions/ConfirmDialog";

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

function EditableRow({
  item,
  onSave,
  onDelete,
  isNew,
  onCancelNew,
}: {
  item: Partial<LookupValue> & { id?: number };
  onSave: (data: Partial<LookupValue> & { id?: number }) => Promise<void>;
  onDelete: (id: number) => void;
  isNew?: boolean;
  onCancelNew?: () => void;
}) {
  const [label, setLabel] = useState(item.label ?? "");
  const [value, setValue] = useState(item.value ?? "");
  const [sortOrder, setSortOrder] = useState(item.sort_order ?? 0);
  const [isDefault, setIsDefault] = useState(item.is_default ?? false);
  const [isActive, setIsActive] = useState(item.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isNew && label && !value) {
      setValue(slugify(label));
    }
  }, [label, isNew, value]);

  const handleSave = async () => {
    if (!label.trim() || !value.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: item.id,
        label: label.trim(),
        value: value.trim(),
        sort_order: sortOrder,
        is_default: isDefault,
        is_active: isActive,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error handled upstream
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t" style={{ borderColor: "var(--border)" }}>
      <td className="p-1.5">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          className="w-14 px-1.5 py-1 text-xs rounded outline-none text-center"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
      </td>
      <td className="p-1.5">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-1.5 py-1 text-xs rounded outline-none"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
      </td>
      <td className="p-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-1.5 py-1 text-xs rounded outline-none font-mono"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        />
      </td>
      <td className="p-1.5 text-center">
        <input
          type="radio"
          name="default-radio"
          checked={isDefault}
          onChange={() => setIsDefault(true)}
        />
      </td>
      <td className="p-1.5 text-center">
        <button
          type="button"
          onClick={() => setIsActive(!isActive)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            isActive ? "bg-green-500" : "bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              isActive ? "translate-x-4" : "translate-x-1"
            }`}
          />
        </button>
      </td>
      <td className="p-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !label.trim() || !value.trim()}
            className="p-1 rounded transition-colors disabled:opacity-40"
            style={{
              color: saved ? "#22c55e" : "#3b82f6",
            }}
            title="Save"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
          </button>
          {isNew ? (
            <button
              type="button"
              onClick={onCancelNew}
              className="p-1 rounded transition-colors"
              style={{ color: "#ef4444" }}
              title="Cancel"
            >
              <X size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onDelete(item.id!)}
              className="p-1 rounded transition-colors hover:bg-red-500/20"
              style={{ color: "#ef4444" }}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdvanceOptionsPage() {
  const [categories, setCategories] = useState<Record<string, LookupValue[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newRows, setNewRows] = useState<number[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

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

            <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "var(--bg-surface-hover)" }}>
                    <th className="p-2 text-left font-medium w-16" style={{ color: "var(--text-secondary)" }}>
                      Sort Order
                    </th>
                    <th className="p-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>
                      Label
                    </th>
                    <th className="p-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>
                      Value
                    </th>
                    <th className="p-2 text-center font-medium w-16" style={{ color: "var(--text-secondary)" }}>
                      Default
                    </th>
                    <th className="p-2 text-center font-medium w-20" style={{ color: "var(--text-secondary)" }}>
                      Active
                    </th>
                    <th className="p-2 text-center font-medium w-20" style={{ color: "var(--text-secondary)" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* New rows */}
                  {newRows.map((key) => (
                    <EditableRow
                      key={key}
                      item={{ sort_order: currentValues.length + 1, is_active: true }}
                      isNew
                      onSave={handleSaveRow}
                      onDelete={() => {}}
                      onCancelNew={() => removeNewRow(key)}
                    />
                  ))}
                  {/* Existing rows */}
                  {currentValues.length === 0 && newRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center" style={{ color: "var(--text-secondary)" }}>
                        No values found. Click "+ Add New Value" to get started.
                      </td>
                    </tr>
                  ) : (
                    currentValues.map((item) => (
                      <EditableRow
                        key={item.id}
                        item={item}
                        onSave={handleSaveRow}
                        onDelete={(id) =>
                          setDeleteTarget({ id, label: item.label })
                        }
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
