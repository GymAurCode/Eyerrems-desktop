import { useState } from "react";
import PropertiesTab from "../components/property/tabs/PropertiesTab";
import UnitsTab from "../components/property/tabs/UnitsTab";
import LeaseTab from "../components/property/tabs/LeaseTab";
import SalesTab from "../components/property/tabs/SalesTab";
import BuyersTab from "../components/property/tabs/BuyersTab";
import SellersTab from "../components/property/tabs/SellersTab";
import ModuleTabs from "../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../config/moduleColors";

const TABS = [
  { label: "Properties", value: "properties" },
  { label: "Units",      value: "units" },
  { label: "Lease",      value: "lease" },
  { label: "Sales",      value: "sales" },
  { label: "Buyers",     value: "buyers" },
  { label: "Sellers",    value: "sellers" },
];

type TabKey = typeof TABS[number]["value"];

export default function PropertyPage() {
  const [tab, setTab]       = useState<TabKey>("properties");
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh((n) => n + 1);

  return (
    <div className="px-6 py-5 space-y-5 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold text-primary">Property Module</h1>
        <p className="text-xs text-muted mt-0.5">Manage properties, units, leases, and sales</p>
      </div>

      <ModuleTabs
        tabs={TABS}
        activeTab={tab}
        onChange={(v) => setTab(v as TabKey)}
        moduleColor={MODULE_COLORS.property}
      />

      {tab === "properties" && <PropertiesTab onView={() => {}} refresh={refresh} onRefresh={bump} />}
      {tab === "units"      && <UnitsTab refresh={refresh} />}
      {tab === "lease"      && <LeaseTab refresh={refresh} onRefresh={bump} />}
      {tab === "sales"      && <SalesTab refresh={refresh} onRefresh={bump} />}
      {tab === "buyers"     && <BuyersTab refresh={refresh} onRefresh={bump} />}
      {tab === "sellers"    && <SellersTab refresh={refresh} onRefresh={bump} />}
    </div>
  );
}
