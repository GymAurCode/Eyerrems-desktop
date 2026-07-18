import { useState, useEffect, useRef } from "react";
import { spreadsheetApi } from "../lib/spreadsheetApi";

const COLUMNS = [
  { key: "name", label: "Product Name", required: true, type: "text" },
  { key: "model", label: "Model", type: "text" },
  { key: "sku", label: "Ref No/SKU", auto: true, type: "text" },
  { key: "category", label: "Category", type: "text" },
  { key: "barcode_number", label: "Barcode", auto: true, type: "text" },
  { key: "stock", label: "Stock Qty", type: "number" },
  { key: "cost_price", label: "Cost Price", type: "number" },
  { key: "selling_price", label: "Selling Price", type: "number" },
  { key: "company_price", label: "Company Price", type: "number" },
  { key: "variant", label: "Variant", type: "text" },
  { key: "color", label: "Color", type: "text" },
  { key: "is_curtain", label: "Is Curtain?", type: "checkbox" },
  { key: "no_of_curtains", label: "No. of Curtains", type: "number", dependsOn: "is_curtain" },
  { key: "pieces_per_curtain", label: "Pieces/Curtain", type: "number", dependsOn: "is_curtain" },
  { key: "per_piece_price", label: "Per Piece Price", type: "number", dependsOn: "is_curtain" },
  { key: "low_stock_threshold", label: "Low Stock Alert", type: "number" },
  { key: "date_added", label: "Date Added", auto: true, type: "text" },
];

function generateSku() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const n = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `REF-${y}${m}${d}-${n}`;
}

function generateBarcode() {
  const ts = Date.now().toString(36).toUpperCase();
  return `BR-${ts}`;
}

function getDateAdded() {
  return new Date().toISOString().split("T")[0];
}

export default function ProductSpreadsheetPage() {
  const [rows, setRows] = useState([]);
  const [dirtyCells, setDirtyCells] = useState(new Map());
  const [newRows, setNewRows] = useState([]);
  const [hideExisting, setHideExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const autoIdCounter = useRef(0);

  useEffect(() => {
    spreadsheetApi.getRows("products", { limit: 1000 })
      .then((data) => {
        setRows(data.rows || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allRows = [
    ...rows,
    ...newRows.map((nr) => ({ ...nr, _new: true, _tempId: --autoIdCounter.current })),
  ];

  const displayRows = hideExisting ? newRows : allRows;

  const handleCellEdit = (row, colKey) => {
    const val = row[colKey] ?? "";
    setEditingCell({ rowId: row.id, colKey, _tempId: row._tempId, row });
    setEditValue(val);
  };

  const commitCellEdit = (row, colKey, value) => {
    if (row._new) {
      setNewRows((prev) =>
        prev.map((r) => (r._tempId === row._tempId ? { ...r, [colKey]: value } : r))
      );
    } else {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, [colKey]: value } : r))
      );
      setDirtyCells((prev) => {
        const next = new Map(prev);
        next.set(`${row.id}:${colKey}`, value);
        return next;
      });
    }
    setEditingCell(null);
  };

  const addNewRow = () => {
    const newRow = {
      name: "",
      model: "",
      sku: generateSku(),
      category: "",
      barcode_number: generateBarcode(),
      stock: "",
      cost_price: "",
      selling_price: "",
      company_price: "",
      variant: "",
      color: "",
      is_curtain: false,
      no_of_curtains: "",
      pieces_per_curtain: "",
      per_piece_price: "",
      low_stock_threshold: "",
      date_added: getDateAdded(),
    };
    setNewRows((prev) => [...prev, newRow]);
  };

  const handleBulkSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of dirtyCells) {
        const [rowId, column] = key.split(":");
        await spreadsheetApi.updateCell("products", parseInt(rowId), column, value).catch(() => {});
      }

      for (const newRow of newRows) {
        await spreadsheetApi.insertRow("products", newRow).catch(() => {});
      }

      setDirtyCells(new Map());
      setNewRows([]);

      const data = await spreadsheetApi.getRows("products", { limit: 1000 });
      setRows(data.rows || []);
    } catch {
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const isCurtainChecked = (row) => {
    return row.is_curtain === true || row.is_curtain === "true" || row.is_curtain === 1;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted animate-pulse">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-base)" }}>
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Product Spreadsheet
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={hideExisting}
              onChange={(e) => setHideExisting(e.target.checked)}
            />
            Hide existing
          </label>
          <button
            onClick={addNewRow}
            className="px-3 py-1 rounded text-xs font-medium"
            style={{ background: "var(--accent-primary, #f6ce3a)", color: "#000", border: "none", cursor: "pointer" }}
          >
            + Add Row
          </button>
          <button
            onClick={handleBulkSave}
            disabled={saving || (dirtyCells.size === 0 && newRows.length === 0)}
            className="px-3 py-1 rounded text-xs font-medium"
            style={{
              background: dirtyCells.size > 0 || newRows.length > 0 ? "var(--accent-primary, #f6ce3a)" : "var(--bg-surface2)",
              color: dirtyCells.size > 0 ? "#000" : "var(--text-muted)",
              border: "1px solid var(--border)",
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ fontSize: 11 }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--table-header-bg, #071414)" }}>
              <th
                className="border-r border-b px-1 py-1 text-center"
                style={{ width: 30, borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                #
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="border-r border-b px-1.5 py-1 text-left font-medium text-[10px] uppercase tracking-wider whitespace-nowrap"
                  style={{ borderColor: "var(--border)", color: "var(--table-header-text, #3a7070)" }}
                >
                  {col.label}
                  {col.required && <span className="text-red-400 ml-0.5">*</span>}
                  {col.auto && <span className="text-yellow-500 ml-0.5 text-[8px]">(auto)</span>}
                </th>
              ))}
              <th
                className="border-r border-b px-1 py-1 text-center"
                style={{ width: 30, borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                &times;
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => {
              const isNew = row._new;
              const canEditCurtain = isCurtainChecked(row);
              return (
                <tr
                  key={row._tempId || row.id}
                  style={{
                    background: isNew
                      ? "rgba(246,206,58,0.05)"
                      : rowIdx % 2 === 0
                      ? "var(--table-row-odd)"
                      : "var(--table-row-even)",
                  }}
                >
                  <td
                    className="border-r border-b text-center"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)", fontSize: 10 }}
                  >
                    {rowIdx + 1}
                  </td>
                  {COLUMNS.map((col) => {
                    const val = col.auto
                      ? (row[col.key] ?? "")
                      : (row[col.key] ?? "");
                    const isEditing =
                      editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                    const cellDirty = dirtyCells.has(`${row.id}:${col.key}`);
                    const isDisabled = col.dependsOn === "is_curtain" && !canEditCurtain;

                    if (col.type === "checkbox") {
                      const checked = val === true || val === "true" || val === 1;
                      return (
                        <td
                          key={col.key}
                          className="border-r border-b px-1.5 py-0.5 text-center"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const newVal = e.target.checked;
                              if (isNew) {
                                setNewRows((prev) =>
                                  prev.map((r) =>
                                    r._tempId === row._tempId
                                      ? { ...r, [col.key]: newVal, no_of_curtains: "", pieces_per_curtain: "", per_piece_price: "" }
                                      : r
                                  )
                                );
                              } else {
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? { ...r, [col.key]: newVal, no_of_curtains: "", pieces_per_curtain: "", per_piece_price: "" }
                                      : r
                                  )
                                );
                                setDirtyCells((prev) => {
                                  const next = new Map(prev);
                                  next.set(`${row.id}:${col.key}`, newVal);
                                  return next;
                                });
                              }
                            }}
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        className="border-r border-b px-1.5 py-0.5"
                        style={{
                          borderColor: "var(--border)",
                          opacity: isDisabled ? 0.3 : 1,
                          cursor: isDisabled ? "not-allowed" : "cell",
                        }}
                        onDoubleClick={() => !isDisabled && handleCellEdit(row, col.key)}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            className="w-full bg-transparent outline-none border-none text-xs"
                            style={{ color: "var(--text-primary)" }}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitCellEdit(row, col.key, editValue)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitCellEdit(row, col.key, editValue);
                              }
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                          />
                        ) : (
                          <span
                            className="text-xs truncate block"
                            style={{
                              color: cellDirty ? "var(--accent-primary, #f6ce3a)" : "var(--text-primary)",
                            }}
                          >
                            {String(val)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className="border-r border-b text-center"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <button
                      onClick={async () => {
                        if (isNew) {
                          setNewRows((prev) => prev.filter((r) => r._tempId !== row._tempId));
                        } else {
                          try {
                            await spreadsheetApi.deleteRow("products", row.id);
                            setRows((prev) => prev.filter((r) => r.id !== row.id));
                          } catch {}
                        }
                      }}
                      className="text-red-400 hover:text-red-300 text-[10px]"
                      style={{ background: "none", border: "none", cursor: "pointer" }}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="flex items-center justify-between px-4 py-1 border-t shrink-0 text-xs"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)" }}
      >
        <div className="flex items-center gap-3">
          <span>{displayRows.length} rows</span>
          {dirtyCells.size > 0 && <span style={{ color: "#d97706" }}>{dirtyCells.size} changes</span>}
          {newRows.length > 0 && <span style={{ color: "#10b981" }}>{newRows.length} new</span>}
        </div>
        <button
          onClick={addNewRow}
          className="px-2 py-0.5 rounded text-[10px]"
          style={{ background: "var(--accent-primary, #f6ce3a)", color: "#000", border: "none", cursor: "pointer" }}
        >
          + Add Row
        </button>
      </div>
    </div>
  );
}
