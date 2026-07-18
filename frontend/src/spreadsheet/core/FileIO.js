import * as XLSX from "xlsx";
import { createCell, DEFAULT_STYLE, deserializeCells, serializeCells } from "./CellStore";
import { createSheet, createWorkbook } from "./Workbook";
import { cellKey } from "./utils";

function mapXlsxStyle(cell, styles) {
  if (!cell || !cell.s) return null;
  const xlStyle = styles && styles[cell.s];
  if (!xlStyle) return null;

  const style = { ...DEFAULT_STYLE };
  const font = xlStyle.font;
  if (font) {
    if (font.bold) style.bold = true;
    if (font.italic) style.italic = true;
    if (font.underline) style.underline = true;
    if (font.strike) style.strikethrough = true;
    if (font.name) style.fontFamily = font.name;
    if (font.sz) style.fontSize = font.sz;
    if (font.color && font.color.rgb) {
      const c = font.color.rgb;
      style.color = `#${c.length === 6 ? c : c.substring(2)}`;
    }
  }
  const fill = xlStyle.fill;
  if (fill && fill.fgColor && fill.fgColor.rgb) {
    const c = fill.fgColor.rgb;
    style.bgColor = `#${c.length === 6 ? c : c.substring(2)}`;
  }
  const align = xlStyle.alignment;
  if (align) {
    if (align.horizontal) style.hAlign = align.horizontal;
    if (align.vertical) style.vAlign = align.vertical;
    if (align.wrapText) style.wrap = true;
  }
  return style;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export function importCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return createWorkbook("Imported CSV");

  const workbook = createWorkbook("Imported CSV");
  const sheet = workbook.sheets[0];
  sheet.name = "Sheet1";

  const data = lines.map((l) => parseCSVLine(l));
  const maxCols = Math.max(...data.map((row) => row.length));
  sheet.rowCount = Math.max(data.length, 100);
  sheet.columnCount = Math.max(maxCols, 26);

  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const val = data[r][c];
      if (val !== "") {
        const cell = createCell(val);
        sheet.cells[cellKey(r, c)] = cell;
      }
    }
  }

  return workbook;
}

export function importXlsx(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellStyles: true });

  if (wb.SheetNames.length === 0) return createWorkbook("Imported XLSX");

  const workbook = createWorkbook("Imported XLSX");
  workbook.sheets = [];
  workbook.sheetIdCounter = 1;

  for (const sheetName of wb.SheetNames) {
    const xlSheet = wb.Sheets[sheetName];
    const sheet = createSheet(sheetName);
    const ref = xlSheet["!ref"];
    let maxRow = 100;
    let maxCol = 26;

    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      maxRow = Math.max(range.e.r + 1, 100);
      maxCol = Math.max(range.e.c + 1, 26);
    }

    sheet.rowCount = maxRow;
    sheet.columnCount = maxCol;

    if (xlSheet["!cols"]) {
      for (let i = 0; i < xlSheet["!cols"].length; i++) {
        const colDef = xlSheet["!cols"][i];
        if (colDef && colDef.wch) {
          sheet.colWidths[i] = colDef.wch * 8;
        }
      }
    }

    const styles = wb.Styles;

    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const xlCell = xlSheet[addr];
          if (xlCell) {
            let rawValue = "";
            if (xlCell.t === "s") {
              rawValue = wb.Strings ? wb.Strings[xlCell.v] : String(xlCell.v);
            } else if (xlCell.t === "n") {
              rawValue = String(xlCell.v);
            } else if (xlCell.t === "b") {
              rawValue = xlCell.v ? "TRUE" : "FALSE";
            } else if (xlCell.t === "e") {
              rawValue = "";
            } else {
              rawValue = String(xlCell.v ?? "");
            }
            if (xlCell.f) {
              rawValue = `=${xlCell.f}`;
            }
            const cell = createCell(rawValue);
            const mappedStyle = mapXlsxStyle(xlCell, styles);
            if (mappedStyle) cell.style = mappedStyle;
            sheet.cells[cellKey(r, c)] = cell;
          }
        }
      }
    }

    workbook.sheets.push(sheet);
  }

  workbook.activeSheetId = workbook.sheets[0] ? workbook.sheets[0].id : null;
  return workbook;
}

export function exportCsv(activeSheet) {
  if (!activeSheet) return "";
  const lines = [];
  for (let r = 0; r < activeSheet.rowCount; r++) {
    const cells = [];
    for (let c = 0; c < activeSheet.columnCount; c++) {
      const cell = activeSheet.cells[cellKey(r, c)];
      let val = cell ? cell.rawValue : "";
      if (typeof val === "string" && val.startsWith("=")) {
        val = val.substring(1);
      }
      const strVal = String(val);
      if (strVal.includes(",") || strVal.includes('"') || strVal.includes("\n")) {
        cells.push('"' + strVal.replace(/"/g, '""') + '"');
      } else {
        cells.push(strVal);
      }
    }
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

export function exportXlsx(workbook, engine) {
  const xlWb = XLSX.utils.book_new();

  for (const sheet of workbook.sheets) {
    const data = [];
    for (let r = 0; r < sheet.rowCount; r++) {
      const row = [];
      for (let c = 0; c < sheet.columnCount; c++) {
        const cell = sheet.cells[cellKey(r, c)];
        let val = cell ? cell.rawValue : "";
        if (typeof val === "string" && val.startsWith("=")) {
          val = val.substring(1);
        }
        row.push(val);
      }
      data.push(row);
    }

    const xlSheet = XLSX.utils.aoa_to_sheet(data);

    const cols = [];
    for (let c = 0; c < sheet.columnCount; c++) {
      const w = sheet.colWidths[c];
      if (w) {
        cols.push({ wch: Math.round(w / 8) });
      } else {
        cols.push({ wch: 12 });
      }
    }
    xlSheet["!cols"] = cols;

    XLSX.utils.book_append_sheet(xlWb, xlSheet, sheet.name);
  }

  return XLSX.write(xlWb, { bookType: "xlsx", type: "array" });
}
