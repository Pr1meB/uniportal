from django.contrib.auth import password_validation
from django.db import transaction
from rest_framework import serializers

from apps.academics.models import Department
from apps.accounts.models import AccountStatus, LecturerProfile, Role, StudentProfile, User
from apps.accounts.permissions import ensure_same_department


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False)
    new_password = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        password_validation.validate_password(attrs["new_password"], user)
        return attrs


class DepartmentMiniSerializer(serializers.ModelSerializer):
    faculty = serializers.CharField(source="faculty.name", read_only=True)

    class Meta:
        model = Department
        fields = ["id", "name", "code", "faculty"]


class StudentProfileSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source="program.__str__", read_only=True)
    level_display = serializers.CharField(source="get_level_display", read_only=True)
    entry_session_name = serializers.CharField(source="entry_session.name", read_only=True, default=None)

    class Meta:
        model = StudentProfile
        fields = [
            "matric_number", "program", "program_name", "level", "level_display", "entry_session",
            "entry_session_name", "date_of_birth", "gender", "address", "next_of_kin", "next_of_kin_phone",
        ]
        # uniqueness is checked in the parent serializer, which knows the instance being edited
        extra_kwargs = {"matric_number": {"validators": []}}


class LecturerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = LecturerProfile
        fields = ["staff_id", "title", "rank", "specialization", "office"]
        extra_kwargs = {"staff_id": {"validators": []}}


class MeSerializer(serializers.ModelSerializer):
    """The current user, including role-specific profile data."""

    full_name = serializers.CharField(source="get_full_name", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    department = DepartmentMiniSerializer(read_only=True)
    student_profile = StudentProfileSerializer(read_only=True)
    lecturer_profile = LecturerProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name", "phone", "role", "role_display",
            "department", "status", "must_change_password", "last_login", "student_profile", "lecturer_profile",
        ]


class StudentSelfUpdateSerializer(serializers.Serializer):
    """Fields a student may change on their own record — nothing academic."""

    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    next_of_kin = serializers.CharField(max_length=150, required=False, allow_blank=True)
    next_of_kin_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.ChoiceField(choices=["", "Male", "Female"], required=False)

    def update(self, user, data):
        if "phone" in data:
            user.phone = data.pop("phone")
            user.save(update_fields=["phone"])
        profile = user.student_profile
        for key, value in data.items():
            setattr(profile, key, value)
        profile.save()
        return user
