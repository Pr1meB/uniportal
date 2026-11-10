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
