import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { propApi, Amenity } from "../../lib/propertyApi";

type Props = {
  selected: number[];
  onChange: (ids: number[]) => void;
};

export default function AmenityPicker({ selected, onChange }: Props) {
  const [all, setAll]       = useState<Amenity[]>([]);
  const [newName, setNewName] = useState("");

  const load = () => propApi.getAmenities().then((res) => {
    const data = res && 'data' in res ? (res as any).data : res;
    setAll(Array.isArray(data) ? data : []);
  });
  useEffect(() => { void load(); }, []);

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const add = async () => {
    if (!newName.trim()) return;
    const res = await propApi.createAmenity(newName.trim());
    const data = res && 'data' in res ? (res as any).data : res;
    setNewName("");
    await load();
    if (data?.id) {
      onChange([...selected, data.id]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {all.map((a) => {
          const active = selected.includes(a.id);
          return (
            <button key={a.id} type="button" onClick={() => toggle(a.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150"
              style={{
                background: active ? "rgba(59,130,246,0.2)" : "var(--border)",
                color: active ? "#3b82f6" : "var(--text-secondary)",
                border: `1px solid ${active ? "rgba(59,130,246,0.4)" : "transparent"}`,
              }}>
              {a.name}
              {active && <X size={10} />}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input className="input-dark flex-1 px-3 py-2 text-xs" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="Add new amenity…" />
        <button type="button" onClick={() => void add()}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-500/10 border border-blue-500/20 transition-colors shrink-0">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
