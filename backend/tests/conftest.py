import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.accounts.models import User


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    """Load the demo university once; each test runs in a rolled-back transaction."""
    with django_db_blocker.unblock():
        call_command("seed_demo", verbosity=0)


def client_for(email):
    client = APIClient()
    client.force_login(User.objects.get(email=email))
    return client


@pytest.fixture
def anon():
    return APIClient()


@pytest.fixture
def super_admin():
    return client_for("superadmin@uemp.test")


@pytest.fixture
def csc_admin():
    return client_for("csc.admin@uemp.test")


@pytest.fixture
def mth_admin():
    return client_for("mth.admin@uemp.test")


@pytest.fixture
def lecturer():
    return client_for("lecturer@uemp.test")


@pytest.fixture
def other_lecturer():
    return client_for("ngozi.eze@uemp.test")  # Mathematics


@pytest.fixture
def student():
    return client_for("student@uemp.test")


@pytest.fixture
def clients(anon, super_admin, csc_admin, lecturer, student):
    return {"anon": anon, "super": super_admin, "dept": csc_admin, "lecturer": lecturer, "student": student}
