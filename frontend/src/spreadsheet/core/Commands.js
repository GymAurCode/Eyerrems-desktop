import { cellKey } from "./utils";

export class CommandManager {
  constructor() {
    this._undoStack = [];
    this._redoStack = [];
    this._maxHistory = 200;
  }

  execute(command) {
    command.execute();
    this._undoStack.push(command);
    if (this._undoStack.length > this._maxHistory) {
      this._undoStack.shift();
    }
    this._redoStack = [];
  }

  undo() {
    if (this._undoStack.length === 0) return false;
    const cmd = this._undoStack.pop();
    cmd.undo();
    this._redoStack.push(cmd);
    return true;
  }

  redo() {
    if (this._redoStack.length === 0) return false;
    const cmd = this._redoStack.pop();
    cmd.execute();
    this._undoStack.push(cmd);
    return true;
  }

  get canUndo() {
    return this._undoStack.length > 0;
  }

  get canRedo() {
    return this._redoStack.length > 0;
  }

  clear() {
    this._undoStack = [];
    this._redoStack = [];
  }
}

export class EditCellCommand {
  constructor(engine, sheetId, row, col, oldValue, newValue, oldStyle, newStyle) {
    this.engine = engine;
    this.sheetId = sheetId;
    this.row = row;
    this.col = col;
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.oldStyle = oldStyle;
    this.newStyle = newStyle;
  }

  execute() {
    this.engine.setCellRawValue(this.sheetId, this.row, this.col, this.newValue);
    if (this.newStyle) this.engine.setCellStyle(this.sheetId, this.row, this.col, this.newStyle);
  }

  undo() {
    this.engine.setCellRawValue(this.sheetId, this.row, this.col, this.oldValue);
    if (this.oldStyle) this.engine.setCellStyle(this.sheetId, this.row, this.col, this.oldStyle);
  }
}

export class BatchEditCellsCommand {
  constructor(engine, sheetId, edits) {
    this.engine = engine;
    this.sheetId = sheetId;
    this.edits = edits;
  }

  execute() {
    for (const e of this.edits) {
      this.engine.setCellRawValue(this.sheetId, e.row, e.col, e.newValue);
      if (e.newStyle) this.engine.setCellStyle(this.sheetId, e.row, e.col, e.newStyle);
    }
  }

  undo() {
    for (const e of this.edits) {
      this.engine.setCellRawValue(this.sheetId, e.row, e.col, e.oldValue);
      if (e.oldStyle) this.engine.setCellStyle(this.sheetId, e.row, e.col, e.oldStyle);
    }
  }
}

export class InsertRowsCommand {
  constructor(engine, sheetId, atRow, count = 1) {
    this.engine = engine;
    this.sheetId = sheetId;
    this.atRow = atRow;
    this.count = count;
  }

  execute() {
    this.engine.insertRows(this.sheetId, this.atRow, this.count);
  }

  undo() {
    this.engine.removeRows(this.sheetId, this.atRow, this.count);
  }
}

export class RemoveRowsCommand {
  constructor(engine, sheetId, atRow, count = 1, removedCells = null) {
    this.engine = engine;
    this.sheetId = sheetId;
    this.atRow = atRow;
    this.count = count;
    this.removedCells = removedCells;
  }

  execute() {
    this.engine.removeRows(this.sheetId, this.atRow, this.count);
  }

  undo() {
    this.engine.insertRowsWithCells(this.sheetId, this.atRow, this.count, this.removedCells);
  }
}

export class InsertColsCommand {
  constructor(engine, sheetId, atCol, count = 1) {
    this.engine = engine;
    this.sheetId = sheetId;
    this.atCol = atCol;
    this.count = count;
  }

  execute() {
    this.engine.insertCols(this.sheetId, this.atCol, this.count);
  }

  undo() {
    this.engine.removeCols(this.sheetId, this.atCol, this.count);
  }
}

export class RemoveColsCommand {
  constructor(engine, sheetId, atCol, count = 1, removedCells = null) {
    this.engine = engine;
    this.sheetId = sheetId;
    this.atCol = atCol;
    this.count = count;
    this.removedCells = removedCells;
  }

  execute() {
    this.engine.removeCols(this.sheetId, this.atCol, this.count);
  }

  undo() {
    this.engine.insertColsWithCells(this.sheetId, this.atCol, this.count, this.removedCells);
  }
}

export class StyleCellsCommand {
  constructor(engine, sheetId, cells, styleChanges) {
    this.engine = engine;
    this.sheetId = sheetId;
    this.cells = cells.map((c) => ({ ...c, oldStyle: c.oldStyle ? { ...c.oldStyle } : null }));
    this.styleChanges = { ...styleChanges };
  }

  execute() {
    for (const c of this.cells) {
      const currentStyle = this.engine.getCellStyle(this.sheetId, c.row, c.col) || {};
      const newStyle = { ...currentStyle, ...this.styleChanges };
      this.engine.setCellStyle(this.sheetId, c.row, c.col, newStyle);
    }
  }

  undo() {
    for (const c of this.cells) {
      this.engine.setCellStyle(this.sheetId, c.row, c.col, c.oldStyle);
    }
  }
}

export class ClearCellsCommand {
  constructor(engine, sheetId, cells, oldValues, oldStyles) {
    this.engine = engine;
    this.sheetId = sheetId;
    this.cells = cells;
    this.oldValues = oldValues;
    this.oldStyles = oldStyles;
  }

  execute() {
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      this.engine.setCellRawValue(this.sheetId, c.row, c.col, "");
    }
  }

  undo() {
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      this.engine.setCellRawValue(this.sheetId, c.row, c.col, this.oldValues[i]);
      if (this.oldStyles && this.oldStyles[i]) {
        this.engine.setCellStyle(this.sheetId, c.row, c.col, this.oldStyles[i]);
      }
    }
  }
}

export class ResizeColCommand {
  constructor(sheet, col, oldWidth, newWidth) {
    this.sheet = sheet;
    this.col = col;
    this.oldWidth = oldWidth;
    this.newWidth = newWidth;
  }

  execute() {
    this.sheet.colWidths[this.col] = this.newWidth;
  }

  undo() {
    if (this.oldWidth !== undefined) {
      this.sheet.colWidths[this.col] = this.oldWidth;
    } else {
      delete this.sheet.colWidths[this.col];
    }
  }
}

export class ResizeRowCommand {
  constructor(sheet, row, oldHeight, newHeight) {
    this.sheet = sheet;
    this.row = row;
    this.oldHeight = oldHeight;
    this.newHeight = newHeight;
  }

  execute() {
    this.sheet.rowHeights[this.row] = this.newHeight;
  }

  undo() {
    if (this.oldHeight !== undefined) {
      this.sheet.rowHeights[this.row] = this.oldHeight;
    } else {
      delete this.sheet.rowHeights[this.row];
    }
  }
}
