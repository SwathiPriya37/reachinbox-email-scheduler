import { db } from '../db';
import { createEtherealAccount } from './mailerService';

/**
 * Ensures at least one Sender exists in the DB.
 * On first boot: creates an Ethereal test account and persists it.
 * On subsequent boots: returns the existing sender.
 *
 * This means Ethereal credentials persist across restarts — critical because
 * Ethereal test accounts are ephemeral and we need the same SMTP credentials
 * for the worker to send emails after a restart.
 */
export async function ensureDefaultSender(): Promise<string> {
  const existing = await db.sender.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    console.log(`[Sender] Using existing sender: ${existing.email}`);
    return existing.id;
  }

  console.log('[Sender] No sender found — creating Ethereal test account...');
  const ethereal = await createEtherealAccount();

  const sender = await db.sender.create({
    data: {
      name: 'ReachInbox Mailer',
      email: ethereal.email,
      smtpHost: ethereal.smtpHost,
      smtpPort: ethereal.smtpPort,
      smtpUser: ethereal.smtpUser,
      smtpPass: ethereal.smtpPass,
      smtpSecure: ethereal.smtpSecure,
      hourlyLimit: 100,
    },
  });

  console.log(`[Sender] Created Ethereal sender: ${sender.email}`);
  console.log('[Sender] View sent emails at: https://ethereal.email');

  return sender.id;
}

/**
 * Returns all senders (for the compose form dropdown).
 */
export async function getAllSenders() {
  return db.sender.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      hourlyLimit: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Returns the default sender ID (first created).
 */
export async function getDefaultSenderId(): Promise<string | null> {
  const sender = await db.sender.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  return sender?.id ?? null;
}
