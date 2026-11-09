"""University structure and the academic calendar.

Faculty -> Department -> Program, plus Course (catalogue entry) and
CourseOffering (a course being taught in a specific semester, with the
lecturers allocated to it). Allocation lives on the offering, not on the
course, because who teaches a course changes from session to session.
"""
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.db.models import Q

from apps.core.models import TimeStampedModel


class Level(models.IntegerChoices):
    L100 = 100, "100 Level"
    L200 = 200, "200 Level"
    L300 = 300, "300 Level"
    L400 = 400, "400 Level"
    L500 = 500, "500 Level"
    L600 = 600, "600 Level"


class Term(models.TextChoices):
    FIRST = "FIRST", "First Semester"
    SECOND = "SECOND", "Second Semester"


class Faculty(TimeStampedModel):
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=10, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "faculties"

    def __str__(self):
        return self.name


class Department(TimeStampedModel):
    faculty = models.ForeignKey(Faculty, on_delete=models.PROTECT, related_name="departments")
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=10, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Program(TimeStampedModel):
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="programs")
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=15, unique=True)
    degree = models.CharField(max_length=20, default="B.Sc.")
    duration_years = models.PositiveSmallIntegerField(
        default=4, validators=[MinValueValidator(1), MaxValueValidator(6)]
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["department", "name"], name="uniq_program_name_per_dept")]

    def __str__(self):
        return f"{self.degree} {self.name}"

    @property
    def levels(self) -> list[int]:
        """Levels a student on this program can be in (100 .. duration*100)."""
        return [lvl for lvl in Level.values if lvl <= self.duration_years * 100]
