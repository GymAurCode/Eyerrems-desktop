import { useState } from "react";
import PropertiesTab from "../components/property/tabs/PropertiesTab";
import UnitsTab from "../components/property/tabs/UnitsTab";
import LeaseTab from "../components/property/tabs/LeaseTab";
import SalesTab from "../components/property/tabs/SalesTab";
import BuyersTab from "../components/property/tabs/BuyersTab";
import SellersTab from "../components/property/tabs/SellersTab";

const TABS = [
  { key: "properties", label: "Properties" },
  { key: "units",      label: "Units" },
  { key: "lease",      label: "Lease" },
  { key: "sales",      label: "Sales" },
  { key: "buyers",     label: "Buyers" },
  { key: "sellers",    label: "Sellers" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function PropertyPage() {
  const [tab, setTab]       = useState<TabKey>("properties");
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh((n) => n + 1);

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold text-primary">Property Module</h1>
        <p className="text-xs text-muted mt-0.5">Manage properties, units, leases, and sales</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              tab === key ? "text-white" : "text-secondary hover:text-primary"
            }`}
            style={tab === key ? { background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 2px 10px rgba(99,102,241,0.3)" } : {}}>
            {label}
          </button>
        ))}
      </div>

      {tab === "properties" && <PropertiesTab onView={() => {}} refresh={refresh} onRefresh={bump} />}
      {tab === "units"      && <UnitsTab refresh={refresh} />}
      {tab === "lease"      && <LeaseTab refresh={refresh} onRefresh={bump} />}
      {tab === "sales"      && <SalesTab refresh={refresh} onRefresh={bump} />}
      {tab === "buyers"     && <BuyersTab refresh={refresh} onRefresh={bump} />}
      {tab === "sellers"    && <SellersTab refresh={refresh} onRefresh={bump} />}
    </div>
  );
}
