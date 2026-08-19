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
// ── Middleware ─────────────────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' })); // 10MB for large CSV batches
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, morgan_1.default)(config_1.config.nodeEnv === 'development' ? 'dev' : 'combined'));
// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/emails', emailRoutes_1.default);
app.use('/api', healthRoutes_1.default);
// ── 404 handler ────────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});
// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[Error]', err.message);
    if (config_1.config.nodeEnv === 'development') {
        console.error(err.stack);
    }
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        // Never leak stack traces in production
        ...(config_1.config.nodeEnv === 'development' ? { details: err.message } : {}),
    });
});
// ── Boot sequence ─────────────────────────────────────────────────────────────
async function boot() {
    console.log('[Boot] Starting ReachInbox Email Scheduler backend...');
    // 1. Verify DB connection
    try {
        await db_1.db.$connect();
        console.log('[Boot] PostgreSQL connected');
    }
    catch (err) {
        console.error('[Boot] Failed to connect to PostgreSQL:', err);
        process.exit(1);
    }
    // 2. Verify Redis connection
    try {
        const redis = (0, redis_1.getRedis)();
        await redis.ping();
        console.log('[Boot] Redis connected');
    }
    catch (err) {
        console.error('[Boot] Failed to connect to Redis:', err);
        process.exit(1);
    }
    // 3. Ensure BullMQ queue is ready
    (0, emailQueue_1.getEmailQueue)();
    // 4. Ensure a default sender exists (creates Ethereal account if needed)
    await (0, senderService_1.ensureDefaultSender)();
    // 5. Start the BullMQ worker
    (0, emailWorker_1.startEmailWorker)();
    // 6. ─ RECONCILIATION ─────────────────────────────────────────────────────
    // Re-enqueue any PENDING emails whose BullMQ jobs are missing.
    // This runs on every boot and is idempotent — safe to call multiple times.
    // Protects against Redis data loss (e.g. Redis FLUSHALL between restarts).
    await (0, scheduleService_1.reconcilePendingEmails)();
    // 7. Start HTTP server
    const server = app.listen(config_1.config.port, () => {
        console.log(`[Boot] Server listening on http://localhost:${config_1.config.port}`);
        console.log(`[Boot] Health check: http://localhost:${config_1.config.port}/api/health`);
    });
    // ── Graceful shutdown ──────────────────────────────────────────────────────
    async function shutdown(signal) {
        console.log(`\n[Shutdown] Received ${signal} — shutting down gracefully...`);
        server.close(async () => {
            try {
                await db_1.db.$disconnect();
                console.log('[Shutdown] PostgreSQL disconnected');
            }
            catch { }
            try {
                const redis = (0, redis_1.getRedis)();
                await redis.quit();
                console.log('[Shutdown] Redis disconnected');
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
    console.error('[Boot] Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map