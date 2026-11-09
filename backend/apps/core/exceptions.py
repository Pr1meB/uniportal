"""Consistent error envelope for the API.

Every error response has the shape::

    {"detail": "Human readable message", "code": "machine_code", "errors": {...}}

so the frontend can always show `detail` in a toast and map `errors` onto
form fields.
"""
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class BusinessRuleViolation(exceptions.APIException):
    """Raised by service functions when a domain rule is broken."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This action violates a business rule."
    default_code = "business_rule"


class InvalidTransition(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This action is not allowed in the record's current state."
    default_code = "invalid_transition"


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(detail=getattr(exc, "message_dict", None) or exc.messages)
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()
    elif isinstance(exc, IntegrityError):
        return Response(
            {"detail": "This record conflicts with an existing one.", "code": "conflict", "errors": {}},
            status=status.HTTP_409_CONFLICT,
        )

    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(exc, exceptions.ValidationError):
        errors = data if isinstance(data, dict) else {"non_field_errors": data}
        first = _first_message(errors)
        response.data = {"detail": first or "Please correct the highlighted fields.", "code": "invalid", "errors": errors}
    else:
        detail = data.get("detail", "") if isinstance(data, dict) else str(data)
        code = getattr(getattr(exc, "detail", None), "code", None) or getattr(exc, "default_code", "error")
        response.data = {"detail": str(detail), "code": code, "errors": {}}
    return response


def _first_message(errors):
    if isinstance(errors, dict):
        for value in errors.values():
            msg = _first_message(value)
            if msg:
                return msg
    elif isinstance(errors, list):
        for value in errors:
            msg = _first_message(value)
            if msg:
                return msg
    elif errors:
        return str(errors)
    return None
