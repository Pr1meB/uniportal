"""Result entry and approval.

One ResultSheet per course offering holds the workflow state; one Result per
course registration holds the scores. Students can only ever see Result rows
whose sheet is APPROVED.

State machine (enforced in services.py):

    DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED
      ▲                   │                      │
      └──── reject ───────┘ (REJECTED)           │
      └──────────────── reopen ──────────────────┘
"""
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel


class SheetStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    SUBMITTED = "SUBMITTED", "Submitted for review"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Returned for correction"


EDITABLE_STATUSES = {SheetStatus.DRAFT, SheetStatus.REJECTED}


class ResultSheet(TimeStampedModel):
    offering = models.OneToOneField("academics.CourseOffering", on_delete=models.PROTECT, related_name="result_sheet")
    status = models.CharField(max_length=10, choices=SheetStatus.choices, default=SheetStatus.DRAFT, db_index=True)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_comment = models.TextField(blank=True)
    revision = models.PositiveIntegerField(default=1, help_text="Increments each time the sheet is reopened or returned.")

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Results for {self.offering} [{self.status}]"

    @property
    def is_editable(self):
        return self.status in EDITABLE_STATUSES


class Result(TimeStampedModel):
    sheet = models.ForeignKey(ResultSheet, on_delete=models.CASCADE, related_name="results")
    registration = models.OneToOneField("registration.CourseRegistration", on_delete=models.PROTECT, related_name="result")
    ca_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    exam_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    total = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    grade = models.CharField(max_length=2, blank=True)
    grade_point = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")

    class Meta:
        ordering = ["registration__student__student_profile__matric_number"]
        constraints = [
            models.CheckConstraint(condition=Q(ca_score__isnull=True) | Q(ca_score__gte=0), name="ca_non_negative"),
            models.CheckConstraint(condition=Q(exam_score__isnull=True) | Q(exam_score__gte=0), name="exam_non_negative"),
            models.CheckConstraint(condition=Q(total__isnull=True) | Q(total__lte=100), name="total_max_100"),
        ]

    def __str__(self):
        return f"{self.registration} = {self.total} {self.grade}"

    @property
    def is_complete(self):
        return self.ca_score is not None and self.exam_score is not None

    def compute(self, bands):
        """Fill total/grade/point from the scores using the given grade bands."""
        from apps.results.grading import grade_for

        if not self.is_complete:
            self.total, self.grade, self.grade_point = None, "", None
            return
        self.total = (Decimal(self.ca_score) + Decimal(self.exam_score)).quantize(Decimal("0.01"))
        band = grade_for(self.total, bands)
        self.grade, self.grade_point = band.grade, band.point
