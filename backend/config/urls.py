from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.academics import views as academics
from apps.accounts import views as accounts
from apps.audit.views import AuditLogViewSet
from apps.registration import views as registration
from apps.reports import views as reports
from apps.results import views as results

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
router.register("admin/registrations", registration.RegistrationAdminViewSet, basename="registration")
router.register("admin/result-sheets", results.ResultSheetReviewViewSet, basename="resultsheet")
router.register("admin/audit-logs", AuditLogViewSet, basename="auditlog")
# lecturer
router.register("lecturer/offerings", results.LecturerOfferingViewSet, basename="lecturer-offering")

api = [
    path("auth/csrf/", accounts.CsrfView.as_view()),
    path("auth/login/", accounts.LoginView.as_view()),
    path("auth/logout/", accounts.LogoutView.as_view()),
    path("auth/me/", accounts.MeView.as_view()),
    path("auth/change-password/", accounts.ChangePasswordView.as_view()),
    path("lookups/", academics.LookupsView.as_view()),
    # student
    path("student/dashboard/", reports.StudentDashboardView.as_view()),
    path("student/profile/", accounts.StudentProfileView.as_view()),
    path("student/courses/", registration.StudentCoursesView.as_view()),
    path("student/courses/<int:pk>/", registration.StudentDropView.as_view()),
    path("student/registrations/", registration.StudentRegistrationHistoryView.as_view()),
    path("student/results/", results.StudentResultsView.as_view()),
    # lecturer / admin dashboards & reports
    path("lecturer/dashboard/", reports.LecturerDashboardView.as_view()),
    path("admin/dashboard/", reports.AdminDashboardView.as_view()),
    path("admin/reports/performance/", reports.DepartmentPerformanceReport.as_view()),
    path("admin/reports/standing/", reports.StudentStandingReport.as_view()),
    path("", include(router.urls)),
]

urlpatterns = [
    path("api/health/", lambda r: JsonResponse({"status": "ok"})),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/", include(api)),
    path("django-admin/", admin.site.urls),
]
