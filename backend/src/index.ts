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

// ── Service initialization (queue + worker + reconcile) ───────────────────────
let servicesInitialized = false;

async function initServices(): Promise<boolean> {
  if (servicesInitialized) return true;

  let dbOk = false;
  let redisOk = false;

  try {
    // 6s timeout — enough for Supabase + Upstash TLS handshake over internet
    await withTimeout(db.$connect(), 6000);
    dbOk = true;
    console.log('[Services] ✓ PostgreSQL connected');
  } catch {
    console.warn('[Services] ✗ PostgreSQL not reachable within 6s');
  }

  try {
    const redis = getRedis();
    await withTimeout(redis.ping(), 6000);
    redisOk = true;
    console.log('[Services] ✓ Redis connected');
  } catch {
    console.warn('[Services] ✗ Redis not reachable within 6s');
  }

  if (!dbOk || !redisOk) return false;

  try {
    getEmailQueue();
    await ensureDefaultSender();
    startEmailWorker();
    await reconcilePendingEmails();
    servicesInitialized = true;
    console.log('[Services] ✓ BullMQ Queue & Worker operational');
    console.log('[Services] ✓ Pending emails reconciled — future emails will be delivered on schedule');
    return true;
  } catch (err) {
    console.warn('[Services] ⚠️ Init warning:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Retry service initialization every 15s until successful.
 * This handles cloud services (Supabase, Upstash) that may not respond
 * within the initial boot window due to TLS handshake or cold-start delays.
 */
function scheduleServiceRetry() {
  let attempt = 1;
  const interval = setInterval(async () => {
    console.log(`[Services] Retry attempt ${attempt} — trying to connect to DB + Redis...`);
    const ok = await initServices();
    if (ok) {
      console.log(`[Services] ✓ Services initialized on retry attempt ${attempt}`);
      clearInterval(interval);
    }
    attempt++;
    if (attempt > 20) {
      // Give up after 5 minutes of retries
      console.error('[Services] ✗ Could not initialize services after 20 attempts. Check your DATABASE_URL and REDIS_URL.');
      clearInterval(interval);
    }
  }, 15_000);
}

// ── Boot sequence ────────────────────────────────────────────────────────────
async function boot() {
  console.log('======================================================');
  console.log('   ReachInbox Email Scheduler Backend Service');
  console.log('======================================================');

  // 1. Start HTTP server immediately (health checks work from the very start)
  const server = app.listen(config.port, () => {
    console.log(`[Boot] 🚀 Server listening on http://localhost:${config.port}`);
    console.log(`[Boot] 🏥 Health check: http://localhost:${config.port}/api/health`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[Boot] ⚠️  Port ${config.port} is already in use!`);
      console.error(`[Boot] 💡 The backend server is ALREADY running on http://localhost:${config.port}`);
      console.error(`[Boot] 💡 You do not need to run 'npm run dev' again.\n`);
      process.exit(1);
    } else {
      console.error('[Boot] Server error:', err);
    }
  });

  // 2. Try to initialize services (DB + Redis + Worker + Reconcile)
  console.log('[Boot] Connecting to PostgreSQL and Redis (6s timeout per service)...');
  const ok = await initServices();

  if (ok) {
    console.log('[Boot] ✓ All services initialized on first attempt');
  } else {
    console.log('[Boot] ⚠️  Could not connect to DB or Redis within 6s.');
    console.log('[Boot] 💡 HTTP is running but emails will NOT be delivered until services connect.');
    console.log('[Boot] 🔄 Will retry every 15s — no action needed.');
    scheduleServiceRetry();
  }

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  async function shutdown(signal: string) {
    console.log(`\n[Shutdown] Received ${signal} — shutting down gracefully...`);
    server.close(async () => {
      try { await db.$disconnect(); } catch {}
      try { const redis = getRedis(); await redis.quit(); } catch {}
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
