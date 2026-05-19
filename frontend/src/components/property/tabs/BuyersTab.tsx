import { useEffect, useState, FormEvent, useRef } from "react";
import { Plus, Printer } from "lucide-react";
import Modal from "../../Modal";
import { propApi, Buyer } from "../../../lib/propertyApi";
import { printRecord } from "../../actions";
import { SmartTable } from "../../data-table";
import { api } from "../../../lib/api";

type Props = { refresh: number; onRefresh: () => void };

export default function BuyersTab({ refresh, onRefresh }: Props) {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [open, setOpen]     = useState(false);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const paramsRef = useRef<any>(null);

  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [phone, setPhone]   = useState("");
  const [address, setAddr]  = useState("");
  const [notes, setNotes]   = useState("");

  const fetchBuyers = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const res = await api.get<Buyer[]>("/properties/buyers/all", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          filter: params.dateFilter || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
        }
      });
      const data = res.data;
      setBuyers(Array.isArray(data) ? data : []);
      const totalCount = Number(res.headers["x-total-count"] || res.headers["X-Total-Count"] || (Array.isArray(data) ? data.length : 0));
      setTotal(totalCount);
    } catch (err) {
      console.error(err);
      setBuyers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const refreshTable = () => {
    if (paramsRef.current) {
      fetchBuyers(paramsRef.current);
    }
  };

  useEffect(() => {
    refreshTable();
  }, [refresh]);

  const reset = () => { setName(""); setEmail(""); setPhone(""); setAddr(""); setNotes(""); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await propApi.createBuyer({ name, email: email || null, phone: phone || null, address: address || null, notes: notes || null });
    reset(); setOpen(false); onRefresh();
  };

  const columns = [
    {
      key: "tid",
      label: "TID",
      className: "font-mono text-xs text-blue-400"
    },
    {
      key: "name",
      label: "Name",
      className: "text-primary font-medium"
    },
    {
      key: "email",
      label: "Email",
      render: (val: any) => val || "—",
      className: "text-secondary"
    },
    {
      key: "phone",
      label: "Phone",
      render: (val: any) => val || "—",
      className: "text-secondary"
    },
    {
      key: "address",
      label: "Address",
      render: (val: any) => val || "—",
      className: "text-secondary"
    }
  ];

  const rowActions = [
    {
      key: "print",
      label: "Print",
      icon: Printer,
      onClick: (row: Buyer) => printRecord(`Buyer ${row.tid}`, [
        { label: "Name", value: row.name },
        { label: "Email", value: row.email || "—" },
        { label: "Phone", value: row.phone || "—" },
        { label: "Address", value: row.address || "—" },
      ])
    }
  ];

  return (
    <>
      <SmartTable
        storageKey="rems_buyers"
        data={buyers}
        columns={columns}
        rowActions={rowActions}
        loading={loading}
        total={total}
        onParamsChange={fetchBuyers}
        showDateFilter={true}
        toolbarActions={
          <button type="button" onClick={() => { reset(); setOpen(true); }}
            className="btn-primary flex items-center gap-2 px-3 py-2 text-xs">
            <Plus size={13} /> New Buyer
          </button>
        }
      />

      <Modal open={open} onClose={() => setOpen(false)} title="New Buyer">
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
          <button className="btn-primary w-full py-3 text-sm mt-1" type="submit">Save Buyer</button>
        </form>
      </Modal>
    </>
  );
}
