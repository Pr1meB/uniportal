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
    ("/api/admin/reports/registrations/",     {S, D}),
    ("/api/admin/audit-logs/",                {S, D}),
    ("/api/admin/faculties/",                 {S, D}),
    ("/api/admin/departments/",               {S, D}),
    ("/api/admin/sessions/",                  {S, D}),
    ("/api/admin/accounts/",                  {S}),
    ("/api/admin/roles/",                     {S}),
]


@pytest.mark.parametrize("url,allowed", MATRIX)
@pytest.mark.parametrize("role", [A, S, D, L, ST])
def test_read_access_matrix(clients, url, allowed, role):
    res = clients[role].get(url)
    if role in allowed:
        assert res.status_code == 200, f"{role} should read {url}, got {res.status_code}"
    else:
        assert res.status_code in (401, 403), f"{role} must not read {url}, got {res.status_code}"
