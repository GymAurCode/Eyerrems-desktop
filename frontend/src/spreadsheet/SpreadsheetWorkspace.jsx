import Spreadsheet from "./Spreadsheet";
import { useUIStore } from "../store/ui";
import "./styles/spreadsheet.css";

export default function SpreadsheetWorkspace() {
  const theme = useUIStore((s) => s.theme);

  return (
    <div
      data-theme={theme}
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Spreadsheet />
    </div>
  );
}
