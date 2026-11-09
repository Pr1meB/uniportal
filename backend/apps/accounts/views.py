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
