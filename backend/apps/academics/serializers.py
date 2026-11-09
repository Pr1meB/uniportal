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
