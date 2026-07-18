export class Clipboard {
  constructor() {
    this._data = null;
    this._isCut = false;
  }

  copy(cells) {
    if (!cells || cells.length === 0) return;
    const rows = {};
    let minRow = Infinity,
      minCol = Infinity,
      maxRow = -Infinity,
      maxCol = -Infinity;
    for (const c of cells) {
      if (!rows[c.row]) rows[c.row] = {};
      rows[c.row][c.col] = c;
      if (c.row < minRow) minRow = c.row;
      if (c.col < minCol) minCol = c.col;
      if (c.row > maxRow) maxRow = c.row;
      if (c.col > maxCol) maxCol = c.col;
    }
    this._data = { cells, startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol };
    this._isCut = false;

    try {
      const tsvLines = [];
      for (let r = minRow; r <= maxRow; r++) {
        const line = [];
        for (let c = minCol; c <= maxCol; c++) {
          const cell = rows[r] && rows[r][c];
          line.push(cell ? String(cell.rawValue) : "");
        }
        tsvLines.push(line.join("\t"));
      }
      navigator.clipboard.writeText(tsvLines.join("\n")).catch(() => {});
    } catch {
    }
  }

  cut(cells) {
    this.copy(cells);
    this._isCut = true;
  }

  paste(targetRow, targetCol) {
    if (!this._data) return [];
    const dr = targetRow - this._data.startRow;
    const dc = targetCol - this._data.startCol;
    return this._data.cells.map((c) => ({
      row: c.row + dr,
      col: c.col + dc,
      rawValue: c.rawValue,
      style: c.style ? { ...c.style } : null,
    }));
  }

  async readFromSystemClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return [];
      const lines = text.split("\n");
      const cells = [];
      for (let r = 0; r < lines.length; r++) {
        const cols = lines[r].split("\t");
        for (let c = 0; c < cols.length; c++) {
          if (cols[c]) {
            cells.push({ row: r, col: c, rawValue: cols[c] });
          }
        }
      }
      return cells;
    } catch {
      return [];
    }
  }

  clear() {
    this._data = null;
    this._isCut = false;
  }

  get isCut() {
    return this._isCut;
  }

  hasData() {
    return this._data !== null;
  }

  getData() {
    return this._data;
  }
}
