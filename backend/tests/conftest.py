import pytest

from sentinel.config import settings


@pytest.fixture(autouse=True)
def _test_runtime_defaults(monkeypatch):
    monkeypatch.setattr(settings, "deployment_env", "test")
