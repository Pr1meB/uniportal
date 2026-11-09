"""Result entry, submission and departmental approval (Workflows 2 & 3).

Every state change is written to the audit log with before/after values.
"""
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import Role
from apps.accounts.permissions import ensure_same_department
from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.core.exceptions import BusinessRuleViolation, InvalidTransition
from apps.results.grading import load_bands
from apps.results.models import Result, ResultSheet, SheetStatus


# --- helpers -----------------------------------------------------------------

def ensure_allocated(lecturer, offering):
    if lecturer.role != Role.LECTURER or not offering.lecturers.filter(pk=lecturer.pk).exists():
        raise PermissionDenied("You are not allocated to this course.")


def get_sheet(offering) -> ResultSheet:
    sheet, _ = ResultSheet.objects.select_for_update().get_or_create(offering=offering)
    return sheet


def sync_result_rows(sheet: ResultSheet):
    """Make sure every registration on the offering has a Result row."""
    existing = set(sheet.results.values_list("registration_id", flat=True))
    missing = sheet.offering.registrations.exclude(pk__in=existing)
    Result.objects.bulk_create([Result(sheet=sheet, registration=reg) for reg in missing])


def _to_score(value, field, maximum):
    if value in (None, ""):
        return None
    try:
        score = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        raise BusinessRuleViolation(f"{field} must be a number.")
    if score < 0 or score > maximum:
        raise BusinessRuleViolation(f"{field} must be between 0 and {maximum}.")
    return score


def _num(v):
    return None if v is None else str(v)


# --- lecturer actions --------------------------------------------------------

@transaction.atomic
def save_scores(lecturer, offering, entries, request=None) -> ResultSheet:
    """Save CA/exam scores as a draft. `entries` = [{registration, ca_score, exam_score}]."""
    ensure_allocated(lecturer, offering)
    sheet = get_sheet(offering)
    if not sheet.is_editable:
        raise InvalidTransition(
            "These results are %s and can no longer be edited." % sheet.get_status_display().lower()
        )
    sync_result_rows(sheet)

    rows = {r.registration_id: r for r in sheet.results.select_for_update().select_related("registration__student__student_profile")}
    bands = load_bands()
    changes = []
    for entry in entries:
        reg_id = int(entry.get("registration"))
        row = rows.get(reg_id)
        if row is None:
            raise BusinessRuleViolation("A score was sent for a student who is not registered on this course.")
        ca = _to_score(entry.get("ca_score"), "CA score", settings.CA_MAX_SCORE)
        exam = _to_score(entry.get("exam_score"), "Exam score", settings.EXAM_MAX_SCORE)
        if (row.ca_score, row.exam_score) == (ca, exam):
            continue
        before = {"ca": _num(row.ca_score), "exam": _num(row.exam_score), "grade": row.grade}
        row.ca_score, row.exam_score = ca, exam
        row.compute(bands)
        row.updated_by = lecturer
        row.save()
        changes.append({
            "matric": row.registration.student.student_profile.matric_number,
            "before": before,
            "after": {"ca": _num(ca), "exam": _num(exam), "grade": row.grade},
        })

    if changes:
        sheet.save(update_fields=["updated_at"])
        record(
            actor=lecturer, action=AuditAction.RESULT_SAVE, entity=sheet,
            summary=f"Saved {len(changes)} score(s) for {offering.course.code}",
            changes={"rows": changes, "revision": sheet.revision}, request=request,
        )
    return sheet


@transaction.atomic
def submit_sheet(lecturer, offering, request=None) -> ResultSheet:
    ensure_allocated(lecturer, offering)
    sheet = get_sheet(offering)
    if not sheet.is_editable:
        raise InvalidTransition("Only draft or returned results can be submitted.")
    sync_result_rows(sheet)
    total = sheet.results.count()
    if total == 0:
        raise BusinessRuleViolation("There are no registered students on this course.")
    incomplete = sheet.results.filter(ca_score__isnull=True).count() + sheet.results.filter(
        ca_score__isnull=False, exam_score__isnull=True
    ).count()
    if incomplete:
        raise BusinessRuleViolation(f"{incomplete} student(s) still have missing scores.")

    previous = sheet.status
    sheet.status = SheetStatus.SUBMITTED
    sheet.submitted_by = lecturer
    sheet.submitted_at = timezone.now()
    sheet.save()
    record(
        actor=lecturer, action=AuditAction.RESULT_SUBMIT, entity=sheet,
        summary=f"Submitted {total} result(s) for {offering.course.code} for departmental review",
        changes={"from": previous, "to": sheet.status, "revision": sheet.revision}, request=request,
    )
    return sheet


# --- department admin actions -------------------------------------------------

def _ensure_reviewer(user, sheet):
    if user.role not in (Role.DEPT_ADMIN, Role.SUPER_ADMIN):
        raise PermissionDenied("Only department administrators can review results.")
    ensure_same_department(user, sheet.offering.course.department_id)
    if sheet.submitted_by_id == user.pk:
        raise PermissionDenied("You cannot review results you submitted.")


@transaction.atomic
def approve_sheet(user, sheet: ResultSheet, comment="", request=None) -> ResultSheet:
    sheet = ResultSheet.objects.select_for_update().get(pk=sheet.pk)
    _ensure_reviewer(user, sheet)
    if sheet.status != SheetStatus.SUBMITTED:
        raise InvalidTransition("Only submitted results can be approved.")
    sheet.status = SheetStatus.APPROVED
    sheet.reviewed_by = user
    sheet.reviewed_at = timezone.now()
    sheet.review_comment = comment
    sheet.save()
    record(
        actor=user, action=AuditAction.RESULT_APPROVE, entity=sheet,
        summary=f"Approved results for {sheet.offering.course.code}; now visible to students",
        changes={"from": SheetStatus.SUBMITTED, "to": SheetStatus.APPROVED, "comment": comment,
                 "revision": sheet.revision}, request=request,
    )
    return sheet


@transaction.atomic
def reject_sheet(user, sheet: ResultSheet, comment, request=None) -> ResultSheet:
    if not (comment or "").strip():
        raise BusinessRuleViolation("Please explain what needs to be corrected.")
    sheet = ResultSheet.objects.select_for_update().get(pk=sheet.pk)
    _ensure_reviewer(user, sheet)
    if sheet.status != SheetStatus.SUBMITTED:
        raise InvalidTransition("Only submitted results can be returned for correction.")
    sheet.status = SheetStatus.REJECTED
    sheet.reviewed_by = user
    sheet.reviewed_at = timezone.now()
    sheet.review_comment = comment.strip()
    sheet.revision += 1
    sheet.save()
    record(
        actor=user, action=AuditAction.RESULT_REJECT, entity=sheet,
        summary=f"Returned results for {sheet.offering.course.code} to the lecturer",
        changes={"from": SheetStatus.SUBMITTED, "to": SheetStatus.REJECTED, "comment": sheet.review_comment,
                 "revision": sheet.revision}, request=request,
    )
    return sheet


@transaction.atomic
def reopen_sheet(user, sheet: ResultSheet, reason, request=None) -> ResultSheet:
    """Authorised reopening of approved results (e.g. a discovered error)."""
    if not (reason or "").strip():
        raise BusinessRuleViolation("A reason is required to reopen approved results.")
    sheet = ResultSheet.objects.select_for_update().get(pk=sheet.pk)
    if user.role not in (Role.DEPT_ADMIN, Role.SUPER_ADMIN):
        raise PermissionDenied("Only administrators can reopen results.")
    ensure_same_department(user, sheet.offering.course.department_id)
    if sheet.status != SheetStatus.APPROVED:
        raise InvalidTransition("Only approved results can be reopened.")
    sheet.status = SheetStatus.DRAFT
    sheet.review_comment = reason.strip()
    sheet.reviewed_by = user
    sheet.reviewed_at = timezone.now()
    sheet.revision += 1
    sheet.save()
    record(
        actor=user, action=AuditAction.RESULT_REOPEN, entity=sheet,
        summary=f"Reopened approved results for {sheet.offering.course.code}; hidden from students until re-approved",
        changes={"from": SheetStatus.APPROVED, "to": SheetStatus.DRAFT, "reason": sheet.review_comment,
                 "revision": sheet.revision}, request=request,
    )
    return sheet
