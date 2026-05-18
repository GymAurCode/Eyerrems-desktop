/**
 * Consistent Actions column header and cell for data tables.
 */
import type { ReactNode } from "react";

const thClass =
  "text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap";
const tdClass = "px-4 py-3 text-right whitespace-nowrap align-middle";

export function ActionsTh({ className = "" }: { className?: string }) {
  return (
    <th className={`${thClass} ${className}`} style={{ width: "1%" }}>
      Actions
    </th>
  );
}

export function ActionsCell({
  children,
  className = "",
  onClickStop = true,
}: {
  children: ReactNode;
  className?: string;
  /** Stop row-click propagation when the cell is clicked (default true). */
  onClickStop?: boolean;
}) {
  return (
    <td
      className={`${tdClass} ${className}`}
      onClick={onClickStop ? (e) => e.stopPropagation() : undefined}
    >
      <div className="inline-flex items-center justify-end min-w-[7rem]">
        {children}
      </div>
    </td>
  );
}
