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


class AcademicSession(TimeStampedModel):
    name = models.CharField(max_length=9, unique=True, help_text="e.g. 2025/2026")
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        ordering = ["-start_date"]
        constraints = [
            models.UniqueConstraint(fields=["is_current"], condition=Q(is_current=True), name="one_current_session"),
            models.CheckConstraint(condition=Q(end_date__gt=models.F("start_date")), name="session_dates_valid"),
        ]

    def __str__(self):
        return self.name


class Semester(TimeStampedModel):
    session = models.ForeignKey(AcademicSession, on_delete=models.PROTECT, related_name="semesters")
    term = models.CharField(max_length=6, choices=Term.choices)
    is_current = models.BooleanField(default=False)
    registration_open = models.BooleanField(default=False)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-session__start_date", "-term"]
        constraints = [
            models.UniqueConstraint(fields=["session", "term"], name="uniq_term_per_session"),
            models.UniqueConstraint(fields=["is_current"], condition=Q(is_current=True), name="one_current_semester"),
        ]

    def __str__(self):
        return f"{self.session.name} {self.get_term_display()}"

    @classmethod
    def current(cls):
        return cls.objects.select_related("session").filter(is_current=True).first()

    @transaction.atomic
    def make_current(self):
        """Mark this semester (and its session) as the current one."""
        Semester.objects.filter(is_current=True).exclude(pk=self.pk).update(is_current=False, registration_open=False)
        AcademicSession.objects.filter(is_current=True).exclude(pk=self.session_id).update(is_current=False)
        AcademicSession.objects.filter(pk=self.session_id).update(is_current=True)
        self.is_current = True
        self.save(update_fields=["is_current", "updated_at"])


class Course(TimeStampedModel):
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="courses")
    programs = models.ManyToManyField(
        Program, related_name="courses", blank=True,
        help_text="Programs whose students may register this course.",
    )
    code = models.CharField(max_length=10, unique=True)
    title = models.CharField(max_length=200)
    units = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(6)])
    level = models.PositiveSmallIntegerField(choices=Level.choices)
    term = models.CharField(max_length=6, choices=Term.choices)
    description = models.TextField(blank=True)
    is_elective = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["level", "code"]

    def __str__(self):
        return f"{self.code} — {self.title}"


class CourseOffering(TimeStampedModel):
    """A course running in a particular semester, with its allocated lecturers."""

    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name="offerings")
    semester = models.ForeignKey(Semester, on_delete=models.PROTECT, related_name="offerings")
    lecturers = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="teaching_offerings", blank=True,
        limit_choices_to={"role": "LECTURER"},
    )
    capacity = models.PositiveIntegerField(null=True, blank=True, help_text="Leave empty for unlimited.")

    class Meta:
        ordering = ["course__code"]
        constraints = [models.UniqueConstraint(fields=["course", "semester"], name="uniq_offering_per_semester")]

    def __str__(self):
        return f"{self.course.code} ({self.semester})"

    @property
    def department(self):
        return self.course.department

    def clean(self):
        if self.course_id and self.semester_id and self.course.term != self.semester.term:
            raise ValidationError({"semester": "This course is taught in the %s." % self.course.get_term_display()})
