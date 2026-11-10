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


class AcademicSessionViewSet(AuditedModelViewSet):
    serializer_class = AcademicSessionSerializer
    permission_classes = [IsAdministrator, ReadOnlyForDeptAdmin]
    audit_label = "academic session"
    queryset = AcademicSession.objects.prefetch_related("semesters__session")

    def perform_create(self, serializer):
        """Creating a session also creates its two semesters."""
        super().perform_create(serializer)
        session = serializer.instance
        for term in Term.values:
            Semester.objects.get_or_create(session=session, term=term)

    def perform_destroy(self, instance):
        if CourseOffering.objects.filter(semester__session=instance).exists():
            raise BusinessRuleViolation("Courses have been offered in this session; it cannot be deleted.")
        instance.semesters.all().delete()
        super().perform_destroy(instance)


class SemesterViewSet(AuditedModelViewSet):
    serializer_class = SemesterSerializer
    permission_classes = [IsAdministrator, ReadOnlyForDeptAdmin]
    filterset_fields = ["session", "term", "is_current"]
    audit_label = "semester"
    queryset = Semester.objects.select_related("session")
    http_method_names = ["get", "patch", "post", "head", "options"]

    @action(detail=True, methods=["post"], url_path="make-current")
    def make_current(self, request, pk=None):
        semester = self.get_object()
        previous = Semester.current()
        semester.make_current()
        record(actor=request.user, action=AuditAction.SEMESTER_CHANGE, entity=semester,
               summary=f"Current semester set to {semester}",
               changes={"from": str(previous) if previous else None, "to": str(semester)}, request=request)
        return Response(SemesterSerializer(semester).data)

    @action(detail=True, methods=["post"], url_path="toggle-registration")
    def toggle_registration(self, request, pk=None):
        semester = self.get_object()
        if not semester.is_current and not semester.registration_open:
            raise BusinessRuleViolation("Registration can only be opened for the current semester.")
        semester.registration_open = not semester.registration_open
        semester.save(update_fields=["registration_open", "updated_at"])
        record(actor=request.user, action=AuditAction.UPDATE, entity=semester,
               summary=f"Registration {'opened' if semester.registration_open else 'closed'} for {semester}",
               request=request)
        return Response(SemesterSerializer(semester).data)


class CourseViewSet(AuditedModelViewSet):
    serializer_class = CourseSerializer
    permission_classes = [IsAdministrator]
    filterset_fields = ["department", "level", "term", "is_active", "programs"]
    search_fields = ["code", "title"]
    ordering_fields = ["code", "level", "units"]
    audit_label = "course"

    def get_queryset(self):
        qs = Course.objects.select_related("department").prefetch_related("programs").distinct()
        return scope_to_department(qs, self.request.user)

    def perform_destroy(self, instance):
        if instance.offerings.exists():
            raise BusinessRuleViolation("This course has been offered before; deactivate it instead.")
        super().perform_destroy(instance)


class CourseOfferingViewSet(AuditedModelViewSet):
    """Courses running in a semester + lecturer allocation."""

    serializer_class = CourseOfferingSerializer
    permission_classes = [IsAdministrator]
    filterset_fields = {"semester": ["exact"], "course__level": ["exact"], "course__department": ["exact"],
                        "result_sheet__status": ["exact"]}
    search_fields = ["course__code", "course__title"]
    audit_label = "course offering"

    def get_queryset(self):
        qs = (
            CourseOffering.objects.select_related("course__department", "semester__session", "result_sheet")
            .prefetch_related("course__programs", Prefetch("lecturers", queryset=User.objects.select_related("lecturer_profile")))
            .annotate(registered_count=Count("registrations", distinct=True))
            .order_by("-semester__session__start_date", "course__code")
        )
        if self.request.query_params.get("current") == "1":
            qs = qs.filter(semester__is_current=True)
        return scope_to_department(qs, self.request.user, field="course__department")

    def perform_destroy(self, instance):
        if instance.registrations.exists():
            raise BusinessRuleViolation("Students have registered this course; it cannot be withdrawn.")
        super().perform_destroy(instance)

    @extend_schema(request=AllocationSerializer, responses=CourseOfferingSerializer)
    @action(detail=True, methods=["post"])
    def allocate(self, request, pk=None):
        offering = self.get_object()
        s = AllocationSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        lecturers = s.validated_data["lecturers"]
        for lec in lecturers:
            if lec.department_id != offering.course.department_id:
                raise BusinessRuleViolation(f"{lec.get_full_name()} is not in this course's department.")
            if not lec.is_active:
                raise BusinessRuleViolation(f"{lec.get_full_name()}'s account is not active.")
        before = sorted(offering.lecturers.values_list("email", flat=True))
        offering.lecturers.set(lecturers)
        record(actor=request.user, action=AuditAction.ALLOCATE, entity=offering,
               summary=f"Allocated {len(lecturers)} lecturer(s) to {offering.course.code}",
               changes={"before": before, "after": sorted(l.email for l in lecturers)}, request=request)
        return Response(self.get_serializer(self.get_queryset().get(pk=offering.pk)).data)

    @action(detail=False, methods=["post"], url_path="bulk-offer")
    def bulk_offer(self, request):
        """Offer all active courses of the matching term in the current semester."""
        semester = Semester.current()
        if semester is None:
            raise BusinessRuleViolation("Set a current semester first.")
        courses = scope_to_department(Course.objects.filter(is_active=True, term=semester.term), request.user)
        created = 0
        for course in courses:
            _, was_created = CourseOffering.objects.get_or_create(course=course, semester=semester)
            created += was_created
        record(actor=request.user, action=AuditAction.CREATE, entity=semester, entity_type="academics.CourseOffering",
               department=request.user.department, summary=f"Offered {created} course(s) for {semester}",
               request=request)
        return Response({"created": created}, status=status.HTTP_201_CREATED)


class GradeBandViewSet(AuditedModelViewSet):
    serializer_class = GradeBandSerializer
    permission_classes = [IsAdministrator, ReadOnlyForDeptAdmin]
    queryset = GradeBand.objects.all()
    pagination_class = None
    audit_label = "grade band"


class LookupsView(APIView):
    """Small reference lists every signed-in user needs for forms and labels."""

    def get(self, request):
        user = request.user
        current = Semester.current()
        departments = scope_to_department(Department.objects.select_related("faculty"), user, field="pk") \
            if user.role != Role.STUDENT else Department.objects.none()
        programs = scope_to_department(Program.objects.all(), user) if user.role != Role.STUDENT else Program.objects.none()
        return Response({
            "current_semester": SemesterSerializer(current).data if current else None,
            "faculties": list(Faculty.objects.values("id", "name", "code")) if user.role != Role.STUDENT else [],
            "departments": [{"id": d.id, "name": d.name, "code": d.code, "faculty": d.faculty_id} for d in departments],
            "programs": [{"id": p.id, "name": str(p), "code": p.code, "department": p.department_id, "levels": p.levels}
                         for p in programs],
            "levels": [{"value": v, "label": l} for v, l in Level.choices],
            "terms": [{"value": v, "label": l} for v, l in Term.choices],
            "semesters": SemesterSerializer(Semester.objects.select_related("session")[:12], many=True).data,
            "grading": {
                "ca_max": settings.CA_MAX_SCORE,
                "exam_max": settings.EXAM_MAX_SCORE,
                "max_units": settings.MAX_UNITS_PER_SEMESTER,
                "bands": [b.__dict__ for b in load_bands()],
            },
        })
