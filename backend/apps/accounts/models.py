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
