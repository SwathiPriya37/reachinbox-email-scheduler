"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
exports.createRedisConnection = createRedisConnection;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("./config");
let redisInstance = null;
function getRedis() {
    if (!redisInstance) {
        redisInstance = new ioredis_1.default(config_1.config.redis.url, {
            maxRetriesPerRequest: null, // required by BullMQ
            enableReadyCheck: false, // required by BullMQ
            lazyConnect: false,
        });
        redisInstance.on('connect', () => {
            console.log('[Redis] Connected');
        });
        redisInstance.on('error', (err) => {
            console.error('[Redis] Connection error:', err.message);
        });
    }
    return redisInstance;
}
// Dedicated connection for BullMQ (it needs its own connection)
function createRedisConnection() {
    return new ioredis_1.default(config_1.config.redis.url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
}
//# sourceMappingURL=redis.js.map