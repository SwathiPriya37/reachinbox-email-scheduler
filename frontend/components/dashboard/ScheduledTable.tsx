'use client';

import { Table } from '@/components/ui/Table';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { EmailRow } from '@/lib/types';

interface ScheduledTableProps {
  emails: EmailRow[];
  isLoading: boolean;
  error: string | null;
  onCompose: () => void;
}

function formatScheduledTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const CalendarIcon = () => (
  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export function ScheduledTable({ emails, isLoading, error, onCompose }: ScheduledTableProps) {
  if (isLoading) return <LoadingSkeleton rows={5} />;

  if (error) {
    return (
      <EmptyState
        icon={<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>}
        title="Failed to load scheduled emails"
        description={error}
      />
    );
  }

  if (emails.length === 0) {
    return (
      <EmptyState
        icon={<CalendarIcon />}
        title="No scheduled emails"
        description="Schedule a batch of emails using the Compose button."
        action={
          <button
            onClick={onCompose}
            className="mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2"
          >
            Compose New Email
          </button>
        }
      />
    );
  }

  return (
    <Table
      columns={[
        {
          key: 'recipient',
          header: 'To',
          render: (row) => (
            <div>
              <span className="font-medium text-gray-800">To: {row.recipient}</span>
            </div>
          ),
        },
        {
          key: 'scheduledTime',
          header: 'Scheduled',
          render: (row) => (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-full border border-orange-100">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatScheduledTime(row.scheduledTime)}
            </span>
          ),
        },
        {
          key: 'subject',
          header: 'Subject',
          render: (row) => (
            <span className="text-gray-700">
              {row.subject}
              <span className="text-gray-400 ml-1">· {row.body.replace(/<[^>]+>/g, '').slice(0, 50)}...</span>
            </span>
          ),
        },
        {
          key: 'status',
          header: 'Status',
          render: () => (
            <span className="w-4 h-4 text-gray-300">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </span>
          ),
        },
      ]}
      data={emails}
      keyExtractor={(row) => row.id}
    />
  );
}
