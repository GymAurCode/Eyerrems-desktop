import { lazy, Suspense, useState, memo, useCallback } from "react";
import ModuleTabs from "../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../config/moduleColors";

const PropertiesTab = lazy(() => import("../components/property/tabs/PropertiesTab"));
const UnitsTab = lazy(() => import("../components/property/tabs/UnitsTab"));
const LeaseTab = lazy(() => import("../components/property/tabs/LeaseTab"));
const SalesTab = lazy(() => import("../components/property/tabs/SalesTab"));
const BuyersTab = lazy(() => import("../components/property/tabs/BuyersTab"));
const SellersTab = lazy(() => import("../components/property/tabs/SellersTab"));

const TABS = [
  { label: "Properties", value: "properties" },
  { label: "Units",      value: "units" },
  { label: "Lease",      value: "lease" },
  { label: "Sales",      value: "sales" },
  { label: "Buyers",     value: "buyers" },
  { label: "Sellers",    value: "sellers" },
];

type TabKey = typeof TABS[number]["value"];

function TabFallback() {
  return <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
}

const PropertyPage = memo(function PropertyPage() {
  const [tab, setTab]       = useState<TabKey>("properties");
  const [refresh, setRefresh] = useState(0);
  const bump = useCallback(() => setRefresh((n) => n + 1), []);

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
        moduleColor={MODULE_COLORS.properties.primary}
      />

      <Suspense fallback={<TabFallback />}>
        {tab === "properties" && <PropertiesTab onView={() => {}} refresh={refresh} onRefresh={bump} />}
        {tab === "units"      && <UnitsTab refresh={refresh} />}
        {tab === "lease"      && <LeaseTab refresh={refresh} onRefresh={bump} />}
        {tab === "sales"      && <SalesTab refresh={refresh} onRefresh={bump} />}
        {tab === "buyers"     && <BuyersTab refresh={refresh} onRefresh={bump} />}
        {tab === "sellers"    && <SellersTab refresh={refresh} onRefresh={bump} />}
      </Suspense>
    </div>
  );
});

export default PropertyPage;
