'use client';

import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';

interface SidebarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  scheduledCount: number;
  sentCount: number;
  onCompose: () => void;
}

function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
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
  const name = user?.name ?? 'User';
  const initials = getInitials(name);
  const hue = nameToHue(name);
  const avatarStyle = {
    background: `linear-gradient(135deg, hsl(${hue},65%,52%), hsl(${(hue + 40) % 360},70%,44%))`,
  };

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col py-4 px-3 flex-shrink-0">
      {/* User info — initials only */}
      {user && (
        <div className="mb-4 px-1">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold select-none shadow-sm flex-shrink-0"
              style={avatarStyle}
              title={name}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
                {name}
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
        + Compose
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
