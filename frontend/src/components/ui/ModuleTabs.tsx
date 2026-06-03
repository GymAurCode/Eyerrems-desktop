interface TabItem {
  label: string;
  value: string;
  icon?: React.ElementType;
  badge?: number;
}

interface ModuleTabsProps {
  tabs: (TabItem | string)[];
  activeTab: string;
  onChange: (value: string) => void;
  moduleColor: string;
  className?: string;
}

function normalizeTab(t: TabItem | string): TabItem {
  return typeof t === "string" ? { label: t, value: t } : t;
}

export default function ModuleTabs({
  tabs,
  activeTab,
  onChange,
  moduleColor,
  className = "",
}: ModuleTabsProps) {
  return (
    <div className={`border-b border-theme ${className}`}>
      <nav className="flex gap-0 overflow-x-auto">
        {tabs.map((raw) => {
          const { label, value, icon: Icon, badge } = normalizeTab(raw);
          const isActive = activeTab === value;
          return (
            <button
              key={value}
              onClick={() => onChange(value)}
              className={`relative pb-2.5 pt-1 px-4 text-xs font-medium transition-all duration-150 whitespace-nowrap flex items-center gap-1.5
                ${isActive
                  ? "font-semibold"
                  : "text-muted hover:text-secondary"
                }`}
              style={
                isActive
                  ? {
                      color: moduleColor,
                      borderBottom: `3px solid ${moduleColor}`,
                    }
                  : {
                      borderBottom: "3px solid transparent",
                    }
              }
            >
              {Icon && <Icon size={13} />}
              {label}
              {badge != null && badge > 0 && (
                <span
                  className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white shrink-0"
                  style={{ background: moduleColor }}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
