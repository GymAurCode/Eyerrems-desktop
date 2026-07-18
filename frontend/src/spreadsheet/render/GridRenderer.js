import {
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  HEADER_HEIGHT,
  ROW_HEADER_WIDTH,
  MIN_COL_WIDTH,
  MIN_ROW_HEIGHT,
  MAX_COL_WIDTH,
  MAX_ROW_HEIGHT,
  cellKey,
  colIndexToLetter,
} from "../core/utils";
import { getGridTheme } from "./GridTheme";
import { formatNumber } from "../core/NumberFormat";

const CELL_PADDING = 4;
const FILL_HANDLE_SIZE = 7;
const RESIZE_HANDLE_WIDTH = 4;
const DEFAULT_FONT = "Calibri";

export class GridRenderer {
  constructor(canvas, engine, eventBus) {
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d");
    this._engine = engine;
    this._eventBus = eventBus;
    this._dpr = window.devicePixelRatio || 1;

    this._scrollX = 0;
    this._scrollY = 0;
    this._sheetId = null;
    this._selection = null;
    this._editing = false;
    this._editCell = null;
    this._resizeCol = null;
    this._resizeRow = null;
    this._fillDragging = false;
    this._fillStart = null;
    this._frozenRows = 0;
    this._frozenCols = 0;
    this._animFrame = null;
    this._colWidths = [];
    this._rowHeights = [];

    this._bindEvents();
    this.resize();
  }

  setSheet(sheetId) {
    this._sheetId = sheetId;
    this._scrollX = 0;
    this._scrollY = 0;
    this._editing = false;
    this._editCell = null;
    this.rebuildLayout();
    this.render();
  }

  setSelection(sel) {
    this._selection = sel;
    this.render();
  }

  setEditing(editing, cell) {
    this._editing = editing;
    this._editCell = cell;
    this.render();
  }

  setTheme(theme) {
    this._theme = theme;
    this.render();
  }

  rebuildLayout() {
    if (!this._sheetId) return;
    const sheet = this._getSheet();
    if (!sheet) return;

    const count = Math.max(sheet.columnCount, 1);
    this._colWidths = [];
    for (let i = 0; i < count; i++) {
      this._colWidths[i] = sheet.colWidths[i] || DEFAULT_COL_WIDTH;
    }

    const rowCount = Math.max(sheet.rowCount, 1);
    this._rowHeights = [];
    for (let i = 0; i < rowCount; i++) {
      this._rowHeights[i] = sheet.rowHeights[i] || DEFAULT_ROW_HEIGHT;
    }
  }

  _getSheet() {
    if (!this._engine || !this._sheetId) return null;
    const dims = this._engine.getSheetDimensions(this._sheetId);
    if (!dims) return { columnCount: 1, rowCount: 1, colWidths: this._colWidths, rowHeights: this._rowHeights };
    return { columnCount: dims.columnCount, rowCount: dims.rowCount, colWidths: this._colWidths, rowHeights: this._rowHeights };
  }

  resize() {
    const parent = this._canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    this._canvas.width = w * this._dpr;
    this._canvas.height = h * this._dpr;
    this._canvas.style.width = w + "px";
    this._canvas.style.height = h + "px";
    this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this._viewportWidth = w;
    this._viewportHeight = h;
    this.render();
  }

  getVisibleBounds() {
    const sheet = this._getSheet();
    if (!sheet)
      return { startRow: 0, endRow: 0, startCol: 0, endCol: 0 };

    let x = ROW_HEADER_WIDTH - this._scrollX;
    let startCol = 0;
    for (let c = 0; c < sheet.columnCount; c++) {
      if (x + (this._colWidths[c] || DEFAULT_COL_WIDTH) > ROW_HEADER_WIDTH) {
        startCol = c;
        break;
      }
      x += this._colWidths[c] || DEFAULT_COL_WIDTH;
    }

    let endCol = startCol;
    let cx = x;
    for (let c = startCol; c < sheet.columnCount; c++) {
      const w = this._colWidths[c] || DEFAULT_COL_WIDTH;
      if (cx > this._viewportWidth) break;
      endCol = c;
      cx += w;
    }

    let y = HEADER_HEIGHT - this._scrollY;
    let startRow = 0;
    for (let r = 0; r < sheet.rowCount; r++) {
      if (y + (this._rowHeights[r] || DEFAULT_ROW_HEIGHT) > HEADER_HEIGHT) {
        startRow = r;
        break;
      }
      y += this._rowHeights[r] || DEFAULT_ROW_HEIGHT;
    }

    let endRow = startRow;
    let ry = y;
    for (let r = startRow; r < sheet.rowCount; r++) {
      const h = this._rowHeights[r] || DEFAULT_ROW_HEIGHT;
      if (ry > this._viewportHeight) break;
      endRow = r;
      ry += h;
    }

    return { startRow, endRow, startCol, endCol };
  }

  colX(col) {
    let x = ROW_HEADER_WIDTH - this._scrollX;
    for (let c = 0; c < col; c++) {
      x += this._colWidths[c] || DEFAULT_COL_WIDTH;
    }
    return x;
  }

  rowY(row) {
    let y = HEADER_HEIGHT - this._scrollY;
    for (let r = 0; r < row; r++) {
      y += this._rowHeights[r] || DEFAULT_ROW_HEIGHT;
    }
    return y;
  }

  cellFromPixel(px, py) {
    const sheet = this._getSheet();
    if (!sheet) return { row: 0, col: 0 };

    let col = 0;
    if (px > ROW_HEADER_WIDTH) {
      let x = ROW_HEADER_WIDTH - this._scrollX;
      for (let c = 0; c < sheet.columnCount; c++) {
        const w = this._colWidths[c] || DEFAULT_COL_WIDTH;
        if (px >= x && px < x + w) { col = c; break; }
        x += w;
        col = c + 1;
      }
    }

    let row = 0;
    if (py > HEADER_HEIGHT) {
      let y = HEADER_HEIGHT - this._scrollY;
      for (let r = 0; r < sheet.rowCount; r++) {
        const h = this._rowHeights[r] || DEFAULT_ROW_HEIGHT;
        if (py >= y && py < y + h) { row = r; break; }
        y += h;
        row = r + 1;
      }
    }

    return {
      row: Math.min(row, sheet.rowCount - 1),
      col: Math.min(col, sheet.columnCount - 1),
    };
  }

  scrollToCell(row, col) {
    if (!this._viewportWidth || !this._viewportHeight) return;
    const cellX = this.colX(col);
    const cellY = this.rowY(row);
    const cellW = this._colWidths[col] || DEFAULT_COL_WIDTH;
    const cellH = this._rowHeights[row] || DEFAULT_ROW_HEIGHT;

    const rightEdge = cellX + cellW;
    const bottomEdge = cellY + cellH;
    const viewRight = this._viewportWidth;
    const viewBottom = this._viewportHeight;

    let changed = false;
    if (cellX < ROW_HEADER_WIDTH) {
      this._scrollX -= ROW_HEADER_WIDTH - cellX;
      changed = true;
    } else if (rightEdge > viewRight) {
      this._scrollX += rightEdge - viewRight;
      changed = true;
    }
    if (cellY < HEADER_HEIGHT) {
      this._scrollY -= HEADER_HEIGHT - cellY;
      changed = true;
    } else if (bottomEdge > viewBottom) {
      this._scrollY += bottomEdge - viewBottom;
      changed = true;
    }
    this._clampScroll();
    if (changed) this.render();
  }

  _clampScroll() {
    const sheet = this._getSheet();
    if (!sheet || !this._viewportWidth || !this._viewportHeight) return;
    const totalW = this._getTotalWidth();
    const totalH = this._getTotalHeight();
    const maxX = Math.max(0, totalW - this._viewportWidth + ROW_HEADER_WIDTH);
    const maxY = Math.max(0, totalH - this._viewportHeight + HEADER_HEIGHT);
    this._scrollX = Math.max(0, Math.min(maxX, this._scrollX));
    this._scrollY = Math.max(0, Math.min(maxY, this._scrollY));
  }

  _getTotalWidth() {
    let w = ROW_HEADER_WIDTH;
    for (const cw of this._colWidths) w += cw || DEFAULT_COL_WIDTH;
    return w;
  }

  _getTotalHeight() {
    let h = HEADER_HEIGHT;
    for (const rh of this._rowHeights) h += rh || DEFAULT_ROW_HEIGHT;
    return h;
  }

  render() {
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    this._animFrame = requestAnimationFrame(() => this._doRender());
  }

  _doRender() {
    this._animFrame = null;
    const ctx = this._ctx;
    const theme = getGridTheme();
    this._currentTheme = theme;

    ctx.clearRect(0, 0, this._viewportWidth, this._viewportHeight);

    const bounds = this.getVisibleBounds();
    const sheet = this._getSheet();
    if (!sheet) return;

    const totalCols = sheet.columnCount;
    const totalRows = sheet.rowCount;

    ctx.save();

    const clipX = ROW_HEADER_WIDTH;
    const clipY = HEADER_HEIGHT;
    const clipW = this._viewportWidth - ROW_HEADER_WIDTH;
    const clipH = this._viewportHeight - HEADER_HEIGHT;

    ctx.beginPath();
    ctx.rect(clipX, clipY, clipW, clipH);
    ctx.clip();

    for (let r = bounds.startRow; r <= bounds.endRow && r < totalRows; r++) {
      for (let c = bounds.startCol; c <= bounds.endCol && c < totalCols; c++) {
        this._drawCell(ctx, r, c, bounds, theme, sheet);
      }
    }

    for (let r = bounds.startRow; r <= bounds.endRow && r < totalRows; r++) {
      const y = this.rowY(r);
      const h = this._rowHeights[r] || DEFAULT_ROW_HEIGHT;
      ctx.strokeStyle = theme.gridLineColor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(clipX, y + h);
      ctx.lineTo(clipX + clipW, y + h);
      ctx.stroke();
    }

    for (let c = bounds.startCol; c <= bounds.endCol && c < totalCols; c++) {
      const x = this.colX(c);
      const w = this._colWidths[c] || DEFAULT_COL_WIDTH;
      ctx.strokeStyle = theme.gridLineColor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + w, clipY);
      ctx.lineTo(x + w, clipY + clipH);
      ctx.stroke();
    }

    ctx.restore();

    this._drawHeaders(ctx, bounds, theme, sheet);
    this._drawSelection(ctx, theme);
    this._drawFillHandle(ctx, theme);

    if (!this._editing && this._selection) {
      this._drawBorders(ctx, bounds, theme, sheet);
    }
  }

  _drawCell(ctx, row, col, bounds, theme, sheet) {
    const x = this.colX(col);
    const y = this.rowY(row);
    const w = this._colWidths[col] || DEFAULT_COL_WIDTH;
    const h = this._rowHeights[row] || DEFAULT_ROW_HEIGHT;

    if (x + w < ROW_HEADER_WIDTH || y + h < HEADER_HEIGHT) return;
    if (x > this._viewportWidth || y > this._viewportHeight) return;

    if (!this._engine || !this._sheetId) {
      ctx.fillStyle = theme.cellBackground;
      ctx.fillRect(x, y, w, h);
      return;
    }

    const style = this._engine.getCellStyle(this._sheetId, row, col);

    if (style && style.bgColor) {
      ctx.fillStyle = style.bgColor;
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.fillStyle = theme.cellBackground;
      ctx.fillRect(x, y, w, h);
    }

    if (this._editing && this._editCell && this._editCell.row === row && this._editCell.col === col) {
      return;
    }

    const rawValue = this._engine.getCellRawValue(this._sheetId, row, col);
    if (rawValue === "" || rawValue === null || rawValue === undefined) return;

    const isFormula = typeof rawValue === "string" && rawValue.startsWith("=");
    let displayValue = isFormula
      ? this._engine.getCellDisplayValue(this._sheetId, row, col)
      : rawValue;

    if (style && style.numberFormat && style.numberFormat !== "general") {
      const num = parseFloat(displayValue);
      if (!isNaN(num)) {
        displayValue = formatNumber(num, style.numberFormat);
      }
    }

    if (displayValue === "" || displayValue === undefined) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    const fontSize = style.fontSize || 11;
    const fontFamily = style.fontFamily || DEFAULT_FONT;
    const fontWeight = style.bold ? "bold" : "normal";
    const fontStyle = style.italic ? "italic" : "normal";
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    ctx.fillStyle = style.color || theme.textColor;

    let textX = x + CELL_PADDING;
    let textY = y + h - CELL_PADDING - 2;

    const hAlign = style.hAlign || "left";
    if (hAlign === "center") {
      textX = x + w / 2;
      ctx.textAlign = "center";
    } else if (hAlign === "right") {
      textX = x + w - CELL_PADDING;
      ctx.textAlign = "right";
    } else {
      ctx.textAlign = "left";
    }

    ctx.textBaseline = "bottom";

    ctx.fillText(displayValue, textX, textY);

    if (style.underline) {
      const metrics = ctx.measureText(displayValue);
      const tw = metrics.width;
      let lineX = textX;
      if (ctx.textAlign === "center") lineX = textX - tw / 2;
      else if (ctx.textAlign === "right") lineX = textX - tw;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lineX, textY + 1);
      ctx.lineTo(lineX + tw, textY + 1);
      ctx.stroke();
    }

    if (style.strikethrough) {
      const metrics = ctx.measureText(displayValue);
      const tw = metrics.width;
      let lineX = textX;
      if (ctx.textAlign === "center") lineX = textX - tw / 2;
      else if (ctx.textAlign === "right") lineX = textX - tw;
      const midY = textY - fontSize * 0.3;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lineX, midY);
      ctx.lineTo(lineX + tw, midY);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawHeaders(ctx, bounds, theme, sheet) {
    const totalCols = sheet.columnCount;
    const totalRows = sheet.rowCount;

    ctx.strokeStyle = theme.gridLineColor;
    ctx.lineWidth = 0.5;

    ctx.fillStyle = theme.cornerFill;
    ctx.fillRect(0, 0, ROW_HEADER_WIDTH, HEADER_HEIGHT);
    ctx.strokeRect(0, 0, ROW_HEADER_WIDTH, HEADER_HEIGHT);
    ctx.fillStyle = theme.headerText;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("", ROW_HEADER_WIDTH / 2, HEADER_HEIGHT / 2);

    for (let c = bounds.startCol; c <= bounds.endCol && c < totalCols; c++) {
      const x = this.colX(c);
      const w = this._colWidths[c] || DEFAULT_COL_WIDTH;
      const letter = colIndexToLetter(c);

      const isSelected = this._selection && this._isColSelected(c);
      ctx.fillStyle = isSelected ? theme.headerSelectedFill : theme.headerBackground;
      ctx.fillRect(x, 0, w, HEADER_HEIGHT);
      ctx.strokeRect(x, 0, w, HEADER_HEIGHT);

      ctx.fillStyle = isSelected ? theme.headerSelectedText : theme.headerText;
      ctx.font = isSelected ? "bold 11px sans-serif" : "11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letter, x + w / 2, HEADER_HEIGHT / 2);
    }

    for (let r = bounds.startRow; r <= bounds.endRow && r < totalRows; r++) {
      const y = this.rowY(r);
      const h = this._rowHeights[r] || DEFAULT_ROW_HEIGHT;
      const label = String(r + 1);

      const isSelected = this._selection && this._isRowSelected(r);
      ctx.fillStyle = isSelected ? theme.headerSelectedFill : theme.headerBackground;
      ctx.fillRect(0, y, ROW_HEADER_WIDTH, h);
      ctx.strokeRect(0, y, ROW_HEADER_WIDTH, h);

      ctx.fillStyle = isSelected ? theme.headerSelectedText : theme.headerText;
      ctx.font = isSelected ? "bold 11px sans-serif" : "11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, ROW_HEADER_WIDTH / 2, y + h / 2);
    }
  }

  _isColSelected(col) {
    if (!this._selection || !this._selection.ranges) return false;
    for (const r of this._selection.ranges) {
      const minC = Math.min(r.startCol, r.endCol);
      const maxC = Math.max(r.startCol, r.endCol);
      if (col >= minC && col <= maxC) {
        const minR = Math.min(r.startRow, r.endRow);
        const maxR = Math.max(r.startRow, r.endRow);
        if (minR === 0 && maxR >= (this._rowHeights.length - 1)) return true;
      }
    }
    return false;
  }

  _isRowSelected(row) {
    if (!this._selection || !this._selection.ranges) return false;
    for (const r of this._selection.ranges) {
      const minR = Math.min(r.startRow, r.endRow);
      const maxR = Math.max(r.startRow, r.endRow);
      if (row >= minR && row <= maxR) {
        const minC = Math.min(r.startCol, r.endCol);
        const maxC = Math.max(r.startCol, r.endCol);
        if (minC === 0 && maxC >= (this._colWidths.length - 1)) return true;
      }
    }
    return false;
  }

  _drawSelection(ctx, theme) {
    if (!this._selection || !this._selection.ranges) return;
    for (const range of this._selection.ranges) {
      const minR = Math.min(range.startRow, range.endRow);
      const maxR = Math.max(range.startRow, range.endRow);
      const minC = Math.min(range.startCol, range.endCol);
      const maxC = Math.max(range.startCol, range.endCol);

      const x = this.colX(minC);
      const y = this.rowY(minR);
      const w = this.colX(maxC) + (this._colWidths[maxC] || DEFAULT_COL_WIDTH) - x;
      const h = this.rowY(maxR) + (this._rowHeights[maxR] || DEFAULT_ROW_HEIGHT) - y;

      ctx.fillStyle = theme.selectionFill;
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = theme.selectionBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);

      if (this._selection.active) {
        const ax = this.colX(this._selection.active.col);
        const ay = this.rowY(this._selection.active.row);
        const aw = this._colWidths[this._selection.active.col] || DEFAULT_COL_WIDTH;
        const ah = this._rowHeights[this._selection.active.row] || DEFAULT_ROW_HEIGHT;

        ctx.strokeStyle = theme.activeCellBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(ax, ay, aw, ah);
      }
    }
  }

  _drawFillHandle(ctx, theme) {
    if (!this._selection || !this._selection.ranges || this._selection.ranges.length === 0) return;
    const range = this._selection.ranges[this._selection.ranges.length - 1];
    const maxR = Math.max(range.startRow, range.endRow);
    const maxC = Math.max(range.startCol, range.endCol);

    const x = this.colX(maxC) + (this._colWidths[maxC] || DEFAULT_COL_WIDTH) - FILL_HANDLE_SIZE;
    const y = this.rowY(maxR) + (this._rowHeights[maxR] || DEFAULT_ROW_HEIGHT) - FILL_HANDLE_SIZE;

    ctx.fillStyle = theme.selectionBorder;
    ctx.fillRect(x, y, FILL_HANDLE_SIZE, FILL_HANDLE_SIZE);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, FILL_HANDLE_SIZE, FILL_HANDLE_SIZE);
  }

  _drawBorders(ctx, bounds, theme, sheet) {
    for (let r = bounds.startRow; r <= bounds.endRow && r < (this._rowHeights.length); r++) {
      for (let c = bounds.startCol; c <= bounds.endCol && c < (this._colWidths.length); c++) {
        const key = cellKey(r, c);
        const cell = sheet.cells ? sheet.cells[key] : null;
        if (!cell || !cell.style) continue;
        const style = cell.style;
        const x = this.colX(c);
        const y = this.rowY(r);
        const w = this._colWidths[c] || DEFAULT_COL_WIDTH;
        const h = this._rowHeights[r] || DEFAULT_ROW_HEIGHT;

        ctx.lineWidth = 1;
        if (style.borderTop) {
          ctx.strokeStyle = style.borderColor || "#000000";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + w, y);
          ctx.stroke();
        }
        if (style.borderBottom) {
          ctx.strokeStyle = style.borderColor || "#000000";
          ctx.beginPath();
          ctx.moveTo(x, y + h);
          ctx.lineTo(x + w, y + h);
          ctx.stroke();
        }
        if (style.borderLeft) {
          ctx.strokeStyle = style.borderColor || "#000000";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + h);
          ctx.stroke();
        }
        if (style.borderRight) {
          ctx.strokeStyle = style.borderColor || "#000000";
          ctx.beginPath();
          ctx.moveTo(x + w, y);
          ctx.lineTo(x + w, y + h);
          ctx.stroke();
        }
      }
    }
  }

  _bindEvents() {
    const c = this._canvas;

    c.addEventListener("mousedown", (e) => this._onMouseDown(e));
    c.addEventListener("mousemove", (e) => this._onMouseMove(e));
    c.addEventListener("mouseup", (e) => this._onMouseUp(e));
    c.addEventListener("dblclick", (e) => this._onDblClick(e));
    c.addEventListener("contextmenu", (e) => this._onContextMenu(e));
    c.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(c.parentElement);
  }

  _onMouseDown(e) {
    const rect = this._canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const sheet = this._getSheet();
    if (!sheet) return;

    if (py < HEADER_HEIGHT && px < ROW_HEADER_WIDTH) {
      if (this._eventBus) this._eventBus.emit("selectAll");
      return;
    }

    if (py < HEADER_HEIGHT && px > ROW_HEADER_WIDTH) {
      let col = 0;
      let x = ROW_HEADER_WIDTH - this._scrollX;
      for (let c = 0; c < sheet.columnCount; c++) {
        const w = this._colWidths[c] || DEFAULT_COL_WIDTH;
        if (px >= x && px < x + w) {
          col = c;
          break;
        }
        x += w;
      }
      const borderX = this.colX(col) + (this._colWidths[col] || DEFAULT_COL_WIDTH);
      if (Math.abs(px - borderX) < RESIZE_HANDLE_WIDTH) {
        this._resizeCol = col;
        return;
      }
      if (this._eventBus) this._eventBus.emit("selectColumn", col, sheet.rowCount - 1);
      return;
    }

    if (px < ROW_HEADER_WIDTH && py > HEADER_HEIGHT) {
      let row = 0;
      let y = HEADER_HEIGHT - this._scrollY;
      for (let r = 0; r < sheet.rowCount; r++) {
        const h = this._rowHeights[r] || DEFAULT_ROW_HEIGHT;
        if (py >= y && py < y + h) {
          row = r;
          break;
        }
        y += h;
      }
      const borderY = this.rowY(row) + (this._rowHeights[row] || DEFAULT_ROW_HEIGHT);
      if (Math.abs(py - borderY) < RESIZE_HANDLE_WIDTH) {
        this._resizeRow = row;
        return;
      }
      if (this._eventBus) this._eventBus.emit("selectRow", row, sheet.columnCount - 1);
      return;
    }

    if (this._selection && this._selection.ranges.length > 0) {
      const range = this._selection.ranges[this._selection.ranges.length - 1];
      const maxR = Math.max(range.startRow, range.endRow);
      const maxC = Math.max(range.startCol, range.endCol);
      const fhX = this.colX(maxC) + (this._colWidths[maxC] || DEFAULT_COL_WIDTH) - FILL_HANDLE_SIZE;
      const fhY = this.rowY(maxR) + (this._rowHeights[maxR] || DEFAULT_ROW_HEIGHT) - FILL_HANDLE_SIZE;
      if (px >= fhX && px < fhX + FILL_HANDLE_SIZE + 4 && py >= fhY && py < fhY + FILL_HANDLE_SIZE + 4) {
        this._fillDragging = true;
        this._fillStart = { row: maxR, col: maxC };
        return;
      }
    }

    const cell = this.cellFromPixel(px, py);

    this._resizeStartX = px;
    this._resizeStartY = py;
    this._resizeInitialColWidth = this._colWidths[cell.col] || DEFAULT_COL_WIDTH;
    this._resizeInitialRowHeight = this._rowHeights[cell.row] || DEFAULT_ROW_HEIGHT;

    if (this._eventBus) {
      this._eventBus.emit("cellMouseDown", cell.row, cell.col, e.shiftKey);
    }
  }

  _onMouseMove(e) {
    const rect = this._canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const sheet = this._getSheet();
    if (!sheet) {
      this._canvas.style.cursor = "default";
      return;
    }

    if (this._resizeCol !== null) {
      const initialX = this.colX(this._resizeCol);
      const newWidth = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, this._resizeInitialColWidth + (px - this._resizeStartX)));
      this._colWidths[this._resizeCol] = newWidth;
      if (this._eventBus) this._eventBus.emit("layoutChanged");
      this.render();
      return;
    }

    if (this._resizeRow !== null) {
      const initialY = this.rowY(this._resizeRow);
      const newHeight = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, this._resizeInitialRowHeight + (py - this._resizeStartY)));
      this._rowHeights[this._resizeRow] = newHeight;
      if (this._eventBus) this._eventBus.emit("layoutChanged");
      this.render();
      return;
    }

    if (this._fillDragging) {
      const cell = this.cellFromPixel(px, py);
      if (this._eventBus) {
        this._eventBus.emit("fillDrag", this._fillStart, cell);
      }
      return;
    }

    if (e.buttons === 1 && !this._resizeCol && !this._resizeRow && !this._fillDragging) {
      const cell = this.cellFromPixel(px, py);
      if (this._eventBus) {
        this._eventBus.emit("selectionDrag", cell.row, cell.col);
      }
      return;
    }

    let cursor = "default";
    if (py < HEADER_HEIGHT && px > ROW_HEADER_WIDTH) {
      let col = 0;
      let x = ROW_HEADER_WIDTH - this._scrollX;
      for (let c = 0; c < sheet.columnCount; c++) {
        const w = this._colWidths[c] || DEFAULT_COL_WIDTH;
        if (px >= x && px < x + w) {
          col = c;
          break;
        }
        x += w;
      }
      const borderX = this.colX(col) + (this._colWidths[col] || DEFAULT_COL_WIDTH);
      if (Math.abs(px - borderX) < RESIZE_HANDLE_WIDTH) {
        cursor = "col-resize";
      }
    } else if (px < ROW_HEADER_WIDTH && py > HEADER_HEIGHT) {
      let row = 0;
      let y = HEADER_HEIGHT - this._scrollY;
      for (let r = 0; r < sheet.rowCount; r++) {
        const h = this._rowHeights[r] || DEFAULT_ROW_HEIGHT;
        if (py >= y && py < y + h) {
          row = r;
          break;
        }
        y += h;
      }
      const borderY = this.rowY(row) + (this._rowHeights[row] || DEFAULT_ROW_HEIGHT);
      if (Math.abs(py - borderY) < RESIZE_HANDLE_WIDTH) {
        cursor = "row-resize";
      }
    } else if (this._selection && this._selection.ranges.length > 0) {
      const range = this._selection.ranges[this._selection.ranges.length - 1];
      const maxR = Math.max(range.startRow, range.endRow);
      const maxC = Math.max(range.startCol, range.endCol);
      const fhX = this.colX(maxC) + (this._colWidths[maxC] || DEFAULT_COL_WIDTH) - FILL_HANDLE_SIZE;
      const fhY = this.rowY(maxR) + (this._rowHeights[maxR] || DEFAULT_ROW_HEIGHT) - FILL_HANDLE_SIZE;
      if (px >= fhX - 2 && px < fhX + FILL_HANDLE_SIZE + 6 && py >= fhY - 2 && py < fhY + FILL_HANDLE_SIZE + 6) {
        cursor = "crosshair";
      }
    }

    this._canvas.style.cursor = cursor;
  }

  _onMouseUp(e) {
    if (this._resizeCol !== null) {
      const col = this._resizeCol;
      this._resizeCol = null;
      if (this._eventBus) this._eventBus.emit("colResizeEnd", col);
      return;
    }
    if (this._resizeRow !== null) {
      const row = this._resizeRow;
      this._resizeRow = null;
      if (this._eventBus) this._eventBus.emit("rowResizeEnd", row);
      return;
    }
    if (this._fillDragging) {
      this._fillDragging = false;
      if (this._eventBus) this._eventBus.emit("fillDragEnd");
      return;
    }
    if (this._eventBus) this._eventBus.emit("selectionEnd");
  }

  _onDblClick(e) {
    const rect = this._canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (px < ROW_HEADER_WIDTH || py < HEADER_HEIGHT) return;
    const cell = this.cellFromPixel(px, py);
    if (this._eventBus) this._eventBus.emit("startEdit", cell.row, cell.col);
  }

  _onContextMenu(e) {
    e.preventDefault();
    const rect = this._canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const cell = this.cellFromPixel(px, py);

    if (py < HEADER_HEIGHT && px > ROW_HEADER_WIDTH) {
      let col = 0;
      let x = ROW_HEADER_WIDTH - this._scrollX;
      const sheet = this._getSheet();
      if (sheet) {
        for (let c = 0; c < sheet.columnCount; c++) {
          const w = this._colWidths[c] || DEFAULT_COL_WIDTH;
          if (px >= x && px < x + w) { col = c; break; }
          x += w;
        }
      }
      if (this._eventBus) this._eventBus.emit("columnContextMenu", e.clientX, e.clientY, col);
      return;
    }

    if (px < ROW_HEADER_WIDTH && py > HEADER_HEIGHT) {
      let row = 0;
      let y = HEADER_HEIGHT - this._scrollY;
      const sheet = this._getSheet();
      if (sheet) {
        for (let r = 0; r < sheet.rowCount; r++) {
          const h = this._rowHeights[r] || DEFAULT_ROW_HEIGHT;
          if (py >= y && py < y + h) { row = r; break; }
          y += h;
        }
      }
      if (this._eventBus) this._eventBus.emit("rowContextMenu", e.clientX, e.clientY, row);
      return;
    }

    if (this._eventBus) this._eventBus.emit("contextMenu", e.clientX, e.clientY, cell);
  }

  _onWheel(e) {
    e.preventDefault();
    const deltaX = e.deltaX;
    const deltaY = e.deltaY * (e.deltaMode === 1 ? DEFAULT_ROW_HEIGHT : 1) * 1.2;

    this._scrollX += deltaX;
    this._scrollY += deltaY;
    this._clampScroll();
    this.render();
  }

  _getMaxScrollX() {
    const total = this._getTotalWidth();
    return Math.max(0, total - this._viewportWidth + ROW_HEADER_WIDTH);
  }

  _getMaxScrollY() {
    const total = this._getTotalHeight();
    return Math.max(0, total - this._viewportHeight + HEADER_HEIGHT);
  }

  getCellEditorPosition(row, col) {
    const x = this.colX(col);
    const y = this.rowY(row);
    const w = this._colWidths[col] || DEFAULT_COL_WIDTH;
    const h = this._rowHeights[row] || DEFAULT_ROW_HEIGHT;
    return { x, y, w, h };
  }

  destroy() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
  }
}
