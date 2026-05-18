/**
 * LedgersPage — legacy route wrapper; /ledger redirects to Finance → Ledger tab.
 */
import UnifiedLedgersTab from "../../components/finance/UnifiedLedgersTab";

export default function LedgersPage() {
  return (
    <div className="p-6">
      <UnifiedLedgersTab />
    </div>
  );
}
