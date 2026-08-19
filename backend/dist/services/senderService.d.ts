/**
 * Ensures at least one Sender exists in the DB.
 * On first boot: creates an Ethereal test account and persists it.
 * On subsequent boots: returns the existing sender.
 *
 * This means Ethereal credentials persist across restarts — critical because
 * Ethereal test accounts are ephemeral and we need the same SMTP credentials
 * for the worker to send emails after a restart.
 */
export declare function ensureDefaultSender(): Promise<string>;
/**
 * Returns all senders (for the compose form dropdown).
 */
export declare function getAllSenders(): Promise<{
    email: string;
    name: string;
    id: string;
    hourlyLimit: number | null;
}[]>;
/**
 * Returns the default sender ID (first created).
 */
export declare function getDefaultSenderId(): Promise<string | null>;
//# sourceMappingURL=senderService.d.ts.map