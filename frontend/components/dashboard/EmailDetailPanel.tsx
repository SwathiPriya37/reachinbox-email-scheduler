'use client';

import { useEffect } from 'react';
import type { EmailRow } from '@/lib/types';

interface EmailDetailPanelProps {
  email: EmailRow | null;
  onClose: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDetailTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function generateTrackingCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const StarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const ArchiveIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export function EmailDetailPanel({ email, onClose }: EmailDetailPanelProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!email) return null;

  const senderName = email.sender?.name ?? 'Unknown Sender';
  const senderEmail = email.sender?.email ?? 'sender@example.com';
  const trackingCode1 = generateTrackingCode().slice(0, 7);
  const trackingCode2 = `BM#${generateTrackingCode().slice(0, 5)}`;
  const bodyText = email.body.replace(/<[^>]+>/g, '');
  const scheduledDate = email.scheduledTime
    ? formatDetailTime(email.scheduledTime)
    : 'Unknown time';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/10"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-right overflow-hidden border-l border-gray-200">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          {/* Back button + title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
              title="Back"
              id="email-detail-back-btn"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 truncate">
                {senderName}, hello there! | {trackingCode1} {trackingCode2}
              </h2>
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-4">
            <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500" title="Star" id="email-star-btn">
              <StarIcon />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500" title="Archive" id="email-archive-btn">
              <ArchiveIcon />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-red-500" title="Delete" id="email-delete-btn">
              <TrashIcon />
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-semibold">
              {getInitials(senderName)}
            </div>
          </div>
        </div>

        {/* Email content */}
        <div className="flex-1 overflow-y-auto">
          {/* Sender info */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-start gap-3">
              {/* Sender avatar */}
              <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 mt-0.5">
                {getInitials(senderName)}
              </div>

              {/* Sender details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-gray-900">{senderName}</span>
                    <span className="text-xs text-gray-500 ml-1">&lt;{senderEmail}&gt;</span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{scheduledDate}</span>
                </div>

                {/* "to me" dropdown */}
                <button className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  to me
                  <ChevronDownIcon />
                </button>
              </div>
            </div>
          </div>

          {/* Email body */}
          <div className="px-6 py-5">
            {/* Recipient greeting */}
            <div className="mb-4 text-sm text-gray-700 leading-relaxed">
              <p className="mb-2">Hey {email.recipient},</p>
              <p className="mb-3">You&apos;ve just RECEIVED something</p>
            </div>

            {/* Highlight box (like image 3's yellow promo box) */}
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm font-semibold text-gray-800 leading-snug">
                ⚡ {email.subject}
              </p>
            </div>

            {/* Email body content */}
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
              {bodyText}
            </div>

            {/* Sign-off */}
            <div className="text-sm text-gray-700 mt-4">
              <p>Your sender,</p>
              <p className="font-medium mt-1">{senderName}</p>
            </div>

            {/* PS line */}
            <p className="text-xs text-gray-400 italic mt-6">
              P.S. This email was scheduled via ReachInbox Email Scheduler 🚀
            </p>

            {/* Status badge */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Status:</span>
                {email.status === 'PENDING' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-orange-600 bg-orange-50 rounded-full border border-orange-100">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Scheduled
                  </span>
                ) : email.status === 'SENT' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full border border-emerald-100">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Sent
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-full border border-red-100">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    Failed
                  </span>
                )}

                {email.sentTime && (
                  <span className="text-xs text-gray-400">
                    at {formatDetailTime(email.sentTime)}
                  </span>
                )}
              </div>

              {email.errorMessage && (
                <p className="mt-2 text-xs text-red-500">{email.errorMessage}</p>
              )}
            </div>

            {/* Metadata row */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
              <div>
                <span className="font-medium text-gray-500">Recipient:</span> {email.recipient}
              </div>
              <div>
                <span className="font-medium text-gray-500">Scheduled:</span>{' '}
                {formatDetailTime(email.scheduledTime)}
              </div>
              <div>
                <span className="font-medium text-gray-500">Job ID:</span>{' '}
                <span className="font-mono">{email.bullmqJobId ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Divider at bottom */}
          <div className="border-t border-dashed border-gray-200 mx-6 my-4" />
        </div>

        {/* Footer action bar */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              id="email-detail-user-btn"
            >
              <UserIcon />
              Contact
            </button>
            <button
              onClick={onClose}
              className="ml-auto px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              id="email-detail-close-btn"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
