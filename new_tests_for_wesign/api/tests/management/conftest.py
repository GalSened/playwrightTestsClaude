"""
Management API Test Configuration

Provides fixtures specific to Management API testing.
Management API uses a different base URL and authentication.
"""

import pytest
import pytest_asyncio
import os
from typing import AsyncGenerator
import structlog

from api.helpers.api_client import APIClient
from api.helpers.auth_helper import AuthHelper, UserCredentials

logger = structlog.get_logger()


@pytest.fixture(scope="session")
def management_api_base_url() -> str:
    """
    Base URL for WeSign Management API.

    Default: https://devtest.comda.co.il:10443/managementapi

    Override with: WESIGN_MANAGEMENT_API_URL environment variable
    """
    default_url = "https://devtest.comda.co.il:10443/managementapi"
    url = os.getenv("WESIGN_MANAGEMENT_API_URL", default_url)
    logger.info("management_api_base_url_configured", url=url)
    return url


@pytest.fixture(scope="session")
def management_credentials() -> UserCredentials:
    """
    Management API admin credentials.

    Override with environment variables:
    - WESIGN_MANAGEMENT_EMAIL
    - WESIGN_MANAGEMENT_PASSWORD
    """
    email = os.getenv("WESIGN_MANAGEMENT_EMAIL", "systemadmin@comda.co.il")
    password = os.getenv("WESIGN_MANAGEMENT_PASSWORD", "Comsign1!")

    credentials = UserCredentials(
        email=email,
        password=password,
        user_type="management"
    )

    logger.info("management_credentials_configured", email=email)
    return credentials


@pytest_asyncio.fixture
async def management_client(
    management_api_base_url: str,
) -> AsyncGenerator[APIClient, None]:
    """
    Provides an APIClient for Management API (unauthenticated).
    """
    client = APIClient(
        base_url=management_api_base_url,
        timeout=30.0,
        verify_ssl=True,
    )

    await client.start()
    logger.info("management_client_started")

    yield client

    await client.close()
    logger.info("management_client_closed")


@pytest_asyncio.fixture
async def authenticated_management_client(
    management_client: APIClient,
    management_credentials: UserCredentials,
) -> AsyncGenerator[APIClient, None]:
    """
    Provides an authenticated Management API client.

    Note: Login may fail if credentials are not configured.
    Tests using this fixture will FAIL (not skip) if auth fails.

    To configure management credentials, set environment variables:
    - WESIGN_MANAGEMENT_EMAIL
    - WESIGN_MANAGEMENT_PASSWORD
    """
    # Try to authenticate
    # Note: Management API uses lowercase field names per Swagger schema
    response = await management_client.post(
        "/v3/users/login",
        json_data={
            "email": management_credentials.email,
            "password": management_credentials.password
        }
    )

    if response.status_code == 200:
        data = response.json()
        token = data.get("token") or data.get("Token")
        if token:
            management_client.set_auth_token(token)
            logger.info("management_auth_success")
            yield management_client
            return
        else:
            logger.warning("management_auth_failed", reason="no_token_in_response")
    else:
        logger.warning("management_auth_failed", status=response.status_code)

    # FAIL test if authentication failed - tests should pass or fail, never skip
    # This accurately reflects that we cannot test authenticated endpoints without valid credentials
    pytest.fail(
        "Management API authentication failed (status: {}). "
        "Set WESIGN_MANAGEMENT_EMAIL and WESIGN_MANAGEMENT_PASSWORD environment variables "
        "with valid management admin credentials. Response: {}".format(
            response.status_code, str(response.body)[:200] if response.body else "empty"
        )
    )
