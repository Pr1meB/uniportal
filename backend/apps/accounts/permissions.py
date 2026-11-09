"""Role-based access control.

Two layers, both enforced on the server:

1. **Role gate** – DRF permission classes below decide whether a role may call
   an endpoint at all (e.g. only LECTURER can hit /api/lecturer/*).
2. **Department scope** – `scope_to_department` filters every queryset so a
   department admin or lecturer only ever *sees* rows from their own
   department. Out-of-scope objects therefore return 404, which also avoids
   leaking that the record exists.

Fine-grained rules that depend on record state (e.g. "a lecturer can only
enter scores for an offering they are allocated to", "submitted results
cannot be edited") live in the service layer, next to the business logic.

Note: Django's auth backend refuses inactive users on every request, so
suspending or deactivating an account (which clears `is_active`) logs the
user out immediately — no token revocation needed.
"""
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from apps.accounts.models import Role


class HasRole(BasePermission):
    roles: tuple[str, ...] = ()
    message = "Your role does not have access to this resource."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in self.roles)


def roles_allowed(*roles):
    """Build a permission class allowing only the given roles."""
    name = "Allow" + "Or".join(r.title().replace("_", "") for r in roles)
    return type(name, (HasRole,), {"roles": tuple(roles)})


IsSuperAdmin = roles_allowed(Role.SUPER_ADMIN)
IsAdministrator = roles_allowed(Role.SUPER_ADMIN, Role.DEPT_ADMIN)
IsLecturer = roles_allowed(Role.LECTURER)
IsStudent = roles_allowed(Role.STUDENT)
IsStaff = roles_allowed(Role.SUPER_ADMIN, Role.DEPT_ADMIN, Role.LECTURER)


class ReadOnlyForDeptAdmin(BasePermission):
    """Super admin can write; department admin may only read."""

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return request.user.role == Role.SUPER_ADMIN


def scope_to_department(queryset, user, field="department"):
    """Restrict a queryset to the user's department (super admin sees all)."""
    if user.role == Role.SUPER_ADMIN:
        return queryset
    if user.department_id:
        return queryset.filter(**{field: user.department_id})
    return queryset.none()


def ensure_same_department(user, department):
    """Raise unless `user` may manage records belonging to `department`."""
    if user.role == Role.SUPER_ADMIN:
        return
    dept_id = getattr(department, "pk", department)
    if not dept_id or dept_id != user.department_id:
        raise PermissionDenied("You can only manage records in your own department.")
