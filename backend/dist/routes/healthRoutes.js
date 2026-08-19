"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const redis_1 = require("../redis");
const router = (0, express_1.Router)();
router.get('/health', async (_req, res) => {
    let database = false;
    let redis = false;
    // Check PostgreSQL
    try {
        await db_1.db.$queryRaw `SELECT 1`;
        database = true;
    }
    catch {
        database = false;
    }
    // Check Redis
    try {
        const r = (0, redis_1.getRedis)();
        await r.ping();
        redis = true;
    }
    catch {
        redis = false;
    }
    // Check BullMQ queue (only if redis is up)
    let queue = false;
    if (redis) {
        try {
            // Dynamically import to avoid circular init issues
            const { getEmailQueue } = await Promise.resolve().then(() => __importStar(require('../queue/emailQueue')));
            await getEmailQueue().getJobCounts();
            queue = true;
        }
        catch {
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
exports.default = router;
//# sourceMappingURL=healthRoutes.js.map