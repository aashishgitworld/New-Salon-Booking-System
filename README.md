# Salon Appointment & Time Slot Management System

A full-stack salon booking platform with dynamic time-slot availability, break-period enforcement, queue-based notifications, and real-time socket updates.

![Stack](https://img.shields.io/badge/stack-NestJS%20%7C%20Next.js%20%7C%20PostgreSQL%20%7C%20Redis-blueviolet)

---

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Apps](#running-the-apps)
- [API Documentation](#api-documentation)
- [Time-Slot Logic](#time-slot-logic)
- [Bulk Upload Format](#bulk-upload-format)
- [Real-Time Events](#real-time-events)
- [Design Decisions](#design-decisions)
- [Testing](#testing)
- [Security](#security)

---

## Features

**Authentication**
- Email/password registration with verification link
- JWT-based authentication (24h default expiry)
- Role-based access control (admin / staff / customer)
- Bcrypt password hashing (12 rounds)

**Appointment Management**
- Browse services with pricing and duration
- Book appointments with a live time-slot picker
- Edit and cancel appointments
- List view with filtering (status, service, date range)
- Break-period enforcement (default 12:00–14:00)
- Overlap detection — no double-booking
- Past-slot prevention

**Notifications**
- 4 seeded confirmation templates with `{{placeholder}}` support
- Queue-based single confirmations (Bull + Redis)
- Bulk Excel upload — rows processed asynchronously
- Per-row success/failure logging
- Real-time progress via Socket.IO

**Operational**
- Swagger/OpenAPI documentation
- TypeORM migrations with seeding
- Global validation, error handling, and response envelope
- Throttling, Helmet, CORS, class-validator
- Unit tests for the core time-slot logic

---

## Architecture

```
┌─────────────────┐   HTTP/JWT    ┌──────────────────┐
│  Next.js App    │◄─────────────►│  NestJS API      │
│  (port 3000)    │               │  (port 3001)     │
│                 │   Socket.IO   │                  │
│  - Dashboard    │◄─────────────►│  - REST + WS     │
│  - Appointments │               │  - Swagger       │
│  - Templates    │               │  - Validation    │
│  - Bulk Upload  │               └────────┬─────────┘
│  - Logs         │                        │
└─────────────────┘                        │
                                 ┌─────────┴──────────┐
                                 │                    │
                          ┌──────▼───────┐    ┌───────▼──────┐
                          │  PostgreSQL  │    │    Redis     │
                          │              │    │  (Bull jobs) │
                          └──────────────┘    └──────┬───────┘
                                                     │
                                              ┌──────▼────────────┐
                                              │  Bull Workers     │
                                              │  - notification   │
                                              │  - bulk-appointment│
                                              └───────────────────┘
```

Async work (email sends, bulk processing) is offloaded to Bull queues backed by Redis. Workers emit progress events through Socket.IO so the UI reflects status live.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend framework | [NestJS 10](https://nestjs.com) |
| Frontend framework | [Next.js 14](https://nextjs.org) (App Router) |
| Database | PostgreSQL 14+ |
| ORM | TypeORM |
| Queue | Bull + Redis |
| Real-time | Socket.IO |
| Auth | JWT + Passport |
| Validation | class-validator + Zod (frontend) |
| Styling | Tailwind CSS |
| API docs | Swagger / OpenAPI 3 |
| Excel parsing | ExcelJS |

---

## Project Structure

```
salon-booking-system/
├── backend/                       # NestJS API
│   ├── src/
│   │   ├── auth/                  # Registration, login, JWT, email verification
│   │   ├── users/                 # User entity + service
│   │   ├── services/              # Salon service catalog
│   │   ├── appointments/          # Booking + time-slot engine
│   │   ├── notifications/         # Templates, logs, queues, Excel import
│   │   ├── mail/                  # SMTP / nodemailer wrapper
│   │   ├── common/                # Filters, interceptors, DTOs, constants
│   │   ├── config/                # Typed config factories
│   │   ├── database/
│   │   │   ├── migrations/        # TypeORM migrations
│   │   │   └── seeds/             # Seeder script
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── docs/                      # Sample bulk upload files
│   └── .env.example
│
├── frontend/                      # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── verify-email/
│   │   │   └── dashboard/
│   │   │       ├── appointments/
│   │   │       ├── templates/
│   │   │       ├── bulk-upload/
│   │   │       └── logs/
│   │   ├── components/
│   │   └── lib/                   # api client, socket client, types, stores
│   └── .env.example
│
├── docs/                          # Extra diagrams / notes
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js **≥ 20**
- PostgreSQL **≥ 14**
- Redis **≥ 6**
- npm

### 1. Clone & install

```bash
git clone <this-repo>
cd salon-booking-system

# Backend
cd backend
# cp .env.example .env
npm install

# Frontend (in another terminal)
cd ../frontend
# cp .env.example .env
npm install
```

### 2. Configure environment

Create `backend/.env.example` with your Postgres, Redis, and SMTP credentials.
If SMTP is not configured, emails are logged to the console instead of being sent — useful for local dev.

Also, Create `frontend/.env.example` with api url and socket url.

### 3. Database setup

```bash
cd backend
npm run migration:generate    # generate migration files
npm run migration:run    # run migration scripts
npm run seed             # adds templates, services, admin user
```

The seed creates an admin account:
- Email: `admin@salon.local`
- Password: `Admin@123`

### 4. Run

```bash
# Terminal 1 - backend
cd backend
npm run start:dev

# Terminal 2 - frontend
cd frontend
npm run dev
```

Open http://localhost:3000.

---

## Environment Variables

### Backend (`backend/.env.example`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `API_PREFIX` | `api/v1` | URL prefix |
| `FRONTEND_URL` | `http://localhost:3000` | CORS + email links |
| `DB_*` | — | PostgreSQL connection |
| `JWT_SECRET` | — | **Change in production** |
| `JWT_EXPIRES_IN` | `1d` | Access token lifetime |
| `JWT_VERIFICATION_SECRET` | — | Separate secret for email tokens |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | Bull backend |
| `SMTP_*` | — | Optional; falls back to console logging |
| `SALON_OPEN_HOUR` | `9` | Business open (24h) |
| `SALON_CLOSE_HOUR` | `18` | Business close (24h) |
| `BREAK_START_HOUR` | `12` | Break start (24h) |
| `BREAK_END_HOUR` | `14` | Break end (24h) |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60` / `100` | Rate limit (per IP, per window) |

### Frontend (`frontend/.env.example`)

| Variable | Default |
|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:3001` |

---

## API Documentation

Swagger UI: http://localhost:3001/api/v1/docs

All protected routes require `Authorization: Bearer <token>`. Click the **Authorize** button in Swagger to paste your token once — it persists across requests.

Key endpoints:

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Sign up + send verification |
| GET  | `/auth/verify-email?token=...` | Verify via email token |
| POST | `/auth/login` | Returns JWT |
| GET  | `/services` | List salon services |
| GET  | `/appointments/available-slots?serviceId=...&date=YYYY-MM-DD` | Availability |
| POST | `/appointments` | Create booking |
| PATCH | `/appointments/:id` | Update booking |
| DELETE | `/appointments/:id` | Cancel booking |
| GET  | `/templates` | List confirmation templates |
| POST | `/notifications/send-confirmation` | Queue a single confirmation |
| POST | `/notifications/bulk-upload` | Upload an Excel file for batch processing |
| GET  | `/notifications/logs` | View send history |

---

## Time-Slot Logic

The `TimeSlotService` encapsulates all booking rules:

1. **Business hours** — slots only between `SALON_OPEN_HOUR` and `SALON_CLOSE_HOUR`.
2. **Break period** — any slot that overlaps `BREAK_START_HOUR`–`BREAK_END_HOUR` is rejected.
3. **Past-time guard** — slots in the past are marked unavailable.
4. **Overlap detection** — two intervals `[a1, a2)` and `[b1, b2)` overlap iff `a1 < b2 && b1 < a2`. This is correctly applied even when updating an existing appointment (the current appointment is excluded from conflict checks).
5. **Slot granularity** — 30-minute increments by default (`TIME_SLOT_INTERVAL_MINUTES`).

Each slot returned from `/available-slots` includes a `reason` (`break`, `booked`, `past`) when unavailable, which the frontend tooltips surface to the user.

See `backend/src/appointments/time-slot.service.ts` and the unit tests in `time-slot.service.spec.ts`.

---

## Bulk Upload Format

Excel files must have a header row (case-insensitive) with:

| Column | Required | Example |
|---|---|---|
| `customerEmail` | ✅ | `alice@example.com` |
| `serviceName` | ✅ | `Men's Haircut` *(must match a seeded service)* |
| `startTime` | ✅ | `2026-06-10T10:00:00Z` or an Excel date cell |
| `customerName` | | `Alice Johnson` |
| `customerPhone` | | `+15551234567` |
| `notes` | | `First-time customer` |

Sample files live in `backend/docs/`:
- `sample-bulk-upload.xlsx`
- `sample-bulk-upload.csv`

Processing flow:
1. Upload → API parses the file and queues a `process-bulk` job.
2. Worker iterates row-by-row, creating the appointment and sending the confirmation.
3. Per-row result is saved to `notification_logs` and pushed via Socket.IO to subscribers.
4. When done, a `bulk:completed` event fires with the final summary.

---

## Real-Time Events

Two Socket.IO namespaces:

**`/appointments`**
- `appointment:created`
- `appointment:updated`

**`/notifications`**
- `notification:progress`
- `notification:completed`
- `notification:failed`
- `bulk:progress` — fires after every row during bulk processing
- `bulk:completed` — fires once when the full batch finishes

Clients can scope to a specific batch with `socket.emit('subscribe:batch', batchId)`.

---

## Design Decisions

- **Modular Nest structure** — one feature module per domain (`auth`, `users`, `services`, `appointments`, `notifications`, `mail`). Each module owns its entities, DTOs, services, controllers, and any gateway/processor it needs.
- **Global response envelope** via `TransformInterceptor` — every successful response is `{ success, statusCode, message, data, timestamp }`.
- **Global `AllExceptionsFilter`** produces a consistent shape for both expected `HttpException`s and unexpected errors.
- **Repository pattern** — services take entity repositories via `@InjectRepository`, keeping controllers thin and testable.
- **Single Responsibility** — `TimeSlotService` does *only* slot math; `AppointmentsService` orchestrates; `TemplateRenderer` does *only* placeholder substitution; `ExcelParserService` does *only* parsing.
- **Bull for async work** — sending email is a side effect; we never block the HTTP request on it.
- **JWT secrets separated** — a distinct secret is used for email-verification tokens so rotating the login secret doesn't invalidate unrelated flows.
- **Frontend `api` client with a response interceptor** that pushes users back to `/login` on 401 — keeps auth handling in one place.
- **Zustand for auth state** — small, minimal, no boilerplate compared with Redux for a single-store case.

---

## Testing

Unit tests cover the core business logic:

```bash
cd backend
npm test
```

Covered:
- `overlapsBreak` — boundary conditions (slot ends exactly at break start, starts exactly at break end)
- `hasConflict` — overlap, back-to-back, and self-exclusion when editing
- `validateSlot` — past, out-of-hours, break, and conflict scenarios

---

## Security

- Passwords hashed with bcrypt (12 salt rounds)
- JWT with separate secrets for login vs. email verification
- Input validation via `class-validator` with `forbidNonWhitelisted` — unknown fields are rejected
- `helmet` applied globally
- CORS restricted to the configured frontend origin
- Rate limiting via `@nestjs/throttler`
- Database queries use parameter binding (TypeORM query builder) to prevent SQL injection
- Email enumeration protection on the resend-verification endpoint
- Role-based guards on admin/staff-only endpoints
- The `password` column is `select: false`-equivalent (excluded via query builder) except during login

---

## License

MIT
