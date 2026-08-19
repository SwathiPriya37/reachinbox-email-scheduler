'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { scheduleEmails, getSenders } from '@/lib/api';

interface Sender {
  id: string;
  name: string;
  email: string;
  hourlyLimit: number | null;
}

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Send Later quick options
const SEND_LATER_PRESETS = [
  {
    label: 'Tomorrow',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Tomorrow, 10:00 AM',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Tomorrow, 11:00 AM',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(11, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Tomorrow, 3:00 PM',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(15, 0, 0, 0);
      return d;
    },
  },
];

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ComposeModal({ isOpen, onClose, onSuccess }: ComposeModalProps) {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [recipientError, setRecipientError] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delayBetweenMs, setDelayBetweenMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSendLater, setShowSendLater] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Load senders on open
  useEffect(() => {
    if (!isOpen) return;
    getSenders()
      .then((data) => {
        setSenders(data);
        if (data.length > 0 && !selectedSenderId) {
          setSelectedSenderId(data[0].id);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setRecipients([]);
      setRecipientInput('');
      setRecipientError('');
      setCsvFileName('');
      setSubject('');
      setBody('');
      setStartTime('');
      setDelayBetweenMs(2000);
      setHourlyLimit(100);
      setShowSendLater(false);
      if (bodyRef.current) bodyRef.current.innerHTML = '';
    }
  }, [isOpen]);

  const handleCSVUpload = useCallback((file: File) => {
    setCsvFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const emails: string[] = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        results.data.forEach((row) => {
          // Look for any column that looks like an email
          const values = Object.values(row);
          values.forEach((val) => {
            if (typeof val === 'string' && emailRegex.test(val.trim())) {
              emails.push(val.trim().toLowerCase());
            }
          });
        });

        if (emails.length === 0) {
          setRecipientError(
            'No valid email addresses found in CSV. Make sure your CSV has an email column.',
          );
        } else {
          const unique = Array.from(new Set(emails));
          setRecipients(unique);
          setRecipientError('');
        }
      },
      error: (err) => {
        setRecipientError(`CSV parse error: ${err.message}`);
      },
    });
  }, []);

  const handleManualRecipients = useCallback((value: string) => {
    setRecipientInput(value);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = value
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    const valid = emails.filter((e) => emailRegex.test(e));
    const invalid = emails.filter((e) => !emailRegex.test(e) && e.length > 0);

    setRecipients(valid);
    if (invalid.length > 0) {
      setRecipientError(`Invalid: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? ` +${invalid.length - 3} more` : ''}`);
    } else {
      setRecipientError('');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) { toast.error('Subject is required'); return; }
    if (!body.trim()) { toast.error('Email body is required'); return; }
    if (recipients.length === 0) { toast.error('Add at least one recipient'); return; }
    if (!startTime) { toast.error('Select a send time'); return; }

    const scheduledISO = new Date(startTime).toISOString();

    setIsSubmitting(true);
    try {
      const result = await scheduleEmails({
        subject: subject.trim(),
        body: body.trim(),
        recipients,
        startTime: scheduledISO,
        delayBetweenEmailsMs: delayBetweenMs,
        hourlyLimit,
        senderId: selectedSenderId || undefined,
      });

      toast.success(`Scheduled ${result.scheduledCount} email${result.scheduledCount !== 1 ? 's' : ''}!`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format body from contenteditable
  const handleBodyInput = () => {
    if (bodyRef.current) {
      setBody(bodyRef.current.innerHTML || '');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" showCloseButton={false}>
      <form onSubmit={handleSubmit}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Compose New Email
          </button>
          <div className="flex items-center gap-2">
            <button type="button" className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors" title="Attachment">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSendLater(!showSendLater)}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                title="Send Later"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {/* Send Later dropdown */}
              {showSendLater && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-100 p-3 z-50 animate-slide-up">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Send Later</p>
                  <div className="mb-2">
                    <input
                      type="datetime-local"
                      className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-brand-400"
                      value={startTime}
                      onChange={(e) => { setStartTime(e.target.value); }}
                      min={toLocalDatetimeValue(new Date())}
                    />
                  </div>
                  <div className="space-y-0.5">
                    {SEND_LATER_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setStartTime(toLocalDatetimeValue(preset.getDate()));
                          setShowSendLater(false);
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                    <button type="button" onClick={() => setShowSendLater(false)} className="flex-1 text-xs text-gray-500 hover:text-gray-700 py-1">Cancel</button>
                    <button type="button" onClick={() => setShowSendLater(false)} className="flex-1 text-xs font-semibold text-brand-600 border border-brand-500 rounded-lg py-1 hover:bg-brand-50">Done</button>
                  </div>
                </div>
              )}
            </div>
            <Button type="submit" size="sm" loading={isSubmitting} variant="secondary"
              className="border-brand-500 text-brand-600 hover:bg-brand-50 font-semibold px-5">
              Send
            </Button>
          </div>
        </div>

        {/* Form fields */}
        <div className="px-6 py-4 space-y-0 divide-y divide-gray-100">
          {/* From */}
          <div className="flex items-center py-3 gap-4">
            <label className="text-sm text-gray-500 w-16 flex-shrink-0">From</label>
            <select
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(e.target.value)}
              className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-brand-400"
              id="compose-from"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>{s.email}</option>
              ))}
              {senders.length === 0 && <option value="">Loading...</option>}
            </select>
          </div>

          {/* To — manual + CSV */}
          <div className="py-3">
            <div className="flex items-start gap-4">
              <label className="text-sm text-gray-500 w-16 flex-shrink-0 pt-1.5">To</label>
              <div className="flex-1">
                <textarea
                  id="compose-to"
                  value={recipientInput}
                  onChange={(e) => handleManualRecipients(e.target.value)}
                  placeholder="recipient@example.com, another@example.com (or upload CSV)"
                  rows={2}
                  className="w-full text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none resize-none"
                />
                {recipientError && (
                  <p className="text-xs text-red-500 mt-1">{recipientError}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {recipients.length > 0 && (
                    <span className="text-xs text-brand-600 font-medium">
                      ✓ {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
                  >
                    Upload CSV
                  </button>
                  {csvFileName && (
                    <span className="text-xs text-gray-400 truncate max-w-[150px]">{csvFileName}</span>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCSVUpload(file);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="flex items-center py-3 gap-4">
            <label className="text-sm text-gray-500 w-16 flex-shrink-0">Subject</label>
            <input
              id="compose-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none"
            />
          </div>

          {/* Delay + Hourly limit */}
          <div className="flex items-center py-3 gap-6">
            <label className="text-sm text-gray-500 flex-shrink-0">Delay between 2 emails</label>
            <input
              id="compose-delay"
              type="number"
              value={Math.round(delayBetweenMs / 1000)}
              onChange={(e) => setDelayBetweenMs(Math.max(0, parseInt(e.target.value, 10) || 0) * 1000)}
              min={0}
              className="w-16 text-sm text-center text-gray-700 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-brand-400"
            />
            <span className="text-xs text-gray-400">sec</span>
            <label className="text-sm text-gray-500 flex-shrink-0 ml-2">Hourly Limit</label>
            <input
              id="compose-hourly-limit"
              type="number"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
              min={1}
              max={1000}
              className="w-16 text-sm text-center text-gray-700 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-brand-400"
            />
          </div>
        </div>

        {/* Rich text body */}
        <div className="px-6 pb-2">
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleBodyInput}
            className="min-h-[140px] text-sm text-gray-700 outline-none placeholder-gray-400 leading-relaxed"
            data-placeholder="Type Your Reply..."
            style={{ '--placeholder-color': '#9ca3af' } as React.CSSProperties}
            id="compose-body"
          />
          {/* Toolbar */}
          <div className="flex items-center gap-1 py-2 border-t border-gray-100 mt-2 flex-wrap">
            {[
              { cmd: 'undo', icon: '↩' },
              { cmd: 'redo', icon: '↪' },
            ].map(({ cmd, icon }) => (
              <button key={cmd} type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); }}
                className="px-1.5 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded transition-colors">{icon}</button>
            ))}
            <div className="w-px h-4 bg-gray-200 mx-1" />
            {[
              { cmd: 'bold', icon: 'B', cls: 'font-bold' },
              { cmd: 'italic', icon: 'I', cls: 'italic' },
              { cmd: 'underline', icon: 'U', cls: 'underline' },
            ].map(({ cmd, icon, cls }) => (
              <button key={cmd} type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); }}
                className={`px-1.5 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded transition-colors ${cls}`}>{icon}</button>
            ))}
            <div className="w-px h-4 bg-gray-200 mx-1" />
            {[
              { cmd: 'justifyLeft', icon: '⬛⬜⬜' },
              { cmd: 'justifyCenter', icon: '⬜⬛⬜' },
            ].map(({ cmd, icon }) => (
              <button key={cmd} type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); }}
                className="px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors">{icon}</button>
            ))}
          </div>
        </div>
      </form>

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--placeholder-color, #9ca3af);
          pointer-events: none;
        }
      `}</style>
    </Modal>
  );
}
