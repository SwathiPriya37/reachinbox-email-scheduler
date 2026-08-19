import { db } from '../db';
import { getEmailQueue, makeJobId } from '../queue/emailQueue';
import { getDefaultSenderId } from './senderService';
import type { ScheduleEmailRequest, ScheduleEmailResponse } from '../types';
import type { EmailJobData } from '../types';

/**
 * Schedules a batch of emails:
 * 1. Inserts one DB row per recipient (status: PENDING)
 * 2. Enqueues a BullMQ delayed job per email with deterministic jobId
 *
 * The deterministic jobId = "email-job-{db_id}" causes BullMQ to silently
 * reject duplicate enqueue calls if the job already exists in the queue.
 * This is the primary idempotency mechanism at the queue layer.
 */
export async function scheduleEmails(
  req: ScheduleEmailRequest,
): Promise<ScheduleEmailResponse> {
  const queue = getEmailQueue();

  // Resolve sender
  const senderId =
    req.senderId ?? (await getDefaultSenderId());

  if (!senderId) {
    throw new Error('No sender configured. Run the seed or ensure a sender exists.');
  }

  const startTime = new Date(req.startTime);
  const delayBetweenMs = req.delayBetweenEmailsMs ?? 0;
  const jobIds: string[] = [];

  for (let i = 0; i < req.recipients.length; i++) {
    const recipient = req.recipients[i];
    const scheduledTime = new Date(startTime.getTime() + i * delayBetweenMs);

    // Step 1: Insert DB row
    const email = await db.email.create({
      data: {
        senderId,
        recipient,
        subject: req.subject,
        body: req.body,
        scheduledTime,
        status: 'PENDING',
      },
    });

    // Step 2: Enqueue BullMQ delayed job
    const jobId = makeJobId(email.id);
    const delayMs = Math.max(0, scheduledTime.getTime() - Date.now());

    const jobData: EmailJobData = { emailId: email.id, senderId };

    await queue.add('send-email', jobData, {
      jobId,      // deterministic — BullMQ rejects duplicate jobIds silently
      delay: delayMs,
    });

    // Store the jobId in DB for audit/debugging
    await db.email.update({
      where: { id: email.id },
      data: { bullmqJobId: jobId },
    });

    jobIds.push(jobId);
  }

  console.log(
    `[Schedule] Scheduled ${req.recipients.length} emails for sender ${senderId}`,
  );

  return {
    scheduledCount: req.recipients.length,
    jobIds,
    senderId,
  };
}

/**
 * Reconciliation — called on every server boot.
 *
 * Queries the DB for all PENDING emails and verifies each has a corresponding
 * BullMQ job. Any that are missing (e.g. after a Redis flush) are re-enqueued.
 *
 * This is safe to call multiple times:
 * - If the job already exists: BullMQ rejects the duplicate (idempotent).
 * - If the job is missing: it gets re-enqueued with the correct delay.
 *
 * This step protects against Redis/DB drift (e.g. Redis FLUSHALL) which would
 * lose jobs that were queued but not yet processed. BullMQ jobs already survive
 * plain process restarts (they persist in Redis), but not Redis data loss.
 */
export async function reconcilePendingEmails(): Promise<void> {
  console.log('[Reconcile] Starting reconciliation of pending emails...');

  const queue = getEmailQueue();

  const pendingEmails = await db.email.findMany({
    where: { status: 'PENDING' },
    include: { sender: true },
  });

  if (pendingEmails.length === 0) {
    console.log('[Reconcile] No pending emails — nothing to reconcile');
    return;
  }

  console.log(`[Reconcile] Found ${pendingEmails.length} pending emails`);

  let requeued = 0;
  let alreadyQueued = 0;

  for (const email of pendingEmails) {
    const jobId = makeJobId(email.id);

    // Check if BullMQ job exists
    const existingJob = await queue.getJob(jobId);

    if (existingJob) {
      alreadyQueued++;
      continue;
    }

    // Job is missing — re-enqueue with correct delay
    const delayMs = Math.max(0, email.scheduledTime.getTime() - Date.now());

    const jobData: EmailJobData = {
      emailId: email.id,
      senderId: email.senderId,
    };

    await queue.add('send-email', jobData, {
      jobId,
      delay: delayMs,
    });

    requeued++;
    console.log(
      `[Reconcile] Re-enqueued email ${email.id} (delay: ${Math.ceil(delayMs / 1000)}s)`,
    );
  }

  console.log(
    `[Reconcile] Done — ${alreadyQueued} already queued, ${requeued} re-enqueued`,
  );
}
