# Smart Queue & Appointment Management System with AI Chatbot

A full-stack, real-time appointment booking and queue management platform with an
LLM-powered chatbot that books, cancels and reschedules appointments through
authenticated backend tool calls (not by inventing answers).

## 1. Project structure

```
smart-queue-system/
├── docker-compose.yml          # Postgres for local development
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Full relational schema
│   │   └── seed.js             # Demo org/services/slots/users
│   ├── src/
│   │   ├── app.js              # Express app (middleware + routes)
│   │   ├── index.js            # HTTP + Socket.IO server entrypoint
│   │   ├── config/db.js        # Prisma client singleton
│   │   ├── middleware/         # auth (JWT + RBAC), validation (Zod), errors
│   │   ├── routes/              # REST endpoints per resource
│   │   ├── controllers/        # HTTP request/response handlers
│   │   ├── services/           # Business logic (booking, queue, notifications, wait-time)
│   │   ├── ai/                 # LLM client, tool definitions, chat controller
│   │   ├── sockets/            # Socket.IO auth + room management
│   │   └── utils/
│   └── tests/                  # Jest + Supertest (unit + concurrency integration test)
└── frontend/
    └── src/
        ├── api/client.js       # Axios instance with auth + refresh interceptor
        ├── store/              # Zustand auth store, Socket.IO connection helper
        ├── components/         # Navbar, NotificationBell, ChatWidget, ProtectedRoute
        └── pages/              # Landing, Login, Register, Customer/Staff/Admin dashboards, Booking, QueueTracking
```

## 2. How each major feature works

**Authentication & authorization** — `backend/src/middleware/auth.js`,
`services/jwt.service.js`. Passwords are hashed with bcrypt (cost 12). Access
tokens are short-lived JWTs (15m default); refresh tokens are random 96-char
secrets stored in the `RefreshToken` table with rotation on every use (old
token is revoked, a new one issued) — see `POST /api/auth/refresh`.
Role-based access control (`CUSTOMER`/`STAFF`/`ADMIN`) is enforced with the
`authorize(...roles)` middleware on every sensitive route.

**Concurrency-safe booking** — `backend/src/services/appointments.service.js`.
Booking a slot runs inside a Postgres transaction that issues
`SELECT ... FOR UPDATE` on the target `AppointmentSlot` row before checking
`bookedCount < capacity`. Two simultaneous requests for the last seat are
serialized by the row lock: the first commit wins, the second sees the
updated `bookedCount` and is rejected with `409 Conflict`. The same pattern
locks the `Queue` row before incrementing `lastToken`, so token numbers are
never duplicated under concurrent load. See
`backend/tests/booking-concurrency.test.js` for an automated proof (fires two
bookings at once and asserts exactly one succeeds).

**Digital tokens & queues** — `services/queue.service.js`. Each service has
one `Queue` row per calendar day; `lastToken` is an atomic counter
incremented inside the locked transaction, producing labels like `A-27`.
`QueueEntry` rows track `WAITING → IN_SERVICE → COMPLETED` (or `SKIPPED` /
`CANCELLED`), and positions are recomputed (`reindexPositions`) whenever an
entry leaves the waiting set.

**Real-time updates** — `backend/src/sockets/index.js` +
`services/notification.service.js`. Socket.IO authenticates connections with
the same JWT used for REST calls. Clients join `user:<id>` (personal
notifications) and `queue:<serviceId>` (live queue) rooms. Every booking,
cancellation, reschedule, and staff queue action broadcasts a fresh queue
snapshot (`queue:updated`) and/or a personal event (`token:called`,
`notification:new`) to the relevant rooms — the frontend never has to poll
(a 15s fallback poll is used only as a safety net).

**Wait-time estimation** — `services/waitTime.service.js`. Implements
`estimatedWait = peopleAhead × averageServiceMinutes`, adjusted for the
remaining time of whichever entry is currently `IN_SERVICE`. The chatbot and
the queue-tracking UI both read this same computed value — neither is
allowed to invent it.

**AI chatbot with tool calling** — `backend/src/ai/`. `tools.js` defines the
8 tools from the spec (`getAvailableServices`, `getAvailableSlots`,
`getMyAppointments`, `getQueueStatus`, `createAppointment`,
`cancelAppointment`, `rescheduleAppointment`, `getOrganizationInformation`).
`chatController.js` runs the tool-calling loop against an LLM provider: the
model can only retrieve or mutate data via these functions, which are called
with the **authenticated user's id from the verified JWT** — never an id
supplied by the model. Booking/cancel/reschedule tools require
`confirm:true`, and the system prompt instructs the model to only pass that
after the user has explicitly agreed in plain language; the backend
independently re-validates capacity and ownership regardless of what the
model asked for.

**Admin analytics** — `controllers/admin.controller.js` computes real
aggregates (totals, completed/cancelled counts, live waiting count, average
wait time from actually completed queue entries) rather than static numbers.

## 3. Tech stack

React (Vite) + Tailwind · Zustand · Node.js/Express · PostgreSQL + Prisma ·
Socket.IO · JWT/bcrypt · Zod · an LLM API with tool/function calling ·
Jest/Supertest.

The chat integration (`backend/src/ai/llmClient.js`) is written against a
Messages-style tool-calling API; swap in any provider's SDK that supports
the same tool-call/tool-result message shape by changing that one file.

Redis/BullMQ, email/SMS notifications, and RAG-based knowledge retrieval are
intentionally left out of this MVP (see §22 of the spec's "advanced version"
column) — the architecture (service layer + Socket.IO rooms) supports adding
them later without rework.

## 4. Environment variables

**backend/.env** (copy from `backend/.env.example`):

```
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smart_queue?schema=public"
JWT_ACCESS_SECRET=change_this_access_secret
JWT_REFRESH_SECRET=change_this_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
LLM_API_KEY=your-llm-provider-api-key
LLM_MODEL=your-llm-provider-model-id
```

**frontend/.env** (copy from `frontend/.env.example`):

```
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```

If `LLM_API_KEY` or `LLM_MODEL` is not set, every other feature works
normally; the chatbot endpoint returns a clear `503` instead of failing
silently.

## 5. Database setup

You need a running PostgreSQL instance. Easiest path (Docker):

```bash
docker compose up -d          # from the repo root — starts Postgres on :5432
```

Or point `DATABASE_URL` at any existing Postgres instance (local install or
a managed service like Neon/Supabase/RDS).

Then, from `backend/`:

```bash
npm install
npx prisma migrate dev --name init   # creates tables
npm run seed                          # demo org, services, slots, and 3 accounts
```

Seeded accounts (password `Password123!` for all):
- `admin@smartqueue.dev` — ADMIN
- `staff@smartqueue.dev` — STAFF (assigned to "General Consultation")
- `customer@smartqueue.dev` — CUSTOMER

## 6. Running the app

**Backend** (from `backend/`):
```bash
npm install
npm run dev        # http://localhost:4000, requires DATABASE_URL reachable
```

**Frontend** (from `frontend/`, in a separate terminal):
```bash
npm install
npm run dev        # http://localhost:5173
```

Open http://localhost:5173, register a customer account (or use the seeded
one), book an appointment, and open the same account in a second browser tab
to watch the live queue update when staff calls the next token.

## 7. Testing

From `backend/`:
```bash
npm test
```

- `tests/waitTime.test.js` — pure unit tests for the wait-time formula (no DB needed).
- `tests/auth.test.js` — registration/login/duplicate-email/wrong-password/auth-boundary, requires `DATABASE_URL`.
- `tests/booking-concurrency.test.js` — fires two simultaneous bookings at a
  single-capacity slot and asserts exactly one succeeds and `bookedCount`
  never exceeds `capacity`; requires `DATABASE_URL` with migrations applied.

Tests that need a database automatically skip (rather than fail) if
`DATABASE_URL` is unset, so `npm test` is always safe to run.

## 8. Deployment

1. **Database**: provision managed PostgreSQL (Neon, Supabase, RDS, Railway).
   Run `npx prisma migrate deploy` against it once.
2. **Backend**: deploy `backend/` to Render/Railway (needs a host that
   supports long-lived WebSocket connections for Socket.IO). Set all env
   vars from §4, plus `NODE_ENV=production` and `CORS_ORIGIN` pointing at
   your deployed frontend URL.
3. **Frontend**: deploy `frontend/` to Vercel/Netlify. Set `VITE_API_URL`
   and `VITE_SOCKET_URL` to your backend's public URL.
4. Re-run `npm run seed` against production only if you want demo data
   there — otherwise create your first admin manually (register as
   `CUSTOMER`, then promote via `UPDATE "User" SET role='ADMIN' WHERE
   email=...` once, since the API does not allow self-registering as admin).

## 9. Security notes already implemented

- Passwords hashed with bcrypt; JWTs short-lived with rotating refresh tokens.
- Every appointment/queue mutation re-validates ownership and capacity
  server-side, regardless of client or chatbot input.
- `helmet` for secure headers, `express-rate-limit` on all `/api` routes
  (tighter limit on `/auth/login` and `/auth/register`).
- Prisma parameterizes all queries (including the raw `FOR UPDATE` locks),
  so there is no SQL injection surface.
- The chatbot treats tool results as data, never instructions, and cannot
  act as a different user than the one whose JWT authenticated the request.
