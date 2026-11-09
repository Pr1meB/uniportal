from django.db.models import Avg, Count, Max, Min, Prefetch, Q
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import CourseOffering
from apps.academics.serializers import CourseOfferingSerializer
from apps.accounts.models import User
from apps.accounts.permissions import IsAdministrator, IsLecturer, IsStudent, scope_to_department
from apps.audit.models import AuditLog
from apps.results import services
from apps.results.models import Result, ResultSheet, SheetStatus
from apps.results.transcript import build_transcript


class ResultRowSerializer(serializers.ModelSerializer):
    registration = serializers.IntegerField(source="registration_id", read_only=True)
    student_name = serializers.CharField(source="registration.student.get_full_name", read_only=True)
    matric_number = serializers.CharField(source="registration.student.student_profile.matric_number", read_only=True)
    level = serializers.IntegerField(source="registration.student.student_profile.level", read_only=True)

    class Meta:
        model = Result
        fields = ["id", "registration", "student_name", "matric_number", "level", "ca_score", "exam_score", "total",
                  "grade", "grade_point", "updated_at"]


class SheetSerializer(serializers.ModelSerializer):
    offering = CourseOfferingSerializer(read_only=True)
    submitted_by_name = serializers.CharField(source="submitted_by.get_full_name", read_only=True, default=None)
    reviewed_by_name = serializers.CharField(source="reviewed_by.get_full_name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    student_count = serializers.IntegerField(read_only=True, default=None)
    average = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True, default=None)
    pass_count = serializers.IntegerField(read_only=True, default=None)

    class Meta:
        model = ResultSheet
        fields = ["id", "offering", "status", "status_display", "submitted_by_name", "submitted_at",
                  "reviewed_by_name", "reviewed_at", "review_comment", "revision", "student_count", "average",
                  "pass_count", "updated_at"]


class ScoreEntrySerializer(serializers.Serializer):
    registration = serializers.IntegerField()
    ca_score = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True, required=False)
    exam_score = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True, required=False)


class SaveScoresSerializer(serializers.Serializer):
    entries = ScoreEntrySerializer(many=True)


class CommentSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)


def sheet_summary(sheet):
    agg = sheet.results.aggregate(
        count=Count("id"), avg=Avg("total"), high=Max("total"), low=Min("total"),
        passed=Count("id", filter=Q(grade_point__gt=0)), failed=Count("id", filter=Q(grade_point=0)),
        entered=Count("id", filter=Q(ca_score__isnull=False, exam_score__isnull=False)),
    )
    dist = dict(sheet.results.exclude(grade="").values_list("grade").annotate(n=Count("id")))
    return {**agg, "distribution": dist}


def sheet_history(sheet):
    return list(
        AuditLog.objects.filter(entity_type="results.ResultSheet", entity_id=str(sheet.pk))
        .select_related("actor").order_by("-created_at")
        .values("id", "action", "summary", "changes", "created_at", "actor__first_name", "actor__last_name", "actor_role")[:50]
    )


def sheet_payload(sheet, request):
    rows = sheet.results.select_related("registration__student__student_profile").order_by(
        "registration__student__student_profile__matric_number"
    )
    return {
        "sheet": SheetSerializer(sheet, context={"request": request}).data,
        "rows": ResultRowSerializer(rows, many=True).data,
        "summary": sheet_summary(sheet),
        "history": sheet_history(sheet),
    }
