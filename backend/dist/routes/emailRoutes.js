"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const scheduleService_1 = require("../services/scheduleService");
const senderService_1 = require("../services/senderService");
const router = (0, express_1.Router)();
// ── Validation schema ─────────────────────────────────────────────────────────
const scheduleSchema = zod_1.z.object({
    subject: zod_1.z.string().min(1, 'Subject is required'),
    body: zod_1.z.string().min(1, 'Body is required'),
    recipients: zod_1.z
        .array(zod_1.z.string().email('Invalid email address'))
        .min(1, 'At least one recipient required')
        .max(10000, 'Maximum 10,000 recipients per batch'),
    startTime: zod_1.z.string().datetime({ message: 'startTime must be ISO 8601' }),
    delayBetweenEmailsMs: zod_1.z.number().int().min(0).optional().default(0),
    hourlyLimit: zod_1.z.number().int().min(1).max(1000).optional(),
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
 * Schedules a batch of emails.
 */
router.post('/schedule', async (req, res, next) => {
    try {
        const parsed = scheduleSchema.safeParse(req.body);
        if (!parsed.success) {
            return fail(res, 'Validation error', 400, parsed.error.flatten());
        }
        const result = await (0, scheduleService_1.scheduleEmails)(parsed.data);
        return success(res, result, 201);
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/emails/scheduled
 * Paginated list of PENDING emails.
 */
router.get('/scheduled', async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? '20', 10)));
        const skip = (page - 1) * pageSize;
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
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/emails/sent
 * Paginated list of SENT and FAILED emails.
 */
router.get('/sent', async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? '20', 10)));
        const skip = (page - 1) * pageSize;
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
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/emails/senders
 * Returns all configured senders (for compose form dropdown).
 */
router.get('/senders', async (_req, res, next) => {
    try {
        const senders = await (0, senderService_1.getAllSenders)();
        return success(res, senders);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=emailRoutes.js.map