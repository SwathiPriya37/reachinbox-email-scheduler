"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const redis_1 = require("../redis");
const emailQueue_1 = require("../queue/emailQueue");
const router = (0, express_1.Router)();
router.get('/health', async (_req, res) => {
    const checks = {};
    // Check PostgreSQL
    try {
        await db_1.db.$queryRaw `SELECT 1`;
        checks.postgres = 'ok';
    }
    catch {
        checks.postgres = 'error';
    }
    // Check Redis
    try {
        const redis = (0, redis_1.getRedis)();
        await redis.ping();
        checks.redis = 'ok';
    }
    catch {
        checks.redis = 'error';
    }
    // Check BullMQ queue
    try {
        const queue = (0, emailQueue_1.getEmailQueue)();
        await queue.getJobCounts();
        checks.bullmq = 'ok';
    }
    catch {
        checks.bullmq = 'error';
    }
    const allOk = Object.values(checks).every((v) => v === 'ok');
    return res.status(allOk ? 200 : 503).json({
        status: allOk ? 'healthy' : 'degraded',
        checks,
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
//# sourceMappingURL=healthRoutes.js.map