from django.conf import settings
from django.db.models import Count, Prefetch, Q
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import (
    AcademicSession,
    Course,
    CourseOffering,
    Department,
    Faculty,
    GradeBand,
    Level,
    Program,
    Semester,
    Term,
)
from apps.academics.serializers import (
    AcademicSessionSerializer,
    AllocationSerializer,
    CourseOfferingSerializer,
    CourseSerializer,
    DepartmentSerializer,
    FacultySerializer,
    GradeBandSerializer,
    ProgramSerializer,
    SemesterSerializer,
)
from apps.accounts.models import Role, User
from apps.accounts.permissions import (
    IsAdministrator,
    IsSuperAdmin,
    ReadOnlyForDeptAdmin,
    ensure_same_department,
    scope_to_department,
)
from apps.accounts.views import AuditedModelViewSet
from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.core.exceptions import BusinessRuleViolation
from apps.results.grading import load_bands


class FacultyViewSet(AuditedModelViewSet):
    serializer_class = FacultySerializer
    permission_classes = [IsAdministrator, ReadOnlyForDeptAdmin]
    search_fields = ["name", "code"]
    audit_label = "faculty"

    def get_queryset(self):
        return Faculty.objects.annotate(
            department_count=Count("departments", distinct=True),
            student_count=Count("departments__users", filter=Q(departments__users__role=Role.STUDENT), distinct=True),
        ).order_by("name")

    def perform_destroy(self, instance):
        if instance.departments.exists():
            raise BusinessRuleViolation("Remove or move this faculty's departments first.")
        super().perform_destroy(instance)


class DepartmentViewSet(AuditedModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = [IsAdministrator, ReadOnlyForDeptAdmin]
    filterset_fields = ["faculty", "is_active"]
    search_fields = ["name", "code"]
    audit_label = "department"

    def get_queryset(self):
        qs = Department.objects.select_related("faculty").annotate(
            student_count=Count("users", filter=Q(users__role=Role.STUDENT), distinct=True),
            lecturer_count=Count("users", filter=Q(users__role=Role.LECTURER), distinct=True),
            course_count=Count("courses", distinct=True),
        ).order_by("name")
        return scope_to_department(qs, self.request.user, field="pk")

    def perform_destroy(self, instance):
        if instance.users.exists() or instance.courses.exists():
            raise BusinessRuleViolation("This department still has users or courses and cannot be deleted.")
        super().perform_destroy(instance)


class ProgramViewSet(AuditedModelViewSet):
    serializer_class = ProgramSerializer
    permission_classes = [IsAdministrator]
    filterset_fields = ["department", "is_active"]
    search_fields = ["name", "code"]
    audit_label = "program"

    def get_queryset(self):
        qs = Program.objects.select_related("department").annotate(student_count=Count("students", distinct=True)).order_by("name")
        return scope_to_department(qs, self.request.user)

    def perform_destroy(self, instance):
        if instance.students.exists():
            raise BusinessRuleViolation("Students are enrolled on this program; deactivate it instead.")
        super().perform_destroy(instance)
