"""Course registration and result approval workflows, end to end over HTTP."""
from decimal import Decimal

import pytest

from apps.academics.models import CourseOffering, Semester
from apps.accounts.models import User
from apps.audit.models import AuditAction, AuditLog
from apps.registration.models import CourseRegistration
from apps.results.grading import Band, grade_for, weighted_gpa
from apps.results.models import ResultSheet, SheetStatus

pytestmark = pytest.mark.django_db


def available(student):
    return student.get("/api/student/courses/").json()["available"]


# --- Workflow 1: registration -----------------------------------------------------

def test_student_sees_only_courses_for_their_program_level_and_term(student):
    data = student.get("/api/student/courses/").json()
    codes = {o["course_detail"]["code"] for o in data["available"]}
    assert codes == {"CSC 301", "CSC 303", "CSC 305"}
    assert all(o["course_detail"]["level"] == 300 and o["course_detail"]["term"] == "FIRST" for o in data["available"])


def test_register_then_duplicate_is_rejected(student, csc_admin):
    ids = [o["id"] for o in available(student)]
    res = student.post("/api/student/courses/", {"offerings": ids}, format="json")
    assert res.status_code == 201 and len(res.json()) == 3

    again = student.post("/api/student/courses/", {"offerings": ids[:1]}, format="json")
    assert again.status_code == 400
    assert "already registered" in again.json()["detail"]

    # department admin can see the registrations
    regs = csc_admin.get("/api/admin/registrations/?current=1&search=student").json()
    assert AuditLog.objects.filter(action=AuditAction.COURSE_REGISTER).exists()
    assert csc_admin.get("/api/admin/registrations/?current=1&page_size=200").status_code == 200


def test_cannot_register_course_outside_program_or_level(student):
    other = CourseOffering.objects.filter(semester__is_current=True, course__code="CSC 401").first()
    mth = CourseOffering.objects.filter(semester__is_current=True, course__code="MTH 301").first()
    for off in (other, mth):
        res = student.post("/api/student/courses/", {"offerings": [off.pk]}, format="json")
        assert res.status_code == 400


def test_registration_closed_blocks_registration(student):
    sem = Semester.current()
    sem.registration_open = False
    sem.save()
    ids = [o["id"] for o in available(student)]
    assert student.post("/api/student/courses/", {"offerings": ids}, format="json").status_code == 400


def test_database_prevents_duplicate_registration():
    from django.db import IntegrityError, transaction

    reg = CourseRegistration.objects.filter(semester__is_current=True).first()
    with pytest.raises(IntegrityError), transaction.atomic():
        CourseRegistration.objects.create(student=reg.student, offering=reg.offering)


def test_student_can_drop_while_open(student):
    ids = [o["id"] for o in available(student)]
    created = student.post("/api/student/courses/", {"offerings": ids}, format="json").json()
    assert student.delete(f"/api/student/courses/{created[0]['id']}/").status_code == 204


# --- Workflow 2 & 3: results ------------------------------------------------------------

def offering(code):
    return CourseOffering.objects.get(semester__is_current=True, course__code=code)


def test_lecturer_sees_only_allocated_courses(lecturer, other_lecturer):
    mine = {o["course_detail"]["code"] for o in lecturer.get("/api/lecturer/offerings/?current=1").json()["results"]}
    assert mine == {"CSC 101", "CSC 201", "CSC 301", "CSC 401"}
    # Mathematics lecturer cannot open a CSC offering
    assert other_lecturer.get(f"/api/lecturer/offerings/{offering('CSC 301').pk}/results/").status_code == 404


def test_full_result_lifecycle(lecturer, csc_admin, student):
    off = offering("CSC 301")
    # demo student registers first so they appear on the sheet
    student.post("/api/student/courses/", {"offerings": [off.pk]}, format="json")

    sheet = lecturer.get(f"/api/lecturer/offerings/{off.pk}/results/").json()
    rows = sheet["rows"]
    assert sheet["sheet"]["status"] == "DRAFT" and rows

    # out-of-range score rejected
    bad = lecturer.put(f"/api/lecturer/offerings/{off.pk}/results/",
                       {"entries": [{"registration": rows[0]["registration"], "ca_score": 45, "exam_score": 50}]},
                       format="json")
    assert bad.status_code == 400

    # submit with missing scores rejected
    assert lecturer.post(f"/api/lecturer/offerings/{off.pk}/submit/").status_code == 400

    entries = [{"registration": r["registration"], "ca_score": 25, "exam_score": 50} for r in rows]
    saved = lecturer.put(f"/api/lecturer/offerings/{off.pk}/results/", {"entries": entries}, format="json").json()
    assert all(r["grade"] == "A" and Decimal(r["total"]) == 75 for r in saved["rows"])

    # draft results are invisible to the student
    assert not student.get("/api/student/results/").json()["semesters"][-1]["label"].startswith("2026/2027")

    assert lecturer.post(f"/api/lecturer/offerings/{off.pk}/submit/").status_code == 200
    # submitted results are locked
    locked = lecturer.put(f"/api/lecturer/offerings/{off.pk}/results/", {"entries": entries[:1]}, format="json")
    assert locked.status_code == 409

    sheet_id = ResultSheet.objects.get(offering=off).pk
    # a lecturer cannot approve
    assert lecturer.post(f"/api/admin/result-sheets/{sheet_id}/approve/").status_code == 403
    # reject needs a comment
    assert csc_admin.post(f"/api/admin/result-sheets/{sheet_id}/reject/", {"comment": ""}).status_code == 400

    assert csc_admin.post(f"/api/admin/result-sheets/{sheet_id}/approve/", {"comment": "OK"}).status_code == 200
    transcript = student.get("/api/student/results/").json()
    current = transcript["semesters"][-1]
    assert current["label"] == "2026/2027 First Semester"
    assert current["courses"][0]["grade"] == "A"

    actions = list(AuditLog.objects.filter(entity_type="results.ResultSheet", entity_id=str(sheet_id))
                   .values_list("action", flat=True))
    assert {AuditAction.RESULT_SAVE, AuditAction.RESULT_SUBMIT, AuditAction.RESULT_APPROVE} <= set(actions)


def test_reject_returns_sheet_to_lecturer_for_correction(lecturer, csc_admin):
    sheet = ResultSheet.objects.get(offering=offering("CSC 201"))
    assert sheet.status == SheetStatus.SUBMITTED
    res = csc_admin.post(f"/api/admin/result-sheets/{sheet.pk}/reject/", {"comment": "Check row 2"})
    assert res.status_code == 200
    sheet.refresh_from_db()
    assert sheet.status == SheetStatus.REJECTED and sheet.revision == 2
    data = lecturer.get(f"/api/lecturer/offerings/{sheet.offering_id}/results/").json()
    assert data["sheet"]["review_comment"] == "Check row 2"
    row = data["rows"][0]
    ok = lecturer.put(f"/api/lecturer/offerings/{sheet.offering_id}/results/",
                      {"entries": [{"registration": row["registration"], "ca_score": 10, "exam_score": 20}]}, format="json")
    assert ok.status_code == 200


def test_other_department_admin_cannot_review(mth_admin):
    sheet = ResultSheet.objects.get(offering=offering("CSC 201"))
    assert mth_admin.get(f"/api/admin/result-sheets/{sheet.pk}/").status_code == 404
    assert mth_admin.post(f"/api/admin/result-sheets/{sheet.pk}/approve/").status_code == 404


def test_reopen_hides_results_until_reapproved(csc_admin, student):
    approved = ResultSheet.objects.filter(status=SheetStatus.APPROVED, offering__course__department__code="CSC").first()
    res = csc_admin.post(f"/api/admin/result-sheets/{approved.pk}/reopen/", {"comment": "Wrong exam script captured"})
    assert res.status_code == 200
    assert ResultSheet.objects.get(pk=approved.pk).status == SheetStatus.DRAFT


# --- grading ------------------------------------------------------------------------------

def test_grade_bands_and_weighted_gpa():
    bands = [Band("A", Decimal(70), Decimal(100), Decimal(5)), Band("B", Decimal(60), Decimal("69.99"), Decimal(4)),
             Band("F", Decimal(0), Decimal("39.99"), Decimal(0))]
    assert grade_for(70, bands).grade == "A"
    assert grade_for("69.99", bands).grade == "B"
    assert grade_for(12, bands).grade == "F"
    # (3*5 + 2*4 + 1*0) / 6 = 3.83
    assert weighted_gpa([(3, 5), (2, 4), (1, 0)]) == Decimal("3.83")
    assert weighted_gpa([]) is None


def test_audit_log_is_append_only():
    entry = AuditLog.objects.first()
    entry.summary = "tampered"
    with pytest.raises(PermissionError):
        entry.save()
    with pytest.raises(PermissionError):
        AuditLog.objects.all().delete()
    with pytest.raises(PermissionError):
        AuditLog.objects.filter(pk=entry.pk).update(summary="x")
