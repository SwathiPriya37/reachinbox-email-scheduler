import { Router, Request, Response } from 'express';
import { db } from '../db';
import { getRedis } from '../redis';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  let database = false;
  let redis = false;

  // Check PostgreSQL
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  // Check Redis
  try {
    const r = getRedis();
    await r.ping();
    redis = true;
  } catch {
    redis = false;
  }

  // Check BullMQ queue (only if redis is up)
  let queue = false;
  if (redis) {
    try {
      // Dynamically import to avoid circular init issues
      const { getEmailQueue } = await import('../queue/emailQueue');
      await getEmailQueue().getJobCounts();
      queue = true;
    } catch {
      queue = false;
    }
  }

  const allOk = database && redis && queue;

  return res.status(200).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: { database, redis, queue },
  });
});

export default router;
