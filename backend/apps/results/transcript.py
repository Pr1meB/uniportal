"""Builds a student's academic record from APPROVED results only."""
from collections import OrderedDict

from apps.results.grading import degree_class, weighted_gpa
from apps.results.models import Result, SheetStatus


def approved_results(student):
    return (
        Result.objects.filter(registration__student=student, sheet__status=SheetStatus.APPROVED)
        .select_related("registration__course", "registration__semester__session")
        .order_by("registration__semester__session__start_date", "registration__semester__term", "registration__course__code")
    )


def build_transcript(student):
    semesters = OrderedDict()
    for r in approved_results(student):
        sem = r.registration.semester
        bucket = semesters.setdefault(sem.pk, {
            "semester_id": sem.pk,
            "session": sem.session.name,
            "term": sem.term,
            "label": str(sem),
            "courses": [],
        })
        course = r.registration.course
        bucket["courses"].append({
            "code": course.code,
            "title": course.title,
            "units": course.units,
            "ca_score": r.ca_score,
            "exam_score": r.exam_score,
            "total": r.total,
            "grade": r.grade,
            "grade_point": r.grade_point,
        })

    cumulative = []
    out = []
    for bucket in semesters.values():
        rows = [(c["units"], c["grade_point"]) for c in bucket["courses"]]
        cumulative.extend(rows)
        bucket["units"] = sum(u for u, _ in rows)
        bucket["units_passed"] = sum(u for u, p in rows if p and p > 0)
        bucket["gpa"] = weighted_gpa(rows)
        bucket["cgpa"] = weighted_gpa(cumulative)
        out.append(bucket)

    cgpa = weighted_gpa(cumulative)
    return {
        "semesters": out,
        "cgpa": cgpa,
        "total_units": sum(u for u, _ in cumulative),
        "units_passed": sum(u for u, p in cumulative if p and p > 0),
        "degree_class": degree_class(cgpa),
    }
