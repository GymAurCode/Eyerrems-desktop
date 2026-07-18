import { useRef, useEffect } from "react";

export default function SheetTabs({ sheets, activeSheetId, onSwitch, onAdd, onRename, onDelete }) {
  const tabsRef = useRef(null);

  const handleContextMenu = (e, sheetId) => {
    e.preventDefault();
    const action = window.confirm
      ? window.confirm("Rename sheet? Click OK to rename, Cancel to delete.")
      : null;
    if (action) {
      const newName = prompt("Enter new sheet name:");
      if (newName && newName.trim()) onRename(sheetId, newName.trim());
    } else {
      onDelete(sheetId);
    }
  };

  const handleDoubleClick = (e, sheetId, currentName) => {
    e.stopPropagation();
    const target = e.currentTarget;
    const input = document.createElement("input");
    input.value = currentName;
    input.className = "ss-sheet-rename-input";
    input.style.cssText = "position:absolute;inset:0;z-index:5;background:var(--ss-bg);color:var(--ss-text);border:1px solid var(--ss-accent);padding:0 8px;font-size:12px;outline:none;";
    target.style.position = "relative";
    target.appendChild(input);
    input.focus();
    input.select();

    const finish = () => {
      const newName = input.value.trim();
      if (newName && newName !== currentName) onRename(sheetId, newName);
      input.remove();
    };

    input.addEventListener("blur", finish);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); input.blur(); }
      if (ev.key === "Escape") { ev.preventDefault(); input.value = currentName; input.blur(); }
    });
  };

  return (
    <div className="ss-sheet-tabs" ref={tabsRef}>
      {sheets.map((sheet) => (
        <div
          key={sheet.id}
          className={`ss-sheet-tab ${sheet.id === activeSheetId ? "active" : ""}`}
          onClick={() => onSwitch(sheet.id)}
          onDoubleClick={(e) => handleDoubleClick(e, sheet.id, sheet.name)}
          onContextMenu={(e) => handleContextMenu(e, sheet.id)}
        >
          {sheet.name}
          <span className="ss-sheet-delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(sheet.id); }} title="Delete sheet">&times;</span>
        </div>
      ))}
      <button className="ss-sheet-add-btn" onClick={onAdd} title="Add sheet" type="button">+</button>
    </div>
  );
}
