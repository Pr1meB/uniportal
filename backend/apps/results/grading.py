"""Grade lookup and GPA / CGPA calculation.

GPA  = Σ(course units × grade point) / Σ(course units) for one semester
CGPA = the same sum taken over every approved result to date

Only results on APPROVED sheets are counted. Values are rounded half-up to
two decimal places.
"""
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from apps.academics.models import DEFAULT_GRADE_BANDS, GradeBand

TWO_PLACES = Decimal("0.01")


@dataclass(frozen=True)
class Band:
    grade: str
    min_score: Decimal
    max_score: Decimal
    point: Decimal
    remark: str = ""


def load_bands() -> list[Band]:
    rows = list(GradeBand.objects.all())
    if rows:
        return [Band(r.grade, r.min_score, r.max_score, r.point, r.remark) for r in rows]
    return [Band(*row) for row in DEFAULT_GRADE_BANDS]


def grade_for(total, bands: list[Band]) -> Band:
    total = Decimal(total)
    for band in sorted(bands, key=lambda b: b.min_score, reverse=True):
        if total >= band.min_score:
            return band
    return min(bands, key=lambda b: b.min_score)


def weighted_gpa(rows) -> Decimal | None:
    """rows: iterable of (units, grade_point)."""
    total_units = Decimal(0)
    total_points = Decimal(0)
    for units, point in rows:
        if point is None:
            continue
        total_units += Decimal(units)
        total_points += Decimal(units) * Decimal(point)
    if not total_units:
        return None
    return (total_points / total_units).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def degree_class(cgpa: Decimal | None) -> str:
    if cgpa is None:
        return "—"
    if cgpa >= Decimal("4.50"):
        return "First Class"
    if cgpa >= Decimal("3.50"):
        return "Second Class Upper"
    if cgpa >= Decimal("2.40"):
        return "Second Class Lower"
    if cgpa >= Decimal("1.50"):
        return "Third Class"
    if cgpa >= Decimal("1.00"):
        return "Pass"
    return "Fail"
