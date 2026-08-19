import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createEtherealAccount } from '../src/services/mailerService';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  // Check if a sender already exists
  const existing = await prisma.sender.findFirst();
  if (existing) {
    console.log(`[Seed] Sender already exists: ${existing.email} — skipping`);
    return;
  }

  console.log('[Seed] Creating Ethereal test account...');
  const ethereal = await createEtherealAccount();

  const sender = await prisma.sender.create({
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

  console.log(`[Seed] ✓ Created sender: ${sender.email}`);
  console.log(`[Seed] Sender ID: ${sender.id}`);
  console.log('[Seed] View sent emails at: https://ethereal.email');
  console.log('[Seed] Done');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
