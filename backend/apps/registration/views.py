from django.conf import settings
from django.db.models import Sum
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.serializers import CourseOfferingSerializer, SemesterSerializer
from apps.accounts.permissions import IsAdministrator, IsStudent, scope_to_department
from apps.registration import services
from apps.registration.models import CourseRegistration


class RegistrationSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    units = serializers.IntegerField(source="course.units", read_only=True)
    level = serializers.IntegerField(source="course.level", read_only=True)
    semester_label = serializers.CharField(source="semester.__str__", read_only=True)
    student_name = serializers.CharField(source="student.get_full_name", read_only=True)
    matric_number = serializers.CharField(source="student.student_profile.matric_number", read_only=True)
    student_level = serializers.IntegerField(source="student.student_profile.level", read_only=True)
    program = serializers.CharField(source="student.student_profile.program.code", read_only=True)
    lecturers = serializers.SerializerMethodField()
    result_status = serializers.CharField(source="offering.result_sheet.status", read_only=True, default=None)

    class Meta:
        model = CourseRegistration
        fields = ["id", "offering", "course_code", "course_title", "units", "level", "semester", "semester_label",
                  "student", "student_name", "matric_number", "student_level", "program", "lecturers",
                  "result_status", "created_at"]

    def get_lecturers(self, obj):
        return [l.get_full_name() for l in obj.offering.lecturers.all()]


class RegisterInputSerializer(serializers.Serializer):
    offerings = serializers.ListField(child=serializers.IntegerField(), allow_empty=False, max_length=20)


def _registration_qs():
    return CourseRegistration.objects.select_related(
        "course", "semester__session", "student__student_profile__program", "offering__result_sheet"
    ).prefetch_related("offering__lecturers")


class StudentCoursesView(APIView):
    """Current-semester registration page for the signed-in student."""

    permission_classes = [IsStudent]

    def get(self, request):
        semester = services.current_semester_or_error()
        student = request.user
        regs = _registration_qs().filter(student=student, semester=semester)
        registered_ids = {r.offering_id for r in regs}
        available = services.available_offerings(student, semester)
        return Response({
            "semester": SemesterSerializer(semester).data,
            "max_units": settings.MAX_UNITS_PER_SEMESTER,
            "registered_units": services.registered_units(student, semester),
            "registered": RegistrationSerializer(regs, many=True).data,
            "available": [
                {**CourseOfferingSerializer(o, context={"request": request}).data, "is_registered": o.pk in registered_ids}
                for o in available
            ],
        })

    @extend_schema(request=RegisterInputSerializer, responses=RegistrationSerializer(many=True))
    def post(self, request):
        s = RegisterInputSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        created = services.register_courses(request.user, s.validated_data["offerings"], request=request)
        return Response(RegistrationSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


class StudentDropView(APIView):
    permission_classes = [IsStudent]

    def delete(self, request, pk):
        reg = _registration_qs().filter(student=request.user, pk=pk).first()
        if reg is None:
            return Response({"detail": "Registration not found.", "code": "not_found", "errors": {}}, status=404)
        services.drop_course(request.user, reg, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class StudentRegistrationHistoryView(APIView):
    """Every semester's registration slip, used for printing."""

    permission_classes = [IsStudent]

    def get(self, request):
        regs = _registration_qs().filter(student=request.user).order_by("-semester__session__start_date", "-semester__term", "course__code")
        semester_id = request.query_params.get("semester")
        if semester_id:
            regs = regs.filter(semester_id=semester_id)
        grouped = {}
        for r in regs:
            g = grouped.setdefault(r.semester_id, {"semester": SemesterSerializer(r.semester).data, "courses": [], "units": 0})
            g["courses"].append(RegistrationSerializer(r).data)
            g["units"] += r.course.units
        return Response(list(grouped.values()))


class RegistrationAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Department admins see registrations in their department; super admin sees all."""

    serializer_class = RegistrationSerializer
    permission_classes = [IsAdministrator]
    filterset_fields = {"semester": ["exact"], "course": ["exact"], "offering": ["exact"],
                        "student__student_profile__level": ["exact"], "course__department": ["exact"]}
    search_fields = ["student__first_name", "student__last_name", "student__student_profile__matric_number", "course__code"]
    ordering_fields = ["created_at", "course__code"]

    def get_queryset(self):
        qs = _registration_qs()
        if self.request.query_params.get("current") == "1":
            qs = qs.filter(semester__is_current=True)
        # Scope by the *student's* department so admins see their own students' registrations.
        return scope_to_department(qs, self.request.user, field="student__department")
