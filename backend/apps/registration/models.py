from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class CourseRegistration(TimeStampedModel):
    """A student registered on a course offering for a semester.

    `semester` is denormalised from the offering so the database itself can
    guarantee a student never holds the same course twice in a semester.
    """

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="registrations",
        limit_choices_to={"role": "STUDENT"},
    )
    offering = models.ForeignKey("academics.CourseOffering", on_delete=models.PROTECT, related_name="registrations")
    course = models.ForeignKey("academics.Course", on_delete=models.PROTECT, related_name="+")
    semester = models.ForeignKey("academics.Semester", on_delete=models.PROTECT, related_name="registrations")
    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )

    class Meta:
        ordering = ["course__code"]
        constraints = [
            models.UniqueConstraint(fields=["student", "course", "semester"], name="no_duplicate_course_in_semester"),
        ]
        indexes = [models.Index(fields=["semester", "student"])]

    def __str__(self):
        return f"{self.student.email} → {self.course.code}"

    def save(self, *args, **kwargs):
        if self.offering_id:
            self.course_id = self.offering.course_id
            self.semester_id = self.offering.semester_id
        super().save(*args, **kwargs)
