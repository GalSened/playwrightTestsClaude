"""
Pytest fixtures for WeSign API Testing

Provides reusable fixtures for APIClient, AuthHelper, and authenticated sessions.

SMART Principles:
- Systematic: Consistent test setup across all API tests
- Resilient: Automatic cleanup, clear error messages
- Test-driven: Easy-to-use fixtures that encourage good testing practices

Best Practices Applied:
- TestContext pattern for sharing state between tests (like Postman environment variables)
- Module-scoped fixtures for efficient resource usage
- Factory fixtures for test data generation
"""

import pytest
import pytest_asyncio
import os
from typing import AsyncGenerator, Optional, Dict, Any
from dataclasses import dataclass, field
import structlog

from api.helpers.api_client import APIClient
from api.helpers.auth_helper import AuthHelper, UserCredentials

logger = structlog.get_logger()


# ==================== Test Context (Postman Environment Equivalent) ====================

@dataclass
class TestContext:
    """
    Stores variables between tests - equivalent to Postman environment variables.

    This allows tests to share data like:
    - JWT tokens (handled automatically by authenticated_client)
    - Document IDs created in setup tests
    - Contact IDs, Signer IDs, etc.

    Usage:
        @pytest.mark.asyncio
        async def test_01_setup(authenticated_client, test_context):
            response = await authenticated_client.get("/v3/documents")
            data = response.json()
            test_context.document_id = data["documents"][0]["id"]
            test_context.set("customVar", "value")

        @pytest.mark.asyncio
        async def test_02_use_document(authenticated_client, test_context):
            doc_id = test_context.document_id
            custom = test_context.get("customVar")

    Equivalent Postman scripts:
        pm.environment.set('documentId', jsonData.documents[0].id)
        pm.environment.get('documentId')
    """
    # Authentication (usually handled by fixtures, but available if needed)
    jwt_token: Optional[str] = None

    # Document Collections
    doc_collection_id: Optional[str] = None
    document_id: Optional[str] = None
    signer_id: Optional[str] = None

    # Contacts
    contact_id: Optional[str] = None

    # Distribution
    distribution_id: Optional[str] = None

    # Links
    link_id: Optional[str] = None

    # Templates
    template_id: Optional[str] = None

    # Generic storage for dynamic/custom keys (like pm.environment)
    _variables: Dict[str, Any] = field(default_factory=dict)

    def set(self, key: str, value: Any) -> None:
        """
        Set a variable - equivalent to pm.environment.set(key, value)

        Args:
            key: Variable name
            value: Variable value
        """
        self._variables[key] = value
        logger.info("test_context_set", key=key, value_type=type(value).__name__)

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a variable - equivalent to pm.environment.get(key)

        Args:
            key: Variable name
            default: Default value if not found

        Returns:
            Variable value or default
        """
        return self._variables.get(key, default)

    def has(self, key: str) -> bool:
        """Check if a variable exists"""
        return key in self._variables

    def clear(self) -> None:
        """Clear all custom variables"""
        self._variables.clear()
        logger.info("test_context_cleared")

    def require(self, *keys: str) -> None:
        """
        Assert that required context variables are set.
        Use in tests that depend on setup tests.

        Args:
            *keys: Variable names that must be set

        Raises:
            pytest.fail: If any required variable is missing (tests should pass or fail, never skip)
        """
        missing = []
        for key in keys:
            # Check both attributes and custom variables
            attr_value = getattr(self, key, None) if hasattr(self, key) else None
            var_value = self._variables.get(key)
            if attr_value is None and var_value is None:
                missing.append(key)

        if missing:
            pytest.fail(f"Required context variables not set: {missing}. Setup tests did not provide required data.")


@pytest.fixture(scope="module")
def test_context() -> TestContext:
    """
    Module-scoped test context for sharing data between tests.

    Each test module gets its own context, ensuring isolation between
    different test files while allowing data sharing within a module.

    Usage:
        async def test_setup(authenticated_client, test_context):
            test_context.document_id = "doc-123"

        async def test_use_document(authenticated_client, test_context):
            assert test_context.document_id == "doc-123"
    """
    context = TestContext()
    logger.info("test_context_created", scope="module")
    return context


# ==================== Configuration ====================

@pytest.fixture(scope="session")
def api_base_url() -> str:
    """
    Base URL for WeSign API.

    Default: https://devtest.comda.co.il/userapi

    Override for CI/CD with: WESIGN_PYTEST_API_URL environment variable
    (Uses specific env var to avoid conflicts with other tools)

    Note: Named 'api_base_url' to avoid conflict with pytest-base-url plugin's 'base_url' fixture.
    """
    # Use specific env var for pytest to avoid conflicts with Postman/other tools
    # that may use WESIGN_API_URL with different paths
    default_url = "https://devtest.comda.co.il/userapi"
    url = os.getenv("WESIGN_PYTEST_API_URL", default_url)
    logger.info("api_base_url_configured", url=url)
    return url


@pytest.fixture(scope="session")
def company_user_credentials() -> UserCredentials:
    """
    Default company user credentials for testing.
    Matches UI test credentials (admin@companya.com).

    Can be overridden with environment variables:
    - WESIGN_TEST_EMAIL
    - WESIGN_TEST_PASSWORD
    """
    email = os.getenv("WESIGN_TEST_EMAIL", "admin@companya.com")
    password = os.getenv("WESIGN_TEST_PASSWORD", "1234")

    credentials = UserCredentials(
        email=email,
        password=password,
        user_type="company"
    )

    logger.info("company_user_credentials_configured", email=email)
    return credentials


# ==================== API Client Fixtures ====================

@pytest_asyncio.fixture
async def api_client(api_base_url: str) -> AsyncGenerator[APIClient, None]:
    """
    Provides a fresh APIClient instance for each test.
    Automatically starts and closes the client.

    Usage:
        @pytest.mark.asyncio
        async def test_example(api_client):
            response = await api_client.get("/v3/users/me")
            assert response.is_success
    """
    client = APIClient(
        base_url=api_base_url,
        timeout=30.0,
        verify_ssl=True,
    )

    await client.start()
    logger.info("api_client_fixture_started")

    yield client

    await client.close()
    logger.info("api_client_fixture_closed")


@pytest_asyncio.fixture
async def auth_helper(api_client: APIClient) -> AuthHelper:
    """
    Provides an AuthHelper instance for authentication operations.

    Usage:
        @pytest.mark.asyncio
        async def test_example(api_client, auth_helper):
            await auth_helper.authenticate_as_company_user()
            response = await api_client.get("/v3/contacts")
            assert response.is_success
    """
    helper = AuthHelper(api_client)
    logger.info("auth_helper_fixture_created")
    return helper


@pytest_asyncio.fixture
async def authenticated_client(
    api_client: APIClient,
    auth_helper: AuthHelper,
) -> AsyncGenerator[APIClient, None]:
    """
    Provides an APIClient that is already authenticated as company user.
    This is the most common fixture for API tests.

    Usage:
        @pytest.mark.asyncio
        async def test_example(authenticated_client):
            # Client is already authenticated
            response = await authenticated_client.get("/v3/contacts")
            assert response.is_success
    """
    # Authenticate as company user
    await auth_helper.authenticate_as_company_user()
    logger.info("authenticated_client_fixture_ready")

    yield api_client

    # Cleanup: logout
    await auth_helper.logout()
    logger.info("authenticated_client_fixture_cleaned_up")


@pytest_asyncio.fixture
async def authenticated_client_with_helper(
    api_client: APIClient,
    auth_helper: AuthHelper,
) -> AsyncGenerator[tuple[APIClient, AuthHelper], None]:
    """
    Provides both authenticated APIClient and AuthHelper.
    Useful when you need to do additional auth operations (e.g., verify token).

    Usage:
        @pytest.mark.asyncio
        async def test_example(authenticated_client_with_helper):
            client, auth = authenticated_client_with_helper
            response = await client.get("/v3/contacts")
            user = await auth.get_current_user()
            assert user["email"] == "admin@companya.com"
    """
    # Authenticate as company user
    await auth_helper.authenticate_as_company_user()
    logger.info("authenticated_client_with_helper_fixture_ready")

    yield api_client, auth_helper

    # Cleanup: logout
    await auth_helper.logout()
    logger.info("authenticated_client_with_helper_fixture_cleaned_up")


# ==================== Test Data Fixtures ====================

@pytest.fixture
def unique_test_name() -> str:
    """
    Generate unique test name using pytest's built-in node.
    Useful for creating unique test data that won't conflict.

    Usage:
        @pytest.mark.asyncio
        async def test_create_contact(authenticated_client, unique_test_name):
            contact_name = f"Contact {unique_test_name}"
            # contact_name will be like "Contact test_create_contact"
    """
    import inspect
    frame = inspect.currentframe()
    if frame and frame.f_back and frame.f_back.f_back:
        test_name = frame.f_back.f_back.f_code.co_name
        return test_name
    return "default_test"


@pytest.fixture
def timestamp() -> str:
    """
    Current timestamp for unique test data.

    Usage:
        async def test_example(timestamp):
            email = f"test_{timestamp}@automation.test"
    """
    from datetime import datetime
    return datetime.now().strftime("%Y%m%d_%H%M%S")


# ==================== Cleanup Fixtures ====================

@pytest.fixture(scope="function", autouse=True)
def log_test_start_end(request):
    """
    Automatically log test start and end for all API tests.
    Runs for every test function.
    """
    test_name = request.node.name
    logger.info("test_started", test_name=test_name)

    yield

    logger.info("test_completed", test_name=test_name)


# ==================== Pytest Configuration ====================

def pytest_configure(config):
    """
    Pytest configuration hook.
    Configures structlog for better API test logging.
    """
    # Configure structlog (if not already configured)
    import structlog
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logger.info("pytest_api_tests_configured")


def pytest_collection_modifyitems(config, items):
    """
    Pytest hook to modify test collection.
    Adds 'api' marker to all tests in tests/api/ directory.
    """
    for item in items:
        fspath_str = str(item.fspath)
        if "api/tests" in fspath_str or "api\\tests" in fspath_str:
            item.add_marker(pytest.mark.api)
            item.add_marker(pytest.mark.asyncio)
