import { lazy, Suspense, useState, memo, useCallback, useMemo } from "react";
import ModuleTabs from "../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../config/moduleColors";
import { usePermissions } from "../hooks/usePermissions";

const PropertiesTab = lazy(() => import("../components/property/tabs/PropertiesTab"));
const UnitsTab = lazy(() => import("../components/property/tabs/UnitsTab"));
const LeaseTab = lazy(() => import("../components/property/tabs/LeaseTab"));
const SalesTab = lazy(() => import("../components/property/tabs/SalesTab"));
const BuyersTab = lazy(() => import("../components/property/tabs/BuyersTab"));
const SellersTab = lazy(() => import("../components/property/tabs/SellersTab"));

const ALL_TABS: { label: string; value: string; permKey?: string }[] = [
  { label: "Properties", value: "properties", permKey: "Properties" },
  { label: "Units",      value: "units",      permKey: "Units" },
  { label: "Lease",      value: "lease",      permKey: "Lease" },
  { label: "Sales",      value: "sales",      permKey: "Sales" },
  { label: "Buyers",     value: "buyers",     permKey: "Buyers" },
  { label: "Sellers",    value: "sellers",    permKey: "Sellers" },
];

type TabKey = "properties" | "units" | "lease" | "sales" | "buyers" | "sellers";

function TabFallback() {
  return <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
}

const PropertyPage = memo(function PropertyPage() {
  const { canAccessTab } = usePermissions();
  const TABS = useMemo(() => ALL_TABS.filter(t => {
    return t.permKey ? canAccessTab("properties", t.permKey) : true;
  }), [canAccessTab]);
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
