import { Router, Request, Response } from 'express';
import { db } from '../db';
import { getRedis } from '../redis';
import { getEmailQueue } from '../queue/emailQueue';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, 'ok' | 'offline'> = {};

  // Check PostgreSQL
  try {
    await db.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch {
    checks.postgres = 'offline';
  }

  // Check Redis
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'offline';
  }

  // Check BullMQ queue
  try {
    const queue = getEmailQueue();
    await queue.getJobCounts();
    checks.bullmq = 'ok';
  } catch {
    checks.bullmq = 'offline';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');

  return res.status(200).json({
    status: allOk ? 'healthy' : 'dev-standby',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
