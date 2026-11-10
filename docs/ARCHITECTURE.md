# Technical documentation

University Education Management Portal (UEMP): system architecture, database
structure, permission logic and the main technical decisions.

---

## 1. Architecture

```
 Browser ──HTTPS──▶  Next.js 15 (Vercel)  ──/api/* rewrite──▶  Django 5.2 + DRF (VPS, Docker)  ──▶  PostgreSQL 16
            same origin: pages + /api            proxy, no CORS              gunicorn, session auth            constraints, FKs
```

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, TanStack Query | Typed, fast to build, deploys to Vercel with no config. Query caching keeps dashboards responsive. |
| API | Django 5.2 LTS + Django REST Framework | Mature ORM, migrations, transactions and auth. DRF gives per-endpoint permission classes, filtering, pagination, throttling and OpenAPI docs. |
| Database | PostgreSQL 16 | Real constraints (partial unique indexes, CHECKs), row locking for workflow transitions, JSONB for audit diffs. |
| Packaging | Docker + docker compose | Same image locally and on the VPS. |
| Hosting | Vercel (frontend) · VPS + Cloudflare Tunnel (API) | The API has no public port: the tunnel connects outbound and serves HTTPS. The VPS redeploys itself when `main` changes. |

### Why REST (DRF) rather than GraphQL

Both were considered. The assessment weights **RBAC and security at 20%** and
explicitly asks that unauthorised users can't reach "backend endpoints". REST
gives every endpoint its own explicit permission class and a role-scoped
queryset, which is easy to reason about, easy to test (see the permission matrix
test), and lets an evaluator probe it directly in Swagger (`/api/docs/`).
GraphQL's single endpoint with nested resolvers makes it easier to leak data
through a nested field and needs extra depth-limiting and introspection work.

### Why same-origin session auth (not JWT)

The browser never talks to Django directly. Next.js rewrites `/api/*` to the
Django server, so the session and CSRF cookies are **first-party** on the
Vercel domain.

* The session cookie is `HttpOnly`, so JavaScript, and therefore an XSS bug, can't read it.
* There is no token in `localStorage`.
* CSRF protection is Django's built-in double-submit (`csrftoken` cookie + `X-CSRFToken` header).
* **Suspension is immediate.** Changing a user's status flips `is_active`, and
  Django refuses inactive users on the next request, so there's no token to revoke.
* `login()` rotates the session key (prevents session fixation), and changing a
  password invalidates every other session (`update_session_auth_hash`).
* Login is rate-limited (10/min per IP) and failed attempts are audited.

### Backend layout

```
backend/
  config/            settings, urls (all API routes in one place)
  apps/
    accounts/        User (role, department, status), profiles, auth views, RBAC permissions
    academics/       Faculty, Department, Program, Session, Semester, Course, CourseOffering, GradeBand
    registration/    CourseRegistration + services.py (registration rules)
    results/         ResultSheet, Result, services.py (state machine), grading.py, transcript.py
    audit/           append-only AuditLog + record() helper
    reports/         dashboards and reports (read-only, scoped)
    core/            error envelope, pagination, seed_demo command
  tests/             permission matrix + workflow tests (pytest)
```

Business rules live in **service functions** (`registration/services.py`,
`results/services.py`), not in views or serializers. Views stay thin: they
check the role, scope the queryset and call a service. That keeps every rule in
one place, and every rule is covered by tests.

### Frontend layout

```
frontend/src/
  app/login                    sign in (+ evaluation accounts panel)
  app/(portal)/student/*       dashboard, registration, results, profile
  app/(portal)/lecturer/*      dashboard, courses, score entry
  app/(portal)/admin/*         shared by super admin & department admin (scope-aware)
  app/print/*                  registration slip & result statement (print → PDF)
  components/                  design system (ui.tsx), data table, shell, charts
  lib/api.ts                   fetch wrapper (CSRF, error envelope)
  middleware.ts                redirects to /login when there is no session cookie
```

### Design system

A blend of four styles, each with one job:

| Style | Role in the UI |
|---|---|
| **Japandi** | Calm base: oat / rice-paper neutrals, light-wood hairlines, soft radii. Dark mode is "charred wood" rather than grey. |
| **Bohemian** | Jewel accents (emerald, terracotta, saffron, indigo, plum) for filled stat tiles, statuses, charts and per-role colour (student emerald, lecturer indigo, dept admin terracotta, super admin plum). |
| **Pointillism** | Hero tiles use a stippled dot field where jewel colours mix optically; progress is shown as dot meters; the result pipeline is one dot per course sheet. |
| **Utilitarian** | Monospace uppercase labels, numbered sections, path-style breadcrumbs, tabular figures. |

Type: **Clash Display** (headlines and numerals), Geist (UI text), Geist Mono (labels and IDs).
Light, dark and system themes are tokenised as CSS variables. The saved choice is applied by an
inline script before first paint, so the wrong theme never flashes.

---

## 2. Database structure

See **[ER_DIAGRAM.md](ER_DIAGRAM.md)** for the full diagram and the list of
database-level integrity rules.

Key modelling decisions:

* **One `User` table with a `role` and a `department`.** The department is the
  scope used by every permission check. A `CHECK` constraint guarantees that
  everyone except a super admin has one.
* **`Course` vs `CourseOffering`.** A course is a catalogue entry. An offering is
  that course running in a specific semester. Lecturer allocation, registrations
  and results hang off the *offering*, because who teaches a course and who takes
  it change every session.
* **`ResultSheet` per offering + `Result` per registration.** The sheet holds the
  workflow state (draft → submitted → approved / returned), and results hold
  the scores. Students only ever see results whose sheet is `APPROVED`.
* **Configurable grading.** `GradeBand` rows (grade, min, max, point) can be
  edited by a super admin. CA/exam maxima and the unit limit are settings.

---

## 3. Permission logic (RBAC)

Authorisation is enforced **on the server** in three layers. The frontend
mirrors it only for UX.

### Layer 1: role gate (which endpoints a role may call)

`apps/accounts/permissions.py` defines DRF permission classes:

| Area | Super admin | Dept admin | Lecturer | Student |
|---|:-:|:-:|:-:|:-:|
| `/api/student/*` | – | – | – | ✔ |
| `/api/lecturer/*` | – | – | ✔ | – |
| `/api/admin/*` (students, lecturers, courses, offerings, programs, registrations, result review, reports, audit) | ✔ | ✔ (own dept) | – | – |
| `/api/admin/faculties`, `departments`, `sessions`, `semesters`, `grade-bands` (write) | ✔ | read-only | – | – |
| `/api/admin/accounts` (all users, roles), `/api/admin/roles` (permission matrix) | ✔ | – | – | – |

### Layer 2: department scope (which rows a role may see)

`scope_to_department(queryset, user, field)` is applied in every admin
`get_queryset()`. A department admin's queries are filtered to their own
department, so a record from another department returns **404, not 403**,
which also avoids revealing that it exists. On create/update,
`ensure_same_department` stops a department admin from writing a record into
another department.

### Layer 3: state and ownership rules (in the service layer)

* A lecturer can only open, grade or submit an offering they are **allocated
  to** (their offerings queryset is `CourseOffering.objects.filter(lecturers=user)`).
* Scores can only be edited while the sheet is `DRAFT` or `REJECTED`. Submitted
  or approved sheets return **409 Conflict**.
* Only a department admin of the course's department (or a super admin) can
  approve, reject or reopen, and nobody can review a sheet they submitted.
* Rejecting requires feedback, and reopening requires a reason. Both bump the
  sheet's revision.
* Students can only change non-academic profile fields (phone, address, next of
  kin). Level, program and matric number are ignored if sent.

### Business rules → where they are enforced

| Rule (from the brief) | Enforced in |
|---|---|
| Register only courses for own department/program/level/semester | `registration.services.available_offerings` |
| No duplicate registration in a semester | service pre-check **and** DB unique constraint |
| Max units per semester, capacity, registration window | `registration.services.register_courses` |
| Lecturers enter results only for assigned courses | `results.services.ensure_allocated` + lecturer queryset |
| Results submitted before approval | state machine in `results.services` |
| Only own-department admins approve | `_ensure_reviewer` + scoped queryset |
| Students see only approved results | `transcript.approved_results` filters `sheet__status=APPROVED` |
| Every submission/approval/rejection/modification traceable | `audit.services.record` in every service, with before/after values |

---

## 4. Workflows

**Course registration.** Student opens *Course registration* → sees only
eligible offerings → selects and confirms → server validates (window, eligibility,
duplicates, capacity, unit cap) inside a transaction → registrations are audited
and show on the student and department dashboards.

**Result submission & approval.**

```
DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED  (visible to students)
  ▲                   │                      │
  └──── reject ───────┘                      │
  └──────────────── reopen (reason) ─────────┘
```

The lecturer enters CA and exam scores (live totals and grades in the UI, re-validated on
the server), saves drafts, then submits. The department admin reviews the scores,
grade distribution and audit history, then approves (released to students) or
returns with feedback.

---
