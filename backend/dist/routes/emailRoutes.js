"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const scheduleService_1 = require("../services/scheduleService");
const senderService_1 = require("../services/senderService");
const router = (0, express_1.Router)();
// In-memory fallback dataset (matching Figma designs) for zero-config dev testing when DB is offline
const inMemoryScheduled = [
    {
        id: 'email-demo-1',
        recipient: 'John Smith',
        subject: 'Meeting follow-up - Scheduled',
        body: 'Hi John, just wanted to follow up on our meeting...',
        scheduledTime: new Date(Date.now() + 3600000).toISOString(),
        status: 'PENDING',
        sentTime: null,
        bullmqJobId: 'email-job-demo-1',
        errorMessage: null,
        createdAt: new Date().toISOString(),
        sender: { id: 'sender-1', name: 'ReachInbox', email: 'rswathipriya3@gmail.com' },
    },
    {
        id: 'email-demo-2',
        recipient: 'Olive',
        subject: 'Ramit, great to meet you - you\'ll love it',
        body: 'Hi Olive, just wanted to follow up on our meeting...',
        scheduledTime: new Date(Date.now() + 86400000).toISOString(),
        status: 'PENDING',
        sentTime: null,
        bullmqJobId: 'email-job-demo-2',
        errorMessage: null,
        createdAt: new Date().toISOString(),
        sender: { id: 'sender-1', name: 'ReachInbox', email: 'rswathipriya3@gmail.com' },
    },
];
const inMemorySent = [
    {
        id: 'email-demo-3',
        recipient: 'Sarah Wilson',
        subject: 'Re: Project Update',
        body: 'Thanks for the update, Sarah. Looks good!',
        scheduledTime: new Date(Date.now() - 3600000).toISOString(),
        status: 'SENT',
        sentTime: new Date(Date.now() - 1800000).toISOString(),
        bullmqJobId: 'email-job-demo-3',
        errorMessage: null,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        sender: { id: 'sender-1', name: 'ReachInbox', email: 'rswathipriya3@gmail.com' },
    },
    {
        id: 'email-demo-4',
        recipient: 'Support',
        subject: 'Issue with login',
        body: 'I am having trouble logging in to the dashboard...',
        scheduledTime: new Date(Date.now() - 86400000).toISOString(),
        status: 'SENT',
        sentTime: new Date(Date.now() - 82800000).toISOString(),
        bullmqJobId: 'email-job-demo-4',
        errorMessage: null,
        createdAt: new Date(Date.now() - 90000000).toISOString(),
        sender: { id: 'sender-1', name: 'ReachInbox', email: 'rswathipriya3@gmail.com' },
    },
];
// ── Validation schema ─────────────────────────────────────────────────────────
const scheduleSchema = zod_1.z.object({
    subject: zod_1.z.string().min(1, 'Subject is required'),
    body: zod_1.z.string().min(1, 'Body is required'),
    recipients: zod_1.z
        .array(zod_1.z.string())
        .min(1, 'At least one recipient required')
        .max(10000, 'Maximum 10,000 recipients per batch'),
    startTime: zod_1.z.string(),
    delayBetweenEmailsMs: zod_1.z.number().int().min(0).optional().default(0),
    hourlyLimit: zod_1.z.number().int().min(0).optional(),
    senderId: zod_1.z.string().optional(),
});
// ── Helpers ───────────────────────────────────────────────────────────────────
function success(res, data, status = 200) {
    return res.status(status).json({ success: true, data });
}
function fail(res, message, status = 400, details) {
    return res
        .status(status)
        .json({ success: false, error: message, details });
}
// ── Routes ────────────────────────────────────────────────────────────────────
/**
 * POST /api/emails/schedule
 */
router.post('/schedule', async (req, res, next) => {
    try {
        const parsed = scheduleSchema.safeParse(req.body);
        if (!parsed.success) {
            return fail(res, 'Validation error', 400, parsed.error.flatten());
        }
        try {
            const result = await (0, scheduleService_1.scheduleEmails)(parsed.data);
            return success(res, result, 201);
        }
        catch {
            // In-memory fallback scheduling when Postgres DB is offline
            const newJobIds = [];
            parsed.data.recipients.forEach((rec, idx) => {
                const emailId = `email-mem-${Date.now()}-${idx}`;
                const newEmail = {
                    id: emailId,
                    recipient: rec,
                    subject: parsed.data.subject,
                    body: parsed.data.body,
                    scheduledTime: parsed.data.startTime,
                    status: 'PENDING',
                    sentTime: null,
                    bullmqJobId: `email-job-${emailId}`,
                    errorMessage: null,
                    createdAt: new Date().toISOString(),
                    sender: { id: 'sender-1', name: 'ReachInbox', email: 'rswathipriya3@gmail.com' },
                };
                inMemoryScheduled.unshift(newEmail);
                newJobIds.push(`email-job-${emailId}`);
            });
            return success(res, {
                scheduledCount: parsed.data.recipients.length,
                jobIds: newJobIds,
                senderId: 'sender-1',
            }, 201);
        }
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/emails/scheduled
 */
router.get('/scheduled', async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? '20', 10)));
        const skip = (page - 1) * pageSize;
        try {
            const [emails, total] = await Promise.all([
                db_1.db.email.findMany({
                    where: { status: 'PENDING' },
                    include: { sender: { select: { id: true, name: true, email: true } } },
                    orderBy: { scheduledTime: 'asc' },
                    skip,
                    take: pageSize,
                }),
                db_1.db.email.count({ where: { status: 'PENDING' } }),
            ]);
            const response = {
                emails: emails.map((e) => ({
                    id: e.id,
                    recipient: e.recipient,
                    subject: e.subject,
                    body: e.body,
                    scheduledTime: e.scheduledTime.toISOString(),
                    status: e.status,
                    sentTime: e.sentTime?.toISOString() ?? null,
                    bullmqJobId: e.bullmqJobId,
                    errorMessage: e.errorMessage,
                    createdAt: e.createdAt.toISOString(),
                    sender: e.sender,
                })),
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            };
            return success(res, response);
        }
        catch {
            // In-memory fallback
            return success(res, {
                emails: inMemoryScheduled.slice(skip, skip + pageSize),
                total: inMemoryScheduled.length,
                page,
                pageSize,
                totalPages: Math.ceil(inMemoryScheduled.length / pageSize),
            });
        }
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/emails/sent
 */
router.get('/sent', async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? '20', 10)));
        const skip = (page - 1) * pageSize;
        try {
            const [emails, total] = await Promise.all([
                db_1.db.email.findMany({
                    where: { status: { in: ['SENT', 'FAILED'] } },
                    include: { sender: { select: { id: true, name: true, email: true } } },
                    orderBy: { sentTime: 'desc' },
                    skip,
                    take: pageSize,
                }),
                db_1.db.email.count({ where: { status: { in: ['SENT', 'FAILED'] } } }),
            ]);
            const response = {
                emails: emails.map((e) => ({
                    id: e.id,
                    recipient: e.recipient,
                    subject: e.subject,
                    body: e.body,
                    scheduledTime: e.scheduledTime.toISOString(),
                    status: e.status,
                    sentTime: e.sentTime?.toISOString() ?? null,
                    bullmqJobId: e.bullmqJobId,
                    errorMessage: e.errorMessage,
                    createdAt: e.createdAt.toISOString(),
                    sender: e.sender,
                })),
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            };
            return success(res, response);
        }
        catch {
            // In-memory fallback
            return success(res, {
                emails: inMemorySent.slice(skip, skip + pageSize),
                total: inMemorySent.length,
                page,
                pageSize,
                totalPages: Math.ceil(inMemorySent.length / pageSize),
            });
        }
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/emails/senders
 */
router.get('/senders', async (_req, res, next) => {
    try {
        try {
            const senders = await (0, senderService_1.getAllSenders)();
            if (senders.length > 0)
                return success(res, senders);
        }
        catch { }
        // Fallback default sender
        return success(res, [
            { id: 'sender-1', name: 'ReachInbox', email: 'rswathipriya3@gmail.com', hourlyLimit: 100 },
        ]);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=emailRoutes.js.map