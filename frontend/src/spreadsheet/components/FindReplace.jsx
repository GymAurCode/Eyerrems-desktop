import { useState, useRef, useEffect, useCallback } from "react";
import { cellKey } from "../core/utils";

export default function FindReplace({ open, onClose, engine, sheetId, sheets, activeSheetId, onReplace }) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [results, setResults] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const findRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => findRef.current?.focus(), 100);
      setFindText("");
      setReplaceText("");
      setResults([]);
      setCurrentIndex(-1);
    }
  }, [open]);

  const doFind = useCallback(() => {
    if (!findText || !engine) return;
    const sheet = sheets.find((s) => s.id === activeSheetId);
    if (!sheet) return;

    const found = [];
    for (let r = 0; r < sheet.rowCount; r++) {
      for (let c = 0; c < sheet.columnCount; c++) {
        const display = engine.getCellDisplayValue(activeSheetId, r, c);
        const compare = matchCase ? display : display.toLowerCase();
        const search = matchCase ? findText : findText.toLowerCase();
        if (compare.includes(search)) {
          found.push({ row: r, col: c });
        }
      }
    }
    setResults(found);
    setCurrentIndex(found.length > 0 ? 0 : -1);
  }, [findText, matchCase, engine, activeSheetId, sheets]);

  const goTo = (idx) => {
    if (idx < 0 || idx >= results.length) return;
    setCurrentIndex(idx);
    if (onReplace && typeof onReplace === "function") {
      onReplace("goto", results[idx].row, results[idx].col);
    }
  };

  const handleReplace = () => {
    if (currentIndex < 0 || currentIndex >= results.length) return;
    const cell = results[currentIndex];
    const oldVal = engine.getCellRawValue(activeSheetId, cell.row, cell.col);
    const newVal = matchCase
      ? oldVal.replace(findText, replaceText)
      : oldVal.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), replaceText);
    if (onReplace) onReplace("replace", cell.row, cell.col, newVal);
    doFind();
  };

  const handleReplaceAll = () => {
    if (!findText || !engine) return;
    for (const cell of results) {
      const oldVal = engine.getCellRawValue(activeSheetId, cell.row, cell.col);
      const newVal = matchCase
        ? oldVal.split(findText).join(replaceText)
        : oldVal.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replaceText);
      if (onReplace) onReplace("replace", cell.row, cell.col, newVal);
    }
    doFind();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="ss-find-replace-overlay"
      onKeyDown={handleKeyDown}
    >
      <div className="ss-find-replace-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ss-find-replace-header">
          <h3>Find & Replace</h3>
          <button className="ss-fr-close" onClick={onClose} type="button">&times;</button>
        </div>
        <div className="ss-find-replace-body">
          <div className="ss-fr-row">
            <input
              ref={findRef}
              className="ss-fr-input"
              placeholder="Find..."
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doFind(); }}
            />
          </div>
          <div className="ss-fr-row">
            <input
              className="ss-fr-input"
              placeholder="Replace with..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleReplace(); }}
            />
          </div>
          <div className="ss-fr-row">
            <label className="ss-fr-checkbox">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
              />
              Match case
            </label>
          </div>
          <div className="ss-fr-results">
            {results.length > 0
              ? `${currentIndex + 1} of ${results.length} found`
              : findText
              ? "No results"
              : ""}
          </div>
          <div className="ss-fr-actions">
            <button className="ss-fr-btn" onClick={doFind}>Find</button>
            <button
              className="ss-fr-btn"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex <= 0}
            >
              Previous
            </button>
            <button
              className="ss-fr-btn"
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex < 0 || currentIndex >= results.length - 1}
            >
              Next
            </button>
            <button
              className="ss-fr-btn"
              onClick={handleReplace}
              disabled={currentIndex < 0}
            >
              Replace
            </button>
            <button
              className="ss-fr-btn"
              onClick={handleReplaceAll}
              disabled={results.length === 0}
            >
              Replace All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
