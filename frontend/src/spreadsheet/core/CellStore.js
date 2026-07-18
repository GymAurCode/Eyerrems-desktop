export const DEFAULT_STYLE = {
  fontFamily: "Calibri",
  fontSize: 11,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  color: "#000000",
  bgColor: "",
  hAlign: "left",
  vAlign: "bottom",
  wrap: false,
  merge: null,
  numberFormat: "general",
  borderTop: null,
  borderRight: null,
  borderBottom: null,
  borderLeft: null,
  borderColor: "#000000",
};

export function createCell(rawValue) {
  const type =
    rawValue === "" || rawValue === null || rawValue === undefined
      ? "empty"
      : typeof rawValue === "string" && rawValue.startsWith("=")
      ? "formula"
      : "string";
  return {
    rawValue: rawValue ?? "",
    value: rawValue ?? "",
    type,
    style: { ...DEFAULT_STYLE },
  };
}

export function createFormulaCell(formula) {
  return {
    rawValue: formula,
    value: formula,
    type: "formula",
    style: { ...DEFAULT_STYLE },
  };
}

export function cloneCell(cell) {
  if (!cell) return null;
  return {
    rawValue: cell.rawValue,
    value: cell.value,
    type: cell.type,
    style: cloneStyle(cell.style),
  };
}

export function cloneStyle(style) {
  if (!style) return { ...DEFAULT_STYLE };
  return { ...style };
}

export function serializeCells(cells) {
  const result = {};
  for (const [key, cell] of Object.entries(cells)) {
    result[key] = {
      rawValue: cell.rawValue,
      style: cell.style,
    };
  }
  return result;
}

export function deserializeCells(data) {
  const cells = {};
  if (!data) return cells;
  for (const [key, item] of Object.entries(data)) {
    const rawValue = item.rawValue ?? "";
    const style = item.style ? { ...DEFAULT_STYLE, ...item.style } : { ...DEFAULT_STYLE };
    const type =
      rawValue === "" || rawValue === null || rawValue === undefined
        ? "empty"
        : typeof rawValue === "string" && rawValue.startsWith("=")
        ? "formula"
        : "string";
    cells[key] = { rawValue, value: rawValue, type, style };
  }
  return cells;
}
