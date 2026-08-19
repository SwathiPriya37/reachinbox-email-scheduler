#!/usr/bin/env ts-node
/**
 * Batch Email Seed Script
 * ━━━━━━━━━━━━━━━━━━━━━━━
 * Schedules a batch of test emails via the REST API to demonstrate
 * the queue/worker/rate-limit/persistence behavior without needing the UI.
 *
 * Usage:
 *   cd scripts
 *   npx ts-node seed-emails.ts [count] [startDelaySecs]
 *
 * Examples:
 *   npx ts-node seed-emails.ts          # 5 emails, 10s from now
 *   npx ts-node seed-emails.ts 10 30    # 10 emails, 30s from now
 *   npx ts-node seed-emails.ts 1000 60  # 1000 emails, 1min from now (load test)
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:3001';

async function main() {
  const count = parseInt(process.argv[2] ?? '5', 10);
  const startDelaySecs = parseInt(process.argv[3] ?? '10', 10);

  const startTime = new Date(Date.now() + startDelaySecs * 1000).toISOString();

  const recipients = Array.from(
    { length: count },
    (_, i) => `test.recipient${i + 1}@example.com`,
  );

  const payload = {
    subject: `Test Batch Email — ${new Date().toLocaleString()}`,
    body: `
      <h2>ReachInbox Test Email</h2>
      <p>This is test email <strong>{{index}}</strong> of ${count}.</p>
      <p>Scheduled at: ${startTime}</p>
      <p>Sent via: ReachInbox Email Scheduler Demo</p>
    `,
    recipients,
    startTime,
    delayBetweenEmailsMs: 2000, // 2s between each send
    hourlyLimit: 100,
  };

  console.log(`\n[Seed] Scheduling ${count} emails...`);
  console.log(`[Seed] Start time: ${startTime}`);
  console.log(`[Seed] Delay between sends: ${payload.delayBetweenEmailsMs}ms`);
  console.log(`[Seed] API: ${API_BASE}/api/emails/schedule\n`);

  const res = await fetch(`${API_BASE}/api/emails/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as {
    success: boolean;
    data?: { scheduledCount: number; jobIds: string[]; senderId: string };
    error?: string;
  };

  if (!res.ok || !json.success) {
    console.error('[Seed] ✗ Failed:', json.error ?? res.statusText);
    process.exit(1);
  }

  const { scheduledCount, senderId } = json.data!;

  console.log(`[Seed] ✓ Scheduled ${scheduledCount} emails`);
  console.log(`[Seed]   Sender ID: ${senderId}`);
  console.log(`\n[Seed] Check status:`);
  console.log(`  GET ${API_BASE}/api/emails/scheduled  — pending emails`);
  console.log(`  GET ${API_BASE}/api/emails/sent        — sent/failed emails`);
  console.log(`  GET ${API_BASE}/api/health             — system health\n`);

  console.log(
    `[Seed] Emails will start sending in ~${startDelaySecs}s. ` +
      `Watch the backend logs for Ethereal preview URLs.`,
  );
}

main().catch((err) => {
  console.error('[Seed] Fatal error:', err.message);
  process.exit(1);
});
