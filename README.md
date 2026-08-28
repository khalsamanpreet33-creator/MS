# School ERP — LAN Edition

A complete, offline-first School Management & Administration Software designed for a real school.
Operates over the school's local network with a centralized SQLite database, role-based access, real-time updates, PDF/Excel export, automatic backup, offline PWA cache, and a Tauri desktop shell for one-click install on any classroom PC.

## What's in the box

### Server (Node + Express + TypeScript)

- **Auth & RBAC** — JWT login (12 h TTL), per-permission middleware, audit log.
- **Students** — CRUD, soft-delete, transfer/promotion with audit history, multi-tab detail view.
- **Classes & Sections** — CRUD, capacity, class-teacher assignment.
- **Attendance** — daily sessions per section, bulk upsert, per-student history, status reports.
- **Fees** — structures, bulk invoice generation, payments with auto-allocation to oldest invoices, PDF receipts.
- **Accounts** — chart of accounts, double-entry journal, trial balance, P&L, balance sheet.
- **Payroll** — salary structures, payslips, payroll runs.
- **HR & Leave** — leave applications, approvals, shifts.
- **Exams & Results** — exam schedule, marks entry, grade scales, report cards.
- **Academics** — subjects, syllabus, question bank, paper generator.
- **Admissions** — inquiry capture, application workflow, document checklist.
- **Parents** — parent profile, linked students, communication log.
- **Homework & Timetable** — class assignments, weekly schedule.
- **Communication** — notice board, emergency broadcasts (fan out to in-app + outbox), per-user notifications, bulk SMS/email/WhatsApp campaigns via `communication_outbox`.
- **Transport** — vehicles, drivers, routes with stops, per-stop student allocations.
- **Library** — books with category, issue/return, fine tracking.
- **Inventory** — items, vendors, stock movements (in/out/adjust), purchase orders with receive flow.
- **Assets** — asset register, assignment history, depreciation log.
- **Events & RSVPs**, **Complaints** with auto ticket numbers, **Tasks**, **Documents** with expiry.
- **ID Cards & Certificates** — templates (student/staff), certificate issuance with auto numbers (BON-00001, TRA-00001, ...).
- **Reports** — dashboard KPIs, attendance summary, fee collection, outstanding dues, student strength with capacity utilization; client-side CSV export.
- **Infrastructure** — node-cron scheduler (nightly backup, attendance reminder, outbox flush, retention purge), backup engine (DB + school-data zip, retention 14), communication outbox (every 30 s; providers are plug-in), system health endpoint, SSE channel for live updates, audit log, role/permission management.

### Web (React 19 + Vite + Tailwind v4)

- Sidebar grouped by Student Management / Academics / Finance / HR / Operations / Communication / Admin.
- TanStack Query for data, optimistic invalidation on mutations.
- Tabs inside grouped pages (Transport: Routes/Vehicles/Drivers; Library: Books/Issues; Inventory: Items/Movements/Vendors/POs).
- Reports with date-range pickers, utilization bars, CSV export.
- Offline banner driven by `navigator.onLine` + listening to `serviceWorker.controllerchange` for new-version prompts.
- **PWA** — `vite-plugin-pwa` with NetworkFirst runtime caches for `/api/dashboard`, `/api/attendance`, `/api/students` (4 s network timeout → last-fetched snapshot when offline). App shell precached.

### Desktop (Tauri 1.6)

- Rust binary that wraps the web app in a WebView. Dev mode loads the Vite dev server; production loads the bundled `web/dist`.
- Native menu (File → Open in Browser, Help → About), `app_info` / `open_external` commands.
- Bundle targets: msi (Windows), dmg (macOS), deb + AppImage (Linux). Resources include the prebuilt web bundle and the (optional) server dist so LAN deployments can upgrade the backend independently of the shell.
- See `src-tauri/README.md` for prerequisites and build commands.

## Run it

```bash
# 1. Install (workspaces install together)
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
│   ├── /api/auth/*            login, me, logout
│   ├── /api/{students,classes,attendance,fees,...}   full per-module CRUD
│   ├── /api/dashboard         live KPI summary
│   ├── /api/reports/*         attendance, fees, outstanding, strength
│   ├── /api/health            db / disk / scheduler / outbox
│   ├── /api/events            SSE channel for live updates
│   └── /uploads/*             static school-data directory
├── SQLite (server/data/school.db, WAL)
├── File storage (./school-data)
├── Backups (./backups — 14 retained)
└── node-cron scheduler + outbox flusher (every 30 s)

Client PCs (browser on the LAN)
└── http://<server-ip>:3000
    └── PWA service worker caches app shell + last dashboard/attendance/students response

Classroom PC (desktop)
└── School ERP.app / .msi / .deb
    └── Tauri WebView → bundled web/dist
```

## Layout

```
server/                 Node + TypeScript REST API
  src/
    index.ts            bootstrap (migrate, seed-if-empty, start cron, mount routes)
    config.ts           env + paths
    db/                 sqlite client, migrate runner, seed
      migrations/       0001_init.sql → 0026_reports.sql
    lib/                auth, ids, sse, error helpers
    middleware/         auth, rbac, audit
    routes/             one file per module
    services/           fees.pdf, questionPaper.pdf
    jobs/               backup, outbox.flush, scheduler, retention purge
web/                    React 19 + TS + Tailwind v4 + Vite
  src/
    App.tsx             router + layout
    components/layout/  Sidebar, Topbar, OfflineBanner
    components/ui/      Card, Button, Input, Modal, Table, Badge, Stat, ...
    pages/              Login, Dashboard + one folder per module
    store/auth.ts       zustand auth (persisted)
    lib/                api client, SSE hook, formatters
  public/favicon.svg
src-tauri/              Tauri 1.6 desktop shell
  src/{main.rs,lib.rs}  app bootstrap + commands + menu
  tauri.conf.json       bundle + window + allowlist
  Cargo.toml            dependencies
  icons/                icon source + generation README
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
npm run build          # production build (server TS + web dist)
npm run tauri:dev      # desktop shell in dev mode (needs Rust + webview)
npm run tauri:build    # desktop bundle (needs Rust + webview)
```

## Environment

Copy `.env.example` to `.env` and set:

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

## Adding a new module

1. Migration: `server/src/db/migrations/NNNN_<name>.sql` (numbered; runner is idempotent via `migrations` table).
2. Permissions: `INSERT OR IGNORE INTO permissions` and `role_permissions` rows in the same migration file.
3. Routes: `server/src/routes/<name>.routes.ts` mounted in `server/src/routes/index.ts`. Use `requireAuth` + `requirePerm` middleware.
4. Web: `web/src/pages/<name>/<Page>.tsx` (lazy import), route in `web/src/App.tsx`, sidebar entry in `web/src/components/layout/Sidebar.tsx`.
5. Verify: `npx tsc --noEmit` in `server/`, `npm run lint` in `web/`, `npm run build` in `web/`.

Reference modules: `tasks.routes.ts` (simple CRUD), `transport.routes.ts` (nested children), `assets.routes.ts` (status workflow + history log), `reports.routes.ts` (read aggregations).

## Notes

- **Offline-first** means the server runs locally and internet is not required for normal operations. Internet-dependent services (WhatsApp / Email / SMS / Cloud backup) sit in `communication_outbox` and retry when providers are configured.
- **PWA offline cache** is implemented for the dashboard, attendance, and students list — when the LAN is unreachable, the page renders the last successful response. Other pages still require a connection.
- **Desktop packaging** uses Tauri; on a host with `rustup` + the platform webview (`webkit2gtk-4.1` / Xcode CLT / WebView2), `npm run tauri:build` produces installers.
