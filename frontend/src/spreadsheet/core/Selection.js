export function createSelection() {
  return {
    active: { row: 0, col: 0 },
    ranges: [{ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }],
    isSelecting: false,
    anchor: null,
  };
}

export function getSelectionBounds(sel) {
  if (!sel || !sel.ranges || sel.ranges.length === 0) return null;
  const r = sel.ranges[0];
  return {
    startRow: Math.min(r.startRow, r.endRow),
    startCol: Math.min(r.startCol, r.endCol),
    endRow: Math.max(r.startRow, r.endRow),
    endCol: Math.max(r.startCol, r.endCol),
  };
}

export function setSelection(sel, row, col, extend) {
  sel.active = { row, col };
  if (extend && sel.anchor) {
    sel.ranges = [
      {
        startRow: sel.anchor.row,
        startCol: sel.anchor.col,
        endRow: row,
        endCol: col,
      },
    ];
  } else {
    sel.anchor = { row, col };
    sel.ranges = [{ startRow: row, startCol: col, endRow: row, endCol: col }];
  }
}

export function selectAll(sel, maxRow, maxCol) {
  sel.active = { row: 0, col: 0 };
  sel.ranges = [{ startRow: 0, startCol: 0, endRow: maxRow, endCol: maxCol }];
  sel.anchor = { row: 0, col: 0 };
}

export function isCellInSelection(sel, row, col) {
  if (!sel || !sel.ranges) return false;
  for (const range of sel.ranges) {
    const minR = Math.min(range.startRow, range.endRow);
    const maxR = Math.max(range.startRow, range.endRow);
    const minC = Math.min(range.startCol, range.endCol);
    const maxC = Math.max(range.startCol, range.endCol);
    if (row >= minR && row <= maxR && col >= minC && col <= maxC) return true;
  }
  return false;
}

export function moveSelection(sel, dRow, dCol, maxRow, maxCol, extend) {
  let newRow = sel.active.row + dRow;
  let newCol = sel.active.col + dCol;
  newRow = Math.max(0, Math.min(maxRow, newRow));
  newCol = Math.max(0, Math.min(maxCol, newCol));

  if (extend && sel.anchor) {
    sel.active = { row: newRow, col: newCol };
    sel.ranges = [
      {
        startRow: sel.anchor.row,
        startCol: sel.anchor.col,
        endRow: newRow,
        endCol: newCol,
      },
    ];
  } else {
    sel.anchor = { row: newRow, col: newCol };
    sel.active = { row: newRow, col: newCol };
    sel.ranges = [{ startRow: newRow, startCol: newCol, endRow: newRow, endCol: newCol }];
  }
}

export function normalizeRange(range) {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    startCol: Math.min(range.startCol, range.endCol),
    endRow: Math.max(range.startRow, range.endRow),
    endCol: Math.max(range.startCol, range.endCol),
  };
}

export function getSelectedCells(sel) {
  const cells = [];
  if (!sel || !sel.ranges) return cells;
  for (const range of sel.ranges) {
    const { startRow, startCol, endRow, endCol } = normalizeRange(range);
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        cells.push({ row: r, col: c });
      }
    }
  }
  return cells;
}
