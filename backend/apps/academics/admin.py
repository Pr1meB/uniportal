from django.contrib import admin

from apps.academics import models

for m in (models.Faculty, models.Department, models.Program, models.AcademicSession, models.Semester,
          models.Course, models.CourseOffering, models.GradeBand):
    admin.site.register(m)
