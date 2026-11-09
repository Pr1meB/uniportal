"""Users, roles and role-specific profiles.

A single User table carries the role and the department the user belongs to.
The department is the *scope* used by every permission check: department
admins and lecturers can only act inside it. Super admins have no department.
"""
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.academics.models import Level
from apps.core.models import TimeStampedModel


class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    DEPT_ADMIN = "DEPT_ADMIN", "Department Admin"
    LECTURER = "LECTURER", "Lecturer"
    STUDENT = "STUDENT", "Student"


class AccountStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"
    DEACTIVATED = "DEACTIVATED", "Deactivated"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True, role=Role.SUPER_ADMIN)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=12, choices=Role.choices, db_index=True)
    department = models.ForeignKey(
        "academics.Department", on_delete=models.PROTECT, null=True, blank=True, related_name="users"
    )
    status = models.CharField(max_length=12, choices=AccountStatus.choices, default=AccountStatus.ACTIVE)
    phone = models.CharField(max_length=20, blank=True)
    must_change_password = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        ordering = ["last_name", "first_name"]
        constraints = [
            # Everyone except a super admin must belong to a department.
            models.CheckConstraint(
                condition=Q(role="SUPER_ADMIN") | Q(department__isnull=False),
                name="non_super_admin_has_department",
            ),
        ]

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}>"

    def clean(self):
        super().clean()
        if self.role != Role.SUPER_ADMIN and not self.department_id:
            raise ValidationError({"department": "A department is required for this role."})

    def save(self, *args, **kwargs):
        # `is_active` is what Django auth checks; keep it in sync with status.
        self.is_active = self.status == AccountStatus.ACTIVE
        if self.email:
            self.email = self.email.lower()
        super().save(*args, **kwargs)

    # Convenience role checks used across the codebase.
    @property
    def is_super_admin(self):
        return self.role == Role.SUPER_ADMIN

    @property
    def is_dept_admin(self):
        return self.role == Role.DEPT_ADMIN

    @property
    def is_lecturer(self):
        return self.role == Role.LECTURER

    @property
    def is_student(self):
        return self.role == Role.STUDENT


class StudentProfile(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    matric_number = models.CharField(max_length=20, unique=True)
    program = models.ForeignKey("academics.Program", on_delete=models.PROTECT, related_name="students")
    level = models.PositiveSmallIntegerField(choices=Level.choices, default=Level.L100)
    entry_session = models.ForeignKey(
        "academics.AcademicSession", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, blank=True)
    address = models.CharField(max_length=255, blank=True)
    next_of_kin = models.CharField(max_length=150, blank=True)
    next_of_kin_phone = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["matric_number"]

    def __str__(self):
        return self.matric_number

    @property
    def department(self):
        return self.program.department

    def clean(self):
        if self.program_id and self.user_id and self.user.department_id != self.program.department_id:
            raise ValidationError({"program": "Program must belong to the student's department."})
        if self.program_id and self.level not in self.program.levels:
            raise ValidationError({"level": "This program does not have a %s." % self.get_level_display()})


class LecturerProfile(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="lecturer_profile")
    staff_id = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=20, blank=True, help_text="Dr., Prof., Engr., Mr., Mrs.")
    rank = models.CharField(max_length=60, blank=True, help_text="e.g. Senior Lecturer")
    specialization = models.CharField(max_length=150, blank=True)
    office = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["staff_id"]

    def __str__(self):
        return self.staff_id
