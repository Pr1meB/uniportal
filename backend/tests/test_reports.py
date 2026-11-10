"""Reports and the roles screen stay inside the caller's scope."""
import pytest

pytestmark = pytest.mark.django_db


def test_registration_report_is_department_scoped(csc_admin, super_admin):
    mine = csc_admin.get("/api/admin/reports/registrations/").json()
    everyone = super_admin.get("/api/admin/reports/registrations/").json()
    assert mine["courses"], "seed data should have CSC offerings this semester"
    assert {c["department"] for c in mine["courses"]} == {"CSC"}
    assert len(everyone["courses"]) > len(mine["courses"])
    assert {c["department"] for c in everyone["courses"]} > {"CSC"}


def test_registration_report_totals_match_rows(super_admin):
    data = super_admin.get("/api/admin/reports/registrations/").json()
    assert data["totals"]["registrations"] == sum(r["registrations"] for r in data["by_level"])
    assert data["totals"]["registrations"] == sum(c["registered"] for c in data["courses"])


def test_dept_admin_cannot_widen_scope_with_department_filter(csc_admin, super_admin):
    depts = super_admin.get("/api/admin/departments/").json()
    rows = depts["results"] if isinstance(depts, dict) else depts
    mth = next(d for d in rows if d["code"] == "MTH")
    data = csc_admin.get(f"/api/admin/reports/registrations/?department={mth['id']}").json()
    assert data["courses"] == [] and data["totals"]["registrations"] == 0


def test_roles_screen_lists_every_role_with_counts(super_admin):
    data = super_admin.get("/api/admin/roles/").json()
    roles = {r["value"]: r["accounts"] for r in data["roles"]}
    assert set(roles) == {"SUPER_ADMIN", "DEPT_ADMIN", "LECTURER", "STUDENT"}
    assert roles["STUDENT"] >= 48 and roles["SUPER_ADMIN"] >= 1
    assert all(item["scope"] for group in data["capabilities"] for item in group["items"])


def test_lecturer_class_list_only_for_own_offering(lecturer, other_lecturer):
    mine = lecturer.get("/api/lecturer/offerings/?current=1").json()
    offering = (mine["results"] if isinstance(mine, dict) else mine)[0]
    res = lecturer.get(f"/api/lecturer/offerings/{offering['id']}/students/")
    assert res.status_code == 200
    assert all({"matric_number", "name", "level", "program"} <= set(r) for r in res.json())
    assert other_lecturer.get(f"/api/lecturer/offerings/{offering['id']}/students/").status_code == 404
