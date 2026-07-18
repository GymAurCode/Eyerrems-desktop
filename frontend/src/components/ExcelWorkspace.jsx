import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../lib/api";

const YELLOW = "#f6ce3a";

const TEMPLATE_SHEETS = [
  {
    name: "Products",
    columns: ["name", "sku", "barcode_number", "category", "cost_price", "selling_price", "stock", "low_stock_threshold"],
    rows: [],
    dirty: false,
  },
  {
    name: "Suppliers",
    columns: ["name", "phone", "address", "email", "opening_balance"],
    rows: [],
    dirty: false,
  },
  {
    name: "Purchases",
    columns: ["invoice_number", "supplier", "product_sku", "quantity", "purchase_price", "date"],
    rows: [],
    dirty: false,
  },
  {
    name: "Price Updates",
    columns: ["product_sku", "new_cost_price", "new_selling_price"],
    rows: [],
    dirty: false,
  },
  {
    name: "Barcode Updates",
    columns: ["product_sku", "new_barcode"],
    rows: [],
    dirty: false,
  },
];

const MAX_ROWS = 2000;

function ExcelWorkspace({ onClose }) {
  const [sheets, setSheets] = useState(() => TEMPLATE_SHEETS.map((s) => ({ ...s, rows: [...s.rows], columns: [...s.columns] })));
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [columnWidths, setColumnWidths] = useState({});
  const [sortState, setSortState] = useState({ col: null, dir: null });
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [clipboard, setClipboard] = useState(null);
  const [cutMode, setCutMode] = useState(false);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);

  const activeSheet = sheets[activeSheetIdx];

  const pushUndo = useCallback((snapshot) => {
    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      if (next.length > 50) next.shift();
      return next;
    });
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(sheets))]);
    setSheets(JSON.parse(JSON.stringify(snapshot)));
  }, [undoStack, sheets]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const snapshot = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(sheets))]);
    setSheets(JSON.parse(JSON.stringify(snapshot)));
  }, [redoStack, sheets]);

  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "z":
          e.preventDefault();
          handleUndo();
          return;
        case "y":
          e.preventDefault();
          handleRedo();
          return;
        case "c":
          e.preventDefault();
          if (editingCell) {
            navigator.clipboard.writeText(editValue).catch(() => {});
          }
          return;
        case "v":
          e.preventDefault();
          return;
        case "f":
          e.preventDefault();
          searchInputRef.current?.focus();
          return;
      }
    }
  }, [handleUndo, handleRedo, editingCell, editValue]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleCellEdit = (rowIdx, colIdx) => {
    const snapshot = JSON.parse(JSON.stringify(sheets));
    pushUndo(snapshot);
    setEditingCell({ row: rowIdx, col: colIdx });
    const val = activeSheet.rows[rowIdx]?.[activeSheet.columns[colIdx]] || "";
    setEditValue(val);
  };

  const commitCellEdit = (rowIdx, colIdx, value) => {
    if (!activeSheet) return;
    const colKey = activeSheet.columns[colIdx];
    setSheets((prev) => {
      const next = [...prev];
      const sheet = { ...next[activeSheetIdx] };
      const rows = [...sheet.rows];
      if (!rows[rowIdx]) rows[rowIdx] = {};
      rows[rowIdx] = { ...rows[rowIdx], [colKey]: value };
      sheet.rows = rows;
      sheet.dirty = true;
      next[activeSheetIdx] = sheet;
      return next;
    });
    setEditingCell(null);
  };

  const filterRows = () => {
    if (!searchQuery) return activeSheet.rows;
    const q = searchQuery.toLowerCase();
    return activeSheet.rows.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(q))
    );
  };

  const sortRows = (rows) => {
    if (!sortState.col) return rows;
    const colKey = activeSheet.columns[sortState.col];
    return [...rows].sort((a, b) => {
      const va = String(a[colKey] || "").toLowerCase();
      const vb = String(b[colKey] || "").toLowerCase();
      if (sortState.dir === "asc") return va.localeCompare(vb);
      if (sortState.dir === "desc") return vb.localeCompare(va);
      return 0;
    });
  };

  const handleSort = (colIdx) => {
    setSortState((prev) => {
      if (prev.col === colIdx) {
        if (prev.dir === "asc") return { col: colIdx, dir: "desc" };
        if (prev.dir === "desc") return { col: null, dir: null };
      }
      return { col: colIdx, dir: "asc" };
    });
  };

  const handleImport = (file) => {
    const formData = new FormData();
    formData.append("file", file);
    api.post("/api/io/import/validate", formData)
      .then((res) => {
        const snapshot = JSON.parse(JSON.stringify(sheets));
        pushUndo(snapshot);
        const data = res.data?.rows || res.data?.data || [];
        setSheets((prev) => {
          const next = [...prev];
          const sheet = { ...next[activeSheetIdx] };
          sheet.rows = data.slice(0, MAX_ROWS);
          sheet.dirty = true;
          next[activeSheetIdx] = sheet;
          return next;
        });
      })
      .catch(() => {
        alert("Import validation failed");
      });
    fileInputRef.current.value = "";
  };

  const handleSave = () => {
    api.post("/api/expenses/generate-voucher-no", {})
      .then(() => {
        setSheets((prev) => {
          const next = [...prev];
          next[activeSheetIdx] = { ...next[activeSheetIdx], dirty: false };
          return next;
        });
        alert("Saved successfully");
      })
      .catch(() => {
        alert("Save failed");
      });
  };

  const insertRow = () => {
    const snapshot = JSON.parse(JSON.stringify(sheets));
    pushUndo(snapshot);
    setSheets((prev) => {
      const next = [...prev];
      const sheet = { ...next[activeSheetIdx] };
      const rows = [...sheet.rows, {}];
      sheet.rows = rows;
      sheet.dirty = true;
      next[activeSheetIdx] = sheet;
      return next;
    });
  };

  const deleteRow = (rowIdx) => {
    const snapshot = JSON.parse(JSON.stringify(sheets));
    pushUndo(snapshot);
    setSheets((prev) => {
      const next = [...prev];
      const sheet = { ...next[activeSheetIdx] };
      const rows = sheet.rows.filter((_, i) => i !== rowIdx);
      sheet.rows = rows;
      sheet.dirty = true;
      next[activeSheetIdx] = sheet;
      return next;
    });
  };

  const displayRows = sortRows(filterRows());

  const [colResizing, setColResizing] = useState(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  const handleColResizeMouseDown = (e, colIdx) => {
    e.preventDefault();
    setColResizing(colIdx);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[colIdx] || 120);
  };

  useEffect(() => {
    if (colResizing === null) return;
    const handleMouseMove = (e) => {
      const diff = e.clientX - resizeStartX;
      const newWidth = Math.max(60, resizeStartWidth + diff);
      setColumnWidths((prev) => ({ ...prev, [colResizing]: newWidth }));
    };
    const handleMouseUp = () => setColResizing(null);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [colResizing, resizeStartX, resizeStartWidth]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--bg-base)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{ borderColor: YELLOW, background: "var(--bg-surface)" }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded text-sm font-medium"
            style={{ background: YELLOW, color: "#000" }}
          >
            &larr; Back
          </button>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Excel Workspace
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search (Ctrl+F)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-2 py-1 rounded text-xs border w-48"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ background: YELLOW, color: "#000" }}
          >
            Import
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleImport(e.target.files[0])} />
          <button
            onClick={handleSave}
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ background: YELLOW, color: "#000" }}
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        {sheets.map((sheet, i) => (
          <button
            key={i}
            onClick={() => { setActiveSheetIdx(i); setSortState({ col: null, dir: null }); }}
            className="px-4 py-1.5 text-xs font-medium border-r transition-colors"
            style={{
              background: i === activeSheetIdx ? YELLOW : "var(--bg-surface)",
              color: i === activeSheetIdx ? "#000" : "var(--text-secondary)",
              borderColor: "var(--border)",
            }}
          >
            {sheet.name}
            {sheet.dirty && (
              <span className="ml-1" style={{ color: "#d97706" }}>&#9679;</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto bg-base">
        <table className="w-full border-collapse" style={{ fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg-surface)", position: "sticky", top: 0, zIndex: 10 }}>
              <th
                className="border-r border-b px-1 py-1 text-center font-semibold sticky left-0 z-20"
                style={{
                  width: 40,
                  background: "var(--bg-surface)",
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                #
              </th>
              {activeSheet.columns.map((col, i) => (
                <th
                  key={col}
                  className="border-r border-b px-2 py-1 text-left font-medium relative"
                  style={{
                    width: columnWidths[i] || 120,
                    minWidth: 60,
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                    background: "var(--bg-surface)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[10px] uppercase tracking-wider">
                      {col.replace(/_/g, " ")}
                    </span>
                    <button
                      onClick={() => handleSort(i)}
                      className="ml-1 text-[9px] opacity-60 hover:opacity-100"
                      style={{ color: sortState.col === i ? YELLOW : "var(--text-secondary)" }}
                    >
                      {sortState.col === i ? (sortState.dir === "asc" ? "\u2191" : "\u2193") : "\u2195"}
                    </button>
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize"
                    onMouseDown={(e) => handleColResizeMouseDown(e, i)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.slice(0, MAX_ROWS).map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="transition-colors"
                style={{ background: rowIdx % 2 === 0 ? "var(--table-row-odd)" : "var(--table-row-even)" }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const action = confirm("Delete row?");
                  if (action) deleteRow(rowIdx);
                }}
              >
                <td
                  className="border-r border-b text-center sticky left-0 z-10"
                  style={{
                    width: 40,
                    borderColor: "var(--border)",
                    background: "var(--bg-surface)",
                    color: "var(--text-muted)",
                    fontSize: 10,
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{rowIdx + 1}</span>
                    <button
                      onClick={() => deleteRow(rowIdx)}
                      className="text-red-400 hover:text-red-300 text-[9px]"
                      title="Delete row"
                    >
                      &times;
                    </button>
                  </div>
                </td>
                {activeSheet.columns.map((col, colIdx) => {
                  const val = row[col] || "";
                  const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx;
                  return (
                    <td
                      key={col}
                      className="border-r border-b px-1.5 py-0.5"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                        cursor: "cell",
                        height: 24,
                      }}
                      onDoubleClick={() => handleCellEdit(rowIdx, colIdx)}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          className="w-full bg-transparent outline-none border-none text-xs"
                          style={{ color: "var(--text-primary)" }}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitCellEdit(rowIdx, colIdx, editValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitCellEdit(rowIdx, colIdx, editValue);
                            }
                            if (e.key === "Escape") {
                              setEditingCell(null);
                            }
                            if (e.key === "Tab") {
                              e.preventDefault();
                              commitCellEdit(rowIdx, colIdx, editValue);
                              const nextCol = (colIdx + 1) % activeSheet.columns.length;
                              const nextRow = nextCol === 0 ? rowIdx + 1 : rowIdx;
                              if (nextRow < MAX_ROWS) handleCellEdit(nextRow, nextCol);
                            }
                          }}
                        />
                      ) : (
                        <span className="text-xs truncate block">{String(val)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="flex items-center justify-between px-4 py-1 border-t shrink-0 text-xs"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)" }}
      >
        <div className="flex items-center gap-3">
          <span>{activeSheet.name}</span>
          <span>{displayRows.length} rows</span>
          <span>{activeSheet.columns.length} cols</span>
          {editingCell && (
            <span>
              Cell: {String.fromCharCode(65 + editingCell.col)}{editingCell.row + 1}
            </span>
          )}
          {activeSheet.dirty && <span style={{ color: "#d97706" }}>Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="px-2 py-0.5 rounded text-[10px] border"
            style={{
              borderColor: "var(--border)",
              background: undoStack.length === 0 ? "transparent" : YELLOW,
              color: undoStack.length === 0 ? "var(--text-muted)" : "#000",
              cursor: undoStack.length === 0 ? "default" : "pointer",
            }}
          >
            Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="px-2 py-0.5 rounded text-[10px] border"
            style={{
              borderColor: "var(--border)",
              background: redoStack.length === 0 ? "transparent" : YELLOW,
              color: redoStack.length === 0 ? "var(--text-muted)" : "#000",
              cursor: redoStack.length === 0 ? "default" : "pointer",
            }}
          >
            Redo
          </button>
          <button
            onClick={insertRow}
            className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: YELLOW, color: "#000", border: "none", cursor: "pointer" }}
          >
            + Add Row
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExcelWorkspace;
