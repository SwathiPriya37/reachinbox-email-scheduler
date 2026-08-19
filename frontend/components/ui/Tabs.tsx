'use client';

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className = '' }: TabsProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 text-left
              ${isActive
                ? 'bg-green-50 text-green-700'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
          >
            {tab.icon && (
              <span className={`flex-shrink-0 ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                {tab.icon}
              </span>
            )}
            <span className="flex-1">{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                  ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
