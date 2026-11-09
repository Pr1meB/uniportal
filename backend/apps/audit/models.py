"""Append-only audit trail.

Rows can be created but never updated or deleted through the ORM, so the
history of who submitted, approved, rejected or changed a result can be
trusted. (The DB user could still be locked down further in production with a
trigger or by revoking UPDATE/DELETE on this table.)
"""
from django.conf import settings
from django.db import models


class AuditAction(models.TextChoices):
    LOGIN = "LOGIN", "Logged in"
    LOGIN_FAILED = "LOGIN_FAILED", "Failed login"
    LOGOUT = "LOGOUT", "Logged out"
    CREATE = "CREATE", "Created"
    UPDATE = "UPDATE", "Updated"
    DELETE = "DELETE", "Deleted"
    STATUS_CHANGE = "STATUS_CHANGE", "Account status changed"
    COURSE_REGISTER = "COURSE_REGISTER", "Registered course"
    COURSE_DROP = "COURSE_DROP", "Dropped course"
    RESULT_SAVE = "RESULT_SAVE", "Saved result draft"
    RESULT_SUBMIT = "RESULT_SUBMIT", "Submitted results"
    RESULT_APPROVE = "RESULT_APPROVE", "Approved results"
    RESULT_REJECT = "RESULT_REJECT", "Rejected results"
    RESULT_REOPEN = "RESULT_REOPEN", "Reopened results"
    ALLOCATE = "ALLOCATE", "Allocated lecturers"
    SEMESTER_CHANGE = "SEMESTER_CHANGE", "Changed current semester"


class AuditLogQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise PermissionError("Audit logs are append-only.")

    def delete(self):
        raise PermissionError("Audit logs are append-only.")


class AuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="audit_entries")
    actor_role = models.CharField(max_length=12, blank=True)
    action = models.CharField(max_length=20, choices=AuditAction.choices, db_index=True)
    entity_type = models.CharField(max_length=50, db_index=True)
    entity_id = models.CharField(max_length=40, blank=True)
    department = models.ForeignKey("academics.Department", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    summary = models.CharField(max_length=255)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    objects = AuditLogQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["entity_type", "entity_id"])]

    def __str__(self):
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {self.action} {self.summary}"

    def save(self, *args, **kwargs):
        if self.pk:
            raise PermissionError("Audit logs are append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("Audit logs are append-only.")
