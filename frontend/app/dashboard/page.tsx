'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { ScheduledTable } from '@/components/dashboard/ScheduledTable';
import { SentTable } from '@/components/dashboard/SentTable';
import { ComposeModal } from '@/components/dashboard/ComposeModal';
import { EmailDetailPanel } from '@/components/dashboard/EmailDetailPanel';
import { useEmails } from '@/hooks/useEmails';
import type { EmailRow } from '@/lib/types';

export default function DashboardPage() {
  // 1. Session hook
  const { data: session, status } = useSession();

  // 2. State hooks
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 3. Toast notification hooks
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const prevSentCount = useRef<number | null>(null);

  // 4. Email data hook
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
  } = useEmails(10_000);

  // 5. Toast trigger effect
  useEffect(() => {
    if (prevSentCount.current === null) {
      prevSentCount.current = sentTotal;
      return;
    }
    if (sentTotal > prevSentCount.current) {
      const delta = sentTotal - prevSentCount.current;
      setToastMsg(`✓ ${delta} email${delta > 1 ? 's' : ''} delivered successfully`);
      setToastVisible(true);
      const t = setTimeout(() => setToastVisible(false), 4000);
      prevSentCount.current = sentTotal;
      return () => clearTimeout(t);
    }
    prevSentCount.current = sentTotal;
  }, [sentTotal]);

  // 6. Memoized search filters (ALL HOOKS CALLED BEFORE ANY CONDITIONAL RETURN)
  const filteredScheduled = useMemo(() => {
    if (!searchQuery.trim()) return scheduledEmails;
    const q = searchQuery.toLowerCase();
    return scheduledEmails.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.recipient.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q),
    );
  }, [scheduledEmails, searchQuery]);

  const filteredSent = useMemo(() => {
    if (!searchQuery.trim()) return sentEmails;
    const q = searchQuery.toLowerCase();
    return sentEmails.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.recipient.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q),
    );
  }, [sentEmails, searchQuery]);

  // 7. Redirect unauthenticated users in an effect
  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
  }, [status]);

  // Loading state render (must be AFTER all hooks)
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  const activeFiltered = activeTab === 'scheduled' ? filteredScheduled : filteredSent;
  const showSearchCount = searchQuery.trim() && activeFiltered.length !== (activeTab === 'scheduled' ? scheduledEmails : sentEmails).length;

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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by recipient, subject, or body…"
                  id="email-search"
                  className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                    title="Clear search"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {/* Search result count chip */}
              {showSearchCount && (
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {activeFiltered.length} result{activeFiltered.length !== 1 ? 's' : ''}
                </span>
              )}
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
                emails={filteredScheduled}
                isLoading={scheduledLoading}
                error={scheduledError}
                onCompose={() => setComposeOpen(true)}
                onRowClick={(email) => setSelectedEmail(email)}
              />
            ) : (
              <SentTable
                emails={filteredSent}
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
          setTimeout(refresh, 500);
        }}
      />

      {/* Email detail panel */}
      <EmailDetailPanel
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
      />

      {/* Delivery toast notification */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ${
          toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2.5 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-xl">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {toastMsg}
        </div>
      </div>
    </div>
  );
}
