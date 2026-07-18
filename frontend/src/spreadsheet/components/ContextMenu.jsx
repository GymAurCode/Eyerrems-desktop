import { useEffect, useRef } from "react";

function MenuItem({ onClick, label, shortcut, danger }) {
  return (
    <button
      className={`ss-context-item ${danger ? "danger" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      {shortcut && <span className="ss-context-shortcut">{shortcut}</span>}
    </button>
  );
}

function MenuSeparator() {
  return <div className="ss-context-separator" />;
}

export default function ContextMenu({
  x, y, type, cell,
  onClose,
  onCut, onCopy, onPaste,
  onInsertRowAbove, onInsertRowBelow,
  onInsertColLeft, onInsertColRight,
  onDeleteRow, onDeleteCol,
  onClearContents, onClearFormatting, onClearAll,
  onSortAsc, onSortDesc,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const escHandler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [onClose]);

  const style = {
    position: "fixed",
    left: x,
    top: y,
    zIndex: 1000,
  };

  if (type === "column") {
    return (
      <div ref={ref} className="ss-context-menu" style={style}>
        <MenuItem label="Insert Column Left" onClick={onInsertColLeft} />
        <MenuItem label="Insert Column Right" onClick={onInsertColRight} />
        <MenuSeparator />
        <MenuItem label="Delete Column" onClick={onDeleteCol} danger />
        <MenuSeparator />
        <MenuItem label="Sort A → Z" onClick={() => onSortAsc(true)} />
        <MenuItem label="Sort Z → A" onClick={() => onSortDesc(true)} />
      </div>
    );
  }

  if (type === "row") {
    return (
      <div ref={ref} className="ss-context-menu" style={style}>
        <MenuItem label="Insert Row Above" onClick={onInsertRowAbove} />
        <MenuItem label="Insert Row Below" onClick={onInsertRowBelow} />
        <MenuSeparator />
        <MenuItem label="Delete Row" onClick={onDeleteRow} danger />
        <MenuSeparator />
        <MenuItem label="Sort A → Z" onClick={() => onSortAsc(true)} />
        <MenuItem label="Sort Z → A" onClick={() => onSortDesc(true)} />
      </div>
    );
  }

  return (
    <div ref={ref} className="ss-context-menu" style={style}>
      <MenuItem label="Cut" shortcut="Ctrl+X" onClick={onCut} />
      <MenuItem label="Copy" shortcut="Ctrl+C" onClick={onCopy} />
      <MenuItem label="Paste" shortcut="Ctrl+V" onClick={onPaste} />
      <MenuSeparator />
      <MenuItem label="Insert Row Above" onClick={onInsertRowAbove} />
      <MenuItem label="Insert Row Below" onClick={onInsertRowBelow} />
      <MenuItem label="Insert Column Left" onClick={onInsertColLeft} />
      <MenuItem label="Insert Column Right" onClick={onInsertColRight} />
      <MenuSeparator />
      <MenuItem label="Delete Row" onClick={onDeleteRow} danger />
      <MenuItem label="Delete Column" onClick={onDeleteCol} danger />
      <MenuSeparator />
      <MenuItem label="Clear Contents (Del)" onClick={onClearContents} />
      <MenuItem label="Clear Formatting" onClick={onClearFormatting} />
      <MenuItem label="Clear All" onClick={onClearAll} />
      <MenuSeparator />
      <MenuItem label="Sort A → Z" onClick={() => onSortAsc(false)} />
      <MenuItem label="Sort Z → A" onClick={() => onSortDesc(false)} />
    </div>
  );
}
