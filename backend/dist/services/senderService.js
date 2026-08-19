"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDefaultSender = ensureDefaultSender;
exports.getAllSenders = getAllSenders;
exports.getDefaultSenderId = getDefaultSenderId;
const db_1 = require("../db");
const mailerService_1 = require("./mailerService");
/**
 * Ensures at least one Sender exists in the DB.
 * On first boot: creates an Ethereal test account and persists it.
 * On subsequent boots: returns the existing sender.
 *
 * This means Ethereal credentials persist across restarts — critical because
 * Ethereal test accounts are ephemeral and we need the same SMTP credentials
 * for the worker to send emails after a restart.
 */
async function ensureDefaultSender() {
    const existing = await db_1.db.sender.findFirst({
        orderBy: { createdAt: 'asc' },
    });
    if (existing) {
        console.log(`[Sender] Using existing sender: ${existing.email}`);
        return existing.id;
    }
    console.log('[Sender] No sender found — creating Ethereal test account...');
    const ethereal = await (0, mailerService_1.createEtherealAccount)();
    const sender = await db_1.db.sender.create({
        data: {
            name: 'ReachInbox Mailer',
            email: ethereal.email,
            smtpHost: ethereal.smtpHost,
            smtpPort: ethereal.smtpPort,
            smtpUser: ethereal.smtpUser,
            smtpPass: ethereal.smtpPass,
            smtpSecure: ethereal.smtpSecure,
            hourlyLimit: 100,
        },
    });
    console.log(`[Sender] Created Ethereal sender: ${sender.email}`);
    console.log('[Sender] View sent emails at: https://ethereal.email');
    return sender.id;
}
/**
 * Returns all senders (for the compose form dropdown).
 */
async function getAllSenders() {
    return db_1.db.sender.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            hourlyLimit: true,
        },
        orderBy: { createdAt: 'asc' },
    });
}
/**
 * Returns the default sender ID (first created).
 */
async function getDefaultSenderId() {
    const sender = await db_1.db.sender.findFirst({
        orderBy: { createdAt: 'asc' },
    });
    return sender?.id ?? null;
}
//# sourceMappingURL=senderService.js.map