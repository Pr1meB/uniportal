# UEMP: University Education Management Portal

A web portal for academic administration: course registration, result entry,
departmental approval and university-wide oversight, with role-based access for
**students, lecturers, department admins and super admins**.

| | |
|---|---|
| **Frontend** | Next.js 15 · TypeScript · Tailwind CSS v4 · TanStack Query (deploys to Vercel) |
| **Backend** | Django 5.2 · Django REST Framework · PostgreSQL 16 (Docker, deploys to a VPS) |
| **Auth** | Same-origin, HttpOnly session cookie + CSRF (Next.js proxies `/api` to Django) |
| **Docs** | [Technical documentation](docs/ARCHITECTURE.md) · [ER diagram](docs/ER_DIAGRAM.md) · Swagger at `/api/docs/` |

---

## Test credentials

Every demo account uses the password **`Uemp@2026`**.

| Role | Email | What to try |
|---|---|---|
| Super Admin | `superadmin@uemp.test` | University dashboard, faculties & departments, sessions (make current, open/close registration), all accounts (suspend/activate), audit trail |
| Department Admin (Computer Science) | `csc.admin@uemp.test` | Approve **CSC 201**, which is waiting in *Result approvals*; manage students, lecturers, courses; allocate lecturers |
| Lecturer (Dr. Adaeze Okafor, CSC) | `lecturer@uemp.test` | Enter scores for **CSC 301**, fix **CSC 401** (returned with feedback), finish the **CSC 101** draft |
| Student (CSC, 300 Level) | `student@uemp.test` | Register this semester's courses, view results & CGPA, print the registration slip and result statement |

Other seeded admins: `mth.admin@`, `eee.admin@`, `mee.admin@uemp.test`.

### Seeded data

* 2 faculties, 4 departments, 4 programs, 96 courses, 12 lecturers, 48 students (100–400 level)
* **2025/2026** session: fully graded and approved, giving every returning student a GPA history
* **2026/2027 First Semester** is current with registration open. CSC sheets are seeded in every
  workflow state (submitted, returned, partial draft, not started) so each dashboard has something to act on.

### Five-minute walkthrough

1. **Student**: *Course registration* → select CSC 301/303/305 → confirm (unit load and eligibility are validated server-side).
2. **Lecturer**: *My courses* → CSC 301 → type CA/exam scores (totals and grades update live) → *Save draft* → *Submit for review*.
3. **Department admin**: *Result approvals* → CSC 301 → review the scores, grade distribution and audit trail → *Approve*, or *Return* with a note.
4. **Student**: *Results & CGPA* now shows CSC 301 and the updated CGPA.
5. **Super admin**: *Audit trail* shows every step above with who, when, from which IP and what changed.

---

## Running locally

Requirements: Docker (with compose), Node 20+, pnpm.

```bash
# 1. API + database (migrates and seeds demo data on first start)
cp backend/.env.example backend/.env
docker compose up -d --build

# 2. Frontend
cd frontend
pnpm install
pnpm dev          # http://localhost:3050
```

| Service | URL |
|---|---|
| App | http://localhost:3050 |
| API docs (Swagger) | http://localhost:8050/api/docs/ |
| Django admin | http://localhost:8050/django-admin/ (`superadmin@uemp.test`) |

The frontend proxies `/api/*` to `BACKEND_URL` (default `http://localhost:8050`).

### Useful commands

```bash
docker compose exec backend python -m pytest                     # 162 backend tests
docker compose exec backend python manage.py flush --noinput      # wipe data
docker compose exec backend python manage.py seed_demo            # reload demo data
cd frontend && pnpm lint && npx tsc --noEmit                      # frontend checks
```

---

## Project structure

```
backend/     Django project (apps: accounts, academics, registration, results, audit, reports)
frontend/    Next.js app (student, lecturer and admin areas + printable documents)
docs/        Technical documentation and ER diagram
docker-compose.yml
```

## Configuration

Backend environment variables (`backend/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | (none) | Required in production |
| `DJANGO_DEBUG` | `false` | |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,backend` | |
| `CSRF_TRUSTED_ORIGINS` | `http://localhost:3050` | The frontend origin(s) |
| `COOKIE_SECURE` | `!DEBUG` | Secure cookies over HTTPS |
| `POSTGRES_*` | `uemp` | Database connection |
| `CA_MAX_SCORE` / `EXAM_MAX_SCORE` | `30` / `70` | Score split |
| `MAX_UNITS_PER_SEMESTER` | `24` | Registration unit cap |
| `SEED_DEMO_DATA` | `false` | Seed on container start if the DB is empty |

Frontend: `BACKEND_URL` (where `/api` is proxied to), `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` (show the evaluation-accounts panel on the login page; default on).

## Deployment

```
GitHub (main) ──push──▶ GitHub Actions: backend tests + frontend lint/types/build
      │
      ├──▶ Vercel (Git integration): builds frontend/, proxies /api → https://<api-host>
      │
      └──▶ VPS (pull-based, every 3 min): git pull → deploy/vps-deploy.sh
                 Postgres + gunicorn on 127.0.0.1, published by a Cloudflare Tunnel
                 (no inbound ports, HTTPS on the API hostname)
```

**API (VPS).** The server runs [vps-kit](https://github.com/Pr1meB/vps-kit): a Cloudflare
Tunnel, Docker, and a small `vps-app` tool that clones apps, redeploys them when their branch
moves, and routes each hostname to its local port. With the server set up, the API is one command:

```bash
vps add uemp https://github.com/Pr1meB/uniportal.git api.example.com 8050 \
  --env FRONTEND_ORIGIN=https://<project>.vercel.app
```

On first deploy [`deploy/vps-deploy.sh`](deploy/vps-deploy.sh) writes `backend/.env.prod` with a
generated secret key and database password, starts [`docker-compose.prod.yml`](docker-compose.prod.yml),
runs migrations, seeds the demo university and waits for the health check.

Without vps-kit, any Docker host works:
`APP_HOSTNAME=api.example.com APP_PORT=8050 FRONTEND_ORIGIN=https://<project>.vercel.app deploy/vps-deploy.sh`,
then put a reverse proxy or tunnel in front of `127.0.0.1:8050`.

**Frontend (Vercel).** Root directory `frontend`, framework Next.js, environment variable
`BACKEND_URL=https://api.example.com`. Every push to `main` deploys; pull requests get preview URLs.

## Scope

As agreed in the brief, the following are out of scope: fee payments, accommodation,
admissions, biometric attendance, SMS/email gateways, mobile apps and transcript certification.
