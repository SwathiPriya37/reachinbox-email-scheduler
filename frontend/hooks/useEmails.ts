'use client';

import { useCallback, useEffect, useState } from 'react';
import { getScheduledEmails, getSentEmails } from '@/lib/api';
import type { EmailRow } from '@/lib/types';

interface UseEmailsState {
  scheduledEmails: EmailRow[];
  sentEmails: EmailRow[];
  scheduledTotal: number;
  sentTotal: number;
  scheduledLoading: boolean;
  sentLoading: boolean;
  scheduledError: string | null;
  sentError: string | null;
}

export function useEmails(pollingIntervalMs = 15_000) {
  const [state, setState] = useState<UseEmailsState>({
    scheduledEmails: [],
    sentEmails: [],
    scheduledTotal: 0,
    sentTotal: 0,
    scheduledLoading: true,
    sentLoading: true,
    scheduledError: null,
    sentError: null,
  });

  const fetchScheduled = useCallback(async () => {
    try {
      const data = await getScheduledEmails({ page: 1, pageSize: 50 });
      setState((s) => ({
        ...s,
        scheduledEmails: data.emails,
        scheduledTotal: data.total,
        scheduledLoading: false,
        scheduledError: null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        scheduledLoading: false,
        scheduledError: err instanceof Error ? err.message : 'Failed to load',
      }));
    }
  }, []);

  const fetchSent = useCallback(async () => {
    try {
      const data = await getSentEmails({ page: 1, pageSize: 50 });
      setState((s) => ({
        ...s,
        sentEmails: data.emails,
        sentTotal: data.total,
        sentLoading: false,
        sentError: null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        sentLoading: false,
        sentError: err instanceof Error ? err.message : 'Failed to load',
      }));
    }
  }, []);

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, scheduledLoading: true, sentLoading: true }));
    fetchScheduled();
    fetchSent();
  }, [fetchScheduled, fetchSent]);

  // Initial load
  useEffect(() => {
    fetchScheduled();
    fetchSent();
  }, [fetchScheduled, fetchSent]);

  // Polling for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchScheduled();
      fetchSent();
    }, pollingIntervalMs);
    return () => clearInterval(interval);
  }, [fetchScheduled, fetchSent, pollingIntervalMs]);

  return { ...state, refresh };
}
