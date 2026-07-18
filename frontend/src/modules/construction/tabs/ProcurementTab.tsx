import { useEffect, useState } from "react";
import {
  ShoppingCart, Plus, FileText, Truck, CheckCircle, XCircle,
  Send, Download, Search, Edit3, Trash2, Users,
} from "lucide-react";
import {
  constructionApi, PurchaseRequest, PurchaseOrder, Vendor,
  GoodsReceiptNote,
} from "../../../lib/constructionApi";
import { formatCurrency } from "../../../lib/currency";
import DataTable from "../../../components/data-table/DataTable";
import type { TableColumn } from "../../../components/data-table/types";
import { useNotifStore } from "../../../store/notifications";

const STATUS_COLOR: Record<string, string> = {
  draft: "#94a3b8", submitted: "#6366f1", approved: "#10b981",
  rejected: "#ef4444", ordered: "#3b82f6", sent: "#6366f1",
  confirmed: "#10b981", delivered: "#22c55e", cancelled: "#ef4444",
  partially_received: "#f59e0b", received: "#22c55e",
};

function Badge({ label }: { label: string }) {
  const c = STATUS_COLOR[label] ?? "#94a3b8";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${c}20`, color: c }}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold text-primary">{title}</p>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function ProcurementTab({ projectId }: { projectId: number }) {
  const [activeTab, setActiveTab] = useState<"requests" | "orders" | "receipts" | "vendors">("requests");
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceiptNote[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: "", contact_person: "", phone: "", email: "", address: "" });
  const [prForm, setPrForm] = useState({ title: "", description: "", items: [{ name: "", quantity: "1", unit: "", estimated_cost: "" }] });
  const [poForm, setPoForm] = useState({ title: "", vendor_id: 0, vendor_name: "", order_date: "", delivery_date: "", items: [{ name: "", quantity: "1", unit: "", unit_price: "" }] });
  const [grnForm, setGrnForm] = useState({ po_id: 0, received_date: "", vendor_name: "", notes: "", items: [{ name: "", quantity: "1", unit: "" }] });
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const pushToast = useNotifStore((s) => s.pushToast);

  const load = async () => {
    setLoading(true);
    try {
      const [r, o, g, v] = await Promise.all([
        constructionApi.listPurchaseRequests(projectId),
        constructionApi.listPurchaseOrders(projectId),
        constructionApi.listGoodsReceipts(projectId),
        constructionApi.listVendors(),
      ]);
      setRequests(r);
      setOrders(o);
      setReceipts(g);
      setVendors(v);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleSavePR = async () => {
    if (!prForm.title) return;
    setSaving(true);
    try {
      await constructionApi.createPurchaseRequest({
        project_id: projectId,
        title: prForm.title,
        description: prForm.description,
        items: prForm.items.filter(i => i.name).map(i => ({
          name: i.name, quantity: Number(i.quantity),
          unit: i.unit, estimated_cost: i.estimated_cost ? Number(i.estimated_cost) : null,
        })),
      });
      pushToast({ title: "Purchase request created", message: `PR "${prForm.title}" has been created.`, type: "success" });
      setShowForm(false);
      setPrForm({ title: "", description: "", items: [{ name: "", quantity: "1", unit: "", estimated_cost: "" }] });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed"); }
    finally { setSaving(false); }
  };

  const handleSavePO = async () => {
    if (!poForm.title) return;
    setSaving(true);
    try {
      await constructionApi.createPurchaseOrder({
        project_id: projectId,
        title: poForm.title,
        vendor_id: poForm.vendor_id || undefined,
        vendor_name: poForm.vendor_name || undefined,
        order_date: poForm.order_date || undefined,
        delivery_date: poForm.delivery_date || undefined,
        items: poForm.items.filter(i => i.name).map(i => ({
          name: i.name, quantity: Number(i.quantity),
          unit: i.unit, unit_price: i.unit_price ? Number(i.unit_price) : null,
        })),
      });
      pushToast({ title: "Purchase order created", message: `PO "${poForm.title}" has been created.`, type: "success" });
      setShowForm(false);
      setPoForm({ title: "", vendor_id: 0, vendor_name: "", order_date: "", delivery_date: "", items: [{ name: "", quantity: "1", unit: "", unit_price: "" }] });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed"); }
    finally { setSaving(false); }
  };

  const handleSaveGRN = async () => {
    if (!grnForm.received_date) return;
    setSaving(true);
    try {
      await constructionApi.createGoodsReceipt({
        project_id: projectId,
        po_id: grnForm.po_id || undefined,
        received_date: grnForm.received_date,
        vendor_name: grnForm.vendor_name || undefined,
        notes: grnForm.notes,
        items: grnForm.items.filter(i => i.name).map(i => ({
          name: i.name, quantity: Number(i.quantity), unit: i.unit,
        })),
      });
      pushToast({ title: "Goods receipt created", message: "The goods receipt has been recorded.", type: "success" });
      setShowForm(false);
      setGrnForm({ po_id: 0, received_date: "", vendor_name: "", notes: "", items: [{ name: "", quantity: "1", unit: "" }] });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed"); }
    finally { setSaving(false); }
  };

  const handleSaveVendor = async () => {
    if (!vendorForm.name) return;
    setSaving(true);
    try {
      await constructionApi.createVendor(vendorForm);
      pushToast({ title: "Vendor created", message: `Vendor "${vendorForm.name}" has been added.`, type: "success" });
      setShowVendorForm(false);
      setVendorForm({ name: "", contact_person: "", phone: "", email: "", address: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed"); }
    finally { setSaving(false); }
  };

  const requestColumns: TableColumn<PurchaseRequest>[] = [
    { key: 'pr_number', label: 'PR #', render: (v) => <span className="text-xs font-mono text-muted">{v ?? "—"}</span> },
    { key: 'title', label: 'Title', render: (v) => <span className="text-xs font-medium text-primary">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <Badge label={v} /> },
    { key: 'total_amount', label: 'Amount', render: (v) => <span className="text-xs font-mono text-primary">{v ? formatCurrency(Number(v)) : "—"}</span> },
    { key: 'actions', label: '', render: (_, r) => (
      <div className="flex items-center gap-1">
        {r.status === "draft" && (
          <button onClick={() => constructionApi.updatePurchaseRequestStatus(r.id, "submitted").then(load)}
            className="p-1 text-muted hover:text-indigo-400" title="Submit"><Send size={11} /></button>
        )}
        {r.status === "submitted" && (
          <>
            <button onClick={() => constructionApi.updatePurchaseRequestStatus(r.id, "approved").then(load)}
              className="p-1 text-muted hover:text-emerald-400" title="Approve"><CheckCircle size={11} /></button>
            <button onClick={() => constructionApi.updatePurchaseRequestStatus(r.id, "rejected").then(load)}
              className="p-1 text-muted hover:text-red-400" title="Reject"><XCircle size={11} /></button>
          </>
        )}
      </div>
    )},
  ];

  const orderColumns: TableColumn<PurchaseOrder>[] = [
    { key: 'po_number', label: 'PO #', render: (v) => <span className="text-xs font-mono text-muted">{v ?? "—"}</span> },
    { key: 'title', label: 'Title', render: (v) => <span className="text-xs font-medium text-primary">{v}</span> },
    { key: 'vendor_name', label: 'Vendor', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'status', label: 'Status', render: (v) => <Badge label={v} /> },
    { key: 'total_amount', label: 'Amount', render: (v) => <span className="text-xs font-mono text-primary">{v ? formatCurrency(Number(v)) : "—"}</span> },
    { key: 'actions', label: '', render: (_, r) => (
      <div className="flex items-center gap-1">
        {r.status === "draft" && (
          <button onClick={() => constructionApi.updatePurchaseOrderStatus(r.id, "sent").then(load)}
            className="p-1 text-muted hover:text-indigo-400" title="Send"><Send size={11} /></button>
        )}
        {r.status === "sent" && (
          <button onClick={() => constructionApi.updatePurchaseOrderStatus(r.id, "confirmed").then(load)}
            className="p-1 text-muted hover:text-emerald-400" title="Confirm"><CheckCircle size={11} /></button>
        )}
        {r.status === "confirmed" && (
          <button onClick={() => constructionApi.updatePurchaseOrderStatus(r.id, "delivered").then(load)}
            className="p-1 text-muted hover:text-blue-400" title="Delivered"><Truck size={11} /></button>
        )}
      </div>
    )},
  ];

  const receiptColumns: TableColumn<GoodsReceiptNote>[] = [
    { key: 'grn_number', label: 'GRN #', render: (v) => <span className="text-xs font-mono text-muted">{v ?? "—"}</span> },
    { key: 'received_date', label: 'Date', render: (v) => <span className="text-xs text-muted">{v}</span> },
    { key: 'vendor_name', label: 'Vendor', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'status', label: 'Status', render: (v) => <Badge label={v} /> },
    { key: 'notes', label: 'Notes', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
  ];

  const vendorColumns: TableColumn<Vendor>[] = [
    { key: 'name', label: 'Name', render: (v) => <span className="text-xs font-medium text-primary">{v}</span> },
    { key: 'contact_person', label: 'Contact', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'phone', label: 'Phone', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'email', label: 'Email', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'performance_rating', label: 'Rating', render: (v) => (
      <span className="text-xs">{v ? "⭐".repeat(Math.min(5, Number(v))) : "—"}</span>
    )},
  ];

  const renderItemForm = (items: any[], setItems: (items: any[]) => void) => (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1 items-center">
          <input value={item.name} onChange={e => {
            const newItems = [...items];
            newItems[i] = { ...newItems[i], name: e.target.value };
            setItems(newItems);
          }} className="dialog-input flex-1 text-[10px] py-1" placeholder="Item name" />
          <input type="number" value={item.quantity} onChange={e => {
            const newItems = [...items];
            newItems[i] = { ...newItems[i], quantity: e.target.value };
            setItems(newItems);
          }} className="dialog-input text-[10px] py-1 w-16" placeholder="Qty" />
          <input value={item.unit} onChange={e => {
            const newItems = [...items];
            newItems[i] = { ...newItems[i], unit: e.target.value };
            setItems(newItems);
          }} className="dialog-input text-[10px] py-1 w-16" placeholder="Unit" />
          {i === items.length - 1 ? (
            <button onClick={() => setItems([...items, { name: "", quantity: "1", unit: "", estimated_cost: "", unit_price: "" }])}
              className="p-1 text-muted hover:text-emerald-400"><Plus size={11} /></button>
          ) : (
            <button onClick={() => setItems(items.filter((_, idx) => idx !== i))}
              className="p-1 text-muted hover:text-red-400"><Trash2 size={11} /></button>
          )}
        </div>
      ))}
    </div>
  );

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2">
        {(["requests","orders","receipts","vendors"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize ${
              activeTab === tab ? "text-white bg-blue-600" : "text-muted hover:text-primary bg-white/5 hover:bg-white/10"
            }`}>
            {tab === "requests" && <FileText size={12} />}
            {tab === "orders" && <ShoppingCart size={12} />}
            {tab === "receipts" && <Truck size={12} />}
            {tab === "vendors" && <Users size={12} />}
            {tab.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "requests" && (
        <SectionCard title="Purchase Requests"
          action={
            <button onClick={() => { setShowForm(true); setPoForm({ title: "", vendor_id: 0, vendor_name: "", order_date: "", delivery_date: "", items: [{ name: "", quantity: "1", unit: "", unit_price: "" }] }); }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              <Plus size={10} /> New Request
            </button>
          }>
          <DataTable data={requests} columns={requestColumns} searchable
            emptyTitle="No purchase requests" emptyDescription="Create a purchase request to start procurement." />
        </SectionCard>
      )}

      {activeTab === "orders" && (
        <SectionCard title="Purchase Orders"
          action={
            <button onClick={() => { setShowForm(true); setPrForm({ title: "", description: "", items: [{ name: "", quantity: "1", unit: "", estimated_cost: "" }] }); }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              <Plus size={10} /> New Order
            </button>
          }>
          <DataTable data={orders} columns={orderColumns} searchable
            emptyTitle="No purchase orders" emptyDescription="Create a purchase order from an approved request." />
        </SectionCard>
      )}

      {activeTab === "receipts" && (
        <SectionCard title="Goods Receipt Notes"
          action={
            <button onClick={() => { setShowForm(true); setGrnForm({ po_id: 0, received_date: "", vendor_name: "", notes: "", items: [{ name: "", quantity: "1", unit: "" }] }); }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white bg-emerald-600 hover:bg-emerald-500">
              <Plus size={10} /> New GRN
            </button>
          }>
          <DataTable data={receipts} columns={receiptColumns} searchable
            emptyTitle="No goods received yet" />
        </SectionCard>
      )}

      {activeTab === "vendors" && (
        <SectionCard title="Vendors"
          action={
            <button onClick={() => setShowVendorForm(true)}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              <Plus size={10} /> New Vendor
            </button>
          }>
          <DataTable data={vendors} columns={vendorColumns} searchable
            emptyTitle="No vendors" emptyDescription="Add vendors to manage procurement." />
        </SectionCard>
      )}

      {/* Form Dialogs */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
            style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">
              {activeTab === "requests" ? "New Purchase Request" : activeTab === "orders" ? "New Purchase Order" : "New Goods Receipt"}
            </h3>
            <div className="space-y-3">
              {activeTab === "requests" && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted uppercase tracking-wider">Title *</label>
                    <input value={prForm.title} onChange={e => setPrForm(p => ({ ...p, title: e.target.value }))} className="dialog-input" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted uppercase tracking-wider">Description</label>
                    <textarea value={prForm.description} onChange={e => setPrForm(p => ({ ...p, description: e.target.value }))} rows={2} className="dialog-textarea" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Items</label>
                    {renderItemForm(prForm.items, (items) => setPrForm(p => ({ ...p, items })))}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                    <button onClick={handleSavePR} disabled={saving || !prForm.title}
                      className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                      {saving ? "Saving…" : "Create"}
                    </button>
                  </div>
                </>
              )}
              {activeTab === "orders" && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted uppercase tracking-wider">Title *</label>
                    <input value={poForm.title} onChange={e => setPoForm(p => ({ ...p, title: e.target.value }))} className="dialog-input" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted uppercase tracking-wider">Vendor</label>
                      <select value={poForm.vendor_id} onChange={e => setPoForm(p => ({ ...p, vendor_id: Number(e.target.value), vendor_name: e.target.options[e.target.selectedIndex]?.text || "" }))} className="dialog-select">
                        <option value={0}>Select vendor</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted uppercase tracking-wider">Vendor Name (manual)</label>
                      <input value={poForm.vendor_name} onChange={e => setPoForm(p => ({ ...p, vendor_name: e.target.value }))} className="dialog-input" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted uppercase tracking-wider">Order Date</label>
                      <input type="date" value={poForm.order_date} onChange={e => setPoForm(p => ({ ...p, order_date: e.target.value }))} className="dialog-input" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted uppercase tracking-wider">Delivery Date</label>
                      <input type="date" value={poForm.delivery_date} onChange={e => setPoForm(p => ({ ...p, delivery_date: e.target.value }))} className="dialog-input" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Items</label>
                    {renderItemForm(poForm.items, (items) => setPoForm(p => ({ ...p, items })))}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                    <button onClick={handleSavePO} disabled={saving || !poForm.title}
                      className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                      {saving ? "Saving…" : "Create"}
                    </button>
                  </div>
                </>
              )}
              {activeTab === "receipts" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted uppercase tracking-wider">PO (optional)</label>
                      <select value={grnForm.po_id} onChange={e => setGrnForm(p => ({ ...p, po_id: Number(e.target.value) }))} className="dialog-select">
                        <option value={0}>None</option>
                        {orders.map(o => <option key={o.id} value={o.id}>{o.po_number ?? o.title}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted uppercase tracking-wider">Received Date *</label>
                      <input type="date" value={grnForm.received_date} onChange={e => setGrnForm(p => ({ ...p, received_date: e.target.value }))} className="dialog-input" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted uppercase tracking-wider">Vendor</label>
                      <input value={grnForm.vendor_name} onChange={e => setGrnForm(p => ({ ...p, vendor_name: e.target.value }))} className="dialog-input" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted uppercase tracking-wider">Notes</label>
                    <textarea value={grnForm.notes} onChange={e => setGrnForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="dialog-textarea" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Items</label>
                    {renderItemForm(grnForm.items, (items) => setGrnForm(p => ({ ...p, items })))}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                    <button onClick={handleSaveGRN} disabled={saving || !grnForm.received_date}
                      className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                      {saving ? "Saving…" : "Create"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vendor Form Dialog */}
      {showVendorForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowVendorForm(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-md" style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">New Vendor</h3>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Name *</label>
                <input value={vendorForm.name} onChange={e => setVendorForm(p => ({ ...p, name: e.target.value }))} className="dialog-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {["contact_person","phone","email","address"].map(key => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted uppercase tracking-wider">{key.replace(/_/g, " ")}</label>
                    <input value={(vendorForm as any)[key]} onChange={e => setVendorForm(p => ({ ...p, [key]: e.target.value }))} className="dialog-input" />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowVendorForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleSaveVendor} disabled={saving || !vendorForm.name}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                  {saving ? "Saving…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
