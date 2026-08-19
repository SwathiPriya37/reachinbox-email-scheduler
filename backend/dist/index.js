"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const config_1 = require("./config");
const db_1 = require("./db");
const redis_1 = require("./redis");
const emailQueue_1 = require("./queue/emailQueue");
const emailWorker_1 = require("./queue/emailWorker");
const senderService_1 = require("./services/senderService");
const scheduleService_1 = require("./services/scheduleService");
const emailRoutes_1 = __importDefault(require("./routes/emailRoutes"));
const healthRoutes_1 = __importDefault(require("./routes/healthRoutes"));
const app = (0, express_1.default)();
function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)),
    ]);
}
// ── CORS & Security Middleware ───────────────────────────────────────────────
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: true, // Allow all origins in dev mode for easy local testing
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' })); // 10MB for large CSV batches
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, morgan_1.default)(config_1.config.nodeEnv === 'development' ? 'dev' : 'combined'));
// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/emails', emailRoutes_1.default);
app.use('/api', healthRoutes_1.default);
// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});
// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[Error]', err.message);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        ...(config_1.config.nodeEnv === 'development' ? { details: err.message } : {}),
    });
});
// ── Service initialization (queue + worker + reconcile) ───────────────────────
let servicesInitialized = false;
async function initServices() {
    if (servicesInitialized)
        return true;
    let dbOk = false;
    let redisOk = false;
    try {
        // 6s timeout — enough for Supabase + Upstash TLS handshake over internet
        await withTimeout(db_1.db.$connect(), 6000);
        dbOk = true;
        console.log('[Services] ✓ PostgreSQL connected');
    }
    catch {
        console.warn('[Services] ✗ PostgreSQL not reachable within 6s');
    }
    try {
        const redis = (0, redis_1.getRedis)();
        await withTimeout(redis.ping(), 6000);
        redisOk = true;
        console.log('[Services] ✓ Redis connected');
    }
    catch {
        console.warn('[Services] ✗ Redis not reachable within 6s');
    }
    if (!dbOk || !redisOk)
        return false;
    try {
        (0, emailQueue_1.getEmailQueue)();
        await (0, senderService_1.ensureDefaultSender)();
        (0, emailWorker_1.startEmailWorker)();
        await (0, scheduleService_1.reconcilePendingEmails)();
        servicesInitialized = true;
        console.log('[Services] ✓ BullMQ Queue & Worker operational');
        console.log('[Services] ✓ Pending emails reconciled — future emails will be delivered on schedule');
        return true;
    }
    catch (err) {
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
    }, 15000);
}
// ── Boot sequence ────────────────────────────────────────────────────────────
async function boot() {
    console.log('======================================================');
    console.log('   ReachInbox Email Scheduler Backend Service');
    console.log('======================================================');
    // 1. Start HTTP server immediately (health checks work from the very start)
    const server = app.listen(config_1.config.port, () => {
        console.log(`[Boot] 🚀 Server listening on http://localhost:${config_1.config.port}`);
        console.log(`[Boot] 🏥 Health check: http://localhost:${config_1.config.port}/api/health`);
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n[Boot] ⚠️  Port ${config_1.config.port} is already in use!`);
            console.error(`[Boot] 💡 The backend server is ALREADY running on http://localhost:${config_1.config.port}`);
            console.error(`[Boot] 💡 You do not need to run 'npm run dev' again.\n`);
            process.exit(1);
        }
        else {
            console.error('[Boot] Server error:', err);
        }
    });
    // 2. Try to initialize services (DB + Redis + Worker + Reconcile)
    console.log('[Boot] Connecting to PostgreSQL and Redis (6s timeout per service)...');
    const ok = await initServices();
    if (ok) {
        console.log('[Boot] ✓ All services initialized on first attempt');
    }
    else {
        console.log('[Boot] ⚠️  Could not connect to DB or Redis within 6s.');
        console.log('[Boot] 💡 HTTP is running but emails will NOT be delivered until services connect.');
        console.log('[Boot] 🔄 Will retry every 15s — no action needed.');
        scheduleServiceRetry();
    }
    // ── Graceful shutdown ──────────────────────────────────────────────────────
    async function shutdown(signal) {
        console.log(`\n[Shutdown] Received ${signal} — shutting down gracefully...`);
        server.close(async () => {
            try {
                await db_1.db.$disconnect();
            }
            catch { }
            try {
                const redis = (0, redis_1.getRedis)();
                await redis.quit();
            }
            catch { }
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
//# sourceMappingURL=index.js.map