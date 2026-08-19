# ReachInbox — Email Job Scheduler

A **production-grade email scheduling service + dashboard** built for the ReachInbox Software Development Internship assignment.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                   Frontend (Next.js 14)                  │
│   Google OAuth → Login → Dashboard → Compose → Tables   │
└────────────────────────┬─────────────────────────────────┘
                         │  REST  (http://localhost:3001)
┌────────────────────────▼─────────────────────────────────┐
│               Backend (Express.js + TypeScript)          │
│                                                          │
│  POST /api/emails/schedule                               │
│    ├── Insert one DB row per recipient (status: PENDING) │
│    └── queue.add({ jobId, delay })  ← BullMQ delayed job │
│                                                          │
│  BullMQ Worker (concurrency=5)                           │
│    ├── Layer 1 limiter: max 10 jobs / 1000 ms window     │
│    ├── Layer 2: Redis INCR hourly counter per sender     │
│    │     exceeded? → job.moveToDelayed(next hour)        │
│    ├── Idempotency: check DB status before send          │
│    └── Nodemailer → Ethereal SMTP (test) or SendGrid     │
│                                                          │
│  Boot Reconciliation (on every restart)                  │
│    └── SELECT PENDING emails → re-enqueue missing jobs   │
└────────────────────────────────────────────────────────────┘
         │                           │
    ┌────▼────┐                 ┌────▼────┐
    │ Redis 7 │                 │ PG 15   │
    │ (BullMQ)│                 │ (Prisma)│
    └─────────┘                 └─────────┘
```

---

## How Scheduling Works

1. Client calls `POST /api/emails/schedule` with subject, body, recipients[], startTime, delayBetweenEmailsMs.
2. The backend inserts one `Email` row per recipient into PostgreSQL (`status: PENDING`).
3. For each email, a BullMQ job is added to the queue with a deterministic `jobId = "email-job-{db_id}"` and a computed `delay = scheduledTime - now`.
4. BullMQ stores the delayed job in Redis and fires it at exactly the right moment.
5. The worker picks up the job, verifies the DB status (idempotency), checks the hourly rate counter in Redis, then sends via Nodemailer/SMTP.
6. On success, the DB row is updated to `status: SENT`; on failure, `status: FAILED`.

**No cron jobs are used anywhere** — all scheduling is handled purely by BullMQ's built-in delayed job mechanism.

---

## How Persistence on Restart is Handled

**Normal restart** (Redis intact): BullMQ jobs are stored in Redis and survive a plain process restart automatically. No action needed.

**Redis data loss** (e.g. `FLUSHALL`, Redis container restart with no AOF/RDB): On every server boot, the `reconcilePendingEmails()` function runs:

```
Boot:
  1. SELECT * FROM emails WHERE status = 'PENDING'
  2. For each pending email:
       existingJob = await queue.getJob("email-job-{id}")
       if job exists  → skip (already queued)
       if job missing → queue.add("email-job-{id}", delay = scheduledTime - now)
```

This is safe to call multiple times — BullMQ silently rejects duplicate jobIds, so no double-sends occur. The PostgreSQL DB is the source of truth; Redis is the execution engine.

---

## How Rate Limiting & Concurrency Are Implemented

### Worker Concurrency

```ts
new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
  connection: createRedisConnection(),
  concurrency: config.worker.concurrency,  // default: 5, set via WORKER_CONCURRENCY env
  limiter: { ... },
})
```

Configurable via the `WORKER_CONCURRENCY` env variable. Multiple jobs run in parallel safely — each job uses its own DB connection via Prisma's connection pool.

### Layer 1 — Burst Throttle (BullMQ Limiter)

```ts
limiter: {
  max: config.worker.rateLimiterMax,          // default: 10,  env: RATE_LIMITER_MAX
  duration: config.worker.minDelayBetweenSendsMs, // default: 1000ms, env: MIN_DELAY_BETWEEN_SENDS_MS
}
```

At most **10 jobs fire per 1000 ms window** globally. This prevents SMTP flooding and mimics provider throttling. The minimum effective delay between individual sends is ~100 ms (1000ms ÷ 10).

### Layer 2 — Hourly Rate Cap (Redis-backed, per-sender)

```
Key: rate:{senderId}:{hourWindow}
     (hourWindow = Math.floor(Date.now() / 3_600_000) — unique integer per clock hour)

On each job execution:
  count = INCR rate:{senderId}:{hourWindow}
  if count === 1: EXPIRE key 7200  ← auto-cleanup after 2 hours
  if count > hourlyLimit:
      DECR key                          ← undo the increment
      job.moveToDelayed(nextHourStart)  ← reschedule, do NOT drop
      return                            ← worker exits cleanly
```

- Limit is configurable via `MAX_EMAILS_PER_HOUR_PER_SENDER` (default: 100).
- Counter is atomic (`INCR`) and safe across multiple worker instances.
- Over-limit jobs are **never dropped or permanently failed** — they are moved to the next clock-hour boundary via `job.moveToDelayed()`.

### Behaviour Under Load (1000+ emails)

- 1000 DB rows + BullMQ jobs are inserted in a fast sequential loop (a few seconds).
- The BullMQ limiter fires them at ~10/sec rather than all at once.
- Once the hourly cap is hit, remaining jobs cascade to the next hour.
- Trade-off: all over-limit jobs pile at the next hour boundary. A more sophisticated approach would spread them evenly — noted as a future improvement in the README.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | TypeScript · Express.js · BullMQ · ioredis |
| Database | PostgreSQL 15 · Prisma ORM |
| Email (test) | Nodemailer · Ethereal Email (fake SMTP) |
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Auth | NextAuth.js · Google OAuth |
| Infra | Docker Compose (Redis + PostgreSQL) |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop (for Redis + PostgreSQL)
- Google OAuth credentials (for real Google login)

---

### 1. Clone & Install

```bash
git clone https://github.com/SwathiPriya37/reachinbox-email-scheduler.git
cd reachinbox-email-scheduler
```

---

### 2. Configure Environment Variables

**Backend** — copy and edit:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reachinbox"

# Redis
REDIS_URL="redis://localhost:6379"

# Server
PORT=3001
NODE_ENV=development

# Worker / Rate Limiting (all configurable)
WORKER_CONCURRENCY=5
RATE_LIMITER_MAX=10
MIN_DELAY_BETWEEN_SENDS_MS=1000
MAX_EMAILS_PER_HOUR_PER_SENDER=100
MAX_EMAILS_PER_HOUR_GLOBAL=500
```

**Frontend** — create:

```bash
# frontend/.env.local
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
NEXTAUTH_SECRET=any_random_32_char_string_here
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

### 3. How to Set Up Ethereal Email

Ethereal Email is a **free fake SMTP service** — emails are captured and never actually delivered. It is used for testing without a real email provider.

**No manual setup needed!** On first backend boot, if no sender exists in the database, the `ensureDefaultSender()` function automatically:

1. Calls `nodemailer.createTestAccount()` to generate a fresh Ethereal account.
2. Stores the SMTP credentials (`host`, `port`, `user`, `pass`) in the `senders` table.
3. Uses those credentials for all subsequent email sends.

After emails are sent, **preview URLs** appear in the backend terminal logs:

```
[Worker] ✓ Email sent — Preview: https://ethereal.email/message/xxx
```

Open that URL in your browser to see the captured email.

> **To use a real SMTP provider (e.g. SendGrid):** Insert a row into the `senders` table with your SMTP credentials. The system will use those automatically.

---

### 4. Start Infrastructure (Docker)

```bash
# From the root of the project
docker-compose up -d
# Starts PostgreSQL (port 5432) + Redis (port 6379)
```

---

### 5. Run the Backend

```bash
cd backend
npm install
npm run db:push     # Apply Prisma schema to PostgreSQL (creates tables + indexes)
npm run db:seed     # Create the default Ethereal sender account in DB
npm run dev         # Start Express server + BullMQ worker (ts-node-dev, hot reload)
```

On startup, you will see:

```
[Boot] ✓ PostgreSQL connected
[Boot] ✓ Redis connected
[Boot] ✓ BullMQ Queue & Worker operational
[Boot] 🚀 Server listening on http://localhost:3001
[Reconcile] No pending emails — nothing to reconcile
```

---

### 6. Run the Frontend

```bash
cd frontend
npm install
npm run dev         # Next.js dev server
```

Visit: **http://localhost:3000**

- Unauthenticated users → redirected to `/login`
- Login with **Google OAuth** or click **⚡ Quick Demo Login** (dev shortcut)
- Redirected to `/dashboard` after login

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create a project → **APIs & Services** → **Credentials**.
3. Click **Create OAuth 2.0 Client ID** → **Web application**.
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy **Client ID** and **Client Secret** into `frontend/.env.local`.

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/reachinbox` | Prisma connection string |
| `REDIS_URL` | `redis://localhost:6379` | ioredis connection |
| `PORT` | `3001` | Express server port |
| `NODE_ENV` | `development` | Environment mode |
| `WORKER_CONCURRENCY` | `5` | BullMQ worker concurrency |
| `RATE_LIMITER_MAX` | `10` | Max jobs per `MIN_DELAY_BETWEEN_SENDS_MS` window |
| `MIN_DELAY_BETWEEN_SENDS_MS` | `1000` | BullMQ burst limiter window (ms) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Redis hourly cap per sender |
| `MAX_EMAILS_PER_HOUR_GLOBAL` | `500` | Reserved for global hourly cap |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `NEXTAUTH_SECRET` | Any random 32+ character string |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` |

---

## API Reference

### `POST /api/emails/schedule`
Schedule a batch of emails.

```json
{
  "subject": "Hello from ReachInbox",
  "body": "<p>Your email body here</p>",
  "recipients": ["user1@example.com", "user2@example.com"],
  "startTime": "2026-08-20T10:00:00Z",
  "delayBetweenEmailsMs": 2000,
  "hourlyLimit": 100,
  "senderId": "optional-uuid"
}
```

**Response:** `{ success: true, data: { scheduledCount, jobIds, senderId } }`

### `GET /api/emails/scheduled?page=1&pageSize=20`
Paginated list of `PENDING` emails.

### `GET /api/emails/sent?page=1&pageSize=20`
Paginated list of `SENT` and `FAILED` emails.

### `GET /api/emails/senders`
Returns all configured SMTP senders.

### `GET /api/health`
Health check: `{ status: "healthy", checks: { postgres, redis, bullmq } }`

---

## Features Implemented

### Backend

| Feature | Implementation |
|---------|---------------|
| **Scheduler** | `POST /api/emails/schedule` inserts DB rows + BullMQ delayed jobs with `jobId = "email-job-{id}"` |
| **No cron jobs** | 100% BullMQ delayed jobs, zero cron/agenda/node-cron usage |
| **Persistence** | Boot reconciliation re-enqueues PENDING emails missing from BullMQ after Redis flush |
| **Idempotency** | Deterministic jobIds + DB status check in worker before send |
| **Concurrency** | BullMQ worker with configurable `WORKER_CONCURRENCY` (default 5) |
| **Burst throttle** | BullMQ `limiter: { max: 10, duration: 1000 }` — at most 10 sends/sec |
| **Hourly rate limit** | Redis INCR counter keyed `rate:{senderId}:{hourWindow}`, atomic across workers |
| **No job dropping** | `job.moveToDelayed(nextHourTimestamp())` when hourly cap exceeded |
| **Ethereal SMTP** | Auto-provisioned via `nodemailer.createTestAccount()` on first boot |
| **Multi-sender** | Senders table in DB; each email linked to a sender; per-sender rate limits |
| **Health check** | `/api/health` reports postgres + redis + bullmq status |
| **Graceful shutdown** | SIGTERM/SIGINT handlers close DB + Redis connections cleanly |

### Frontend

| Feature | Implementation |
|---------|---------------|
| **Google Login** | NextAuth.js with `GoogleProvider` — real OAuth flow |
| **Demo Login** | Credentials provider fallback for local dev without OAuth setup |
| **Header** | User avatar, name, email, logout dropdown |
| **Dashboard** | Sidebar with Scheduled/Sent tabs + live counts |
| **Compose modal** | From (sender), To (chips/CSV upload), Subject, Body, Start time, Delay, Hourly limit |
| **CSV upload** | papaparse parses email column, shows count, validates addresses |
| **Rich text editor** | contentEditable + toolbar (Bold, Italic, Underline, Strike, Lists, Align, Attach) |
| **Send Later** | Presets (Tomorrow 9AM/10AM/11AM/3PM) + datetime picker |
| **Scheduled table** | Loading skeleton, empty state, error state, paginated |
| **Sent table** | SENT/FAILED status badges, loading/empty/error states |
| **Live polling** | Automatic 15-second refresh of both tables |
| **Toast notifications** | react-hot-toast for success/error feedback |
| **TypeScript** | Full types/interfaces for all API responses, component props |
| **Reusable components** | Button, Input, Modal, Table, Tabs, LoadingSkeleton, EmptyState |

---

## Testing & Verification

### Restart Persistence Test

```bash
# 1. Schedule emails (2 minutes from now)
curl -X POST http://localhost:3001/api/emails/schedule \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test","body":"<p>Hello</p>","recipients":["test@example.com"],"startTime":"'$(date -u -d '+2 minutes' +%Y-%m-%dT%H:%M:%SZ)'"}'

# 2. Verify pending
curl http://localhost:3001/api/emails/scheduled

# 3. Stop backend (Ctrl+C) and flush Redis
redis-cli FLUSHALL

# 4. Restart backend
npm run dev
# → Logs show: [Reconcile] Re-enqueued email xxx (delay: ~120s)

# 5. Wait for scheduled time — email fires and moves to Sent
curl http://localhost:3001/api/emails/sent
```

### Load Test (1000 emails)

```bash
cd scripts
npm install
npx ts-node seed-emails.ts 1000 60  # 1000 emails, start in 60 seconds
```

Watch backend logs — BullMQ limiter fires at ~10/sec. When hourly cap is hit, jobs move to next hour.

---

## Assumptions & Trade-offs

1. **Ethereal Email**: Emails are captured by Ethereal and not actually delivered. Preview URLs appear in backend logs. This is the intended behavior for the demo assignment.

2. **Next-hour rescheduling**: Over-limit jobs are rescheduled to the *start* of the next hour window. Under extreme load, jobs could cascade hour-by-hour. A production improvement would spread them evenly across the window.

3. **Google OAuth**: Requires a configured Google Cloud project. A credentials fallback (Demo Login) is provided for local development without OAuth setup.

4. **Rich text editor**: Uses browser `contentEditable` + `document.execCommand` for formatting. In production, replace with TipTap or Slate.js.

5. **Global hourly cap**: `MAX_EMAILS_PER_HOUR_GLOBAL` is read from config but enforcement is per-sender. Adding a global cap would require one additional Redis key.

6. **Reconciliation delay**: If `scheduledTime` passed while the server was down, `delay` becomes 0 and the email fires immediately on reconnect. "Better late than never."

---

## What I'd Add Next

- Bull Board UI for live job monitoring
- Webhook/notification when email is delivered
- Email preview in dashboard (show Ethereal URL)
- Unit tests for rate-limiting logic (Jest)
- End-to-end tests (Playwright)
- Global hourly cap enforcement
- Pagination controls in dashboard tables
- Proper rich text editor (TipTap)
