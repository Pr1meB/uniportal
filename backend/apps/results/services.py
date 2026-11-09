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

    rows = {r.registration_id: r for r in sheet.results.select_for_update(of=("self",)).select_related("registration__student__student_profile")}
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
