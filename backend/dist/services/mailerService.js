"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.createEtherealAccount = createEtherealAccount;
const nodemailer_1 = __importDefault(require("nodemailer"));
/**
 * Creates a Nodemailer transporter from a Sender's SMTP credentials.
 * For Ethereal test accounts, this will capture the email and return a preview URL.
 */
function createTransporter(sender) {
    return nodemailer_1.default.createTransport({
        host: sender.smtpHost,
        port: sender.smtpPort,
        secure: sender.smtpSecure,
        auth: {
            user: sender.smtpUser,
            pass: sender.smtpPass,
        },
    });
}
/**
 * Sends an email using the sender's SMTP credentials.
 * @returns Preview URL for Ethereal test accounts (null for real SMTP)
 */
async function sendEmail(options) {
    const { sender, to, subject, html } = options;
    const transporter = createTransporter(sender);
    const info = await transporter.sendMail({
        from: `"${sender.name}" <${sender.email}>`,
        to,
        subject,
        html,
        text: html.replace(/<[^>]+>/g, ''), // plain text fallback
    });
    // Ethereal provides a preview URL; real SMTP returns null here
    const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
    return previewUrl || null;
}
/**
 * Creates a temporary Ethereal test account for demo purposes.
 * Returns an object with the SMTP credentials to store in the DB.
 */
async function createEtherealAccount() {
    const testAccount = await nodemailer_1.default.createTestAccount();
    return {
        smtpHost: testAccount.smtp.host,
        smtpPort: testAccount.smtp.port,
        smtpUser: testAccount.user,
        smtpPass: testAccount.pass,
        smtpSecure: testAccount.smtp.secure,
        email: testAccount.user, // Ethereal email address
    };
}
//# sourceMappingURL=mailerService.js.map