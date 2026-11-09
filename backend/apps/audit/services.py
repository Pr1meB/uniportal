from apps.audit.models import AuditLog


def client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def record(*, actor, action, entity, summary, department=None, changes=None, request=None, entity_type=None):
    """Write one audit entry. `entity` may be a model instance or None."""
    actor = actor if getattr(actor, "is_authenticated", False) else None
    if department is None and entity is not None:
        department = _department_of(entity)
    return AuditLog.objects.create(
        actor=actor,
        actor_role=getattr(actor, "role", "") or "",
        action=action,
        entity_type=entity_type or (entity._meta.label if entity is not None else ""),
        entity_id=str(entity.pk) if entity is not None and entity.pk else "",
        department=department,
        summary=summary[:255],
        changes=changes or {},
        ip_address=client_ip(request),
    )


def _department_of(entity):
    for path in ("department", "offering.course.department", "course.department", "user.department"):
        obj = entity
        try:
            for part in path.split("."):
                obj = getattr(obj, part)
        except AttributeError:
            continue
        if obj is not None and obj.__class__.__name__ == "Department":
            return obj
    return None
