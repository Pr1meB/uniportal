from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.academics import views as academics
from apps.accounts import views as accounts
from apps.audit.views import AuditLogViewSet

router = DefaultRouter(trailing_slash=True)
# administration (super admin + department admin, scoped)
router.register("admin/faculties", academics.FacultyViewSet, basename="faculty")
router.register("admin/departments", academics.DepartmentViewSet, basename="department")
router.register("admin/programs", academics.ProgramViewSet, basename="program")
router.register("admin/sessions", academics.AcademicSessionViewSet, basename="session")
router.register("admin/semesters", academics.SemesterViewSet, basename="semester")
router.register("admin/courses", academics.CourseViewSet, basename="course")
router.register("admin/offerings", academics.CourseOfferingViewSet, basename="offering")
router.register("admin/grade-bands", academics.GradeBandViewSet, basename="gradeband")
router.register("admin/students", accounts.StudentViewSet, basename="student")
router.register("admin/lecturers", accounts.LecturerViewSet, basename="lecturer")
router.register("admin/accounts", accounts.UserAccountViewSet, basename="account")
router.register("admin/audit-logs", AuditLogViewSet, basename="auditlog")

api = [
    path("auth/csrf/", accounts.CsrfView.as_view()),
    path("auth/login/", accounts.LoginView.as_view()),
    path("auth/logout/", accounts.LogoutView.as_view()),
    path("auth/me/", accounts.MeView.as_view()),
    path("auth/change-password/", accounts.ChangePasswordView.as_view()),
    path("lookups/", academics.LookupsView.as_view()),
    path("student/profile/", accounts.StudentProfileView.as_view()),
    path("", include(router.urls)),
]

urlpatterns = [
    path("api/health/", lambda r: JsonResponse({"status": "ok"})),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/", include(api)),
    path("django-admin/", admin.site.urls),
]
