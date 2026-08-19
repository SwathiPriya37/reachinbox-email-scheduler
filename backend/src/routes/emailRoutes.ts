import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { scheduleEmails } from '../services/scheduleService';
import { getAllSenders } from '../services/senderService';
import type { ApiResponse, PaginatedEmailsResponse } from '../types';

const router = Router();

// ── Validation schema ─────────────────────────────────────────────────────────

const scheduleSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z
    .array(z.string().email('Invalid email address'))
    .min(1, 'At least one recipient required')
    .max(10000, 'Maximum 10,000 recipients per batch'),
  startTime: z.string().datetime({ message: 'startTime must be ISO 8601' }),
  delayBetweenEmailsMs: z.number().int().min(0).optional().default(0),
  hourlyLimit: z.number().int().min(1).max(1000).optional(),
  senderId: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function success<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data } satisfies ApiResponse<T>);
}

function fail(res: Response, message: string, status = 400, details?: unknown) {
  return res
    .status(status)
    .json({ success: false, error: message, details } satisfies ApiResponse<never>);
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/emails/schedule
 * Schedules a batch of emails.
 */
router.post('/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'Validation error', 400, parsed.error.flatten());
    }

    const result = await scheduleEmails(parsed.data);
    return success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/emails/scheduled
 * Paginated list of PENDING emails.
 */
router.get('/scheduled', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt((req.query.pageSize as string) ?? '20', 10)),
    );
    const skip = (page - 1) * pageSize;

    const [emails, total] = await Promise.all([
      db.email.findMany({
        where: { status: 'PENDING' },
        include: { sender: { select: { id: true, name: true, email: true } } },
        orderBy: { scheduledTime: 'asc' },
        skip,
        take: pageSize,
      }),
      db.email.count({ where: { status: 'PENDING' } }),
    ]);

    const response: PaginatedEmailsResponse = {
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
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/emails/sent
 * Paginated list of SENT and FAILED emails.
 */
router.get('/sent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt((req.query.pageSize as string) ?? '20', 10)),
    );
    const skip = (page - 1) * pageSize;

    const [emails, total] = await Promise.all([
      db.email.findMany({
        where: { status: { in: ['SENT', 'FAILED'] } },
        include: { sender: { select: { id: true, name: true, email: true } } },
        orderBy: { sentTime: 'desc' },
        skip,
        take: pageSize,
      }),
      db.email.count({ where: { status: { in: ['SENT', 'FAILED'] } } }),
    ]);

    const response: PaginatedEmailsResponse = {
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
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/emails/senders
 * Returns all configured senders (for compose form dropdown).
 */
router.get('/senders', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const senders = await getAllSenders();
    return success(res, senders);
  } catch (err) {
    next(err);
  }
});

export default router;
