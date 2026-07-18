import { useState, useEffect } from "react";
import { Printer, X, Loader2 } from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import { paymentsApi, type Payment } from "../../lib/financeApi";
import AppDialog from "../ui/AppDialog";
import { MODULE_COLORS } from "../../config/moduleColors";

const ACCENT = MODULE_COLORS.finance.primary;

function ReceiptContent({ payment }: { payment: Payment }) {
  const methodFields = payment.method_fields || {};
  return (
    <div id="receipt-content" className="bg-white text-gray-900 p-8 max-w-[500px] mx-auto font-sans">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-900 pb-4 mb-6">
        <h1 className="text-xl font-bold tracking-tight">PAYMENT RECEIPT</h1>
        <p className="text-[10px] text-gray-500 mt-1">Official Payment Voucher</p>
      </div>

      {/* Receipt Number */}
      <div className="flex justify-between items-center mb-6 bg-gray-50 p-3 rounded">
        <div>
          <p className="text-[9px] text-gray-500 uppercase tracking-wider">Receipt #</p>
          <p className="text-sm font-bold font-mono">{payment.receipt_number || payment.payment_number || `#${payment.id}`}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-gray-500 uppercase tracking-wider">Date</p>
          <p className="text-xs font-semibold">{new Date(payment.date).toLocaleDateString("en-GB")}</p>
        </div>
      </div>

      {/* Received From */}
      <div className="mb-6">
        <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Received From</p>
        <p className="text-sm font-semibold">{payment.party_name || "—"}</p>
        {payment.party_phone && <p className="text-[11px] text-gray-600">{payment.party_phone}</p>}
        {payment.party_email && <p className="text-[11px] text-gray-600">{payment.party_email}</p>}
      </div>

      {/* Amount */}
      <div className="mb-6">
        <div className="flex justify-between items-center py-3 border-t border-b border-gray-300">
          <span className="text-sm font-semibold">Amount Received</span>
          <span className="text-xl font-bold" style={{ color: ACCENT }}>{formatCurrency(payment.amount)}</span>
        </div>
      </div>

      {/* Details */}
      <table className="w-full text-xs mb-6">
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="py-2 text-gray-500">Payment Method</td>
            <td className="py-2 text-right font-medium capitalize">{payment.method?.replace(/_/g, " ")}</td>
          </tr>
          {payment.reference_number && (
            <tr className="border-b border-gray-200">
              <td className="py-2 text-gray-500">Reference</td>
              <td className="py-2 text-right font-mono">{payment.reference_number}</td>
            </tr>
          )}
          {payment.external_transaction_id && (
            <tr className="border-b border-gray-200">
              <td className="py-2 text-gray-500">Transaction ID</td>
              <td className="py-2 text-right font-mono">{payment.external_transaction_id}</td>
            </tr>
          )}
          {methodFields.bank_name && (
            <tr className="border-b border-gray-200">
              <td className="py-2 text-gray-500">Bank</td>
              <td className="py-2 text-right">{methodFields.bank_name}</td>
            </tr>
          )}
          {methodFields.cheque_number && (
            <tr className="border-b border-gray-200">
              <td className="py-2 text-gray-500">Cheque #</td>
              <td className="py-2 text-right font-mono">{methodFields.cheque_number}</td>
            </tr>
          )}
          {payment.allocations && payment.allocations.length > 0 && (
            <tr className="border-b border-gray-200">
              <td className="py-2 text-gray-500">Invoices</td>
              <td className="py-2 text-right font-mono">{payment.allocations.map(a => a.invoice_number ? a.invoice_number : `#${a.invoice_id}`).join(", ")}</td>
            </tr>
          )}
          <tr className="border-b border-gray-200">
            <td className="py-2 text-gray-500">Status</td>
            <td className="py-2 text-right font-medium capitalize">{payment.status}</td>
          </tr>
        </tbody>
      </table>

      {payment.internal_notes && (
        <div className="mb-6 p-3 bg-gray-50 rounded text-xs text-gray-600 italic">
          {payment.internal_notes}
        </div>
      )}

      {/* Received By */}
      <div className="flex justify-between text-xs pt-4 border-t border-gray-300">
        <div>
          <p className="text-gray-500">Received By</p>
          <p className="font-semibold mt-0.5">{payment.received_by || "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500">Payment #</p>
          <p className="font-mono mt-0.5">{payment.payment_number || `PAY-${String(payment.id).padStart(6, "0")}`}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-8 pt-4 border-t border-gray-200">
        <p className="text-[9px] text-gray-400">This is a computer-generated receipt</p>
      </div>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  paymentId: number;
}

export default function ReceiptView({ isOpen, onClose, paymentId }: Props) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !paymentId) return;
    setLoading(true);
    paymentsApi.get(paymentId)
      .then(setPayment)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, paymentId]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (!printWindow) return;
    const content = document.getElementById("receipt-content");
    if (!content) return;
    printWindow.document.write(`
      <html>
        <head><title>Receipt - ${payment?.receipt_number || paymentId}</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 20px; color: #111; }
          @media print { body { padding: 0; } }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 8px 4px; }
        </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <AppDialog isOpen={isOpen} onClose={onClose}
      title="Payment Receipt"
      subtitle={payment?.receipt_number || `#${paymentId}`}
      size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin" style={{ color: ACCENT }} />
        </div>
      ) : payment ? (
        <div className="space-y-4">
          <ReceiptContent payment={payment} />
          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg"
              style={{ background: ACCENT, color: "#fff" }}>
              <Printer size={12} /> Print Receipt
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-12 text-muted">
          <X size={24} className="mb-2 opacity-50" />
          <p className="text-sm">Payment not found</p>
        </div>
      )}
    </AppDialog>
  );
}
