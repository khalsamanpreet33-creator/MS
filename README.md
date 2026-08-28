# School ERP — LAN Edition

A complete, offline-first School Management & Administration Software designed for a real school.
Operates over the school's local network with a centralized database, role-based access, real-time updates, PDF/Excel export, and automatic backup.

## Phase 1 — what ships now

This repository is a **monorepo** with two workspaces:

- `server/` — Node + Express + TypeScript REST API on SQLite (single file). JWT auth, RBAC, audit log, automation scheduler, backup engine, communication outbox, SSE for live updates.
- `web/` — React 19 + TypeScript + Tailwind v4 + Vite frontend. Router, sidebar, login, dashboard, and **fully functional** Students / Classes / Sections / Attendance / Fees. Every other module gets a navigable route stub that doesn't break later expansion.

### What's complete in Phase 1

- **Auth & RBAC** — JWT login (12 h TTL), 5-attempt lockout, `system.admin` and per-permission checks, audit log middleware.
- **Students** — list, search, filter, multi-field create/edit form, detail page with tabs (Profile / Attendance / Fees / History), soft-delete, transfer/promotion with `student_class_history` audit row.
- **Classes & Sections** — CRUD, capacity, class-teacher assignment.
- **Attendance** — open a session for a date+section, bulk upsert per student, daily summary, per-student history.
- **Fees** — fee structures (per class), invoice generation (bulk per period), payments with auto-allocation to oldest invoices, PDF receipt download.
- **Dashboard** — live totals, today's attendance, MTD collection, attendance trend chart, recent system events. Subscribes to server SSE so it refreshes automatically after a payment or attendance save.
- **System infrastructure** — scheduler (3 built-in cron jobs), backup engine (copies DB + zips school-data, retention 14), communication outbox (queue + flush every 30 s; no providers wired yet — rows go to `failed` with reason), system health endpoint (DB / disk / scheduler / outbox), audit log.
- **Stub routes** — 30+ module routes wired so the SPA can deep-link to every screen from the master prompt.

### What's deferred to later phases

Per the plan, full implementations for **Academics** (Timetable, Exams, Results, Homework, Syllabus), **Finance** (Accounts ledger, Payroll), **HR** (Leave, Recruitment), **Operations** (Transport, Library, Inventory, Assets, Events, Complaints, ID Cards, Certificates, Question Papers), **Communication** (Bulk composer, Emergency, Notice Board, Calendar), and **Admin** (Tasks, Approvals, System Health UI, Backup UI, Settings) are scheduled for Phase 2+. Each appears as a navigable stub today.

## Run it

```bash
# 1. Install
npm install

# 2. Seed (creates admin user, roles, demo classes/sections/students/invoices)
npm run seed

# 3. Start both server (:4000) and web (:3000)
npm run dev
```

Open <http://localhost:3000> and log in:

| Username    | Password    | What they can do                              |
|-------------|-------------|-----------------------------------------------|
| `admin`     | `admin`     | Full system access                            |
| `reception` | `reception` | Students + attendance + fees collection       |
| `teacher1`  | `teacher`   | Attendance read/write + assigned class views  |
| `accountant`| `accountant`| Fees read + collect + structures              |

## Architecture

```
School Server (LAN)
├── Express API on :4000
│   ├── /api/auth/*            login, me, logout, user mgmt
│   ├── /api/students          full CRUD + history + transfer
│   ├── /api/classes           CRUD + sections
│   ├── /api/attendance        sessions, bulk records, summaries
│   ├── /api/fees              structures, invoices, payments, receipts PDF
│   ├── /api/dashboard         summary
│   ├── /api/health            db / disk / scheduler / outbox
│   ├── /api/events            SSE channel for live updates
│   ├── /api/<module-stub>     one per Phase 2+ module
│   └── /uploads/*             static school-data directory
├── SQLite (server/data/school.db, WAL)
├── File storage (./school-data)
├── Backups (./backups — 14 retained)
└── node-cron scheduler + outbox flusher (every 30 s)

Client PCs (browser on the LAN)
└── http://<server-ip>:3000
```

## Layout

```
server/                 Node + TypeScript REST API
  src/
    index.ts            bootstrap (migrate, seed-if-empty, start cron, mount routes)
    config.ts           env + paths
    db/                 sqlite client, migrate runner, seed
      migrations/       0001_init.sql, 0002_seed_roles.sql
    lib/                auth, ids, sse, error helpers
    middleware/         auth, rbac, audit
    routes/             one file per module
    services/           fees.pdf (PDF receipt generator)
    jobs/               backup.job, scheduler.service, outbox.flush
web/                    React 19 + TS + Tailwind v4
  src/
    App.tsx             router + layout
    components/layout/  Sidebar, Topbar
    components/ui/      Card, Button, Input, Modal, Table, Stat, etc.
    pages/              Login, Dashboard, Students, Classes, Attendance, Fees, stubs/
    store/auth.ts       zustand auth (persisted)
    lib/                api client, SSE hook, formatters
school-data/            uploaded documents, generated PDFs (gitignored)
backups/                nightly sqlite + zips (gitignored, 14 retained)
```

## Useful scripts

```bash
npm run dev            # both server (:4000) and web (:3000)
npm run dev:server     # only the API
npm run dev:web        # only the frontend
npm run migrate        # apply pending SQL migrations
npm run seed           # seed demo data (idempotent on empty DB)
npm run backup:now     # run a backup immediately
```

## Environment

Copy `.env.example` to `.env` (server-side) and set:

| Var                | Default                          | Purpose                                     |
|--------------------|----------------------------------|---------------------------------------------|
| `JWT_SECRET`       | `dev-secret-change-me-...`       | Sign / verify JWTs                          |
| `PORT`             | `4000`                           | API port                                    |
| `HOST`             | `0.0.0.0`                        | Bind address (LAN)                          |
| `DB_PATH`          | `server/data/school.db`          | SQLite file                                 |
| `SCHOOL_DATA_DIR`  | `./school-data`                  | Uploaded files                              |
| `BACKUPS_DIR`      | `./backups`                      | Backups                                     |
| `BACKUP_RETENTION` | `14`                             | Backups to keep                             |
| `OUTBOX_FLUSH_MS`  | `30000`                          | Outbox flush interval                       |
| `CORS_ORIGIN`      | `http://localhost:3000`          | Allowed web origin                          |

## Adding a new module later

1. Add a stub now (already done for every Phase 2+ module).
2. To flesh it out:
   - Create `server/src/routes/<name>.routes.ts` and mount it in `server/src/routes/index.ts`.
   - Create `web/src/pages/<name>/...` and add the route to `web/src/App.tsx`.
3. The shape of a real route + service follows `students.routes.ts` / `students.service.ts` — copy that as a template.

## Notes

- "Offline-first" means **the server runs locally** and **internet is not required for normal operations**. Internet-dependent services (WhatsApp / Email / SMS / Cloud backup) sit in `communication_outbox` and retry when providers are configured.
- A browser-side service-worker cache for the last-fetched dashboard / attendance list is Phase 6 polish.
- Tauri packaging (one-click desktop app per PC) is Phase 6.