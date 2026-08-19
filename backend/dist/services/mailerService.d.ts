import type { Sender } from '@prisma/client';
interface SendEmailOptions {
    sender: Sender;
    to: string;
    subject: string;
    html: string;
}
/**
 * Sends an email using the sender's SMTP credentials.
 * @returns Preview URL for Ethereal test accounts (null for real SMTP)
 */
export declare function sendEmail(options: SendEmailOptions): Promise<string | null>;
/**
 * Creates a temporary Ethereal test account for demo purposes.
 * Returns an object with the SMTP credentials to store in the DB.
 */
export declare function createEtherealAccount(): Promise<{
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    smtpSecure: boolean;
    email: string;
}>;
export {};
//# sourceMappingURL=mailerService.d.ts.map