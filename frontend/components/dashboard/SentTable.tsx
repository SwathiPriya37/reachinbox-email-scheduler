'use client';

import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { EmailRow } from '@/lib/types';

interface SentTableProps {
  emails: EmailRow[];
  isLoading: boolean;
  error: string | null;
  onCompose: () => void;
  onRowClick?: (email: EmailRow) => void;
}

const SentIcon = () => (
  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const StarIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    className={`w-4 h-4 transition-colors ${filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-gray-400'}`}
    fill={filled ? 'currentColor' : 'none'}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

export function SentTable({ emails, isLoading, error, onCompose, onRowClick }: SentTableProps) {
  if (isLoading) return <LoadingSkeleton rows={5} />;

  if (error) {
    return (
      <EmptyState
        icon={<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>}
        title="Failed to load sent emails"
        description={error}
      />
    );
  }

  if (emails.length === 0) {
    return (
      <EmptyState
        icon={<SentIcon />}
        title="No sent emails yet"
        description="Emails will appear here once they've been delivered."
        action={
          <button
            onClick={onCompose}
            className="mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2"
          >
            Schedule your first email
          </button>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <tbody>
          {emails.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className="border-b border-gray-100 hover:bg-gray-50/70 transition-colors cursor-pointer group"
            >
              {/* To: Recipient */}
              <td className="py-3 px-5 w-44 flex-shrink-0">
                <span className="font-medium text-gray-800 text-sm">To: {row.recipient}</span>
              </td>

              {/* "Sent" label badge — plain gray text label matching screenshot */}
              <td className="py-3 px-3 w-20 flex-shrink-0">
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                  Sent
                </span>
              </td>

              {/* Subject · preview */}
              <td className="py-3 px-3 flex-1 min-w-0">
                <span className="text-gray-800 font-medium">
                  {row.subject}
                </span>
                <span className="text-gray-400 ml-1 font-normal">
                  · {row.body.replace(/<[^>]+>/g, '').slice(0, 60)}
                </span>
              </td>

              {/* Star */}
              <td className="py-3 px-5 w-10 text-right">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <StarIcon />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
