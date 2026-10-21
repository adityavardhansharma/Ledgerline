import time

import pytest

from ledgerline_engine.settings import Settings
from ledgerline_engine.xero.models import Tokens


@pytest.fixture
def settings():
    return Settings(
        engine_secret="test-secret",
        allow_unsigned=True,
        xero_client_id="client",
        xero_client_secret="secret",
        openrouter_api_key="",
    )


@pytest.fixture
def tokens():
    return Tokens(access_token="access", refresh_token="refresh", expires_at=time.time() + 1800)
