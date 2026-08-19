"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const client_1 = require("@prisma/client");
// Singleton Prisma client — prevents multiple instances in dev (ts-node-dev restarts)
const globalForPrisma = globalThis;
exports.db = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
    });
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.db;
}
//# sourceMappingURL=db.js.map