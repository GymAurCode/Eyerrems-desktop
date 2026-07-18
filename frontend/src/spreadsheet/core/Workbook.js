import { deserializeCells, serializeCells } from "./CellStore";

let _sheetIdCounter = 1;

export function createSheet(name, opts = {}) {
  const id = `sheet-${_sheetIdCounter++}`;
  return {
    id,
    name: name || `Sheet${_sheetIdCounter - 1}`,
    cells: {},
    colWidths: {},
    rowHeights: {},
    rowCount: opts.rowCount || 100,
    columnCount: opts.columnCount || 26,
    frozenRows: opts.frozenRows || 0,
    frozenCols: opts.frozenCols || 0,
    autoFilter: null,
    createdAt: Date.now(),
  };
}

export function createWorkbook(name = "Workbook") {
  const sheet1 = createSheet("Sheet1");
  return {
    name,
    sheets: [sheet1],
    activeSheetId: sheet1.id,
    sheetIdCounter: _sheetIdCounter,
  };
}

export function getActiveSheet(workbook) {
  return workbook.sheets.find((s) => s.id === workbook.activeSheetId);
}

export function serializeWorkbook(workbook) {
  return {
    name: workbook.name,
    activeSheetId: workbook.activeSheetId,
    sheetIdCounter: workbook.sheetIdCounter || _sheetIdCounter,
    sheets: workbook.sheets.map((sheet) => ({
      id: sheet.id,
      name: sheet.name,
      cells: serializeCells(sheet.cells),
      colWidths: { ...sheet.colWidths },
      rowHeights: { ...sheet.rowHeights },
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      frozenRows: sheet.frozenRows || 0,
      frozenCols: sheet.frozenCols || 0,
      autoFilter: sheet.autoFilter || null,
    })),
  };
}

export function deserializeWorkbook(data) {
  const sheets = (data.sheets || []).map((sheet) => ({
    id: sheet.id,
    name: sheet.name,
    cells: deserializeCells(sheet.cells),
    colWidths: sheet.colWidths || {},
    rowHeights: sheet.rowHeights || {},
    rowCount: sheet.rowCount || 100,
    columnCount: sheet.columnCount || 26,
    frozenRows: sheet.frozenRows || 0,
    frozenCols: sheet.frozenCols || 0,
    autoFilter: sheet.autoFilter || null,
  }));
  if (data.sheetIdCounter) _sheetIdCounter = data.sheetIdCounter;
  return {
    name: data.name || "Workbook",
    sheets,
    activeSheetId: data.activeSheetId || (sheets[0] ? sheets[0].id : null),
    sheetIdCounter: data.sheetIdCounter || _sheetIdCounter,
  };
}
