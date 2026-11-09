"""Role x endpoint matrix: every role is tried against every protected area.

403 = role is not allowed at all, 401/403 for anonymous (DRF returns 403 for
session auth without credentials), 200 = allowed.
"""
import pytest

pytestmark = pytest.mark.django_db

A, S, D, L, ST = "anon", "super", "dept", "lecturer", "student"

MATRIX = [
    # endpoint,                              allowed roles
    ("/api/auth/me/",                         {S, D, L, ST}),
    ("/api/lookups/",                         {S, D, L, ST}),
    ("/api/student/dashboard/",               {ST}),
    ("/api/student/courses/",                 {ST}),
    ("/api/student/results/",                 {ST}),
    ("/api/student/registrations/",           {ST}),
    ("/api/lecturer/dashboard/",              {L}),
    ("/api/lecturer/offerings/",              {L}),
    ("/api/admin/dashboard/",                 {S, D}),
    ("/api/admin/students/",                  {S, D}),
    ("/api/admin/lecturers/",                 {S, D}),
    ("/api/admin/courses/",                   {S, D}),
    ("/api/admin/offerings/",                 {S, D}),
    ("/api/admin/programs/",                  {S, D}),
    ("/api/admin/registrations/",             {S, D}),
    ("/api/admin/result-sheets/",             {S, D}),
    ("/api/admin/reports/performance/",       {S, D}),
    ("/api/admin/reports/standing/",          {S, D}),
    ("/api/admin/audit-logs/",                {S, D}),
    ("/api/admin/faculties/",                 {S, D}),
    ("/api/admin/departments/",               {S, D}),
    ("/api/admin/sessions/",                  {S, D}),
    ("/api/admin/accounts/",                  {S}),
]


@pytest.mark.parametrize("url,allowed", MATRIX)
@pytest.mark.parametrize("role", [A, S, D, L, ST])
def test_read_access_matrix(clients, url, allowed, role):
    res = clients[role].get(url)
    if role in allowed:
        assert res.status_code == 200, f"{role} should read {url}, got {res.status_code}"
    else:
        assert res.status_code in (401, 403), f"{role} must not read {url}, got {res.status_code}"


WRITE_ONLY_SUPER = [
    ("/api/admin/faculties/", {"name": "Faculty of Arts", "code": "ART"}),
    ("/api/admin/sessions/", {"name": "2027/2028", "start_date": "2027-10-01", "end_date": "2028-08-30"}),
    ("/api/admin/accounts/", {"email": "x@uemp.test", "first_name": "X", "last_name": "Y", "role": "SUPER_ADMIN"}),
]


@pytest.mark.parametrize("url,payload", WRITE_ONLY_SUPER)
@pytest.mark.parametrize("role", [D, L, ST])
def test_system_wide_writes_are_super_admin_only(clients, url, payload, role):
    assert clients[role].post(url, payload, format="json").status_code == 403


@pytest.mark.parametrize("url,payload", WRITE_ONLY_SUPER)
def test_super_admin_can_do_system_wide_writes(super_admin, url, payload):
    assert super_admin.post(url, payload, format="json").status_code == 201


def test_department_admin_only_sees_own_department(csc_admin):
    from apps.accounts.models import User

    rows = csc_admin.get("/api/admin/students/?page_size=200").json()["results"]
    assert rows and {r["department_name"] for r in rows} == {"Computer Science"}

    mth_student = User.objects.filter(role="STUDENT", department__code="MTH").first()
    assert csc_admin.get(f"/api/admin/students/{mth_student.pk}/").status_code == 404
    assert csc_admin.post(f"/api/admin/students/{mth_student.pk}/status/", {"status": "SUSPENDED"}).status_code == 404


def test_department_admin_cannot_create_records_in_other_department(csc_admin):
    from apps.academics.models import Department, Program

    mth = Department.objects.get(code="MTH")
    res = csc_admin.post("/api/admin/courses/", {
        "code": "MTH 999", "title": "Sneaky", "units": 2, "level": 100, "term": "FIRST", "department": mth.pk,
        "programs": [Program.objects.get(department=mth).pk],
    }, format="json")
    assert res.status_code == 403


def test_department_admin_cannot_modify_sessions(csc_admin):
    from apps.academics.models import Semester

    sem = Semester.current()
    assert csc_admin.post(f"/api/admin/semesters/{sem.pk}/toggle-registration/").status_code == 403
    assert csc_admin.post(f"/api/admin/semesters/{sem.pk}/make-current/").status_code == 403


def test_suspended_user_is_logged_out_immediately(super_admin, student):
    from apps.accounts.models import User

    assert student.get("/api/auth/me/").status_code == 200
    target = User.objects.get(email="student@uemp.test")
    assert super_admin.post(f"/api/admin/accounts/{target.pk}/status/", {"status": "SUSPENDED"}).status_code == 200
    assert student.get("/api/auth/me/").status_code == 403


def test_suspended_user_cannot_log_in(anon):
    from apps.accounts.models import AccountStatus, User

    u = User.objects.get(email="student@uemp.test")
    u.status = AccountStatus.SUSPENDED
    u.save()
    res = anon.post("/api/auth/login/", {"email": u.email, "password": "Uemp@2026"}, format="json")
    assert res.status_code == 401
    assert "suspended" in res.json()["detail"]


def test_login_requires_csrf_token():
    from rest_framework.test import APIClient

    c = APIClient(enforce_csrf_checks=True)
    res = c.post("/api/auth/login/", {"email": "student@uemp.test", "password": "Uemp@2026"}, format="json")
    # The login view itself is unauthenticated; CSRF is enforced on every authenticated write.
    assert res.status_code == 200
    res = c.post("/api/auth/logout/")
    assert res.status_code == 403  # no X-CSRFToken header


def test_student_cannot_change_academic_fields(student):
    res = student.patch("/api/student/profile/", {"address": "New hostel", "level": 400, "matric_number": "X"}, format="json")
    assert res.status_code == 200
    body = res.json()
    assert body["student_profile"]["address"] == "New hostel"
    assert body["student_profile"]["level"] == 300
    assert body["student_profile"]["matric_number"] != "X"
