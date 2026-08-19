'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { Modal } from '@/components/ui/Modal';
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

interface AttachedFile {
  name: string;
  size: string;
  url: string;
}

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
  const [delayBetweenMs, setDelayBetweenMs] = useState(0);
  const [hourlyLimit, setHourlyLimit] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSendLater, setShowSendLater] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Fetch senders list on open
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
  }, [isOpen, selectedSenderId]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setRecipients([]);
      setRecipientInput('');
      setRecipientError('');
      setCsvFileName('');
      setSubject('');
      setBody('');
      setStartTime('');
      setDelayBetweenMs(0);
      setHourlyLimit(0);
      setShowSendLater(false);
      setAttachments([]);
      if (bodyRef.current) bodyRef.current.innerHTML = '';
    }
  }, [isOpen]);

  // Handle CSV Upload
  const handleCSVUpload = useCallback((file: File) => {
    setCsvFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const emails: string[] = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        results.data.forEach((row) => {
          const values = Object.values(row);
          values.forEach((val) => {
            if (typeof val === 'string' && emailRegex.test(val.trim())) {
              emails.push(val.trim().toLowerCase());
            }
          });
        });

        if (emails.length === 0) {
          setRecipientError('No valid email addresses found in CSV.');
        } else {
          const unique = Array.from(new Set(emails));
          setRecipients(unique);
          setRecipientInput('');
          setRecipientError('');
          toast.success(`Loaded ${unique.length} recipients from CSV`);
        }
      },
      error: (err) => {
        setRecipientError(`CSV parse error: ${err.message}`);
      },
    });
  }, []);

  // Handle Typing inline recipients
  const handleManualRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      const val = recipientInput.trim().toLowerCase();
      if (!val) return;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) {
        setRecipientError(`Invalid email address: ${val}`);
        return;
      }
      if (!recipients.includes(val)) {
        setRecipients([...recipients, val]);
      }
      setRecipientInput('');
      setRecipientError('');
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    setRecipients(recipients.filter((_, i) => i !== indexToRemove));
  };

  // Handle Media / Image attachment
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: AttachedFile[] = [];
    Array.from(files).forEach((file) => {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const url = URL.createObjectURL(file);
      newAttachments.push({
        name: file.name,
        size: `${sizeMb} MB`,
        url,
      });
    });

    setAttachments([...attachments, ...newAttachments]);
    toast.success(`Attached ${newAttachments.length} file(s)`);
  };

  // Submit Handler
  const handleSubmit = async (isSendLaterAction: boolean = false) => {
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (recipients.length === 0 && !recipientInput.trim()) {
      toast.error('Add at least one recipient');
      return;
    }

    let finalRecipients = [...recipients];
    if (recipientInput.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const typed = recipientInput.trim().toLowerCase();
      if (emailRegex.test(typed) && !finalRecipients.includes(typed)) {
        finalRecipients.push(typed);
      }
    }

    const scheduledTime = startTime ? new Date(startTime).toISOString() : new Date().toISOString();

    setIsSubmitting(true);
    try {
      const result = await scheduleEmails({
        subject: subject.trim(),
        body: body.trim() || '<p></p>',
        recipients: finalRecipients,
        startTime: scheduledTime,
        delayBetweenEmailsMs: delayBetweenMs * 1000,
        hourlyLimit: hourlyLimit || 100,
        senderId: selectedSenderId || undefined,
      });

      toast.success(
        isSendLaterAction || startTime
          ? `Scheduled ${result.scheduledCount} email(s) for later!`
          : `Sent ${result.scheduledCount} email(s) successfully!`,
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const visiblePills = recipients.slice(0, 3);
  const hiddenCount = recipients.length - 3;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" showCloseButton={false}>
      <div className="relative flex flex-col bg-white rounded-2xl overflow-hidden min-h-[580px]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 text-base font-semibold text-gray-800 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Compose New Email
          </button>

          {/* Action icons & buttons */}
          <div className="flex items-center gap-3">
            {/* Attachment Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors relative"
                title="Attach file / media"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {attachments.length > 0 && (
                  <span className="absolute -top-1 -right-1 text-[10px] font-bold text-green-600">
                    {attachments.length}
                  </span>
                )}
              </button>
              <input
                ref={mediaInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={handleMediaUpload}
              />
            </div>

            {/* Send Later Clock Icon */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSendLater(!showSendLater)}
                className={`p-1.5 transition-colors ${showSendLater ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="Schedule Send Later"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {/* Popover Send Later Card matching Screenshot 1 */}
              {showSendLater && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 animate-slide-up">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Send Later</h3>

                  {/* Pick date & time field with calendar icon */}
                  <div className="relative mb-3">
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      placeholder="Pick date & time"
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-green-500 text-gray-700 placeholder-gray-400 pr-8"
                      min={toLocalDatetimeValue(new Date())}
                    />
                    <svg className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>

                  {/* Presets */}
                  <div className="space-y-1 mb-4">
                    {SEND_LATER_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setStartTime(toLocalDatetimeValue(preset.getDate()));
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Popover Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setShowSendLater(false)}
                      className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSendLater(false);
                        if (!startTime) {
                          setStartTime(toLocalDatetimeValue(SEND_LATER_PRESETS[1].getDate()));
                        }
                        toast.success('Schedule set for later delivery');
                      }}
                      className="px-4 py-1.5 text-xs font-semibold text-green-600 border border-green-500 rounded-full hover:bg-green-50 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Send Later / Send Pill Button matching Figma */}
            <button
              type="button"
              onClick={() => handleSubmit(showSendLater || Boolean(startTime))}
              disabled={isSubmitting}
              className="px-5 py-1.5 text-sm font-medium text-green-600 border border-green-500 rounded-full hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              {isSubmitting
                ? 'Sending...'
                : startTime || showSendLater
                ? 'Send Later'
                : 'Send'}
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="px-6 py-2 divide-y divide-gray-100">
          {/* From Line */}
          <div className="flex items-center py-2.5 gap-4">
            <label className="text-xs text-gray-400 w-12 flex-shrink-0">From</label>
            <div className="relative flex-1">
              <select
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="text-xs font-medium text-gray-800 bg-gray-100/70 hover:bg-gray-100 border border-gray-200/60 rounded-lg px-3 py-1.5 outline-none focus:border-green-500 cursor-pointer appearance-none pr-7"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email}
                  </option>
                ))}
                {senders.length === 0 && <option value="">rswathipriya3@gmail.com</option>}
              </select>
              <svg className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* To Line with Chips / Pills + Upload List button matching Screenshot 3 */}
          <div className="flex items-center py-2.5 gap-4 min-h-[44px]">
            <label className="text-xs text-gray-400 w-12 flex-shrink-0">To</label>

            <div className="flex-1 flex items-center flex-wrap gap-2">
              {/* Recipient Pills */}
              {visiblePills.map((email, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full text-xs font-medium"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeRecipient(idx)}
                    className="hover:text-emerald-900 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}

              {/* +X Badge if more than 3 */}
              {hiddenCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full text-xs font-medium">
                  +{hiddenCount}
                </span>
              )}

              {/* Inline Recipient Input */}
              <input
                type="email"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleManualRecipientKeyDown}
                placeholder={recipients.length === 0 ? 'recipient@example.com' : 'Add email...'}
                className="flex-1 text-xs text-gray-800 placeholder-gray-400 outline-none bg-transparent min-w-[150px]"
              />
            </div>

            {/* Upload List Button matching Screenshot 2 & 3 */}
            <div className="flex-shrink-0 flex items-center gap-2">
              {csvFileName && (
                <span className="text-[11px] text-gray-400 truncate max-w-[120px]">{csvFileName}</span>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload List
              </button>
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
          {recipientError && (
            <p className="text-xs text-red-500 pl-16 py-1">{recipientError}</p>
          )}

          {/* Subject Line */}
          <div className="flex items-center py-2.5 gap-4">
            <label className="text-xs text-gray-400 w-12 flex-shrink-0">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 text-xs text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            />
          </div>

          {/* Delay + Hourly Limit Line matching Figma */}
          <div className="flex items-center py-2.5 gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <label>Delay between 2 emails</label>
              <input
                type="number"
                value={delayBetweenMs ? String(delayBetweenMs) : '00'}
                onChange={(e) => setDelayBetweenMs(parseInt(e.target.value, 10) || 0)}
                className="w-14 px-2 py-1 border border-gray-200 rounded-lg text-center font-mono outline-none focus:border-green-500 text-gray-700 bg-gray-50/50"
                min={0}
              />
            </div>
            <div className="flex items-center gap-2">
              <label>Hourly Limit</label>
              <input
                type="number"
                value={hourlyLimit ? String(hourlyLimit) : '00'}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 0)}
                className="w-14 px-2 py-1 border border-gray-200 rounded-lg text-center font-mono outline-none focus:border-green-500 text-gray-700 bg-gray-50/50"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Compose Body Area & Formatting Toolbar */}
        <div className="flex-1 px-6 pb-4 flex flex-col">
          <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 flex-1 flex flex-col min-h-[220px]">
            {/* Rich text editable area */}
            <div
              ref={bodyRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => {
                if (bodyRef.current) setBody(bodyRef.current.innerHTML || '');
              }}
              className="flex-1 text-xs text-gray-800 outline-none leading-relaxed min-h-[120px]"
              data-placeholder="Type Your Reply..."
              style={{ '--placeholder-color': '#9ca3af' } as React.CSSProperties}
            />
            {/* Rich Text Toolbar matching screenshot */}
            <div className="flex items-center gap-1.5 pt-3 border-t border-gray-200/60 flex-wrap text-gray-500 px-1">
              {/* Undo / Redo */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); document.execCommand('undo'); }}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                title="Undo"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); document.execCommand('redo'); }}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                title="Redo"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>

              <div className="w-px h-4 bg-gray-200 mx-2" />

              {/* Text formatting */}
              <button
                type="button"
                className="px-2 py-1 hover:bg-gray-100 rounded text-[13px] font-serif flex items-center gap-0.5 text-gray-600 transition-colors"
                title="Font Size"
              >
                TT
                <svg className="w-2.5 h-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold'); }}
                className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-sm font-bold text-gray-600 transition-colors"
                title="Bold"
              >
                B
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic'); }}
                className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-sm italic font-serif text-gray-600 transition-colors"
                title="Italic"
              >
                I
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline'); }}
                className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-sm underline text-gray-600 transition-colors"
                title="Underline"
              >
                U
              </button>

              <div className="w-px h-4 bg-gray-200 mx-2" />

              {/* Alignment & Lists */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyLeft'); }}
                className="px-2 py-1 hover:bg-gray-100 rounded text-xs flex items-center gap-0.5 text-gray-600 transition-colors"
                title="Align"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
                </svg>
                <svg className="w-2.5 h-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertOrderedList'); }}
                className="px-2 py-1 hover:bg-gray-100 rounded text-xs font-medium text-gray-600 transition-colors tracking-widest"
                title="Numbered List"
              >
                1=
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList'); }}
                className="px-2 py-1 hover:bg-gray-100 rounded text-xs font-medium text-gray-600 transition-colors tracking-widest"
                title="Bullet List"
              >
                :=
              </button>

              <div className="w-px h-4 bg-gray-200 mx-2" />

              {/* Attachment & Strikethrough */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); mediaInputRef.current?.click(); }}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                title="Attachment"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); document.execCommand('strikeThrough'); }}
                className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-sm line-through text-gray-600 transition-colors"
                title="Strikethrough"
              >
                S
              </button>
            </div>

            {/* Attached media preview thumbnails matching Screenshot 2 & 3 */}
            {attachments.length > 0 && (
              <div className="flex items-center gap-3 pt-3 mt-3 border-t border-gray-200/60 overflow-x-auto">
                {attachments.map((file, i) => (
                  <div key={i} className="relative group flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden w-28 flex-shrink-0 shadow-sm">
                    {file.url.startsWith('blob:') ? (
                      <div className="relative w-full h-16 bg-gray-100">
                        {/* Thumbnail */}
                        <Image
                          src={file.url}
                          alt={file.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-16 bg-gray-100 flex items-center justify-center text-gray-400">
                        📎
                      </div>
                    )}
                    <div className="p-1.5 bg-white text-[10px]">
                      <p className="font-medium text-gray-800 truncate">{file.name}</p>
                      <p className="text-gray-400">{file.size}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
