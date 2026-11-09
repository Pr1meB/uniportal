from rest_framework import mixins, serializers, viewsets

from apps.accounts.permissions import IsAdministrator, scope_to_department
from apps.audit.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.get_full_name", read_only=True, default="System / anonymous")
    actor_email = serializers.CharField(source="actor.email", read_only=True, default=None)
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = ["id", "created_at", "actor", "actor_name", "actor_email", "actor_role", "action", "action_display",
                  "entity_type", "entity_id", "department", "department_name", "summary", "changes", "ip_address"]


class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only. Super admin sees everything; department admin sees their department."""

    serializer_class = AuditLogSerializer
    permission_classes = [IsAdministrator]
    filterset_fields = {"action": ["exact", "in"], "entity_type": ["exact"], "entity_id": ["exact"],
                        "actor": ["exact"], "department": ["exact"], "created_at": ["gte", "lte"]}
    search_fields = ["summary", "actor__email", "actor__first_name", "actor__last_name"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        qs = AuditLog.objects.select_related("actor", "department")
        return scope_to_department(qs, self.request.user)
