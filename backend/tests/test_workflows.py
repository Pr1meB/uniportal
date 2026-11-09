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
