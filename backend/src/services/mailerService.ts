import nodemailer from 'nodemailer';
import type { Sender } from '@prisma/client';

interface SendEmailOptions {
  sender: Sender;
  to: string;
  subject: string;
  html: string;
}

/**
 * Creates a Nodemailer transporter from a Sender's SMTP credentials.
 * For Ethereal test accounts, this will capture the email and return a preview URL.
 */
function createTransporter(sender: Sender) {
  return nodemailer.createTransport({
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
export async function sendEmail(options: SendEmailOptions): Promise<string | null> {
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
  const previewUrl = nodemailer.getTestMessageUrl(info);
  return previewUrl || null;
}

/**
 * Creates a temporary Ethereal test account for demo purposes.
 * Returns an object with the SMTP credentials to store in the DB.
 */
export async function createEtherealAccount(): Promise<{
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  email: string;
}> {
  const testAccount = await nodemailer.createTestAccount();

  return {
    smtpHost: testAccount.smtp.host,
    smtpPort: testAccount.smtp.port,
    smtpUser: testAccount.user,
    smtpPass: testAccount.pass,
    smtpSecure: testAccount.smtp.secure,
    email: testAccount.user, // Ethereal email address
  };
}
