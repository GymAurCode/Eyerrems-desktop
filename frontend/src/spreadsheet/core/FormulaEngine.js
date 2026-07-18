import { HyperFormula } from "hyperformula";
import { cloneStyle, DEFAULT_STYLE } from "./CellStore";
import { cellKey } from "./utils";

const AUTOFILL_FUNCTIONS = [
  "SUM", "AVERAGE", "COUNT", "COUNTA", "COUNTIF", "COUNTIFS",
  "IF", "IFERROR", "VLOOKUP", "HLOOKUP", "INDEX", "MATCH",
  "SUMIF", "SUMIFS", "CONCAT", "CONCATENATE", "TEXT", "ROUND",
  "TODAY", "NOW", "MIN", "MAX", "ABS", "AND", "OR", "NOT",
  "LEN", "LEFT", "RIGHT", "MID", "FIND", "SEARCH", "REPLACE",
  "UPPER", "LOWER", "TRIM", "CLEAN", "VALUE", "INT", "MOD",
  "POWER", "SQRT", "PI", "CEILING", "FLOOR", "ROUNDUP", "ROUNDDOWN",
  "NPV", "IRR", "PMT", "FV", "PV", "RATE", "NPER",
  "ISNUMBER", "ISTEXT", "ISEMPTY", "ISBLANK", "ISERROR",
  "TRUE", "FALSE", "NA",
  "DATE", "YEAR", "MONTH", "DAY", "HOUR", "MINUTE", "SECOND",
  "WEEKDAY", "WEEKNUM", "EOMONTH", "EDATE", "DATEDIF",
];

export class FormulaEngine {
  constructor(eventBus) {
    this._hf = HyperFormula.buildEmpty({
      licenseKey: "gpl-v3",
      evaluateNullToZero: false,
    });
    this._cells = new Map(); // sheetId -> Map of "row:col" -> rawValue
    this._styles = new Map(); // sheetId -> Map of "row:col" -> style
    this._sheetMeta = new Map(); // sheetId -> { rowCount, columnCount, name }
    this._hfSheetIds = new Map(); // our sheetId -> HyperFormula numeric sheetId
    this._sheetNames = new Map(); // our sheetId -> HyperFormula sheet name
    this._eventBus = eventBus;
  }

  _resolveHfId(sheetId) {
    return this._hfSheetIds.get(sheetId);
  }

  initSheet(sheetId, rows, cols) {
    if (this._hfSheetIds.has(sheetId)) return;
    this._hf.addSheet(sheetId);
    const numId = this._hf.getSheetId(sheetId);
    if (numId === undefined) return;
    this._hfSheetIds.set(sheetId, numId);
    this._sheetNames.set(sheetId, sheetId);
    const numRows = rows || 100;
    const numCols = cols || 26;
    const emptyGrid = Array.from({ length: numRows }, () => new Array(numCols).fill(null));
    this._hf.setSheetContent(numId, emptyGrid);
    this._cells.set(sheetId, new Map());
    this._styles.set(sheetId, new Map());
    this._sheetMeta.set(sheetId, { rowCount: numRows, columnCount: numCols, name: sheetId });
  }

  setCellRawValue(sheetId, row, col, rawValue) {
    const cells = this._cells.get(sheetId);
    if (!cells) return;
    const key = cellKey(row, col);
    cells.set(key, rawValue);
    const numId = this._resolveHfId(sheetId);
    if (numId === undefined) return;

    try {
      if (typeof rawValue === "string" && rawValue.startsWith("=")) {
        const address = this._hf.simpleCellAddress(numId, col, row);
        this._hf.setCellContents(address, rawValue);
      } else {
        const numeric = parseFloat(rawValue);
        const val = !isNaN(numeric) && rawValue !== "" ? numeric : (rawValue || null);
        const address = this._hf.simpleCellAddress(numId, col, row);
        this._hf.setCellContents(address, val);
      }
    } catch (e) {
    }

    if (this._eventBus) {
      this._eventBus.emit("cellChanged", { sheetId, row, col });
      this._eventBus.emit("dataChanged", { sheetId });
    }
  }

  getCellRawValue(sheetId, row, col) {
    const cells = this._cells.get(sheetId);
    if (!cells) return "";
    return cells.get(cellKey(row, col)) || "";
  }

  getCellDisplayValue(sheetId, row, col) {
    const numId = this._resolveHfId(sheetId);
    if (numId === undefined) return "";
    try {
      const address = this._hf.simpleCellAddress(numId, col, row);
      const value = this._hf.getCellValue(address);
      if (value && typeof value === "object" && value.error !== undefined) {
        return `#${value.error}`;
      }
      return value !== undefined && value !== null ? String(value) : "";
    } catch {
      return "";
    }
  }

  getCellType(sheetId, row, col) {
    const raw = this.getCellRawValue(sheetId, row, col);
    if (raw === "" || raw === null || raw === undefined) return "empty";
    if (typeof raw === "string" && raw.startsWith("=")) return "formula";
    const n = parseFloat(raw);
    if (!isNaN(n) && raw !== "") return "number";
    return "string";
  }

  setCellStyle(sheetId, row, col, style) {
    const styles = this._styles.get(sheetId);
    if (!styles) return;
    styles.set(cellKey(row, col), style ? { ...style } : null);
  }

  getCellStyle(sheetId, row, col) {
    const styles = this._styles.get(sheetId);
    if (!styles) return { ...DEFAULT_STYLE };
    const s = styles.get(cellKey(row, col));
    return s ? { ...s } : { ...DEFAULT_STYLE };
  }

  insertRows(sheetId, atRow, count) {
    const numId = this._resolveHfId(sheetId);
    if (numId === undefined) return;
    this._shiftCellsDown(sheetId, atRow, count);
    try {
      this._hf.addRows(numId, [atRow, count]);
    } catch (e) {}
    const meta = this._sheetMeta.get(sheetId);
    if (meta) meta.rowCount += count;
    this._emitStructureChange(sheetId);
  }

  removeRows(sheetId, atRow, count) {
    const numId = this._resolveHfId(sheetId);
    if (numId === undefined) return;
    this._shiftCellsUp(sheetId, atRow, count);
    try {
      this._hf.removeRows(numId, [atRow, count]);
    } catch (e) {}
    const meta = this._sheetMeta.get(sheetId);
    if (meta && meta.rowCount > count) meta.rowCount -= count;
    this._emitStructureChange(sheetId);
  }

  insertCols(sheetId, atCol, count) {
    const numId = this._resolveHfId(sheetId);
    if (numId === undefined) return;
    this._shiftCellsRight(sheetId, atCol, count);
    try {
      this._hf.addColumns(numId, [atCol, count]);
    } catch (e) {}
    const meta = this._sheetMeta.get(sheetId);
    if (meta) meta.columnCount += count;
    this._emitStructureChange(sheetId);
  }

  removeCols(sheetId, atCol, count) {
    const numId = this._resolveHfId(sheetId);
    if (numId === undefined) return;
    this._shiftCellsLeft(sheetId, atCol, count);
    try {
      this._hf.removeColumns(numId, [atCol, count]);
    } catch (e) {}
    const meta = this._sheetMeta.get(sheetId);
    if (meta && meta.columnCount > count) meta.columnCount -= count;
    this._emitStructureChange(sheetId);
  }

  insertRowsWithCells(sheetId, atRow, count, cells) {
    const numId = this._resolveHfId(sheetId);
    if (numId === undefined) return;
    this._shiftCellsDown(sheetId, atRow, count);
    try {
      this._hf.addRows(numId, [atRow, count]);
    } catch (e) {}
    const meta = this._sheetMeta.get(sheetId);
    if (meta) meta.rowCount += count;
    if (cells) {
      const cellMap = this._cells.get(sheetId);
      const styleMap = this._styles.get(sheetId);
      for (const [key, val] of Object.entries(cells)) {
        const [r, c] = key.split(":").map(Number);
        if (r >= atRow && r < atRow + count) {
          cellMap.set(key, val.rawValue);
          if (val.style) styleMap.set(key, cloneStyle(val.style));
        }
      }
    }
    this._emitStructureChange(sheetId);
  }

  insertColsWithCells(sheetId, atCol, count, cells) {
    const numId = this._resolveHfId(sheetId);
    if (numId === undefined) return;
    this._shiftCellsRight(sheetId, atCol, count);
    try {
      this._hf.addColumns(numId, [atCol, count]);
    } catch (e) {}
    const meta = this._sheetMeta.get(sheetId);
    if (meta) meta.columnCount += count;
    if (cells) {
      const cellMap = this._cells.get(sheetId);
      const styleMap = this._styles.get(sheetId);
      for (const [key, val] of Object.entries(cells)) {
        const [r, c] = key.split(":").map(Number);
        if (c >= atCol && c < atCol + count) {
          cellMap.set(key, val.rawValue);
          if (val.style) styleMap.set(key, cloneStyle(val.style));
        }
      }
    }
    this._emitStructureChange(sheetId);
  }

  getCellValueForSort(sheetId, row, col) {
    const display = this.getCellDisplayValue(sheetId, row, col);
    const num = parseFloat(display);
    if (!isNaN(num)) return num;
    return display.toLowerCase();
  }

  getSheetDimensions(sheetId) {
    return this._sheetMeta.get(sheetId);
  }

  getAutocompleteSuggestions(partial) {
    const upper = partial.toUpperCase();
    return AUTOFILL_FUNCTIONS.filter((f) => f.startsWith(upper) || f.includes(upper));
  }

  destroySheet(sheetId) {
    const numId = this._resolveHfId(sheetId);
    this._cells.delete(sheetId);
    this._styles.delete(sheetId);
    this._sheetMeta.delete(sheetId);
    this._hfSheetIds.delete(sheetId);
    this._sheetNames.delete(sheetId);
    if (numId !== undefined) {
      try {
        this._hf.removeSheet(numId);
      } catch (e) {}
    }
  }

  exportSheet(sheetId) {
    const cells = this._cells.get(sheetId);
    const styles = this._styles.get(sheetId);
    const result = {};
    if (!cells) return result;
    for (const [key, rawValue] of cells) {
      result[key] = { rawValue };
      if (styles && styles.has(key)) {
        result[key].style = { ...DEFAULT_STYLE, ...styles.get(key) };
      }
    }
    return result;
  }

  _shiftCellsDown(sheetId, atRow, count) {
    const cells = this._cells.get(sheetId);
    const styles = this._styles.get(sheetId);
    if (!cells) return;
    const entries = [];
    for (const [key, val] of cells) {
      const [r, c] = key.split(":").map(Number);
      if (r >= atRow) entries.push([r, c, val]);
    }
    for (const [r, c] of entries) {
      const oldKey = cellKey(r, c);
      const newKey = cellKey(r + count, c);
      cells.set(newKey, cells.get(oldKey));
      cells.delete(oldKey);
      if (styles && styles.has(oldKey)) {
        styles.set(newKey, styles.get(oldKey));
        styles.delete(oldKey);
      }
    }
  }

  _shiftCellsUp(sheetId, atRow, count) {
    const cells = this._cells.get(sheetId);
    const styles = this._styles.get(sheetId);
    if (!cells) return;
    const entries = [];
    for (const [key, val] of cells) {
      const [r, c] = key.split(":").map(Number);
      if (r >= atRow + count) entries.push([r, c, val]);
    }
    for (const [r, c] of entries) {
      const oldKey = cellKey(r, c);
      const newKey = cellKey(r - count, c);
      cells.set(newKey, cells.get(oldKey));
      cells.delete(oldKey);
      if (styles && styles.has(oldKey)) {
        styles.set(newKey, styles.get(oldKey));
        styles.delete(oldKey);
      }
    }
    for (let r = atRow; r < atRow + count; r++) {
      for (const [key] of [...cells]) {
        const [rr, cc] = key.split(":").map(Number);
        if (rr === r) {
          cells.delete(key);
          if (styles) styles.delete(key);
        }
      }
    }
  }

  _shiftCellsRight(sheetId, atCol, count) {
    const cells = this._cells.get(sheetId);
    const styles = this._styles.get(sheetId);
    if (!cells) return;
    const entries = [];
    for (const [key, val] of cells) {
      const [r, c] = key.split(":").map(Number);
      if (c >= atCol) entries.push([r, c, val]);
    }
    for (const [r, c] of entries) {
      const oldKey = cellKey(r, c);
      const newKey = cellKey(r, c + count);
      cells.set(newKey, cells.get(oldKey));
      cells.delete(oldKey);
      if (styles && styles.has(oldKey)) {
        styles.set(newKey, styles.get(oldKey));
        styles.delete(oldKey);
      }
    }
  }

  _shiftCellsLeft(sheetId, atCol, count) {
    const cells = this._cells.get(sheetId);
    const styles = this._styles.get(sheetId);
    if (!cells) return;
    const entries = [];
    for (const [key, val] of cells) {
      const [r, c] = key.split(":").map(Number);
      if (c >= atCol + count) entries.push([r, c, val]);
    }
    for (const [r, c] of entries) {
      const oldKey = cellKey(r, c);
      const newKey = cellKey(r, c - count);
      cells.set(newKey, cells.get(oldKey));
      cells.delete(oldKey);
      if (styles && styles.has(oldKey)) {
        styles.set(newKey, styles.get(oldKey));
        styles.delete(oldKey);
      }
    }
    for (let c = atCol; c < atCol + count; c++) {
      for (const [key] of [...cells]) {
        const [rr, cc] = key.split(":").map(Number);
        if (cc === c) {
          cells.delete(key);
          if (styles) styles.delete(key);
        }
      }
    }
  }

  _emitStructureChange(sheetId) {
    if (this._eventBus) {
      this._eventBus.emit("structureChanged", { sheetId });
    }
  }
}
