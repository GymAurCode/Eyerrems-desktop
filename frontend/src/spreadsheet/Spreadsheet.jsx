import { useState, useRef, useEffect, useCallback } from "react";
import { EventBus } from "./core/EventBus";
import { FormulaEngine } from "./core/FormulaEngine";
import { CommandManager } from "./core/Commands";
import { Clipboard } from "./core/Clipboard";
import {
  EditCellCommand, BatchEditCellsCommand, InsertRowsCommand, RemoveRowsCommand,
  InsertColsCommand, RemoveColsCommand, StyleCellsCommand, ClearCellsCommand,
  ResizeColCommand, ResizeRowCommand,
} from "./core/Commands";
import { createSelection, setSelection, selectAll, getSelectionBounds, getSelectedCells, moveSelection, isCellInSelection } from "./core/Selection";
import { createWorkbook, deserializeWorkbook, serializeWorkbook, getActiveSheet, createSheet } from "./core/Workbook";
import { cloneStyle, DEFAULT_STYLE } from "./core/CellStore";
import { GridRenderer } from "./render/GridRenderer";
import { cellKey } from "./core/utils";
import { importCsv, importXlsx, exportCsv, exportXlsx } from "./core/FileIO";
import Toolbar from "./components/Toolbar";
import FormulaBar from "./components/FormulaBar";
import SheetTabs from "./components/SheetTabs";
import ContextMenu from "./components/ContextMenu";
import StatusBar from "./components/StatusBar";
import FindReplace from "./components/FindReplace";
import { useGridTheme } from "./hooks/useGridTheme";

const STORAGE_KEY = "eyerflow_spreadsheet_v2";
const BACKUP_KEY = "eyerflow_spreadsheet_backup";

function loadWorkbook() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return deserializeWorkbook(JSON.parse(data));
  } catch {}
  return createWorkbook();
}

function saveWorkbook(wb, engine) {
  try {
    if (engine) {
      for (const sheet of wb.sheets) {
        sheet.cells = engine.exportSheet(sheet.id);
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeWorkbook(wb)));
  } catch {}
}

export default function Spreadsheet() {
  const canvasRef = useRef(null);
  const gridWrapperRef = useRef(null);
  const engineRef = useRef(null);
  const rendererRef = useRef(null);
  const cmdRef = useRef(null);
  const clipboardRef = useRef(null);
  const workbookRef = useRef(null);
  const selectionRef = useRef(createSelection());
  const editingRef = useRef(false);
  const editCellRef = useRef(null);
  const eventBusRef = useRef(null);
  const autoSaveRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [selectionState, setSelectionState] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [workbook, setWorkbook] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusInfo, setStatusInfo] = useState(null);

  const theme = useGridTheme();

  const getActive = useCallback(() => {
    return workbookRef.current ? getActiveSheet(workbookRef.current) : null;
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingRef.current || !editCellRef.current) return;
    const { row, col } = editCellRef.current;
    const sheetId = workbookRef.current?.activeSheetId;
    if (!sheetId) return;

    const engine = engineRef.current;
    const oldVal = engine.getCellRawValue(sheetId, row, col);
    if (editValue === oldVal) {
      editingRef.current = false;
      editCellRef.current = null;
      setEditing(false);
      return;
    }

    const oldStyle = engine.getCellStyle(sheetId, row, col);
    const cmd = new EditCellCommand(engine, sheetId, row, col, oldVal, editValue, oldStyle, null);
    cmdRef.current.execute(cmd);

    editingRef.current = false;
    editCellRef.current = null;
    setEditing(false);
    saveWorkbook(workbookRef.current, engineRef.current);
    updateStatusBar();
    rendererRef.current?.render();
  }, [editValue]);

  const cancelEdit = useCallback(() => {
    editingRef.current = false;
    editCellRef.current = null;
    setEditing(false);
    rendererRef.current?.render();
  }, []);

  const startEdit = useCallback((row, col) => {
    const sheetId = workbookRef.current?.activeSheetId;
    if (!sheetId) return;
    const engine = engineRef.current;
    const raw = engine.getCellRawValue(sheetId, row, col);
    editCellRef.current = { row, col };
    editingRef.current = true;
    setEditValue(raw);
    setEditing(true);
  }, []);

  const updateStatusBar = useCallback(() => {
    const sel = selectionRef.current;
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sel || !sheetId || !engine) {
      setStatusInfo(null);
      return;
    }
    const cells = getSelectedCells(sel);
    let count = 0;
    let sum = 0;
    let numericCount = 0;
    for (const c of cells) {
      const raw = engine.getCellRawValue(sheetId, c.row, c.col);
      if (raw !== "" && raw !== null && raw !== undefined) {
        count++;
        const num = parseFloat(raw);
        if (!isNaN(num) && raw !== "") {
          sum += num;
          numericCount++;
        }
      }
    }
    setStatusInfo({
      count,
      sum: numericCount > 0 ? sum : null,
      average: numericCount > 0 ? sum / numericCount : null,
    });
  }, []);

  useEffect(() => {
    const bus = new EventBus();
    const engine = new FormulaEngine(bus);
    const cmds = new CommandManager();
    const clip = new Clipboard();
    const wb = loadWorkbook();

    eventBusRef.current = bus;
    engineRef.current = engine;
    cmdRef.current = cmds;
    clipboardRef.current = clip;
    workbookRef.current = wb;

    for (const sheet of wb.sheets) {
      engine.initSheet(sheet.id, sheet.rowCount, sheet.columnCount);
      for (const [key, cell] of Object.entries(sheet.cells)) {
        const [r, c] = key.split(":").map(Number);
        engine.setCellRawValue(sheet.id, r, c, cell.rawValue);
        if (cell.style) engine.setCellStyle(sheet.id, r, c, cell.style);
      }
    }

    const renderer = new GridRenderer(canvasRef.current, engine, bus);
    renderer.setSheet(wb.activeSheetId);
    rendererRef.current = renderer;

    bus.on("cellMouseDown", (row, col, extend) => {
      commitEdit();
      setSelection(selectionRef.current, row, col, extend);
      setSelectionState({ ...selectionRef.current });
      renderer.setSelection(selectionRef.current);
      updateStatusBar();
    });

    bus.on("selectionDrag", (row, col) => {
      if (!selectionRef.current.anchor) return;
      const sel = selectionRef.current;
      sel.active = { row, col };
      sel.ranges = [{
        startRow: sel.anchor.row,
        startCol: sel.anchor.col,
        endRow: row,
        endCol: col,
      }];
      setSelectionState({ ...sel });
      renderer.setSelection(sel);
      updateStatusBar();
    });

    bus.on("selectionEnd", () => {
      selectionRef.current.isSelecting = false;
    });

    bus.on("selectColumn", (col, maxRow) => {
      commitEdit();
      const sel = selectionRef.current;
      sel.active = { row: 0, col };
      sel.anchor = { row: 0, col };
      sel.ranges = [{ startRow: 0, startCol: col, endRow: maxRow, endCol: col }];
      setSelectionState({ ...sel });
      renderer.setSelection(sel);
      updateStatusBar();
    });

    bus.on("selectRow", (row, maxCol) => {
      commitEdit();
      const sel = selectionRef.current;
      sel.active = { row, col: 0 };
      sel.anchor = { row, col: 0 };
      sel.ranges = [{ startRow: row, startCol: 0, endRow: row, endCol: maxCol }];
      setSelectionState({ ...sel });
      renderer.setSelection(sel);
      updateStatusBar();
    });

    bus.on("selectAll", () => {
      commitEdit();
      const sheet = getActiveSheet(workbookRef.current);
      if (!sheet) return;
      selectAll(selectionRef.current, sheet.rowCount - 1, sheet.columnCount - 1);
      setSelectionState({ ...selectionRef.current });
      renderer.setSelection(selectionRef.current);
      updateStatusBar();
    });

    bus.on("startEdit", (row, col) => {
      startEdit(row, col);
    });

    bus.on("contextMenu", (x, y, cell) => {
      setContextMenu({ x, y, type: "cell", cell });
    });

    bus.on("columnContextMenu", (x, y, col) => {
      setContextMenu({ x, y, type: "column", col });
    });

    bus.on("rowContextMenu", (x, y, row) => {
      setContextMenu({ x, y, type: "row", row });
    });

    bus.on("colResizeEnd", (col) => {
      const sheet = getActiveSheet(workbookRef.current);
      if (!sheet) return;
      const newWidth = renderer._colWidths[col];
      const oldWidth = sheet.colWidths[col];
      sheet.colWidths[col] = newWidth;
      saveWorkbook(workbookRef.current, engineRef.current);
    });

    bus.on("rowResizeEnd", (row) => {
      const sheet = getActiveSheet(workbookRef.current);
      if (!sheet) return;
      const newHeight = renderer._rowHeights[row];
      const oldHeight = sheet.rowHeights[row];
      sheet.rowHeights[row] = newHeight;
      saveWorkbook(workbookRef.current, engineRef.current);
    });

    bus.on("fillDrag", (start, end) => {
      const sel = selectionRef.current;
      if (!sel || !sel.ranges.length) return;
      sel.ranges = [{
        startRow: Math.min(start.row, end.row),
        startCol: Math.min(start.col, end.col),
        endRow: Math.max(start.row, end.row),
        endCol: Math.max(start.col, end.col),
      }];
      setSelectionState({ ...sel });
      renderer.setSelection(sel);
    });

    bus.on("fillDragEnd", () => {
      const lastRange = selectionRef.current?.ranges?.[selectionRef.current.ranges.length - 1];
      if (!lastRange) return;
      const minR = Math.min(lastRange.startRow, lastRange.endRow);
      const maxR = Math.max(lastRange.startRow, lastRange.endRow);
      const minC = Math.min(lastRange.startCol, lastRange.endCol);
      const maxC = Math.max(lastRange.startCol, lastRange.endCol);
      const sheetId = workbookRef.current?.activeSheetId;
      const engine = engineRef.current;
      if (!sheetId || !engine) return;

      const sourceRow = minR;
      const sourceCol = minC;
      const sourceVal = engine.getCellRawValue(sheetId, sourceRow, sourceCol);

      const edits = [];
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (r === sourceRow && c === sourceCol) continue;
          const oldVal = engine.getCellRawValue(sheetId, r, c);
          const dr = r - sourceRow;
          const dc = c - sourceCol;
          let newVal = sourceVal;
          const num = parseFloat(sourceVal);
          if (!isNaN(num) && sourceVal !== "") {
            newVal = String(num + dr + dc);
          }
          edits.push({ row: r, col: c, oldValue: oldVal, newValue: newVal, oldStyle: null, newStyle: null });
        }
      }
      if (edits.length > 0) {
        const cmd = new BatchEditCellsCommand(engine, sheetId, edits);
        cmdRef.current.execute(cmd);
        saveWorkbook(workbookRef.current, engineRef.current);
        renderer.render();
        updateStatusBar();
      }
    });

    bus.on("dataChanged", () => {
      saveWorkbook(workbookRef.current, engineRef.current);
    });

    bus.on("structureChanged", () => {
      renderer.rebuildLayout();
      setRefreshKey((k) => k + 1);
    });

    const interval = setInterval(() => {
      saveWorkbook(workbookRef.current, engineRef.current);
    }, 30000);
    autoSaveRef.current = interval;

    const handleBeforeUnload = () => saveWorkbook(workbookRef.current, engineRef.current);
    window.addEventListener("beforeunload", handleBeforeUnload);

    const resizeObserver = new ResizeObserver(() => renderer.resize());
    if (gridWrapperRef.current) resizeObserver.observe(gridWrapperRef.current);

    const handleResize = () => renderer.resize();
    window.addEventListener("resize", handleResize);

    setWorkbook({ ...wb });
    setReady(true);

    return () => {
      saveWorkbook(workbookRef.current, engineRef.current);
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      renderer.destroy();
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current && theme) {
      rendererRef.current.setTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render();
    }
  }, [refreshKey]);

  const handleKeyDown = useCallback((e) => {
    if (!workbookRef.current || !engineRef.current) return;

    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "z":
          e.preventDefault();
          if (cmdRef.current.undo()) {
            updateStatusBar();
            rendererRef.current?.render();
          }
          return;
        case "y":
          e.preventDefault();
          if (cmdRef.current.redo()) {
            updateStatusBar();
            rendererRef.current?.render();
          }
          return;
        case "c":
          e.preventDefault();
          handleCopy();
          return;
        case "x":
          e.preventDefault();
          handleCut();
          return;
        case "v":
          e.preventDefault();
          handlePaste();
          return;
        case "a":
          e.preventDefault();
          const sheet = getActiveSheet(workbookRef.current);
          if (sheet) {
            selectAll(selectionRef.current, sheet.rowCount - 1, sheet.columnCount - 1);
            setSelectionState({ ...selectionRef.current });
            rendererRef.current?.setSelection(selectionRef.current);
            updateStatusBar();
          }
          return;
        case "f":
          e.preventDefault();
          setShowFindReplace(true);
          return;
        case "b":
          e.preventDefault();
          applyStyleChange({ bold: !getCurrentStyleState()?.bold });
          return;
        case "i":
          e.preventDefault();
          applyStyleChange({ italic: !getCurrentStyleState()?.italic });
          return;
        case "u":
          e.preventDefault();
          applyStyleChange({ underline: !getCurrentStyleState()?.underline });
          return;
      }
      return;
    }

    if (editingRef.current) {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        commitEdit();
        const sel = selectionRef.current;
        if (sel) {
          const sheet = getActiveSheet(workbookRef.current);
          if (sheet) {
            const nc = Math.min(sel.active.col + 1, sheet.columnCount - 1);
            setSelection(sel, sel.active.row, nc, false);
            setSelectionState({ ...sel });
            rendererRef.current?.setSelection(sel);
            rendererRef.current?.scrollToCell(sel.active.row, nc);
            updateStatusBar();
          }
        }
        return;
      }
      return;
    }

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        handleArrow(-1, 0, e.shiftKey);
        break;
      case "ArrowDown":
        e.preventDefault();
        handleArrow(1, 0, e.shiftKey);
        break;
      case "ArrowLeft":
        e.preventDefault();
        handleArrow(0, -1, e.shiftKey);
        break;
      case "ArrowRight":
        e.preventDefault();
        handleArrow(0, 1, e.shiftKey);
        break;
      case "Tab":
        e.preventDefault();
        moveTab(e.shiftKey ? -1 : 1);
        break;
      case "Enter":
        e.preventDefault();
        const enterSel = selectionRef.current;
        if (enterSel) {
          const sheet = getActiveSheet(workbookRef.current);
          if (sheet) {
            const nr = Math.min(enterSel.active.row + 1, sheet.rowCount - 1);
            setSelection(enterSel, nr, enterSel.active.col, false);
            setSelectionState({ ...enterSel });
            rendererRef.current?.setSelection(enterSel);
            rendererRef.current?.scrollToCell(nr, enterSel.active.col);
            updateStatusBar();
          }
        }
        break;
      case "F2":
        e.preventDefault();
        if (selectionRef.current) {
          startEdit(selectionRef.current.active.row, selectionRef.current.active.col);
        }
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        handleDelete();
        break;
      case "Escape":
        setContextMenu(null);
        setShowFindReplace(false);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (selectionRef.current) {
            startEdit(selectionRef.current.active.row, selectionRef.current.active.col);
            setEditValue(e.key);
          }
        }
    }
  }, [startEdit, commitEdit, cancelEdit, updateStatusBar]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleArrow = (dRow, dCol, extend) => {
    const sheet = getActiveSheet(workbookRef.current);
    if (!sheet) return;
    moveSelection(
      selectionRef.current,
      dRow, dCol,
      sheet.rowCount - 1,
      sheet.columnCount - 1,
      extend,
    );
    setSelectionState({ ...selectionRef.current });
    rendererRef.current?.setSelection(selectionRef.current);
    rendererRef.current?.scrollToCell(selectionRef.current.active.row, selectionRef.current.active.col);
    updateStatusBar();
  };

  const moveTab = (dir) => {
    const sheet = getActiveSheet(workbookRef.current);
    if (!sheet) return;
    const nc = Math.max(0, Math.min(sheet.columnCount - 1, selectionRef.current.active.col + dir));
    setSelection(selectionRef.current, selectionRef.current.active.row, nc, false);
    setSelectionState({ ...selectionRef.current });
    rendererRef.current?.setSelection(selectionRef.current);
    rendererRef.current?.scrollToCell(selectionRef.current.active.row, nc);
    updateStatusBar();
  };

  const handleCopy = () => {
    if (!selectionRef.current) return;
    const cells = getSelectedCells(selectionRef.current);
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return;
    const cellData = cells.map((c) => ({
      row: c.row,
      col: c.col,
      rawValue: engine.getCellRawValue(sheetId, c.row, c.col),
      displayValue: engine.getCellDisplayValue(sheetId, c.row, c.col),
      style: engine.getCellStyle(sheetId, c.row, c.col),
    }));
    clipboardRef.current?.copy(cellData);
  };

  const handleCut = () => {
    if (!selectionRef.current) return;
    const cells = getSelectedCells(selectionRef.current);
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return;
    const cellData = cells.map((c) => ({
      row: c.row,
      col: c.col,
      rawValue: engine.getCellRawValue(sheetId, c.row, c.col),
      displayValue: engine.getCellDisplayValue(sheetId, c.row, c.col),
      style: engine.getCellStyle(sheetId, c.row, c.col),
    }));
    clipboardRef.current?.cut(cellData);
  };

  const handlePaste = async () => {
    const clip = clipboardRef.current;
    if (!clip) return;
    const sel = selectionRef.current;
    if (!sel) return;
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return;

    let pastedCells = clip.paste(sel.active.row, sel.active.col);
    if (!pastedCells || pastedCells.length === 0) {
      pastedCells = await clip.readFromSystemClipboard();
      if (pastedCells && pastedCells.length > 0) {
        const dr = sel.active.row;
        const dc = sel.active.col;
        pastedCells = pastedCells.map((c) => ({
          ...c,
          row: c.row + dr,
          col: c.col + dc,
        }));
      }
    }

    if (!pastedCells || pastedCells.length === 0) return;

    const edits = [];
    for (const pc of pastedCells) {
      if (pc.row === undefined || pc.col === undefined) continue;
      const oldVal = engine.getCellRawValue(sheetId, pc.row, pc.col);
      const newVal = clip.isCut ? "" : (pc.rawValue ?? "");
      if (oldVal !== newVal || pc.style) {
        const oldStyle = engine.getCellStyle(sheetId, pc.row, pc.col);
        edits.push({ row: pc.row, col: pc.col, oldValue: oldVal, newValue: newVal, oldStyle, newStyle: pc.style || null });
      }
    }

    if (edits.length > 0) {
      const cmd = new BatchEditCellsCommand(engine, sheetId, edits);
      cmdRef.current.execute(cmd);
      saveWorkbook(workbookRef.current, engineRef.current);
      rendererRef.current?.render();
      updateStatusBar();
    }

    if (clip.isCut) {
      clip.clear();
    }
  };

  const handleDelete = () => {
    if (!selectionRef.current) return;
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return;
    const cells = getSelectedCells(selectionRef.current);
    const oldValues = cells.map((c) => engine.getCellRawValue(sheetId, c.row, c.col));
    const oldStyles = cells.map((c) => engine.getCellStyle(sheetId, c.row, c.col));
    const cmd = new ClearCellsCommand(engine, sheetId, cells, oldValues, oldStyles);
    cmdRef.current.execute(cmd);
    saveWorkbook(workbookRef.current, engineRef.current);
    rendererRef.current?.render();
    updateStatusBar();
  };

  const switchSheet = (sheetId) => {
    commitEdit();
    const wb = workbookRef.current;
    if (!wb) return;
    wb.activeSheetId = sheetId;
    setWorkbook({ ...wb });
    rendererRef.current?.setSheet(sheetId);
    selectionRef.current = createSelection();
    setSelectionState({ ...selectionRef.current });
    rendererRef.current?.setSelection(selectionRef.current);
    updateStatusBar();
  };

  const addSheet = () => {
    const wb = workbookRef.current;
    const engine = engineRef.current;
    if (!wb || !engine) return;
    const num = wb.sheets.length + 1;
    const sheet = createSheet(`Sheet${num}`);
    wb.sheets.push(sheet);
    engine.initSheet(sheet.id, sheet.rowCount, sheet.columnCount);
    wb.activeSheetId = sheet.id;
    setWorkbook({ ...wb });
    rendererRef.current?.setSheet(sheet.id);
    selectionRef.current = createSelection();
    setSelectionState({ ...selectionRef.current });
    rendererRef.current?.setSelection(selectionRef.current);
    saveWorkbook(wb, engineRef.current);
  };

  const renameSheet = (sheetId, newName) => {
    const wb = workbookRef.current;
    if (!wb) return;
    const sheet = wb.sheets.find((s) => s.id === sheetId);
    if (sheet) {
      sheet.name = newName;
      setWorkbook({ ...wb });
      saveWorkbook(wb, engineRef.current);
    }
  };

  const deleteSheet = (sheetId) => {
    const wb = workbookRef.current;
    const engine = engineRef.current;
    if (!wb || !engine) return;
    // allow deleting any sheet
    const idx = wb.sheets.findIndex((s) => s.id === sheetId);
    if (idx < 0) return;
    wb.sheets.splice(idx, 1);
    engine.destroySheet(sheetId);
    wb.activeSheetId = wb.sheets[0].id;
    setWorkbook({ ...wb });
    rendererRef.current?.setSheet(wb.activeSheetId);
    selectionRef.current = createSelection();
    setSelectionState({ ...selectionRef.current });
    rendererRef.current?.setSelection(selectionRef.current);
    saveWorkbook(wb, engineRef.current);
  };

  const handleImport = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const engine = engineRef.current;
        const wb = workbookRef.current;
        if (!engine || !wb) return;

        let imported;
        if (file.name.endsWith(".csv")) {
          imported = importCsv(e.target.result);
        } else {
          imported = importXlsx(e.target.result);
        }

        for (const sheet of imported.sheets) {
          const existing = wb.sheets.find((s) => s.name === sheet.name);
          if (existing) {
            engine.destroySheet(existing.id);
            Object.assign(existing, sheet);
          } else {
            wb.sheets.push(sheet);
          }
          engine.initSheet(sheet.id, sheet.rowCount, sheet.columnCount);
          for (const [key, cell] of Object.entries(sheet.cells)) {
            const [r, c] = key.split(":").map(Number);
            engine.setCellRawValue(sheet.id, r, c, cell.rawValue);
            if (cell.style) engine.setCellStyle(sheet.id, r, c, cell.style);
          }
        }

        wb.activeSheetId = imported.sheets[0]?.id || wb.sheets[0]?.id;
        setWorkbook({ ...wb });
        rendererRef.current?.setSheet(wb.activeSheetId);
        selectionRef.current = createSelection();
        setSelectionState({ ...selectionRef.current });
        rendererRef.current?.setSelection(selectionRef.current);
        saveWorkbook(wb, engineRef.current);
        updateStatusBar();
      } catch (err) {
        console.error("Import failed:", err);
      }
    };
    if (file.name.endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleExport = (format) => {
    const sheet = getActive();
    const wb = workbookRef.current;
    if (!sheet || !wb) return;
    const engine = engineRef.current;
    if (!engine) return;

    if (format === "csv") {
      const csv = exportCsv(sheet);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `${sheet.name}.csv`);
    } else {
      const data = exportXlsx(wb, engine);
      const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      downloadBlob(blob, `${wb.name}.xlsx`);
    }
  };

  const getCurrentStyleState = () => {
    if (!selectionRef.current) return DEFAULT_STYLE;
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return DEFAULT_STYLE;
    const ac = selectionRef.current.active;
    return engine.getCellStyle(sheetId, ac.row, ac.col);
  };

  const applyStyleChange = (changes) => {
    if (!selectionRef.current) return;
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return;
    const cells = getSelectedCells(selectionRef.current);
    const cellsWithStyles = cells.map((c) => ({
      row: c.row,
      col: c.col,
      oldStyle: engine.getCellStyle(sheetId, c.row, c.col),
    }));
    const cmd = new StyleCellsCommand(engine, sheetId, cellsWithStyles, changes);
    cmdRef.current.execute(cmd);
    saveWorkbook(workbookRef.current, engineRef.current);
    rendererRef.current?.render();
    setRefreshKey((k) => k + 1);
  };

  const handleSort = (ascending) => {
    if (!selectionRef.current) return;
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return;
    const bounds = getSelectionBounds(selectionRef.current);
    if (!bounds) return;

    const rows = [];
    for (let r = bounds.startRow; r <= bounds.endRow; r++) {
      const sortKey = engine.getCellValueForSort(sheetId, r, bounds.startCol);
      const rowCells = [];
      for (let c = bounds.startCol; c <= bounds.endCol; c++) {
        rowCells.push({
          rawValue: engine.getCellRawValue(sheetId, r, c),
          style: engine.getCellStyle(sheetId, r, c),
        });
      }
      rows.push({ sortKey, rowCells, index: r });
    }

    rows.sort((a, b) => {
      if (typeof a.sortKey === "number" && typeof b.sortKey === "number") {
        return ascending ? a.sortKey - b.sortKey : b.sortKey - a.sortKey;
      }
      const sa = String(a.sortKey);
      const sb = String(b.sortKey);
      return ascending ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });

    const edits = [];
    for (let r = 0; r < rows.length; r++) {
      const targetRow = bounds.startRow + r;
      for (let c = bounds.startCol; c <= bounds.endCol; c++) {
        const colIdx = c - bounds.startCol;
        const oldVal = engine.getCellRawValue(sheetId, targetRow, c);
        const newVal = rows[r].rowCells[colIdx].rawValue;
        const oldStyle = engine.getCellStyle(sheetId, targetRow, c);
        const newStyle = rows[r].rowCells[colIdx].style;
        edits.push({ row: targetRow, col: c, oldValue: oldVal, newValue: newVal, oldStyle, newStyle });
      }
    }

    if (edits.length > 0) {
      const cmd = new BatchEditCellsCommand(engine, sheetId, edits);
      cmdRef.current.execute(cmd);
      saveWorkbook(workbookRef.current, engineRef.current);
      rendererRef.current?.render();
      updateStatusBar();
    }
  };

  const insertRowAt = (pos) => {
    if (!selectionRef.current) return;
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return;
    const atRow = pos === "above"
      ? selectionRef.current.active.row
      : selectionRef.current.active.row + 1;
    const cmd = new InsertRowsCommand(engine, sheetId, atRow, 1);
    cmdRef.current.execute(cmd);
    const wb = workbookRef.current;
    if (wb) {
      const sheet = getActiveSheet(wb);
      if (sheet) {
        sheet.rowCount += 1;
        rendererRef.current?.rebuildLayout();
      }
    }
    saveWorkbook(wb, engineRef.current);
    rendererRef.current?.render();
    setRefreshKey((k) => k + 1);
  };

  const deleteRowAt = () => {
    if (!selectionRef.current) return;
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return;
    const atRow = selectionRef.current.active.row;
    const cmd = new RemoveRowsCommand(engine, sheetId, atRow, 1, {});
    cmdRef.current.execute(cmd);
    const wb = workbookRef.current;
    if (wb) {
      const sheet = getActiveSheet(wb);
      if (sheet && sheet.rowCount > 1) {
        sheet.rowCount -= 1;
        rendererRef.current?.rebuildLayout();
      }
    }
    saveWorkbook(wb, engineRef.current);
    rendererRef.current?.render();
    setRefreshKey((k) => k + 1);
  };

  const insertColAt = (pos) => {
    if (!selectionRef.current) return;
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return;
    const atCol = pos === "left"
      ? selectionRef.current.active.col
      : selectionRef.current.active.col + 1;
    const cmd = new InsertColsCommand(engine, sheetId, atCol, 1);
    cmdRef.current.execute(cmd);
    const wb = workbookRef.current;
    if (wb) {
      const sheet = getActiveSheet(wb);
      if (sheet) {
        sheet.columnCount += 1;
        rendererRef.current?.rebuildLayout();
      }
    }
    saveWorkbook(wb, engineRef.current);
    rendererRef.current?.render();
    setRefreshKey((k) => k + 1);
  };

  const deleteColAt = () => {
    if (!selectionRef.current) return;
    const sheetId = workbookRef.current?.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return;
    const atCol = selectionRef.current.active.col;
    const cmd = new RemoveColsCommand(engine, sheetId, atCol, 1, {});
    cmdRef.current.execute(cmd);
    const wb = workbookRef.current;
    if (wb) {
      const sheet = getActiveSheet(wb);
      if (sheet && sheet.columnCount > 1) {
        sheet.columnCount -= 1;
        rendererRef.current?.rebuildLayout();
      }
    }
    saveWorkbook(wb, engineRef.current);
    rendererRef.current?.render();
    setRefreshKey((k) => k + 1);
  };

  const handleReplace = (action, row, col, newVal) => {
    if (!workbookRef.current) return;
    const sheetId = workbookRef.current.activeSheetId;
    const engine = engineRef.current;
    if (!sheetId || !engine) return;

    if (action === "goto") {
      const sel = selectionRef.current;
      setSelection(sel, row, col, false);
      setSelectionState({ ...sel });
      rendererRef.current?.setSelection(sel);
      rendererRef.current?.scrollToCell(row, col);
      return;
    }

    if (action === "replace") {
      const oldVal = engine.getCellRawValue(sheetId, row, col);
      const oldStyle = engine.getCellStyle(sheetId, row, col);
      const cmd = new EditCellCommand(engine, sheetId, row, col, oldVal, newVal, oldStyle, null);
      cmdRef.current.execute(cmd);
      saveWorkbook(workbookRef.current, engineRef.current);
      rendererRef.current?.render();
      updateStatusBar();
    }
  };

  const handleLoadTemplate = (template) => {
    const wb = workbookRef.current;
    const engine = engineRef.current;
    if (!wb || !engine) return;

    const LEAD_COLUMNS = ["Name", "Phone", "Email", "Source", "Status", "Notes", "Follow-Up Date", "Assigned To", "Property Interest", "Budget", "City", "Lead ID"];

    const sheet = createSheet("Lead Template");
    wb.sheets.push(sheet);
    engine.initSheet(sheet.id, sheet.rowCount, sheet.columnCount);
    wb.activeSheetId = sheet.id;

    LEAD_COLUMNS.forEach((colName, ci) => {
      engine.setCellRawValue(sheet.id, 0, ci, colName);
    });

    const boldStyle = { ...DEFAULT_STYLE, bold: true, bgColor: "#E8F0FE" };
    LEAD_COLUMNS.forEach((_, ci) => {
      engine.setCellStyle(sheet.id, 0, ci, boldStyle);
    });

    rendererRef.current?.setSheet(sheet.id);
    selectionRef.current = createSelection();
    setSelectionState({ ...selectionRef.current });
    rendererRef.current?.setSelection(selectionRef.current);
    setWorkbook({ ...wb });
    saveWorkbook(wb, engineRef.current);
  };

  const handleReset = () => {
    const backup = JSON.stringify(serializeWorkbook(workbookRef.current));
    try { localStorage.setItem(BACKUP_KEY, backup); } catch {}
    const wb = createWorkbook();
    const engine = engineRef.current;
    if (!engine) return;
    workbookRef.current = wb;
    engine._cells.clear();
    engine._styles.clear();
    engine._sheetMeta.clear();
    engine._hfSheetIds.clear();
    engine._sheetNames.clear();
    for (const sheet of wb.sheets) {
      engine.initSheet(sheet.id, sheet.rowCount, sheet.columnCount);
    }
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setSheet(wb.activeSheetId);
      renderer.rebuildLayout();
    }
    selectionRef.current = createSelection();
    setSelectionState({ ...selectionRef.current });
    rendererRef.current?.setSelection(selectionRef.current);
    setWorkbook({ ...wb });
    setRefreshKey((k) => k + 1);
    saveWorkbook(wb, engineRef.current);
  };

  const handleRestore = () => {
    try {
      const data = localStorage.getItem(BACKUP_KEY);
      if (!data) return;
      const wb = deserializeWorkbook(JSON.parse(data));
      const engine = engineRef.current;
      if (!engine) return;
      workbookRef.current = wb;
      engine._cells.clear();
      engine._styles.clear();
      engine._sheetMeta.clear();
      engine._hfSheetIds.clear();
      engine._sheetNames.clear();
      for (const sheet of wb.sheets) {
        engine.initSheet(sheet.id, sheet.rowCount, sheet.columnCount);
        for (const [key, cell] of Object.entries(sheet.cells)) {
          const [r, c] = key.split(":").map(Number);
          engine.setCellRawValue(sheet.id, r, c, cell.rawValue);
          if (cell.style) engine.setCellStyle(sheet.id, r, c, cell.style);
        }
      }
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.setSheet(wb.activeSheetId);
        renderer.rebuildLayout();
      }
      selectionRef.current = createSelection();
      setSelectionState({ ...selectionRef.current });
      rendererRef.current?.setSelection(selectionRef.current);
      setWorkbook({ ...wb });
      setRefreshKey((k) => k + 1);
      saveWorkbook(wb, engineRef.current);
    } catch {}
  };

  const activeSheet = workbook ? getActiveSheet(workbook) : null;
  const rawValue = (activeSheet && selectionRef.current)
    ? engineRef.current?.getCellRawValue(activeSheet?.id, selectionRef.current.active.row, selectionRef.current.active.col)
    : "";

  const currentStyle = getCurrentStyleState();

  return (
    <div className="ss-container" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar
        canUndo={cmdRef.current?.canUndo}
        canRedo={cmdRef.current?.canRedo}
        onUndo={() => { cmdRef.current?.undo(); updateStatusBar(); rendererRef.current?.render(); }}
        onRedo={() => { cmdRef.current?.redo(); updateStatusBar(); rendererRef.current?.render(); }}
        onSave={() => saveWorkbook(workbookRef.current, engineRef.current)}
        onImport={handleImport}
        onExport={handleExport}
        onBold={() => applyStyleChange({ bold: !currentStyle.bold })}
        onItalic={() => applyStyleChange({ italic: !currentStyle.italic })}
        onUnderline={() => applyStyleChange({ underline: !currentStyle.underline })}
        onStrikethrough={() => applyStyleChange({ strikethrough: !currentStyle.strikethrough })}
        onFontFamily={(f) => applyStyleChange({ fontFamily: f })}
        onFontSize={(s) => applyStyleChange({ fontSize: s })}
        onTextColor={(c) => applyStyleChange({ color: c })}
        onFillColor={(c) => applyStyleChange({ bgColor: c })}
        onAlign={(a) => applyStyleChange({ hAlign: a })}
        onNumberFormat={(f) => applyStyleChange({ numberFormat: f })}
        onInsertRow={() => insertRowAt("above")}
        onDeleteRow={deleteRowAt}
        onInsertCol={() => insertColAt("left")}
        onDeleteCol={deleteColAt}
        onSortAsc={() => handleSort(true)}
        onSortDesc={() => handleSort(false)}
        onOpenFindReplace={() => setShowFindReplace(true)}
        styleState={currentStyle}
        onLoadTemplate={handleLoadTemplate}
        onReset={handleReset}
        onRestore={handleRestore}
      />
      <FormulaBar
        activeCell={selectionRef.current?.active}
        rawValue={rawValue}
        onCellRefChange={(row, col) => {
          setSelection(selectionRef.current, row, col, false);
          setSelectionState({ ...selectionRef.current });
          rendererRef.current?.setSelection(selectionRef.current);
          rendererRef.current?.scrollToCell(row, col);
          updateStatusBar();
        }}
        onValueChange={(val) => {
          const sheetId = workbookRef.current?.activeSheetId;
          const engine = engineRef.current;
          if (!sheetId || !engine || !selectionRef.current) return;
          const { row, col } = selectionRef.current.active;
          const oldVal = engine.getCellRawValue(sheetId, row, col);
          const oldStyle = engine.getCellStyle(sheetId, row, col);
          const cmd = new EditCellCommand(engine, sheetId, row, col, oldVal, val, oldStyle, null);
          cmdRef.current.execute(cmd);
          saveWorkbook(workbookRef.current, engineRef.current);
          rendererRef.current?.render();
          updateStatusBar();
        }}
        engine={engineRef.current}
        sheetId={activeSheet?.id}
      />
      <div className="ss-grid-wrapper" ref={gridWrapperRef}>
        <canvas ref={canvasRef} className="ss-canvas" />
        {editing && editCellRef.current && rendererRef.current && (
          <input
            className="ss-cell-editor"
            style={{
              position: "absolute",
              ...(() => {
                const pos = rendererRef.current.getCellEditorPosition(
                  editCellRef.current.row,
                  editCellRef.current.col,
                );
                return { left: pos.x, top: pos.y, width: pos.w, height: pos.h };
              })(),
            }}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
              if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
              if (e.key === "Tab") { e.preventDefault(); commitEdit(); }
            }}
            autoFocus
          />
        )}
      </div>
      <div className="ss-bottom-bar">
        <SheetTabs
          sheets={workbook?.sheets || []}
          activeSheetId={workbook?.activeSheetId}
          onSwitch={switchSheet}
          onAdd={addSheet}
          onRename={renameSheet}
          onDelete={deleteSheet}
        />
        <StatusBar info={statusInfo} />
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          cell={contextMenu.cell}
          onClose={() => setContextMenu(null)}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onInsertRowAbove={() => { insertRowAt("above"); setContextMenu(null); }}
          onInsertRowBelow={() => { insertRowAt("below"); setContextMenu(null); }}
          onInsertColLeft={() => { insertColAt("left"); setContextMenu(null); }}
          onInsertColRight={() => { insertColAt("right"); setContextMenu(null); }}
          onDeleteRow={() => { deleteRowAt(); setContextMenu(null); }}
          onDeleteCol={() => { deleteColAt(); setContextMenu(null); }}
          onClearContents={() => { handleDelete(); setContextMenu(null); }}
          onClearFormatting={() => {
            if (!selectionRef.current) return;
            const sheetId = workbookRef.current?.activeSheetId;
            const engine = engineRef.current;
            if (!sheetId || !engine) return;
            const cells = getSelectedCells(selectionRef.current);
            const cellsWithStyles = cells.map((c) => ({
              row: c.row, col: c.col,
              oldStyle: engine.getCellStyle(sheetId, c.row, c.col),
            }));
            const cmd = new StyleCellsCommand(engine, sheetId, cellsWithStyles, { ...DEFAULT_STYLE });
            cmdRef.current.execute(cmd);
            saveWorkbook(workbookRef.current, engineRef.current);
            rendererRef.current?.render();
            setContextMenu(null);
          }}
          onClearAll={() => { handleDelete(); setContextMenu(null); }}
          onSortAsc={(useSelection) => handleSort(true)}
          onSortDesc={(useSelection) => handleSort(false)}
        />
      )}
      <FindReplace
        open={showFindReplace}
        onClose={() => setShowFindReplace(false)}
        engine={engineRef.current}
        sheetId={activeSheet?.id}
        sheets={workbook?.sheets || []}
        activeSheetId={activeSheet?.id}
        onReplace={handleReplace}
      />
    </div>
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
