'use client';

import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';

interface SidebarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  scheduledCount: number;
  sentCount: number;
  onCompose: () => void;
}

const ScheduledIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SentIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

export function Sidebar({
  activeTab,
  onTabChange,
  scheduledCount,
  sentCount,
  onCompose,
}: SidebarProps) {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col py-4 px-3 flex-shrink-0">
      {/* User info */}
      {user && (
        <div className="mb-4 px-1">
          <div className="flex items-center gap-2">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name ?? 'User'}
                width={28}
                height={28}
                unoptimized
                className="rounded-full ring-1 ring-gray-200 flex-shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {user.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
                {user.name}
              </p>
              <p className="text-xs text-gray-400 truncate leading-tight">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Compose button */}
      <Button
        id="compose-btn"
        onClick={onCompose}
        variant="secondary"
        size="sm"
        className="w-full mb-5 border-brand-500 text-brand-600 hover:bg-brand-50 font-semibold"
      >
        Compose
      </Button>

      {/* Navigation */}
      <div className="mb-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2">
          Core
        </p>
        <Tabs
          tabs={[
            {
              id: 'scheduled',
              label: 'Scheduled',
              count: scheduledCount,
              icon: <ScheduledIcon />,
            },
            {
              id: 'sent',
              label: 'Sent',
              count: sentCount,
              icon: <SentIcon />,
            },
          ]}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      </div>
    </aside>
  );
}
