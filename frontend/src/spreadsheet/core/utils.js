export function colIndexToLetter(idx) {
  let letter = "";
  let i = idx;
  while (i >= 0) {
    letter = String.fromCharCode((i % 26) + 65) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
}

export function colLetterToIndex(letter) {
  let idx = 0;
  for (let i = 0; i < letter.length; i++) {
    idx = idx * 26 + letter.charCodeAt(i) - 64;
  }
  return idx - 1;
}

export function cellId(row, col) {
  return colIndexToLetter(col) + (row + 1);
}

export function parseCellRef(ref) {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return { row: parseInt(match[2], 10) - 1, col: colLetterToIndex(match[1].toUpperCase()) };
}

export function parseRange(range) {
  const parts = range.split(":");
  if (parts.length !== 2) return null;
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return null;
  return { start, end };
}

export const DEFAULT_COL_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 24;
export const HEADER_HEIGHT = 24;
export const HEADER_WIDTH = 50;
export const ROW_HEADER_WIDTH = 50;
export const MIN_COL_WIDTH = 30;
export const MIN_ROW_HEIGHT = 16;
export const MAX_COL_WIDTH = 500;
export const MAX_ROW_HEIGHT = 200;
export const FREEZE_BORDER_SIZE = 4;

export function cellKey(row, col) {
  return `${row}:${col}`;
}
