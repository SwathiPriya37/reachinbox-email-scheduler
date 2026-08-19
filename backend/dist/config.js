"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(name) {
    const val = process.env[name];
    if (!val)
        throw new Error(`Missing required environment variable: ${name}`);
    return val;
}
function optionalEnv(name, defaultValue) {
    return process.env[name] ?? defaultValue;
}
exports.config = {
    port: parseInt(optionalEnv('PORT', '3001'), 10),
    database: {
        url: requireEnv('DATABASE_URL'),
    },
    redis: {
        url: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
    },
    worker: {
        concurrency: parseInt(optionalEnv('WORKER_CONCURRENCY', '5'), 10),
        rateLimiterMax: parseInt(optionalEnv('RATE_LIMITER_MAX', '10'), 10),
        minDelayBetweenSendsMs: parseInt(optionalEnv('MIN_DELAY_BETWEEN_SENDS_MS', '1000'), 10),
    },
    rateLimit: {
        maxEmailsPerHourPerSender: parseInt(optionalEnv('MAX_EMAILS_PER_HOUR_PER_SENDER', '100'), 10),
        maxEmailsPerHourGlobal: parseInt(optionalEnv('MAX_EMAILS_PER_HOUR_GLOBAL', '500'), 10),
    },
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
};
//# sourceMappingURL=config.js.map