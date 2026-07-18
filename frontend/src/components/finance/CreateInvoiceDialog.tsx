import { useState, useEffect } from "react";
import {
  Plus, Trash2, X, Check, Loader2, DollarSign, Building2, FileText,
  Hash, User, Phone, Mail, MapPin, CreditCard, Calendar, AlertCircle,
  BookOpen
} from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import {
  invoicesApi, type Account, type InvoiceCreate, type InvoiceLineItem
} from "../../lib/financeApi";
import AppDialog from "../ui/AppDialog";
import AttachmentPanel from "../attachments/AttachmentPanel";
import { MODULE_COLORS } from "../../config/moduleColors";
import AsyncCombobox from "../ui/AsyncCombobox";
import { useNotifStore } from "../../store/notifications";

const ACCENT = MODULE_COLORS.finance.primary;

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label} {required && <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Input(props: any) {
  return <input className="dialog-input w-full text-xs" {...props} />;
}

function Select({ children, ...props }: any) {
  return <select className="dialog-select w-full text-xs" {...props}>{children}</select>;
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} style={{ color: ACCENT }} />
        <span className="text-xs font-semibold text-primary">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function CreateInvoiceDialog({
  isOpen, onClose, onSuccess, accounts,
}: {
  isOpen: boolean; onClose: () => void; onSuccess: () => void; accounts: Account[];
}) {
  const [section, setSection] = useState("info");
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pushToast = useNotifStore((s) => s.pushToast);

  const [form, setForm] = useState<InvoiceCreate>({
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    invoice_type: "manual",
    currency: "PKR",
    line_items: [{ description: "", quantity: 1, unit: "lump", unit_price: 0, discount_pct: 0, tax_pct: 0, amount: 0 }],
    payment_terms: "due_immediately",
    auto_generated: false,
  });

  const reset = () => {
    setForm({
      due_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      invoice_type: "manual",
      currency: "PKR",
      line_items: [{ description: "", quantity: 1, unit: "lump", unit_price: 0, discount_pct: 0, tax_pct: 0, amount: 0 }],
      payment_terms: "due_immediately",
      auto_generated: false,
    });
    setSection("info");
    setError("");
    setCreatedId(null);
  };

  const updateLineItem = (i: number, field: keyof InvoiceLineItem, value: any) => {
    const items = [...form.line_items];
    items[i] = { ...items[i], [field]: value };
    if (field === "quantity" || field === "unit_price" || field === "discount_pct" || field === "tax_pct") {
      const q = Number(items[i].quantity);
      const up = Number(items[i].unit_price);
      const dp = Number(items[i].discount_pct);
      const tp = Number(items[i].tax_pct);
      const base = q * up;
      const afterDiscount = base - (base * dp / 100);
      items[i].amount = afterDiscount + (afterDiscount * tp / 100);
    }
    setForm(f => ({ ...f, line_items: items }));
  };

  const addLineItem = () => {
    setForm(f => ({
      ...f,
      line_items: [...f.line_items, { description: "", quantity: 1, unit: "lump", unit_price: 0, discount_pct: 0, tax_pct: 0, amount: 0 }]
    }));
  };

  const removeLineItem = (i: number) => {
    if (form.line_items.length <= 1) return;
    setForm(f => ({ ...f, line_items: f.line_items.filter((_, idx) => idx !== i) }));
  };

  const getTotals = () => {
    const subtotal = form.line_items.reduce((s, li) => s + Number(li.quantity) * Number(li.unit_price), 0);
    const discount = form.line_items.reduce((s, li) => {
      const base = Number(li.quantity) * Number(li.unit_price);
      return s + (base * Number(li.discount_pct) / 100);
    }, 0);
    const tax = form.line_items.reduce((s, li) => s + Number(li.amount) - (Number(li.quantity) * Number(li.unit_price) * (1 - Number(li.discount_pct) / 100)), 0);
    const total = form.line_items.reduce((s, li) => s + Number(li.amount), 0);
    return { subtotal, discount_amount: discount, tax_amount: tax, total };
  };

  const handleSubmit = async () => {
    if (form.line_items.length === 0) { setError("At least one line item is required"); return; }
    if (!form.due_date) { setError("Due date is required"); return; }
    setError(""); setSubmitting(true);
    try {
      const payload: InvoiceCreate = {
        ...form,
        invoice_date: form.invoice_date || new Date().toISOString().slice(0, 10),
        due_date: form.due_date,
      };
      const result = await invoicesApi.create(payload);
      pushToast({ title: "Invoice Created", message: `Invoice #${result.id} created successfully`, type: "success" });
      setCreatedId(result.id);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const sections = [
    { id: "info", label: "Invoice Info", icon: FileText },
    { id: "party", label: "Bill To", icon: User },
    { id: "reference", label: "Reference", icon: BookOpen },
    { id: "items", label: "Line Items", icon: Hash },
    { id: "totals", label: "Totals", icon: DollarSign },
    { id: "terms", label: "Payment Terms", icon: CreditCard },
    { id: "notes", label: "Notes", icon: FileText },
  ];

  const { subtotal, discount_amount, tax_amount, total } = getTotals();

  if (createdId) {
    return (
      <AppDialog isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Create Invoice" subtitle="Invoice created successfully" size="lg">
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Check size={16} className="text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">Invoice #{createdId} created successfully</p>
          </div>
          <AttachmentPanel module="finance" recordId={createdId} />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { reset(); }} className="btn-ghost px-4 py-2 text-xs">Add Another</button>
            <button onClick={() => { reset(); onClose(); onSuccess(); }} className="btn-primary px-4 py-2 text-xs">Done</button>
          </div>
        </div>
      </AppDialog>
    );
  }

  return (
    <AppDialog isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Create Invoice" subtitle="New ERP invoice" size="2xl">
      <div className="flex gap-4 h-[70vh]">
        <div className="w-48 shrink-0 space-y-1">
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all text-left ${
                section === s.id ? "text-white" : "text-muted hover:text-primary"
              }`}
              style={{ background: section === s.id ? ACCENT : "transparent" }}>
              <s.icon size={13} /> {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {error && (
            <div className="flex items-center gap-2 p-2 rounded-lg text-[10px]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}

          {section === "info" && (
            <SectionCard title="Invoice Information" icon={FileText}>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Invoice Type" required>
                  <Select value={form.invoice_type} onChange={(e: any) => setForm(f => ({ ...f, invoice_type: e.target.value }))}>
                    <option value="manual">Manual</option>
                    <option value="sale">Sale</option>
                    <option value="rent">Rent</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="construction">Construction</option>
                    <option value="utility">Utility</option>
                    <option value="security_deposit">Security Deposit</option>
                    <option value="other">Other</option>
                  </Select>
                </FormField>
                <FormField label="Invoice Date">
                  <Input type="date" value={form.invoice_date?.slice(0, 10) || ""} onChange={(e: any) => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
                </FormField>
                <FormField label="Due Date" required>
                  <Input type="date" value={form.due_date?.slice(0, 10)} onChange={(e: any) => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </FormField>
                <FormField label="Currency">
                  <Select value={form.currency} onChange={(e: any) => setForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="SAR">SAR</option>
                    <option value="AED">AED</option>
                  </Select>
                </FormField>
              </div>
            </SectionCard>
          )}

          {section === "party" && (
            <SectionCard title="Bill To / Party Information" icon={User}>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Party Type">
                  <Select value={form.party_type || ""} onChange={(e: any) => setForm(f => ({ ...f, party_type: e.target.value || undefined }))}>
                    <option value="">Select type</option>
                    <option value="client">Client</option>
                    <option value="tenant">Tenant</option>
                    <option value="vendor">Vendor</option>
                    <option value="dealer">Dealer</option>
                    <option value="owner">Owner</option>
                  </Select>
                </FormField>
                <FormField label="Client Name">
                  <Input value={form.client_name || ""} onChange={(e: any) => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Full name" />
                </FormField>
                <FormField label="Phone">
                  <Input value={form.client_phone || ""} onChange={(e: any) => setForm(f => ({ ...f, client_phone: e.target.value }))} placeholder="03XX-XXXXXXX" />
                </FormField>
                <FormField label="Email">
                  <Input type="email" value={form.client_email || ""} onChange={(e: any) => setForm(f => ({ ...f, client_email: e.target.value }))} placeholder="email@example.com" />
                </FormField>
                <FormField label="CNIC">
                  <Input value={form.client_cnic || ""} onChange={(e: any) => setForm(f => ({ ...f, client_cnic: e.target.value }))} placeholder="XXXXX-XXXXXXX-X" />
                </FormField>
                <FormField label="NTN">
                  <Input value={form.client_ntn || ""} onChange={(e: any) => setForm(f => ({ ...f, client_ntn: e.target.value }))} placeholder="NTN number" />
                </FormField>
                <div className="col-span-2">
                  <FormField label="Address">
                    <Input value={form.client_address || ""} onChange={(e: any) => setForm(f => ({ ...f, client_address: e.target.value }))} placeholder="Full address" />
                  </FormField>
                </div>
              </div>
            </SectionCard>
          )}

          {section === "reference" && (
            <SectionCard title="Reference & Links" icon={BookOpen}>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Reference">
                  <Input value={form.reference || ""} onChange={(e: any) => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Invoice reference" />
                </FormField>
                <FormField label="Reference Type">
                  <Select value={form.reference_type || ""} onChange={(e: any) => setForm(f => ({ ...f, reference_type: e.target.value || undefined }))}>
                    <option value="">None</option>
                    <option value="deal">Deal</option>
                    <option value="lease">Lease</option>
                    <option value="booking">Booking</option>
                    <option value="purchase_order">Purchase Order</option>
                    <option value="contract">Contract</option>
                  </Select>
                </FormField>
                <FormField label="Auto-Generated">
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={form.auto_generated || false}
                      onChange={(e: any) => setForm(f => ({ ...f, auto_generated: e.target.checked }))}
                      className="rounded border-gray-600" />
                    This is an auto-generated invoice
                  </label>
                </FormField>
                {form.auto_generated && (
                  <>
                    <FormField label="Source Module">
                      <Select value={form.source_module || ""} onChange={(e: any) => setForm(f => ({ ...f, source_module: e.target.value || undefined }))}>
                        <option value="">Select module</option>
                        <option value="sale">Sale</option>
                        <option value="rental">Rental</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="construction">Construction</option>
                        <option value="utility">Utility</option>
                        <option value="security_deposit">Security Deposit</option>
                      </Select>
                    </FormField>
                    <FormField label="Source Record ID">
                      <Input type="number" value={form.source_record_id || ""} onChange={(e: any) => setForm(f => ({ ...f, source_record_id: Number(e.target.value) || undefined }))} />
                    </FormField>
                  </>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <FormField label="Property">
                  <AsyncCombobox
                    endpoint="/async-select/properties"
                    value={form.property_id}
                    onChange={(v) => setForm(f => ({ ...f, property_id: v ? Number(v) : undefined }))}
                    placeholder="Search or type property ID..."
                  />
                </FormField>
                <FormField label="Unit">
                  <AsyncCombobox
                    endpoint="/async-select/units"
                    value={form.unit_id}
                    onChange={(v) => setForm(f => ({ ...f, unit_id: v ? Number(v) : undefined }))}
                    placeholder="Search or type unit ID..."
                  />
                </FormField>
                <FormField label="Tenant">
                  <AsyncCombobox
                    endpoint="/async-select/tenants"
                    value={form.tenant_id}
                    onChange={(v) => setForm(f => ({ ...f, tenant_id: v ? Number(v) : undefined }))}
                    placeholder="Search or type tenant ID..."
                  />
                </FormField>
              </div>
            </SectionCard>
          )}

          {section === "items" && (
            <SectionCard title="Line Items" icon={Hash}>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[9px] font-medium text-muted px-1">
                  <div className="col-span-3">Description</div>
                  <div className="col-span-1 text-right">Qty</div>
                  <div className="col-span-1">Unit</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-1 text-right">Disc%</div>
                  <div className="col-span-1 text-right">Tax%</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-1" />
                </div>
                {form.line_items.map((li, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <input className="dialog-input w-full text-[10px]" value={li.description}
                        onChange={(e: any) => updateLineItem(i, "description", e.target.value)} placeholder="Item description" />
                    </div>
                    <div className="col-span-1">
                      <input type="number" className="dialog-input w-full text-[10px] text-right" value={li.quantity}
                        min={0} step={1} onChange={(e: any) => updateLineItem(i, "quantity", Number(e.target.value))} />
                    </div>
                    <div className="col-span-1">
                      <select className="dialog-select w-full text-[10px]" value={li.unit}
                        onChange={(e: any) => updateLineItem(i, "unit", e.target.value)}>
                        <option value="lump">lump</option>
                        <option value="pcs">pcs</option>
                        <option value="sqft">sqft</option>
                        <option value="month">month</option>
                        <option value="hour">hour</option>
                        <option value="day">day</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" className="dialog-input w-full text-[10px] text-right" value={li.unit_price}
                        min={0} step={0.01} onChange={(e: any) => updateLineItem(i, "unit_price", Number(e.target.value))} />
                    </div>
                    <div className="col-span-1">
                      <input type="number" className="dialog-input w-full text-[10px] text-right" value={li.discount_pct}
                        min={0} max={100} step={0.1} onChange={(e: any) => updateLineItem(i, "discount_pct", Number(e.target.value))} />
                    </div>
                    <div className="col-span-1">
                      <input type="number" className="dialog-input w-full text-[10px] text-right" value={li.tax_pct}
                        min={0} max={100} step={0.1} onChange={(e: any) => updateLineItem(i, "tax_pct", Number(e.target.value))} />
                    </div>
                    <div className="col-span-2 text-right text-[10px] font-semibold text-primary">
                      {formatCurrency(Number(li.amount))}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => removeLineItem(i)} className="p-1 rounded hover:bg-red-500/10"
                        style={{ color: form.line_items.length <= 1 ? "var(--text-muted)" : "#ef4444" }} disabled={form.line_items.length <= 1}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={addLineItem} className="flex items-center gap-1 text-[10px] mt-2 px-2 py-1 rounded"
                  style={{ color: ACCENT, background: ACCENT + "11" }}>
                  <Plus size={12} /> Add Line Item
                </button>
              </div>
            </SectionCard>
          )}

          {section === "totals" && (
            <SectionCard title="Invoice Totals" icon={DollarSign}>
              <div className="space-y-2 max-w-sm">
                <div className="flex justify-between text-xs py-1">
                  <span className="text-muted">Subtotal</span>
                  <span className="font-medium text-primary">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-muted">Discount</span>
                  <span className="font-medium text-red-400">-{formatCurrency(discount_amount)}</span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-muted">Tax</span>
                  <span className="font-medium text-blue-400">{formatCurrency(tax_amount)}</span>
                </div>
                <FormField label="Adjustment">
                  <Input type="number" value={0} disabled className="text-xs" />
                </FormField>
                <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-primary">Total</span>
                  <span style={{ color: ACCENT }}>{formatCurrency(total)}</span>
                </div>
              </div>
            </SectionCard>
          )}

          {section === "terms" && (
            <SectionCard title="Payment Terms" icon={CreditCard}>
              <FormField label="Payment Terms">
                <Select value={form.payment_terms || "due_immediately"}
                  onChange={(e: any) => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                  <option value="due_immediately">Due Immediately</option>
                  <option value="net_15">Net 15</option>
                  <option value="net_30">Net 30</option>
                  <option value="net_45">Net 45</option>
                  <option value="net_60">Net 60</option>
                  <option value="custom">Custom</option>
                </Select>
              </FormField>
            </SectionCard>
          )}

          {section === "notes" && (
            <SectionCard title="Notes & Terms" icon={FileText}>
              <div className="space-y-3">
                <FormField label="Internal Notes">
                  <textarea className="dialog-input w-full text-xs min-h-[80px]" value={form.internal_notes || ""}
                    onChange={(e: any) => setForm(f => ({ ...f, internal_notes: e.target.value }))}
                    placeholder="Internal notes (not visible to customer)" />
                </FormField>
                <FormField label="Customer Notes">
                  <textarea className="dialog-input w-full text-xs min-h-[80px]" value={form.customer_notes || ""}
                    onChange={(e: any) => setForm(f => ({ ...f, customer_notes: e.target.value }))}
                    placeholder="Notes visible on invoice" />
                </FormField>
                <FormField label="Terms & Conditions">
                  <textarea className="dialog-input w-full text-xs min-h-[80px]" value={form.terms_conditions || ""}
                    onChange={(e: any) => setForm(f => ({ ...f, terms_conditions: e.target.value }))}
                    placeholder="Terms and conditions" />
                </FormField>
                <FormField label="Late Payment Policy">
                  <textarea className="dialog-input w-full text-xs min-h-[60px]" value={form.late_payment_policy || ""}
                    onChange={(e: any) => setForm(f => ({ ...f, late_payment_policy: e.target.value }))}
                    placeholder="Late payment penalties" />
                </FormField>
                <FormField label="Footer Message">
                  <input className="dialog-input w-full text-xs" value={form.footer_message || ""}
                    onChange={(e: any) => setForm(f => ({ ...f, footer_message: e.target.value }))}
                    placeholder="Thank you for your business" />
                </FormField>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 mt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="text-sm font-bold" style={{ color: ACCENT }}>
          Total: {formatCurrency(total)}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { reset(); onClose(); }} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Create Invoice
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
