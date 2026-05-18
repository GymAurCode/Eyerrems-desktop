import { useEffect, useState, FormEvent } from "react";
import { Plus, Users } from "lucide-react";
import Modal from "../../Modal";
import { propApi, Seller } from "../../../lib/propertyApi";
import { QuickRowActions, ActionsTh, ActionsCell, printRecord } from "../../actions";

type Props = { refresh: number; onRefresh: () => void };

export default function SellersTab({ refresh, onRefresh }: Props) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [open, setOpen]       = useState(false);
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [address, setAddr]    = useState("");
  const [notes, setNotes]     = useState("");

  const load = () => propApi.getSellers().then((res) => {
    const data = res && 'data' in res ? (res as any).data : res;
    setSellers(Array.isArray(data) ? data : []);
  });
  useEffect(() => { void load(); }, [refresh]);

  const reset = () => { setName(""); setEmail(""); setPhone(""); setAddr(""); setNotes(""); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await propApi.createSeller({ name, email: email || null, phone: phone || null, address: address || null, notes: notes || null });
    reset(); setOpen(false); onRefresh();
  };

  return (
    <>
      <div className="flex justify-end mb-1">
        <button type="button" onClick={() => { reset(); setOpen(true); }}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
          <Plus size={15} /> New Seller
        </button>
      </div>

      <div className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {sellers.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={32} className="text-muted mx-auto mb-3" />
            <p className="text-secondary text-sm">No sellers yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["TID","Name","Email","Phone","Address"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.id} className="transition-colors row-hover"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td className="px-4 py-3 font-mono text-xs text-blue-400">{s.tid}</td>
                  <td className="px-4 py-3 text-primary font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-secondary">{s.email || "—"}</td>
                  <td className="px-4 py-3 text-secondary">{s.phone || "—"}</td>
                  <td className="px-4 py-3 text-secondary">{s.address || "—"}</td>
                  <ActionsCell>
                    <QuickRowActions row={s} compact onPrint={(row) => printRecord(`Seller ${row.tid}`, [
                      { label: "Name", value: row.name },
                      { label: "Email", value: row.email || "—" },
                      { label: "Phone", value: row.phone || "—" },
                    ])} hiddenActions={["view", "edit", "delete"]} />
                  </ActionsCell>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Seller">
        <form onSubmit={submit} className="space-y-3">
          <input className="input-dark w-full px-4 py-2.5 text-sm" value={name}
            onChange={(e) => setName(e.target.value)} placeholder="Full name *" required />
          <input className="input-dark w-full px-4 py-2.5 text-sm" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className="input-dark w-full px-4 py-2.5 text-sm" value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          <input className="input-dark w-full px-4 py-2.5 text-sm" value={address}
            onChange={(e) => setAddr(e.target.value)} placeholder="Address" />
          <textarea className="input-dark w-full px-4 py-2.5 text-sm resize-none" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
          <button className="btn-primary w-full py-3 text-sm mt-1" type="submit">Save Seller</button>
        </form>
      </Modal>
    </>
  );
}
