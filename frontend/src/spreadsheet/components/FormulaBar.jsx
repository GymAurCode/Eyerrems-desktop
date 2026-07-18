import { useState, useRef, useEffect, useCallback } from "react";
import { cellId, parseCellRef } from "../core/utils";

const FUNCTIONS = [
  "SUM","AVERAGE","COUNT","COUNTA","COUNTIF","COUNTIFS","IF","IFERROR",
  "VLOOKUP","HLOOKUP","INDEX","MATCH","SUMIF","SUMIFS","CONCAT","CONCATENATE",
  "TEXT","ROUND","TODAY","NOW","MIN","MAX","ABS","AND","OR","NOT",
  "LEN","LEFT","RIGHT","MID","FIND","SEARCH","REPLACE","UPPER","LOWER","TRIM",
  "CLEAN","VALUE","INT","MOD","POWER","SQRT","PI","CEILING","FLOOR","ROUNDUP","ROUNDDOWN",
  "NPV","IRR","PMT","FV","PV","RATE","NPER","ISNUMBER","ISTEXT","ISEMPTY","ISBLANK",
  "ISERROR","TRUE","FALSE","NA","DATE","YEAR","MONTH","DAY","HOUR","MINUTE","SECOND",
  "WEEKDAY","WEEKNUM","EOMONTH","EDATE","DATEDIF",
];

export default function FormulaBar({ activeCell, rawValue, onCellRefChange, onValueChange, engine, sheetId }) {
  const [inputValue, setInputValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const inputRef = useRef(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!focused) {
      setInputValue(rawValue || "");
    }
  }, [rawValue, focused]);

  const getSuggestions = useCallback((val) => {
    if (!val || !val.startsWith("=")) {
      setSuggestions([]);
      return;
    }
    const lastToken = val.split(/[\s(,]/).pop() || "";
    if (!lastToken) { setSuggestions([]); return; }
    const upper = lastToken.toUpperCase();
    const matches = FUNCTIONS.filter((f) => f.startsWith(upper) || f.includes(upper));
    setSuggestions(matches.slice(0, 10));
    setSelectedSuggestion(-1);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    getSuggestions(val);
  };

  const handleKeyDown = (e) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestion((p) => Math.min(p + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestion((p) => Math.max(p - 1, 0));
        return;
      }
      if (e.key === "Enter" && selectedSuggestion >= 0) {
        e.preventDefault();
        insertSuggestion(suggestions[selectedSuggestion]);
        return;
      }
      if (e.key === "Escape") {
        setSuggestions([]);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commitValue();
    }
    if (e.key === "Escape") {
      setInputValue(rawValue || "");
      inputRef.current?.blur();
    }
  };

  const insertSuggestion = (fn) => {
    const val = inputValue;
    const lastTokenIdx = val.search(/[\s(,][^)\s(,]*$/);
    let prefix = "";
    if (lastTokenIdx >= 0) {
      prefix = val.substring(0, lastTokenIdx + 1);
    }
    const newVal = prefix + fn + "(";
    setInputValue(newVal);
    setSuggestions([]);
  };

  const commitValue = () => {
    if (onValueChange) onValueChange(inputValue);
    inputRef.current?.blur();
  };

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const ref = nameRef.current?.value;
      if (ref && onCellRefChange) {
        const parsed = parseCellRef(ref.toUpperCase());
        if (parsed) onCellRefChange(parsed.row, parsed.col);
      }
    }
  };

  const cellAddr = activeCell ? cellId(activeCell.row, activeCell.col) : "";

  return (
    <div className="ss-formula-bar">
      <input
        ref={nameRef}
        className="ss-name-box"
        value={cellAddr}
        onKeyDown={handleNameKeyDown}
        readOnly
        placeholder="Name"
      />
      <div className="ss-formula-sep" />
      <div className="ss-fx-icon">
        <span style={{ fontStyle: "italic", fontWeight: "bold", fontSize: 13 }}>fx</span>
      </div>
      <div className="ss-formula-input-wrapper">
        <input
          ref={inputRef}
          className="ss-formula-input"
          value={focused ? inputValue : (rawValue || "")}
          onChange={handleInputChange}
          onFocus={() => {
            setFocused(true);
            setInputValue(rawValue || "");
          }}
          onBlur={() => {
            setFocused(false);
            setSuggestions([]);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Enter value or formula"
        />
        {suggestions.length > 0 && (
          <div className="ss-autocomplete">
            {suggestions.map((fn, i) => (
              <div
                key={fn}
                className={`ss-autocomplete-item ${i === selectedSuggestion ? "selected" : ""}`}
                onMouseDown={() => insertSuggestion(fn)}
              >
                {fn}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
