"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startEmailWorker = startEmailWorker;
exports.stopEmailWorker = stopEmailWorker;
const bullmq_1 = require("bullmq");
const db_1 = require("../db");
const redis_1 = require("../redis");
const config_1 = require("../config");
const mailerService_1 = require("../services/mailerService");
const emailQueue_1 = require("./emailQueue");
/**
 * Get the Redis key for the hourly rate counter.
 * Key format: rate:{senderId}:{hourWindow}
 * hourWindow = Math.floor(Date.now() / 3_600_000) — a unique integer per clock hour.
 * The key naturally expires after 2 hours via EXPIRE.
 */
function getRateKey(senderId) {
    const hourWindow = Math.floor(Date.now() / 3600000);
    return `rate:${senderId}:${hourWindow}`;
}
/**
 * Returns the Unix timestamp (ms) for the start of the NEXT hour window.
 */
function nextHourTimestamp() {
    const hourWindow = Math.floor(Date.now() / 3600000);
    return (hourWindow + 1) * 3600000;
}
/**
 * Increment the Redis hourly counter for a sender.
 * Returns the new count. Sets expiry on first increment.
 */
async function incrementHourlyCounter(senderId) {
    const redis = (0, redis_1.getRedis)();
    const key = getRateKey(senderId);
    const count = await redis.incr(key);
    if (count === 1) {
        // First send this hour — set expiry to 2 hours so the key self-cleans
        await redis.expire(key, 7200);
    }
    return count;
}
/**
 * Decrement counter (used when we decide to reschedule instead of sending).
 */
async function decrementHourlyCounter(senderId) {
    const redis = (0, redis_1.getRedis)();
    const key = getRateKey(senderId);
    await redis.decr(key);
}
/**
 * The core email job processor.
 *
 * Idempotency guarantee:
 *   1. BullMQ refuses duplicate jobIds — prevents double-enqueue.
 *   2. Worker checks DB status before sending — prevents double-send on retry.
 *
 * Rate limiting (two layers):
 *   - BullMQ limiter: throttles burst rate (max N jobs per duration window).
 *   - Redis INCR counter: enforces hourly cap per sender.
 *     If cap exceeded → moveToDelayed(nextHourStart) instead of dropping.
 */
async function processEmailJob(job) {
    const { emailId, senderId } = job.data;
    console.log(`[Worker] Processing job ${job.id} for email ${emailId}`);
    // ── Step 1: Idempotency check ──────────────────────────────────────────
    const email = await db_1.db.email.findUnique({
        where: { id: emailId },
        include: { sender: true },
    });
    if (!email) {
        console.warn(`[Worker] Email ${emailId} not found in DB — skipping`);
        return;
    }
    if (email.status === 'SENT') {
        console.log(`[Worker] Email ${emailId} already sent — no-op (idempotency guard)`);
        return;
    }
    if (email.status === 'FAILED') {
        console.log(`[Worker] Email ${emailId} previously failed — re-attempting`);
    }
    // ── Step 2: Hourly rate limit check (Redis-backed) ─────────────────────
    const senderHourlyLimit = email.sender.hourlyLimit ?? config_1.config.rateLimit.maxEmailsPerHourPerSender;
    const count = await incrementHourlyCounter(senderId);
    if (count > senderHourlyLimit) {
        // Over limit — reschedule to next hour window instead of dropping
        await decrementHourlyCounter(senderId); // undo the increment we just did
        const delayUntilNextHour = nextHourTimestamp() - Date.now();
        console.log(`[Worker] Sender ${senderId} exceeded hourly limit (${senderHourlyLimit}). ` +
            `Rescheduling job ${job.id} to next hour (~${Math.ceil(delayUntilNextHour / 60000)}min)`);
        // moveToDelayed keeps the job in the queue with a new delay
        await job.moveToDelayed(nextHourTimestamp(), job.token);
        return;
    }
    // ── Step 3: Send email ─────────────────────────────────────────────────
    try {
        const previewUrl = await (0, mailerService_1.sendEmail)({
            sender: email.sender,
            to: email.recipient,
            subject: email.subject,
            html: email.body,
        });
        await db_1.db.email.update({
            where: { id: emailId },
            data: {
                status: 'SENT',
                sentTime: new Date(),
            },
        });
        console.log(`[Worker] ✓ Email ${emailId} sent to ${email.recipient}` +
            (previewUrl ? ` — Preview: ${previewUrl}` : ''));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Worker] ✗ Failed to send email ${emailId}: ${message}`);
        // Mark as failed in DB so reconciliation doesn't re-enqueue it
        await db_1.db.email.update({
            where: { id: emailId },
            data: {
                status: 'FAILED',
                errorMessage: message,
            },
        });
        // Re-throw so BullMQ applies retry/backoff
        throw err;
    }
}
let workerInstance = null;
function startEmailWorker() {
    if (workerInstance)
        return workerInstance;
    workerInstance = new bullmq_1.Worker(emailQueue_1.EMAIL_QUEUE_NAME, processEmailJob, {
        connection: (0, redis_1.createRedisConnection)(),
        concurrency: config_1.config.worker.concurrency,
        limiter: {
            // Burst-rate throttle: max N jobs per duration window
            // This is separate from the hourly Redis counter above.
            max: config_1.config.worker.rateLimiterMax,
            duration: config_1.config.worker.minDelayBetweenSendsMs,
        },
    });
    workerInstance.on('completed', (job) => {
        console.log(`[Worker] Job ${job.id} completed`);
    });
    workerInstance.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
    });
    workerInstance.on('stalled', (jobId) => {
        console.warn(`[Worker] Job ${jobId} stalled — will be re-processed`);
    });
    console.log(`[Worker] Started with concurrency=${config_1.config.worker.concurrency}, ` +
        `limiter=${config_1.config.worker.rateLimiterMax}/${config_1.config.worker.minDelayBetweenSendsMs}ms`);
    return workerInstance;
}
async function stopEmailWorker() {
    if (workerInstance) {
        await workerInstance.close();
        workerInstance = null;
        console.log('[Worker] Stopped');
    }
}
//# sourceMappingURL=emailWorker.js.map