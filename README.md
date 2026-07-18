# EyerREMS Desktop

**Real Estate Management System** — A full-featured, multi-tenant Real Estate ERP desktop application.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron 35 |
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS 3 |
| State Management | Zustand 5 |
| Data Fetching | TanStack React Query 5, Axios |
| Routing | React Router DOM 6 (HashRouter) |
| Charts | Recharts 3 |
| Backend | FastAPI (Python), Uvicorn |
| ORM | SQLAlchemy + Alembic |
| Database | PostgreSQL (multi-tenant) with SQLite fallback |
| Auth | JWT, bcrypt |
| Validation | Pydantic v2 |
| Scheduler | APScheduler |

---

## Features

- **Property Management** — Properties, units, floors, locations, categories, amenities, ownership
- **CRM** — Leads, clients, dealers, deals, follow-ups, site visits, communications, installment plans, bookings
- **Finance & Accounting** — Double-entry bookkeeping, chart of accounts, journals, invoices, payments, commissions, P&L, trial balance
- **Tenant Management** — Leases, rent tracking, maintenance requests
- **Construction** — Projects, phases, budgets, contractors, procurement, daily progress
- **HR & Payroll** — Departments, positions, employees, attendance, leaves, payroll
- **Mail & Communication** — IMAP email, threads, WhatsApp, chat
- **Reports Center** — Configurable reports, PDF/Excel export
- **AI Intelligence** — Anomaly detection, risk scoring, duplicate matching, AI chat
- **Town Management** — Hierarchical town/block/plot management
- **Admin Panel** — Multi-company management, RBAC, feature flags, audit logs

---

## Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
  uvicorn app.main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev          # Browser only (Vite on :5173)
npm run electron:dev # Electron + Vite
```

### Build

```bash
npm run build          # Vite production build
npm run build:electron # Windows .exe installer
```

---

## Project Structure

```
backend/         # FastAPI Python backend
  ├── app/
  │   ├── api/routes/    # Route handlers
  │   ├── core/          # Config, DB, security, tenant
  │   ├── models/        # SQLAlchemy models
  │   ├── schemas/       # Pydantic schemas
  │   └── services/      # Business logic
  ├── alembic/           # Migrations
  └── requirements.txt

frontend/        # React + Electron
  ├── src/
  │   ├── components/    # Reusable UI
  │   ├── pages/         # Route pages
  │   ├── store/         # Zustand stores
  │   ├── hooks/         # Custom hooks
  │   └── electron/      # Electron main/preload
  └── package.json
```

---

## Multi-Tenancy

Each company gets an isolated PostgreSQL schema resolved via the `X-Company-Id` header. Falls back to SQLite for local development.

---

## Release

```bash
# Bump version in frontend/package.json, then:
git tag v1.x.x
git push origin v1.x.x
```

GitHub Actions builds the Windows installer and publishes it to GitHub Releases. The app auto-updates on startup.

---

## License

Proprietary — © EyerREMS, 2026.
