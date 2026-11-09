from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.db.models import Count, Q
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.models import AccountStatus, Role, User
from apps.accounts.permissions import ROLE_CAPABILITIES, IsAdministrator, IsStudent, IsSuperAdmin, scope_to_department
from apps.accounts.serializers import (
    ChangePasswordSerializer,
    LecturerAdminSerializer,
    LoginSerializer,
    MeSerializer,
    StatusChangeSerializer,
    StudentAdminSerializer,
    StudentSelfUpdateSerializer,
    UserAccountSerializer,
)
from apps.audit.models import AuditAction
from apps.audit.services import record


def me_queryset():
    return User.objects.select_related(
        "department__faculty", "student_profile__program", "student_profile__entry_session", "lecturer_profile"
    )


# --- authentication ----------------------------------------------------------

@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Sets the csrftoken cookie. Call once before the first POST."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(request=LoginSerializer, responses=MeSerializer)
    def post(self, request):
        s = LoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        email = s.validated_data["email"].lower()
        user = authenticate(request, username=email, password=s.validated_data["password"])
        if user is None:
            existing = User.objects.filter(email=email).first()
            if existing and existing.check_password(s.validated_data["password"]) and not existing.is_active:
                msg = "This account is %s. Contact the registry." % existing.get_status_display().lower()
            else:
                msg = "Invalid email or password."
            record(actor=None, action=AuditAction.LOGIN_FAILED, entity=existing, entity_type="accounts.User",
                   summary=f"Failed login for {email}", request=request)
            return Response({"detail": msg, "code": "auth_failed", "errors": {}}, status=status.HTTP_401_UNAUTHORIZED)
        login(request, user)  # rotates the session key -> no session fixation
        record(actor=user, action=AuditAction.LOGIN, entity=user, summary=f"{user.email} logged in", request=request)
        return Response(MeSerializer(me_queryset().get(pk=user.pk)).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        record(actor=request.user, action=AuditAction.LOGOUT, entity=request.user,
               summary=f"{request.user.email} logged out", request=request)
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    @extend_schema(responses=MeSerializer)
    def get(self, request):
        return Response(MeSerializer(me_queryset().get(pk=request.user.pk)).data)


class ChangePasswordView(APIView):
    @extend_schema(request=ChangePasswordSerializer, responses=None)
    def post(self, request):
        s = ChangePasswordSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        user = request.user
        user.set_password(s.validated_data["new_password"])
        user.must_change_password = False
        user.save()
        update_session_auth_hash(request, user)  # keep this session, invalidate all others
        record(actor=user, action=AuditAction.UPDATE, entity=user, summary=f"{user.email} changed their password",
               request=request)
        return Response({"detail": "Password updated."})


class StudentProfileView(APIView):
    """Student edits the non-academic parts of their own profile."""

    permission_classes = [IsStudent]

    @extend_schema(request=StudentSelfUpdateSerializer, responses=MeSerializer)
    def patch(self, request):
        s = StudentSelfUpdateSerializer(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.update(request.user, dict(s.validated_data))
        record(actor=request.user, action=AuditAction.UPDATE, entity=request.user,
               summary=f"{request.user.email} updated their profile", changes={"fields": sorted(s.validated_data)},
               request=request)
        return Response(MeSerializer(me_queryset().get(pk=request.user.pk)).data)


# --- account management --------------------------------------------------------

class AuditedModelViewSet(viewsets.ModelViewSet):
    audit_label = "record"

    def _describe(self, obj):
        return str(obj)

    def perform_create(self, serializer):
        obj = serializer.save()
        record(actor=self.request.user, action=AuditAction.CREATE, entity=obj,
               summary=f"Created {self.audit_label} {self._describe(obj)}", request=self.request)

    def perform_update(self, serializer):
        changed = sorted(k for k in serializer.validated_data if k != "password")
        obj = serializer.save()
        record(actor=self.request.user, action=AuditAction.UPDATE, entity=obj,
               summary=f"Updated {self.audit_label} {self._describe(obj)}", changes={"fields": changed},
               request=self.request)

    def perform_destroy(self, instance):
        desc = self._describe(instance)
        record(actor=self.request.user, action=AuditAction.DELETE, entity=instance,
               summary=f"Deleted {self.audit_label} {desc}", request=self.request)
        instance.delete()


class StatusActionMixin:
    @extend_schema(request=StatusChangeSerializer, responses=None)
    @action(detail=True, methods=["post"], url_path="status")
    def set_status(self, request, pk=None):
        user = self.get_object()
        s = StatusChangeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if user.pk == request.user.pk:
            return Response({"detail": "You cannot change your own account status.", "code": "forbidden", "errors": {}},
                            status=status.HTTP_403_FORBIDDEN)
        old = user.status
        user.status = s.validated_data["status"]
        user.save()
        record(actor=request.user, action=AuditAction.STATUS_CHANGE, entity=user,
               summary=f"{user.email}: {old} → {user.status}",
               changes={"from": old, "to": user.status, "reason": s.validated_data.get("reason", "")}, request=request)
        return Response({"status": user.status})


class StudentViewSet(StatusActionMixin, AuditedModelViewSet):
    """Students — department admins see only their department."""

    serializer_class = StudentAdminSerializer
    permission_classes = [IsAdministrator]
    filterset_fields = {"department": ["exact"], "status": ["exact"], "student_profile__level": ["exact"],
                        "student_profile__program": ["exact"]}
    search_fields = ["first_name", "last_name", "email", "student_profile__matric_number"]
    ordering_fields = ["last_name", "student_profile__matric_number", "student_profile__level", "date_joined"]
    audit_label = "student"
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = User.objects.filter(role=Role.STUDENT).select_related(
            "department", "student_profile__program", "student_profile__entry_session"
        )
        return scope_to_department(qs, self.request.user)

    def _describe(self, obj):
        return f"{obj.get_full_name()} ({obj.student_profile.matric_number})"


class LecturerViewSet(StatusActionMixin, AuditedModelViewSet):
    serializer_class = LecturerAdminSerializer
    permission_classes = [IsAdministrator]
    filterset_fields = ["department", "status"]
    search_fields = ["first_name", "last_name", "email", "lecturer_profile__staff_id"]
    audit_label = "lecturer"
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        from apps.academics.models import Semester

        current = Semester.current()
        qs = User.objects.filter(role=Role.LECTURER).select_related("department", "lecturer_profile").annotate(
            course_count=Count("teaching_offerings", filter=Q(teaching_offerings__semester=current), distinct=True)
        ).order_by("last_name", "first_name")
        return scope_to_department(qs, self.request.user)

    def _describe(self, obj):
        return f"{obj.get_full_name()} ({obj.lecturer_profile.staff_id})"


class UserAccountViewSet(StatusActionMixin, AuditedModelViewSet):
    """All accounts across the university — super admin only."""

    serializer_class = UserAccountSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["role", "status", "department"]
    search_fields = ["first_name", "last_name", "email", "student_profile__matric_number", "lecturer_profile__staff_id"]
    ordering_fields = ["last_name", "date_joined", "last_login", "role"]
    audit_label = "account"
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return User.objects.select_related("department", "student_profile", "lecturer_profile")

    def _describe(self, obj):
        return obj.email

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        return Response({
            "by_role": {r: qs.filter(role=r).count() for r in Role.values},
            "by_status": {s: qs.filter(status=s).count() for s in AccountStatus.values},
        })
