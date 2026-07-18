import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Reminder } from "../../lib/remindersApi";

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
};

interface Props {
  reminders: Reminder[];
  onEdit: (reminder: Reminder) => void;
}

export default function ReminderCalendar({ reminders, onEdit }: Props) {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const remindersByDate = useMemo(() => {
    const map: Record<string, Reminder[]> = {};
    for (const r of reminders) {
      const d = new Date(r.remind_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [reminders]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const cells: { day: number; isToday: boolean; reminders: Reminder[] }[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: 0, isToday: false, reminders: [] });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${month}-${d}`;
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    cells.push({ day: d, isToday, reminders: remindersByDate[key] || [] });
  }

  return (
    <div className="rounded-xl border border-theme bg-surface p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 rounded text-muted hover:text-primary">
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <button onClick={goToday} className="text-[11px] px-2 py-1 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors">
            Today
          </button>
          <span className="text-sm font-semibold text-primary">{monthNames[month]} {year}</span>
        </div>
        <button onClick={nextMonth} className="p-1 rounded text-muted hover:text-primary">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dayNames.map((dn) => (
          <div key={dn} className="text-center text-[10px] text-muted font-medium py-1">{dn}</div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`min-h-[60px] rounded-lg p-1 text-center text-[11px] transition-colors
              ${cell.day === 0 ? "" : "hover:bg-white/5 cursor-pointer"}
              ${cell.isToday ? "ring-1 ring-blue-500" : ""}`}
            onClick={() => {
              if (cell.day && cell.reminders.length > 0) {
                onEdit(cell.reminders[0]);
              }
            }}
          >
            {cell.day > 0 && (
              <>
                <span className={`text-[11px] ${cell.isToday ? "font-bold text-blue-400" : "text-secondary"}`}>
                  {cell.day}
                </span>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  {cell.reminders.slice(0, 3).map((r) => (
                    <span
                      key={r.id}
                      className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[r.priority] ?? "bg-amber-500"}`}
                    />
                  ))}
                  {cell.reminders.length > 3 && (
                    <span className="text-[8px] text-muted">+{cell.reminders.length - 3}</span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
