import { Router, Request, Response } from 'express';
import { db } from '../db';
import { getRedis } from '../redis';
import { getEmailQueue } from '../queue/emailQueue';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  // Check PostgreSQL
  try {
    await db.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch {
    checks.postgres = 'error';
  }

  // Check Redis
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  // Check BullMQ queue
  try {
    const queue = getEmailQueue();
    await queue.getJobCounts();
    checks.bullmq = 'ok';
  } catch {
    checks.bullmq = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
