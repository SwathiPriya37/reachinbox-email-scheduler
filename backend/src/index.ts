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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), timeoutMs),
    ),
  ]);
}

// ── CORS & Security Middleware ───────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(
  cors({
    origin: true, // Allow all origins in dev mode for easy local testing
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' })); // 10MB for large CSV batches
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/emails', emailRoutes);
app.use('/api', healthRoutes);

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(config.nodeEnv === 'development' ? { details: err.message } : {}),
  });
});

// ── Boot sequence ────────────────────────────────────────────────────────────
async function boot() {
  console.log('======================================================');
  console.log('   ReachInbox Email Scheduler Backend Service');
  console.log('======================================================');

  let dbConnected = false;
  let redisConnected = false;

  // 1. Check PostgreSQL (with 500ms fast timeout)
  try {
    await withTimeout(db.$connect(), 500);
    console.log('[Boot] ✓ PostgreSQL connected');
    dbConnected = true;
  } catch {
    console.warn('[Boot] ⚠️ PostgreSQL is offline (Run `docker-compose up -d` to start Postgres + Redis).');
  }

  // 2. Check Redis (with 500ms fast timeout)
  try {
    const redis = getRedis();
    await withTimeout(redis.ping(), 500);
    console.log('[Boot] ✓ Redis connected');
    redisConnected = true;
  } catch {
    console.warn('[Boot] ⚠️ Redis is offline.');
  }

  if (dbConnected && redisConnected) {
    try {
      getEmailQueue();
      await ensureDefaultSender();
      startEmailWorker();
      await reconcilePendingEmails();
      console.log('[Boot] ✓ BullMQ Queue & Worker operational');
    } catch (err) {
      console.warn('[Boot] ⚠️ Queue init warning:', err instanceof Error ? err.message : err);
    }
  } else {
    console.log('[Boot] 💡 Backend running in Dev Standby mode. Start Docker Desktop (`docker-compose up -d`) to enable full BullMQ persistent scheduling.');
  }

  // 3. Start HTTP server
  const server = app.listen(config.port, () => {
    console.log(`[Boot] 🚀 Server listening on http://localhost:${config.port}`);
    console.log(`[Boot] 🏥 Health check: http://localhost:${config.port}/api/health`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  async function shutdown(signal: string) {
    console.log(`\n[Shutdown] Received ${signal} — shutting down gracefully...`);
    server.close(async () => {
      if (dbConnected) {
        try { await db.$disconnect(); } catch {}
      }
      if (redisConnected) {
        try { const redis = getRedis(); await redis.quit(); } catch {}
      }
      console.log('[Shutdown] Done');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

boot().catch((err) => {
  console.error('[Boot] Fatal boot error:', err);
});
