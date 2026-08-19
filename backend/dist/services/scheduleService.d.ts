import type { ScheduleEmailRequest, ScheduleEmailResponse } from '../types';
/**
 * Schedules a batch of emails:
 * 1. Inserts one DB row per recipient (status: PENDING)
 * 2. Enqueues a BullMQ delayed job per email with deterministic jobId
 *
 * The deterministic jobId = "email-job-{db_id}" causes BullMQ to silently
 * reject duplicate enqueue calls if the job already exists in the queue.
 * This is the primary idempotency mechanism at the queue layer.
 */
export declare function scheduleEmails(req: ScheduleEmailRequest): Promise<ScheduleEmailResponse>;
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
export declare function reconcilePendingEmails(): Promise<void>;
//# sourceMappingURL=scheduleService.d.ts.map