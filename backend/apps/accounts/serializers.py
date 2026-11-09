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


# --- admin-side management ---------------------------------------------------

class BaseUserAdminSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)

    def _actor(self):
        return self.context["request"].user

    def validate_department(self, department):
        actor = self._actor()
        if not actor.is_super_admin:
            # Department admins always create users inside their own department.
            ensure_same_department(actor, department)
        return department

    def validate_password(self, value):
        if value:
            password_validation.validate_password(value)
        return value


class StudentAdminSerializer(BaseUserAdminSerializer):
    profile = StudentProfileSerializer(source="student_profile")

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name", "phone", "department", "department_name",
            "status", "last_login", "date_joined", "password", "profile",
        ]
        read_only_fields = ["status", "last_login", "date_joined"]

    def validate(self, attrs):
        actor = self._actor()
        dept = attrs.get("department") or getattr(self.instance, "department", None) or actor.department
        attrs["department"] = dept
        profile = attrs.get("student_profile", {})
        program = profile.get("program") or getattr(getattr(self.instance, "student_profile", None), "program", None)
        if program is None:
            raise serializers.ValidationError({"profile": {"program": "Program is required."}})
        if program.department_id != getattr(dept, "pk", None):
            raise serializers.ValidationError({"profile": {"program": "Program must belong to the selected department."}})
        level = profile.get("level") or getattr(getattr(self.instance, "student_profile", None), "level", 100)
        if level not in program.levels:
            raise serializers.ValidationError({"profile": {"level": "This program does not run to that level."}})
        matric = profile.get("matric_number")
        if self.instance is None and not matric:
            raise serializers.ValidationError({"profile": {"matric_number": "Matriculation number is required."}})
        if matric and StudentProfile.objects.filter(matric_number__iexact=matric).exclude(user=self.instance).exists():
            raise serializers.ValidationError({"profile": {"matric_number": "This matriculation number is already in use."}})
        return attrs

    @transaction.atomic
    def create(self, data):
        profile = data.pop("student_profile")
        password = data.pop("password", None) or "Student@123"
        user = User.objects.create_user(role=Role.STUDENT, password=password, must_change_password=True, **data)
        StudentProfile.objects.create(user=user, **profile)
        return user

    @transaction.atomic
    def update(self, user, data):
        profile_data = data.pop("student_profile", {})
        password = data.pop("password", None)
        for key, value in data.items():
            setattr(user, key, value)
        if password:
            user.set_password(password)
        user.save()
        profile = user.student_profile
        for key, value in profile_data.items():
            setattr(profile, key, value)
        profile.save()
        return user


class LecturerAdminSerializer(BaseUserAdminSerializer):
    profile = LecturerProfileSerializer(source="lecturer_profile")
    course_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name", "phone", "department", "department_name",
            "status", "last_login", "date_joined", "password", "profile", "course_count",
        ]
        read_only_fields = ["status", "last_login", "date_joined"]

    def validate(self, attrs):
        actor = self._actor()
        attrs["department"] = attrs.get("department") or getattr(self.instance, "department", None) or actor.department
        if attrs["department"] is None:
            raise serializers.ValidationError({"department": "Department is required."})
        staff_id = attrs.get("lecturer_profile", {}).get("staff_id")
        if self.instance is None and not staff_id:
            raise serializers.ValidationError({"profile": {"staff_id": "Staff ID is required."}})
        if staff_id and LecturerProfile.objects.filter(staff_id__iexact=staff_id).exclude(user=self.instance).exists():
            raise serializers.ValidationError({"profile": {"staff_id": "This staff ID is already in use."}})
        return attrs

    @transaction.atomic
    def create(self, data):
        profile = data.pop("lecturer_profile")
        password = data.pop("password", None) or "Lecturer@123"
        user = User.objects.create_user(role=Role.LECTURER, password=password, must_change_password=True, **data)
        LecturerProfile.objects.create(user=user, **profile)
        return user

    @transaction.atomic
    def update(self, user, data):
        profile_data = data.pop("lecturer_profile", {})
        password = data.pop("password", None)
        for key, value in data.items():
            setattr(user, key, value)
        if password:
            user.set_password(password)
        user.save()
        profile = user.lecturer_profile
        for key, value in profile_data.items():
            setattr(profile, key, value)
        profile.save()
        return user
