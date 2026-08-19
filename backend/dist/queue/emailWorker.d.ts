import { Worker } from 'bullmq';
import type { EmailJobData } from '../types';
export declare function startEmailWorker(): Worker<EmailJobData>;
export declare function stopEmailWorker(): Promise<void>;
//# sourceMappingURL=emailWorker.d.ts.map