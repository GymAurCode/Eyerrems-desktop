import { useState, useRef, useEffect, useCallback } from "react";
import { NUMBER_FORMATS } from "../core/NumberFormat";

const COLORS = [
  ["#000000","#434343","#666666","#999999","#b7b7b7","#cccccc","#d9d9d9","#efefef","#f3f3f3","#ffffff"],
  ["#980000","#ff0000","#ff9900","#ffff00","#00ff00","#00ffff","#4a86e8","#0000ff","#9900ff","#ff00ff"],
  ["#e6b8af","#f4cccc","#fce5cd","#fff2cc","#d9ead3","#d0e0e3","#c9daf8","#cfe2f3","#d9d2e9","#ead1dc"],
  ["#dd7e6b","#ea9999","#f9cb9c","#ffe599","#b6d7a8","#a2c4c9","#a4c2f4","#9fc5e8","#b4a7d6","#d5a6bd"],
  ["#cc4125","#e06666","#f6b26b","#ffd966","#93c47d","#76a5af","#6d9eeb","#6fa8dc","#8e7cc3","#c27ba0"],
  ["#a61c00","#cc0000","#e69138","#f1c232","#6aa84f","#45818e","#3c78d8","#3d85c6","#674ea7","#a64d79"],
  ["#85200c","#990000","#b45f06","#bf9000","#38761d","#134f5c","#1155cc","#0b5394","#351c75","#741b47"],
  ["#5b0f00","#660000","#783f04","#7f6000","#274e13","#0c343d","#1c4587","#073763","#20124d","#4c1130"],
];

const FONTS = ["Calibri", "Arial", "Times New Roman", "Courier New", "Verdana", "Georgia", "Tahoma", "Trebuchet MS"];
const FONT_SIZES = [8,9,10,11,12,14,16,18,20,22,24,28,36,48,72];

function Dropdown({ trigger, children, open, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      {trigger}
      {open && children}
    </div>
  );
}

function ColorGrid({ onSelect, onNoFill }) {
  return (
    <div className="ss-color-dropdown">
      {onNoFill && (
        <button
          className="ss-color-no-fill"
          onClick={onNoFill}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "4px 8px", fontSize: 11, cursor: "pointer", background: "none", border: "none", color: "var(--ss-text)" }}
        >
          No Fill
        </button>
      )}
      <div className="ss-color-grid">
        {COLORS.map((row, ri) =>
          row.map((c, ci) => (
            <button
              key={`${ri}-${ci}`}
              className="ss-color-swatch"
              style={{ background: c, border: c === "#ffffff" ? "1px solid #ccc" : "1px solid transparent" }}
              onClick={() => onSelect(c)}
              title={c}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Button({ active, onClick, title, children, disabled }) {
  return (
    <button
      className={`ss-tb-btn ${active ? "active" : ""}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="ss-tb-separator" />;
}

export default function Toolbar({
  canUndo, canRedo,
  onUndo, onRedo,
  onSave,
  onImport, onExport,
  onBold, onItalic, onUnderline, onStrikethrough,
  onFontFamily, onFontSize,
  onTextColor, onFillColor,
  onAlign,
  onNumberFormat,
  onInsertRow, onDeleteRow,
  onInsertCol, onDeleteCol,
  onSortAsc, onSortDesc,
  onFindReplace,
  styleState,
  onOpenFindReplace,
  onLoadTemplate,
  onReset,
  onRestore,
}) {
  const [showTextColor, setShowTextColor] = useState(false);
  const [showFillColor, setShowFillColor] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFont, setShowFont] = useState(false);
  const [showSize, setShowSize] = useState(false);
  const fileInputRef = useRef(null);

  const handleExport = (format) => {
    setShowExport(false);
    onExport(format);
  };

  return (
    <div className="ss-toolbar">
      <Button onClick={onSave} title="Save (Ctrl+S)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></Button>

      <Separator />

      <Button onClick={() => fileInputRef.current?.click()} title="Import"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></Button>
      <input ref={fileInputRef} type="file" accept=".xlsx,.csv" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) { onImport(e.target.files[0]); e.target.value = ""; } }} />

      <Separator />

      <Button onClick={onUndo} title="Undo (Ctrl+Z)" disabled={!canUndo}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></Button>
      <Button onClick={onRedo} title="Redo (Ctrl+Y)" disabled={!canRedo}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></Button>

      <Separator />

      <Dropdown
        open={showFont}
        onClose={() => setShowFont(false)}
        trigger={
          <select
            className="ss-font-selector"
            value={styleState?.fontFamily || "Calibri"}
            onChange={(e) => { onFontFamily(e.target.value); setShowFont(false); }}
            onFocus={() => setShowFont(true)}
            onBlur={() => setTimeout(() => setShowFont(false), 200)}
          >
            {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        }
      />

      <Dropdown
        open={showSize}
        onClose={() => setShowSize(false)}
        trigger={
          <select
            className="ss-size-selector"
            value={styleState?.fontSize || 11}
            onChange={(e) => { onFontSize(Number(e.target.value)); setShowSize(false); }}
            onFocus={() => setShowSize(true)}
            onBlur={() => setTimeout(() => setShowSize(false), 200)}
          >
            {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        }
      />

      <Separator />

      <Button active={styleState?.bold} onClick={onBold} title="Bold (Ctrl+B)"><b>B</b></Button>
      <Button active={styleState?.italic} onClick={onItalic} title="Italic (Ctrl+I)"><i>I</i></Button>
      <Button active={styleState?.underline} onClick={onUnderline} title="Underline (Ctrl+U)"><u>U</u></Button>
      <Button active={styleState?.strikethrough} onClick={onStrikethrough} title="Strikethrough"><span style={{ textDecoration: "line-through" }}>S</span></Button>

      <Separator />

      <Dropdown
        open={showTextColor}
        onClose={() => setShowTextColor(false)}
        trigger={
          <Button onClick={() => setShowTextColor(!showTextColor)} title="Text color">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={styleState?.color || "#000000"} stroke="currentColor" strokeWidth="2"><path d="M17 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M17 18H3"/></svg>
              <div style={{ width: 14, height: 2, background: styleState?.color || "#000000", borderRadius: 1 }} />
            </div>
          </Button>
        }
      >
        <ColorGrid onSelect={(c) => { if (onTextColor) onTextColor(c); setShowTextColor(false); }} />
      </Dropdown>

      <Dropdown
        open={showFillColor}
        onClose={() => setShowFillColor(false)}
        trigger={
          <Button onClick={() => setShowFillColor(!showFillColor)} title="Fill color">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={styleState?.bgColor || "transparent"} stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              <div style={{ width: 14, height: 2, background: styleState?.bgColor || "transparent", borderRadius: 1 }} />
            </div>
          </Button>
        }
      >
        <ColorGrid
          onSelect={(c) => { if (onFillColor) onFillColor(c); setShowFillColor(false); }}
          onNoFill={() => { if (onFillColor) onFillColor(""); setShowFillColor(false); }}
        />
      </Dropdown>

      <Separator />

      <Button active={styleState?.hAlign === "left"} onClick={() => onAlign("left")} title="Align left"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg></Button>
      <Button active={styleState?.hAlign === "center"} onClick={() => onAlign("center")} title="Align center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="18" y1="14" x2="6" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg></Button>
      <Button active={styleState?.hAlign === "right"} onClick={() => onAlign("right")} title="Align right"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="7" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg></Button>

      <Separator />

      <select
        className="ss-format-selector"
        value={styleState?.numberFormat || "general"}
        onChange={(e) => onNumberFormat(e.target.value)}
      >
        {NUMBER_FORMATS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <Separator />

      <Button onClick={onInsertRow} title="Insert Row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></Button>
      <Button onClick={onDeleteRow} title="Delete Row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/></svg></Button>
      <span className="ss-tb-label">Row</span>
      <Separator />
      <Button onClick={onInsertCol} title="Insert Column"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></Button>
      <Button onClick={onDeleteCol} title="Delete Column"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/></svg></Button>
      <span className="ss-tb-label">Col</span>

      <Separator />

      <Button onClick={onSortAsc} title="Sort A → Z"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="11" y2="6"/><line x1="4" y1="12" x2="11" y2="12"/><line x1="4" y1="18" x2="11" y2="18"/><polyline points="15 9 18 6 21 9"/><line x1="18" y1="6" x2="18" y2="18"/></svg></Button>
      <Button onClick={onSortDesc} title="Sort Z → A"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="11" y2="6"/><line x1="4" y1="12" x2="11" y2="12"/><line x1="4" y1="18" x2="11" y2="18"/><polyline points="15 9 18 6 21 9"/><line x1="18" y1="6" x2="18" y2="18"/></svg></Button>

      <Separator />

      <Button onClick={onOpenFindReplace} title="Find & Replace (Ctrl+F)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </Button>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2 }}>
        <Dropdown
          open={showExport}
          onClose={() => setShowExport(false)}
          trigger={
            <Button onClick={() => setShowExport(!showExport)} title="Export">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </Button>
          }
        >
          <div className="ss-dropdown" style={{ right: 0, left: "auto" }}>
            <button className="ss-dropdown-item" onClick={() => handleExport("xlsx")}>Export as .xlsx</button>
            <button className="ss-dropdown-item" onClick={() => handleExport("csv")}>Export as .csv</button>
          </div>
        </Dropdown>

        <Dropdown
          open={showTemplates}
          onClose={() => setShowTemplates(false)}
          trigger={
            <Button onClick={() => setShowTemplates(!showTemplates)} title="Templates">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
            </Button>
          }
        >
          <div className="ss-dropdown" style={{ right: 0, left: "auto" }}>
            {onLoadTemplate && <button className="ss-dropdown-item" onClick={() => { setShowTemplates(false); onLoadTemplate("lead"); }}>Lead Sheet Template</button>}
            <div className="ss-dropdown-separator" />
            {onReset && <button className="ss-dropdown-item" onClick={() => { setShowTemplates(false); onReset(); }}>Reset Sheet</button>}
            {onRestore && <button className="ss-dropdown-item" onClick={() => { setShowTemplates(false); onRestore(); }}>Restore Backup</button>}
          </div>
        </Dropdown>
      </div>
    </div>
  );
}
