"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIL_QUEUE_NAME = void 0;
exports.makeJobId = makeJobId;
exports.getEmailQueue = getEmailQueue;
const bullmq_1 = require("bullmq");
const redis_1 = require("../redis");
exports.EMAIL_QUEUE_NAME = 'email-queue';
// Deterministic job ID prefix — BullMQ will reject duplicate enqueues
// with the same jobId, providing our idempotency guarantee.
function makeJobId(emailId) {
    return `email-job-${emailId}`;
}
// Singleton queue instance
let emailQueueInstance = null;
function getEmailQueue() {
    if (!emailQueueInstance) {
        emailQueueInstance = new bullmq_1.Queue(exports.EMAIL_QUEUE_NAME, {
            connection: (0, redis_1.createRedisConnection)(),
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
        });
        console.log(`[Queue] "${exports.EMAIL_QUEUE_NAME}" initialized`);
    }
    return emailQueueInstance;
}
//# sourceMappingURL=emailQueue.js.map