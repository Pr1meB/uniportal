from rest_framework import serializers

from apps.academics.models import (
    AcademicSession,
    Course,
    CourseOffering,
    Department,
    Faculty,
    GradeBand,
    Program,
    Semester,
)
from apps.accounts.models import Role, User
from apps.accounts.permissions import ensure_same_department


class FacultySerializer(serializers.ModelSerializer):
    department_count = serializers.IntegerField(read_only=True, default=0)
    student_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Faculty
        fields = ["id", "name", "code", "is_active", "department_count", "student_count", "created_at"]


class DepartmentSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source="faculty.name", read_only=True)
    student_count = serializers.IntegerField(read_only=True, default=0)
    lecturer_count = serializers.IntegerField(read_only=True, default=0)
    course_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Department
        fields = ["id", "name", "code", "faculty", "faculty_name", "is_active", "student_count", "lecturer_count",
                  "course_count", "created_at"]


class ProgramSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    levels = serializers.ListField(child=serializers.IntegerField(), read_only=True)
    student_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Program
        fields = ["id", "name", "code", "degree", "duration_years", "department", "department_name", "levels",
                  "is_active", "student_count"]
        extra_kwargs = {"department": {"required": False}}

    def validate(self, attrs):
        user = self.context["request"].user
        dept = attrs.get("department") or getattr(self.instance, "department", None) or user.department
        if dept is None:
            raise serializers.ValidationError({"department": "Department is required."})
        ensure_same_department(user, dept)
        attrs["department"] = dept
        return attrs


class SemesterSerializer(serializers.ModelSerializer):
    session_name = serializers.CharField(source="session.name", read_only=True)
    term_display = serializers.CharField(source="get_term_display", read_only=True)
    label = serializers.CharField(source="__str__", read_only=True)

    class Meta:
        model = Semester
        fields = ["id", "session", "session_name", "term", "term_display", "label", "is_current",
                  "registration_open", "start_date", "end_date"]
        read_only_fields = ["is_current"]


class AcademicSessionSerializer(serializers.ModelSerializer):
    semesters = SemesterSerializer(many=True, read_only=True)

    class Meta:
        model = AcademicSession
        fields = ["id", "name", "start_date", "end_date", "is_current", "semesters"]
        read_only_fields = ["is_current"]

    def validate_name(self, value):
        import re

        if not re.fullmatch(r"\d{4}/\d{4}", value) or int(value[5:]) != int(value[:4]) + 1:
            raise serializers.ValidationError("Use the format 2025/2026.")
        return value

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"end_date": "End date must be after the start date."})
        return attrs


class LecturerMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    staff_id = serializers.CharField(source="lecturer_profile.staff_id", read_only=True, default=None)

    class Meta:
        model = User
        fields = ["id", "full_name", "email", "staff_id"]

    def get_full_name(self, obj):
        title = getattr(getattr(obj, "lecturer_profile", None), "title", "")
        return f"{title} {obj.get_full_name()}".strip()


class CourseSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    level_display = serializers.CharField(source="get_level_display", read_only=True)
    term_display = serializers.CharField(source="get_term_display", read_only=True)
    program_names = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "code", "title", "units", "level", "level_display", "term", "term_display", "description",
                  "is_elective", "is_active", "department", "department_name", "programs", "program_names"]
        extra_kwargs = {"department": {"required": False}}

    def get_program_names(self, obj):
        return [p.code for p in obj.programs.all()]

    def validate_code(self, value):
        return value.upper().replace("  ", " ").strip()

    def validate(self, attrs):
        user = self.context["request"].user
        dept = attrs.get("department") or getattr(self.instance, "department", None) or user.department
        if dept is None:
            raise serializers.ValidationError({"department": "Department is required."})
        ensure_same_department(user, dept)
        attrs["department"] = dept
        return attrs


class CourseOfferingSerializer(serializers.ModelSerializer):
    course_detail = CourseSerializer(source="course", read_only=True)
    semester_label = serializers.CharField(source="semester.__str__", read_only=True)
    lecturer_details = LecturerMiniSerializer(source="lecturers", many=True, read_only=True)
    registered_count = serializers.IntegerField(read_only=True, default=0)
    result_status = serializers.CharField(source="result_sheet.status", read_only=True, default=None)
    lecturers = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=User.objects.filter(role=Role.LECTURER)
    )

    class Meta:
        model = CourseOffering
        fields = ["id", "course", "course_detail", "semester", "semester_label", "lecturers", "lecturer_details",
                  "capacity", "registered_count", "result_status"]

    def validate(self, attrs):
        user = self.context["request"].user
        course = attrs.get("course") or self.instance.course
        semester = attrs.get("semester") or self.instance.semester
        ensure_same_department(user, course.department_id)
        if course.term != semester.term:
            raise serializers.ValidationError({"semester": f"{course.code} is a {course.get_term_display()} course."})
        for lecturer in attrs.get("lecturers", []):
            if lecturer.department_id != course.department_id:
                raise serializers.ValidationError(
                    {"lecturers": f"{lecturer.get_full_name()} is not in the {course.department.name} department."}
                )
        return attrs


class AllocationSerializer(serializers.Serializer):
    lecturers = serializers.PrimaryKeyRelatedField(many=True, queryset=User.objects.filter(role=Role.LECTURER))


class GradeBandSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeBand
        fields = ["id", "grade", "min_score", "max_score", "point", "remark"]

    def validate(self, attrs):
        lo = attrs.get("min_score", getattr(self.instance, "min_score", None))
        hi = attrs.get("max_score", getattr(self.instance, "max_score", None))
        if lo is not None and hi is not None:
            if hi < lo:
                raise serializers.ValidationError({"max_score": "Max must be greater than min."})
            clash = GradeBand.objects.filter(min_score__lte=hi, max_score__gte=lo)
            if self.instance:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                raise serializers.ValidationError(f"This range overlaps grade {clash.first().grade}.")
        return attrs
