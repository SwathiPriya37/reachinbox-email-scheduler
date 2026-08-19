'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { ScheduledTable } from '@/components/dashboard/ScheduledTable';
import { SentTable } from '@/components/dashboard/SentTable';
import { ComposeModal } from '@/components/dashboard/ComposeModal';
import { EmailDetailPanel } from '@/components/dashboard/EmailDetailPanel';
import { useEmails } from '@/hooks/useEmails';
import type { EmailRow } from '@/lib/types';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailRow | null>(null);

  const {
    scheduledEmails,
    sentEmails,
    scheduledTotal,
    sentTotal,
    scheduledLoading,
    sentLoading,
    scheduledError,
    sentError,
    refresh,
  } = useEmails(15_000);

  // Auth guard
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top header */}
      <Header />

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as 'scheduled' | 'sent')}
          scheduledCount={scheduledTotal}
          sentCount={sentTotal}
          onCompose={() => setComposeOpen(true)}
        />

        {/* Main panel */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Panel top bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
            {/* Search bar */}
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search"
                  id="email-search"
                  className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-4">
              {/* Filter */}
              <button
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Filter"
                id="filter-btn"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>

              {/* Refresh */}
              <button
                onClick={refresh}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
                id="refresh-btn"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Table content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'scheduled' ? (
              <ScheduledTable
                emails={scheduledEmails}
                isLoading={scheduledLoading}
                error={scheduledError}
                onCompose={() => setComposeOpen(true)}
                onRowClick={(email) => setSelectedEmail(email)}
              />
            ) : (
              <SentTable
                emails={sentEmails}
                isLoading={sentLoading}
                error={sentError}
                onCompose={() => setComposeOpen(true)}
                onRowClick={(email) => setSelectedEmail(email)}
              />
            )}
          </div>
        </main>
      </div>

      {/* Compose modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSuccess={() => {
          setTimeout(refresh, 500); // brief delay for DB to settle
        }}
      />

      {/* Email detail panel */}
      <EmailDetailPanel
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
      />
    </div>
  );
}
