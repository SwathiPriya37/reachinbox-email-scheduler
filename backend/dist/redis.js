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
            lazyConnect: true,
            retryStrategy: (times) => {
                if (times > 3)
                    return null; // Stop retrying after 3 attempts if offline
                return 1000;
            },
        });
        redisInstance.on('connect', () => {
            console.log('[Redis] Connected');
        });
        redisInstance.on('error', () => {
            // Quiet handler for dev mode when Redis is offline
        });
    }
    return redisInstance;
}
// Dedicated connection for BullMQ
function createRedisConnection() {
    const r = new ioredis_1.default(config_1.config.redis.url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times) => {
            if (times > 3)
                return null;
            return 1000;
        },
    });
    r.on('error', () => { });
    return r;
}
//# sourceMappingURL=redis.js.map