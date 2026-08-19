import { Queue } from 'bullmq';
import { createRedisConnection } from '../redis';
import type { EmailJobData } from '../types';

export const EMAIL_QUEUE_NAME = 'email-queue';

// Deterministic job ID prefix — BullMQ will reject duplicate enqueues
// with the same jobId, providing our idempotency guarantee.
export function makeJobId(emailId: string): string {
  return `email-job-${emailId}`;
}

// Singleton queue instance
let emailQueueInstance: Queue<EmailJobData> | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueueInstance) {
    emailQueueInstance = new Queue<EmailJobData>(
      EMAIL_QUEUE_NAME,
      {
        connection: createRedisConnection(),
        defaultJobOptions: {
          removeOnComplete: {
            age: 24 * 3600, // keep completed jobs for 24h for debugging
            count: 1000,
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // keep failed jobs for 7 days
          },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5s base → 5s, 10s, 20s
          },
        },
      },
    );
    console.log(`[Queue] "${EMAIL_QUEUE_NAME}" initialized`);
  }
  return emailQueueInstance;
}

