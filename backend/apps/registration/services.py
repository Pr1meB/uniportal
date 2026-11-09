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


def registered_units(student, semester) -> int:
    return (
        CourseRegistration.objects.filter(student=student, semester=semester).aggregate(u=Sum("course__units"))["u"] or 0
    )


@transaction.atomic
def register_courses(student, offering_ids, request=None):
    semester = current_semester_or_error()
    if not semester.registration_open:
        raise BusinessRuleViolation("Course registration is closed for %s." % semester)

    offering_ids = list(dict.fromkeys(int(i) for i in offering_ids))  # dedupe, keep order
    if not offering_ids:
        raise BusinessRuleViolation("Select at least one course.")

    allowed = {o.pk: o for o in available_offerings(student, semester)}
    not_allowed = [i for i in offering_ids if i not in allowed]
    if not_allowed:
        raise BusinessRuleViolation("One or more selected courses are not available to you this semester.")

    already = set(
        CourseRegistration.objects.filter(student=student, semester=semester, offering_id__in=offering_ids)
        .values_list("offering__course__code", flat=True)
    )
    if already:
        raise BusinessRuleViolation("You have already registered: %s." % ", ".join(sorted(already)))

    new_units = sum(allowed[i].course.units for i in offering_ids)
    load = registered_units(student, semester) + new_units
    if load > settings.MAX_UNITS_PER_SEMESTER:
        raise BusinessRuleViolation(
            "This would bring you to %d units; the maximum per semester is %d."
            % (load, settings.MAX_UNITS_PER_SEMESTER)
        )

    created = []
    for oid in offering_ids:
        offering = allowed[oid]
        if offering.capacity is not None and offering.registered_count >= offering.capacity:
            raise BusinessRuleViolation("%s is full." % offering.course.code)
        try:
            with transaction.atomic():
                reg = CourseRegistration.objects.create(student=student, offering=offering, registered_by=student)
        except IntegrityError:
            raise BusinessRuleViolation("%s is already registered." % offering.course.code)
        created.append(reg)

    record(
        actor=student, action=AuditAction.COURSE_REGISTER, entity=None, entity_type="registration.CourseRegistration",
        department=student.department,
        summary="%s registered %d course(s): %s"
        % (student.student_profile.matric_number, len(created), ", ".join(r.course.code for r in created)),
        changes={"courses": [r.course.code for r in created], "semester": str(semester), "total_units": load},
        request=request,
    )
    return created
