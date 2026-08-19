import { Queue } from 'bullmq';
import type { EmailJobData } from '../types';
export declare const EMAIL_QUEUE_NAME = "email-queue";
export declare function makeJobId(emailId: string): string;
export declare function getEmailQueue(): Queue<EmailJobData>;
//# sourceMappingURL=emailQueue.d.ts.map