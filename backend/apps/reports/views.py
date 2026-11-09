"""Dashboards and reports. Every query is scoped with scope_to_department."""
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Course, CourseOffering, Department, Faculty, Semester
from apps.accounts.models import AccountStatus, Role, User
from apps.accounts.permissions import IsAdministrator, IsLecturer, IsStudent, scope_to_department
from apps.audit.models import AuditLog
from apps.audit.views import AuditLogSerializer
from apps.registration.models import CourseRegistration
from apps.results.grading import weighted_gpa
from apps.results.models import Result, ResultSheet, SheetStatus
from apps.results.transcript import build_transcript


def _sheet_status_counts(qs):
    counts = dict(qs.values_list("status").annotate(n=Count("id")))
    return {s: counts.get(s, 0) for s in SheetStatus.values}


class AdminDashboardView(APIView):
    """University-wide for super admin, department-wide for department admin."""

    permission_classes = [IsAdministrator]

    def get(self, request):
        user = request.user
        semester = Semester.current()
        users = scope_to_department(User.objects.all(), user)
        offerings = scope_to_department(CourseOffering.objects.filter(semester=semester), user, "course__department")
        regs = scope_to_department(CourseRegistration.objects.filter(semester=semester), user, "student__department")
        sheets = scope_to_department(ResultSheet.objects.filter(offering__semester=semester), user, "offering__course__department")
        logs = scope_to_department(AuditLog.objects.select_related("actor", "department"), user)

        offered = offerings.count()
        sheet_counts = _sheet_status_counts(sheets)
        allocated = offerings.filter(lecturers__isnull=False).distinct().count()
        since = timezone.now() - timezone.timedelta(days=13)
        activity = (
            logs.filter(created_at__gte=since).annotate(day=TruncDate("created_at")).values("day")
            .annotate(n=Count("id")).order_by("day")
        )
        by_level = (
            regs.values("student__student_profile__level").annotate(n=Count("id")).order_by("student__student_profile__level")
        )

        data = {
            "scope": "university" if user.is_super_admin else "department",
            "department": user.department.name if user.department_id else None,
            "semester": str(semester) if semester else None,
            "registration_open": bool(semester and semester.registration_open),
            "counts": {
                "students": users.filter(role=Role.STUDENT).count(),
                "active_students": users.filter(role=Role.STUDENT, status=AccountStatus.ACTIVE).count(),
                "lecturers": users.filter(role=Role.LECTURER).count(),
                "courses": scope_to_department(Course.objects.filter(is_active=True), user).count(),
                "offerings": offered,
                "registrations": regs.count(),
                "students_registered": regs.values("student").distinct().count(),
                "unallocated_offerings": offered - allocated,
                "suspended_accounts": users.exclude(status=AccountStatus.ACTIVE).count(),
            },
            "results": {
                **sheet_counts,
                "not_started": offered - sum(sheet_counts.values()),
            },
            "registrations_by_level": [{"level": r["student__student_profile__level"], "count": r["n"]} for r in by_level],
            "activity": [{"day": a["day"], "count": a["n"]} for a in activity],
            "recent_activity": AuditLogSerializer(logs[:8], many=True).data,
        }
        if user.is_super_admin:
            data["counts"]["faculties"] = Faculty.objects.count()
            data["counts"]["departments"] = Department.objects.count()
            data["departments"] = list(
                Department.objects.annotate(
                    students=Count("users", filter=Q(users__role=Role.STUDENT), distinct=True),
                    lecturers=Count("users", filter=Q(users__role=Role.LECTURER), distinct=True),
                    pending=Count("courses__offerings__result_sheet", filter=Q(
                        courses__offerings__semester=semester, courses__offerings__result_sheet__status=SheetStatus.SUBMITTED
                    ), distinct=True),
                    approved=Count("courses__offerings__result_sheet", filter=Q(
                        courses__offerings__semester=semester, courses__offerings__result_sheet__status=SheetStatus.APPROVED
                    ), distinct=True),
                ).values("id", "name", "code", "students", "lecturers", "pending", "approved")
            )
        return Response(data)


class LecturerDashboardView(APIView):
    permission_classes = [IsLecturer]

    def get(self, request):
        semester = Semester.current()
        offerings = CourseOffering.objects.filter(lecturers=request.user, semester=semester).select_related(
            "course", "result_sheet"
        ).annotate(students=Count("registrations", distinct=True))
        courses = []
        for o in offerings:
            sheet = getattr(o, "result_sheet", None)
            agg = sheet.results.aggregate(avg=Avg("total"), passed=Count("id", filter=Q(grade_point__gt=0)),
                                          entered=Count("id", filter=Q(total__isnull=False))) if sheet else {}
            courses.append({
                "id": o.pk, "code": o.course.code, "title": o.course.title, "units": o.course.units,
                "level": o.course.level, "students": o.students,
                "status": sheet.status if sheet else None,
                "review_comment": sheet.review_comment if sheet and sheet.status == SheetStatus.REJECTED else "",
                "average": agg.get("avg"), "passed": agg.get("passed"), "entered": agg.get("entered", 0),
            })
        return Response({
            "semester": str(semester) if semester else None,
            "courses": courses,
            "totals": {
                "courses": len(courses),
                "students": sum(c["students"] for c in courses),
                "pending_entry": sum(1 for c in courses if c["status"] in (None, SheetStatus.DRAFT, SheetStatus.REJECTED)),
                "awaiting_review": sum(1 for c in courses if c["status"] == SheetStatus.SUBMITTED),
                "approved": sum(1 for c in courses if c["status"] == SheetStatus.APPROVED),
                "returned": sum(1 for c in courses if c["status"] == SheetStatus.REJECTED),
            },
        })


class StudentDashboardView(APIView):
    permission_classes = [IsStudent]

    def get(self, request):
        semester = Semester.current()
        regs = CourseRegistration.objects.filter(student=request.user, semester=semester).select_related("course")
        transcript = build_transcript(request.user)
        return Response({
            "semester": str(semester) if semester else None,
            "registration_open": bool(semester and semester.registration_open),
            "registered_courses": regs.count(),
            "registered_units": sum(r.course.units for r in regs),
            "cgpa": transcript["cgpa"],
            "degree_class": transcript["degree_class"],
            "units_passed": transcript["units_passed"],
            "gpa_trend": [{"label": s["label"], "gpa": s["gpa"], "cgpa": s["cgpa"]} for s in transcript["semesters"]],
            "last_gpa": transcript["semesters"][-1]["gpa"] if transcript["semesters"] else None,
        })


class DepartmentPerformanceReport(APIView):
    """Course-by-course performance for a semester (approved results only)."""

    permission_classes = [IsAdministrator]

    def get(self, request):
        semester_id = request.query_params.get("semester") or getattr(Semester.current(), "pk", None)
        sheets = scope_to_department(
            ResultSheet.objects.filter(offering__semester_id=semester_id, status=SheetStatus.APPROVED),
            request.user, "offering__course__department",
        ).select_related("offering__course__department")
        dept = request.query_params.get("department")
        if dept:
            sheets = sheets.filter(offering__course__department_id=dept)
        rows = []
        for sheet in sheets.annotate(
            n=Count("results"), avg=Avg("results__total"),
            passed=Count("results", filter=Q(results__grade_point__gt=0)),
        ).order_by("offering__course__code"):
            c = sheet.offering.course
            rows.append({
                "code": c.code, "title": c.title, "units": c.units, "level": c.level, "department": c.department.code,
                "students": sheet.n, "average": round(sheet.avg, 2) if sheet.avg is not None else None,
                "pass_rate": round(sheet.passed * 100 / sheet.n, 1) if sheet.n else None,
            })
        return Response({"semester": semester_id, "courses": rows})


class StudentStandingReport(APIView):
    """CGPA standing of students (approved results only)."""

    permission_classes = [IsAdministrator]

    def get(self, request):
        students = scope_to_department(User.objects.filter(role=Role.STUDENT), request.user).select_related(
            "student_profile__program", "department"
        )
        level = request.query_params.get("level")
        if level:
            students = students.filter(student_profile__level=level)
        results = (
            Result.objects.filter(sheet__status=SheetStatus.APPROVED, registration__student__in=students)
            .values_list("registration__student_id", "registration__course__units", "grade_point")
        )
        by_student = {}
        for sid, units, point in results:
            by_student.setdefault(sid, []).append((units, point))
        rows = []
        for s in students:
            pts = by_student.get(s.pk, [])
            rows.append({
                "id": s.pk, "name": s.get_full_name(), "matric_number": s.student_profile.matric_number,
                "program": s.student_profile.program.code, "level": s.student_profile.level,
                "department": s.department.code, "units": sum(u for u, _ in pts), "cgpa": weighted_gpa(pts),
            })
        rows.sort(key=lambda r: (r["cgpa"] is None, -(r["cgpa"] or 0)))
        return Response(rows)
