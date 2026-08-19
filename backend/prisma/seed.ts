import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createEtherealAccount } from '../src/services/mailerService';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  // Clear existing senders to apply the new SendGrid ones
  await prisma.sender.deleteMany({});
  console.log('[Seed] Cleared existing senders.');

  console.log('[Seed] Creating SendGrid sender account...');
  
  const sender = await prisma.sender.create({
    data: {
      name: 'ReachInbox',
      email: 'rswathipriya3@gmail.com', // Your verified SendGrid email
      smtpHost: 'smtp.sendgrid.net',
      smtpPort: 587,
      smtpUser: 'apikey',
      smtpPass: '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',
      smtpSecure: false,
      hourlyLimit: 100,
    },
  });

  console.log(`[Seed] ✓ Created SendGrid sender: ${sender.email}`);
  console.log(`[Seed] Sender ID: ${sender.id}`);
  console.log('[Seed] Done');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
