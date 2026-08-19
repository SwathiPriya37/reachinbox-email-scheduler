# ReachInbox Email Job Scheduler

A production-grade email job scheduling service with dashboard — built as a full-stack monorepo for the ReachInbox Software Development Internship take-home assignment.

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                   Frontend (Next.js 14)           │
│   Google OAuth → Dashboard → Compose → Tables     │
└───────────────────┬──────────────────────────────┘
                    │ REST API
┌───────────────────▼──────────────────────────────┐
│                   Backend (Express + TypeScript)  │
│                                                   │
│  POST /schedule ──► INSERT emails (Prisma/PG)    │
│                ──► queue.add(jobId, delay)        │
│                                                   │
│  BullMQ Worker                                    │
│    ├── Idempotency: check DB status before send  │
│    ├── Redis INCR: hourly rate cap per sender    │
│    │   └── Exceeded? → job.moveToDelayed(+1hr)  │
│    └── Nodemailer → Ethereal SMTP                │
│                                                   │
│  Boot Reconciliation                              │
│    └── Re-enqueue any PENDING emails missing     │
│        from BullMQ (survives Redis flush)        │
└───────────────────────────────────────────────────┘
         │                    │
    ┌────▼────┐          ┌────▼────┐
    │ Redis 7 │          │ PG 15   │
    │ BullMQ  │          │ Prisma  │
    └─────────┘          └─────────┘
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | TypeScript · Express.js · BullMQ · ioredis |
| Database | PostgreSQL 15 · Prisma ORM |
| Email | Nodemailer · Ethereal Email (test SMTP) |
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Auth | NextAuth.js · Google OAuth |
| Infra | Docker Compose (Redis + Postgres) |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Docker + Docker Compose
- Google OAuth credentials (for frontend auth)

### 1. Clone & configure

```bash
git clone <repo>
cd reachinbox-email-scheduler
cp .env.example backend/.env
cp .env.example frontend/.env.local  # then edit with Google OAuth credentials
```

Edit `frontend/.env.local`:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=your_32_char_secret   # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 2. Start infrastructure

```bash
docker-compose up -d
# Starts: postgres:5432 + redis:6379 (with healthchecks)
```

### 3. Start backend

```bash
cd backend
npm install
npm run db:push      # Apply Prisma schema to DB (creates tables + indexes)
npm run dev          # ts-node-dev with hot reload
```

On first boot, the backend:
1. Connects to PostgreSQL and Redis
2. Creates an Ethereal test SMTP account and seeds one sender row
3. Starts the BullMQ worker (concurrency=5, limiter=10/1000ms)
4. Runs the **reconciliation step** (re-enqueues any PENDING emails missing from BullMQ)
5. Listens on `http://localhost:3001`

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev          # Next.js dev server
```

Visit `http://localhost:3000` → redirected to `/login` → Google OAuth → `/dashboard`

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → **APIs & Services** → **Credentials**
3. **Create OAuth 2.0 Client ID** → Web application
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy `Client ID` and `Client Secret` into `frontend/.env.local`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/reachinbox` | Prisma connection string |
| `REDIS_URL` | `redis://localhost:6379` | ioredis connection string |
| `PORT` | `3001` | Express server port |
| `WORKER_CONCURRENCY` | `5` | BullMQ worker concurrency |
| `RATE_LIMITER_MAX` | `10` | Max jobs per `MIN_DELAY_BETWEEN_SENDS_MS` window |
| `MIN_DELAY_BETWEEN_SENDS_MS` | `1000` | BullMQ limiter window (ms) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Redis hourly cap per sender |
| `MAX_EMAILS_PER_HOUR_GLOBAL` | `500` | Reserved for global cap (future) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `NEXTAUTH_SECRET` | 32+ char random string |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` |

---

## API Reference

### `POST /api/emails/schedule`

Schedule a batch of emails.

```json
{
  "subject": "string (required)",
  "body": "string HTML (required)",
  "recipients": ["email1@ex.com", "email2@ex.com"],
  "startTime": "2026-08-20T10:00:00Z",
  "delayBetweenEmailsMs": 2000,
  "hourlyLimit": 100,
  "senderId": "optional — defaults to seeded sender"
}
```

**Response**: `{ success: true, data: { scheduledCount, jobIds, senderId } }`

### `GET /api/emails/scheduled?page=1&pageSize=20`

Paginated list of `PENDING` emails.

### `GET /api/emails/sent?page=1&pageSize=20`

Paginated list of `SENT` and `FAILED` emails.

### `GET /api/emails/senders`

Returns all configured SMTP senders.

### `GET /api/health`

Health check: `{ status: "healthy", checks: { postgres, redis, bullmq } }`

---

## Scheduling Mechanism (Deep Dive)

### Deterministic Job IDs (Idempotency)

Each email DB row gets a BullMQ job with `jobId = "email-job-{db_id}"`.

**Why this works**: BullMQ silently rejects `queue.add()` calls if a job with that ID already exists in the queue. This means:
- Calling `scheduleEmails()` twice with the same emails won't create duplicates at the queue level.
- The startup reconciliation can safely re-enqueue all pending emails without risk of duplication — BullMQ ignores already-queued jobs.

### Restart Persistence

**Normal process restart** (Redis data intact): BullMQ jobs survive in Redis — no action needed.

**Redis data loss** (FLUSHALL or Redis restart with no persistence): The reconciliation step in `boot()` queries PostgreSQL for all `status: PENDING` rows and re-enqueues any whose BullMQ job no longer exists.

```
Boot:
  1. SELECT * FROM emails WHERE status = 'PENDING'
  2. For each: queue.getJob("email-job-{id}")
     → Job exists: skip (already queued)
     → Job missing: queue.add("email-job-{id}", delay=scheduledTime-now)
```

This guarantees eventual delivery as long as the DB is intact.

### Rate Limiting (Two Layers)

**Layer 1 — BullMQ limiter** (burst throttle):
```
Worker({ limiter: { max: 10, duration: 1000 } })
```
At most 10 jobs fire per 1000ms window. This prevents SMTP flooding.
Configured via `RATE_LIMITER_MAX` + `MIN_DELAY_BETWEEN_SENDS_MS`.

**Layer 2 — Redis hourly counter** (per-sender cap):
```
Key: rate:{senderId}:{hourWindow}    (hourWindow = Math.floor(Date.now() / 3_600_000))
INCR key → count
if count === 1: EXPIRE key 7200      (auto-cleanup after 2 hours)
if count > hourlyLimit: reschedule
```

This counter **persists across worker restarts** (Redis-backed) and **works correctly under multiple worker instances** (INCR is atomic).

**When the cap is exceeded**: `job.moveToDelayed(nextHourStart)` — the job is rescheduled to the start of the next clock hour rather than dropped or failed.

**Trade-off**: All over-limit jobs pile up at the next hour boundary. Under extreme load (10,000 jobs hitting the same limit), they'd cascade forward hour by hour. A more sophisticated approach would spread them evenly, but this implementation is correct and simple.

### Concurrency

Workers process `WORKER_CONCURRENCY` (default: 5) jobs simultaneously. BullMQ manages the worker pool internally — no manual thread management needed. Each concurrent job has its own DB connection via Prisma's connection pool.

### 1000+ Emails at the Same Timestamp

The queue handles bulk inserts efficiently (1000 DB rows + BullMQ jobs in a few seconds). All 1000 jobs will be scheduled for the same timestamp. The BullMQ limiter ensures they fire at a controlled rate (~10/sec by default) rather than all at once. The hourly counter prevents exceeding the sender's cap across the entire batch.

---

## Testing & Verification

### Batch seed script

```bash
cd scripts
npm install
# Schedule 5 emails, start in 10 seconds
npx ts-node seed-emails.ts

# Schedule 10 emails, start in 30 seconds
npx ts-node seed-emails.ts 10 30

# Schedule 1000 emails (load test), start in 60 seconds
npx ts-node seed-emails.ts 1000 60
```

Watch the backend logs for Ethereal preview URLs. View captured emails at https://ethereal.email.

### Restart Persistence Test

```bash
# 1. Schedule emails (future start time)
npx ts-node seed-emails.ts 5 60

# 2. Verify they're pending
curl http://localhost:3001/api/emails/scheduled

# 3. Stop the backend (Ctrl+C)
# 4. Simulate Redis flush
redis-cli FLUSHALL

# 5. Restart backend
npm run dev
# → Logs: "[Reconcile] Re-enqueued email xxx (delay: 45s)"

# 6. Verify emails still fire
curl http://localhost:3001/api/emails/sent
```

### Idempotency Test

Call `POST /api/emails/schedule` twice with the same recipients/time. Each call creates new DB rows (different IDs → different jobIds), so this isn't a true duplicate scenario. To test true deduplication: stop server, restart — reconciliation won't re-enqueue already-queued jobs.

---

## Feature Checklist

### Backend
- [x] `POST /api/emails/schedule` — batch scheduling with BullMQ delayed jobs
- [x] `GET /api/emails/scheduled` — paginated pending list
- [x] `GET /api/emails/sent` — paginated sent/failed list
- [x] Deterministic jobId (`email-job-{db_id}`) for BullMQ idempotency
- [x] Startup reconciliation — re-enqueues missing jobs after Redis flush
- [x] Idempotency guard — worker checks DB status before sending
- [x] BullMQ limiter — burst-rate throttle (Layer 1)
- [x] Redis INCR hourly counter — per-sender cap (Layer 2)
- [x] `job.moveToDelayed()` — reschedules over-limit jobs to next hour
- [x] `WORKER_CONCURRENCY` configurable via env
- [x] Prisma + PostgreSQL with indexes on `status` and `scheduledTime`
- [x] Nodemailer + Ethereal Email — auto-provisioned on first boot
- [x] No cron jobs — all scheduling via BullMQ delayed jobs
- [x] Typed JSON error responses — no unhandled 500s with stack traces

### Frontend
- [x] Google OAuth via NextAuth.js — unauthenticated → `/login`
- [x] Dashboard shell — header with avatar/name/email/logout
- [x] Sidebar — Scheduled / Sent tabs with live counts
- [x] Compose button — always visible
- [x] Compose modal — From, To, Subject, Body, Start time, Delay, Hourly limit
- [x] CSV upload — papaparse, live email count, format validation
- [x] Send Later presets (Tomorrow, 10am, 11am, 3pm) + datetime picker
- [x] Scheduled emails table — loading skeleton, empty state, error state
- [x] Sent emails table — SENT/FAILED badges, loading/empty/error states
- [x] Shared TypeScript types (`lib/types.ts`)
- [x] Typed API layer (`lib/api.ts`)
- [x] Reusable UI components: Button, Input, Modal, Table, Tabs, LoadingSkeleton, EmptyState
- [x] Live polling every 15 seconds

---

## Assumptions & Trade-offs

1. **Ethereal Email**: Emails are captured by Ethereal (not actually delivered). Preview URLs appear in backend logs. This is intentional for the demo.

2. **Email/password login**: The Figma shows email + password fields. These are rendered for visual fidelity but auth is Google OAuth only. Email/password auth would require a credential provider + bcrypt + user table — out of scope for this demo.

3. **Next hour rescheduling**: Over-limit jobs reschedule to the _start_ of the next hour window. Under extreme load, jobs could cascade forward hour by hour. An improvement would be to spread them evenly across the next hour.

4. **Reconciliation delay**: If `scheduledTime` has already passed when the job is re-enqueued (e.g., Redis was down for 2+ hours), the delay becomes 0 and the email fires immediately. This is intentional — better late than never.

5. **Global hourly cap**: `MAX_EMAILS_PER_HOUR_GLOBAL` is read from env but not enforced in the current worker. Per-sender caps are enforced. A global cap would require a separate Redis key.

6. **Rich text editor**: Uses browser `contentEditable` + `document.execCommand` for bold/italic/underline. In production, replace with a proper editor like TipTap or React Quill.

7. **CSV format**: The parser looks for any column value that matches an email regex. This is permissive — add column name validation if needed.

---

## What I'd Do Next

- Add Bull Board UI for BullMQ job monitoring
- Implement global hourly cap enforcement
- Add email preview/detail view (Ethereal URL display in UI)
- Pagination controls in the dashboard tables
- Webhook/callback when emails are sent
- Multi-sender support in the UI
- Proper rich text editor (TipTap)
- Unit tests for scheduleService + emailWorker rate limiting logic
- End-to-end tests with Playwright
