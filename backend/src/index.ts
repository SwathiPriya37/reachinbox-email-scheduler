import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { db } from './db';
import { getRedis } from './redis';
import { getEmailQueue } from './queue/emailQueue';
import { startEmailWorker } from './queue/emailWorker';
import { ensureDefaultSender } from './services/senderService';
import { reconcilePendingEmails } from './services/scheduleService';
import emailRoutes from './routes/emailRoutes';
import healthRoutes from './routes/healthRoutes';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' })); // 10MB for large CSV batches
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/emails', emailRoutes);
app.use('/api', healthRoutes);

// ── 404 handler ────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message);
  if (config.nodeEnv === 'development') {
    console.error(err.stack);
  }
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    // Never leak stack traces in production
    ...(config.nodeEnv === 'development' ? { details: err.message } : {}),
  });
});

// ── Boot sequence ─────────────────────────────────────────────────────────────
async function boot() {
  console.log('[Boot] Starting ReachInbox Email Scheduler backend...');

  // 1. Verify DB connection
  try {
    await db.$connect();
    console.log('[Boot] PostgreSQL connected');
  } catch (err) {
    console.error('[Boot] Failed to connect to PostgreSQL:', err);
    process.exit(1);
  }

  // 2. Verify Redis connection
  try {
    const redis = getRedis();
    await redis.ping();
    console.log('[Boot] Redis connected');
  } catch (err) {
    console.error('[Boot] Failed to connect to Redis:', err);
    process.exit(1);
  }

  // 3. Ensure BullMQ queue is ready
  getEmailQueue();

  // 4. Ensure a default sender exists (creates Ethereal account if needed)
  await ensureDefaultSender();

  // 5. Start the BullMQ worker
  startEmailWorker();

  // 6. ─ RECONCILIATION ─────────────────────────────────────────────────────
  // Re-enqueue any PENDING emails whose BullMQ jobs are missing.
  // This runs on every boot and is idempotent — safe to call multiple times.
  // Protects against Redis data loss (e.g. Redis FLUSHALL between restarts).
  await reconcilePendingEmails();

  // 7. Start HTTP server
  const server = app.listen(config.port, () => {
    console.log(`[Boot] Server listening on http://localhost:${config.port}`);
    console.log(`[Boot] Health check: http://localhost:${config.port}/api/health`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  async function shutdown(signal: string) {
    console.log(`\n[Shutdown] Received ${signal} — shutting down gracefully...`);

    server.close(async () => {
      try {
        await db.$disconnect();
        console.log('[Shutdown] PostgreSQL disconnected');
      } catch {}

      try {
        const redis = getRedis();
        await redis.quit();
        console.log('[Shutdown] Redis disconnected');
      } catch {}

      console.log('[Shutdown] Done');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

boot().catch((err) => {
  console.error('[Boot] Fatal error:', err);
  process.exit(1);
});
