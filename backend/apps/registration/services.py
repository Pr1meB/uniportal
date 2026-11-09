"""Course registration rules (Workflow 1).

A student may register an offering only if:
  * the semester is the current one and registration is open,
  * the course is attached to the student's program and matches their level
    and the semester's term,
  * they have not already registered it this semester (also a DB constraint),
  * the offering has capacity, and
  * the semester unit load stays within MAX_UNITS_PER_SEMESTER.
"""
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Count, Sum

from apps.academics.models import CourseOffering, Semester
from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.core.exceptions import BusinessRuleViolation
from apps.registration.models import CourseRegistration
from apps.results.models import SheetStatus


def current_semester_or_error() -> Semester:
    semester = Semester.current()
    if semester is None:
        raise BusinessRuleViolation("No academic semester is currently active.")
    return semester


def available_offerings(student, semester: Semester):
    profile = student.student_profile
    return (
        CourseOffering.objects.filter(
            semester=semester,
            course__is_active=True,
            course__programs=profile.program,
            course__level=profile.level,
            course__term=semester.term,
        )
        # once results are in review, the class list is frozen
        .exclude(result_sheet__status__in=[SheetStatus.SUBMITTED, SheetStatus.APPROVED])
        .select_related("course", "course__department")
        .prefetch_related("lecturers")
        .annotate(registered_count=Count("registrations", distinct=True))
        .distinct()
    )
