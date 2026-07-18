function getCSSVar(name, fallback) {
  try {
    const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return val || fallback;
  } catch {
    return fallback;
  }
}

export const gridThemes = {
  dark: {
    cellBackground: "#122828",
    gridLineColor: "rgba(0,128,128,0.28)",
    textColor: "#d0f0f0",
    headerBackground: "#163030",
    headerBorder: "rgba(0,128,128,0.28)",
    headerText: "#70a8a8",
    selectionFill: "rgba(0,128,128,0.2)",
    selectionBorder: "#008080",
    activeCellBorder: "#009a9a",
    headerSelectedFill: "rgba(0,128,128,0.25)",
    headerSelectedText: "#009a9a",
    cornerFill: "#163030",
  },
  light: {
    cellBackground: "#ffffff",
    gridLineColor: "#c0d8d8",
    textColor: "#002a2a",
    headerBackground: "#e8f0f0",
    headerBorder: "#c0d8d8",
    headerText: "#5a8080",
    selectionFill: "rgba(0,128,128,0.1)",
    selectionBorder: "#008080",
    activeCellBorder: "#006666",
    headerSelectedFill: "rgba(0,128,128,0.12)",
    headerSelectedText: "#006666",
    cornerFill: "#e8f0f0",
  },
};

export function getGridTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  const baseTheme = isDark ? gridThemes.dark : gridThemes.light;

  return {
    cellBackground: getCSSVar("--bg-card", baseTheme.cellBackground),
    gridLineColor: getCSSVar("--border-color", baseTheme.gridLineColor),
    textColor: getCSSVar("--text-primary", baseTheme.textColor),
    headerBackground: getCSSVar("--bg-elevated", baseTheme.headerBackground),
    headerBorder: getCSSVar("--border-color", baseTheme.headerBorder),
    headerText: getCSSVar("--text-secondary", baseTheme.headerText),
    selectionFill: baseTheme.selectionFill,
    selectionBorder: getCSSVar("--accent", baseTheme.selectionBorder),
    activeCellBorder: baseTheme.activeCellBorder,
    headerSelectedFill: baseTheme.headerSelectedFill,
    headerSelectedText: baseTheme.headerSelectedText,
    cornerFill: baseTheme.cornerFill,
  };
}
