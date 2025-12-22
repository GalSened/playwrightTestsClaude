"""
Admins Module - Core Tests

Based on Swagger spec (178 endpoints total)
Real Admins Endpoints:
- GET/POST /v3/Admins/groups - Group management
- PUT/DELETE /v3/Admins/groups/{id} - Group CRUD
- GET/POST /v3/Admins/users - User management
- PUT/DELETE /v3/Admins/users/{id} - User CRUD

Note: Original Postman collection used /v3/admins/send which doesn't exist.
This file now tests the REAL Admin API endpoints.

SMART Principles:
- Systematic: Tests based on actual swagger spec
- Resilient: Clear error handling and assertions
- Test-driven: Factory-generated test data

Observed API Behavior (2025-12-09 - Validated):
- GET /v3/Admins/groups: 200 with auth (test user has admin access)
- GET /v3/Admins/users: 200 with auth (test user has admin access)
- No auth cases: 401 Unauthorized
"""

import pytest
import structlog

logger = structlog.get_logger()


# ==================== Test Constants ====================

ADMIN_GROUPS_ENDPOINT = "/v3/Admins/groups"
ADMIN_USERS_ENDPOINT = "/v3/Admins/users"


# ==================== Groups Tests ====================

@pytest.mark.asyncio
async def test_01_get_admin_groups(authenticated_client, test_context):
    """
    Test: Get all admin groups

    Swagger: GET /v3/Admins/groups
    Description: Get all groups in my company (CompanyAdmin only)

    Expected:
        - 200: Returns list of groups
        - 403: User is not CompanyAdmin
    """
    logger.info("test_start", test="get_admin_groups")

    response = await authenticated_client.get(ADMIN_GROUPS_ENDPOINT)

    # Observed: API returns 200 (test user has admin access)
    assert response.status_code == 200, (
        f"GET {ADMIN_GROUPS_ENDPOINT} expected 200, got {response.status_code}. "
        f"Response: {response.body}"
    )

    # Validate response body structure
    data = response.json()
    assert isinstance(data, (list, dict)), f"Expected list or dict response, got {type(data).__name__}"

    logger.info("groups_retrieved", count=len(data) if isinstance(data, list) else "object")
    test_context.set("admin_groups_accessible", True)

    logger.info("test_complete", test="get_admin_groups", status=response.status_code)


@pytest.mark.asyncio
async def test_02_get_admin_groups_no_auth(api_client, test_context):
    """
    Test: Get admin groups without authentication

    Expected:
        - 401: Unauthorized
    """
    logger.info("test_start", test="get_admin_groups_no_auth")

    response = await api_client.get(ADMIN_GROUPS_ENDPOINT)

    assert response.status_code == 401, (
        f"GET {ADMIN_GROUPS_ENDPOINT} without auth expected 401, "
        f"got {response.status_code}. Response: {response.body}"
    )

    logger.info("test_complete", test="get_admin_groups_no_auth", status=response.status_code)


# ==================== Users Tests ====================

@pytest.mark.asyncio
async def test_03_get_admin_users(authenticated_client, test_context):
    """
    Test: Get all admin users

    Swagger: GET /v3/Admins/users
    Description: Get all users in company (CompanyAdmin only)

    Expected:
        - 200: Returns list of users
        - 403: User is not CompanyAdmin
    """
    logger.info("test_start", test="get_admin_users")

    response = await authenticated_client.get(ADMIN_USERS_ENDPOINT)

    # Observed: API returns 200 (test user has admin access)
    assert response.status_code == 200, (
        f"GET {ADMIN_USERS_ENDPOINT} expected 200, got {response.status_code}. "
        f"Response: {response.body}"
    )

    # Validate response body structure
    data = response.json()
    assert isinstance(data, (list, dict)), f"Expected list or dict response, got {type(data).__name__}"

    logger.info("users_retrieved", count=len(data) if isinstance(data, list) else "object")
    test_context.set("admin_users_accessible", True)

    logger.info("test_complete", test="get_admin_users", status=response.status_code)


@pytest.mark.asyncio
async def test_04_get_admin_users_no_auth(api_client, test_context):
    """
    Test: Get admin users without authentication

    Expected:
        - 401: Unauthorized
    """
    logger.info("test_start", test="get_admin_users_no_auth")

    response = await api_client.get(ADMIN_USERS_ENDPOINT)

    assert response.status_code == 401, (
        f"GET {ADMIN_USERS_ENDPOINT} without auth expected 401, "
        f"got {response.status_code}. Response: {response.body}"
    )

    logger.info("test_complete", test="get_admin_users_no_auth", status=response.status_code)


# ==================== Summary Test ====================

def test_migration_summary():
    """
    Admins Module - Test Summary

    Based on Swagger Spec:
    - Total Admins endpoints: 18
    - Groups endpoints: POST, GET, PUT/{id}, DELETE/{id}
    - Users endpoints: POST, GET, PUT/{id}, DELETE/{id}

    Tests Implemented:
    - test_01_get_admin_groups: Get groups (auth)
    - test_02_get_admin_groups_no_auth: Get groups (no auth)
    - test_03_get_admin_users: Get users (auth)
    - test_04_get_admin_users_no_auth: Get users (no auth)

    Note: Full CRUD tests require CompanyAdmin role.
    Read-only tests verify endpoint existence and auth.
    """
    print("\n" + "=" * 60)
    print("Admins Module - Based on Swagger Spec")
    print("=" * 60)
    print("Real Endpoints:")
    print("  - GET/POST /v3/Admins/groups")
    print("  - PUT/DELETE /v3/Admins/groups/{id}")
    print("  - GET/POST /v3/Admins/users")
    print("  - PUT/DELETE /v3/Admins/users/{id}")
    print("Tests: 4 (read-only, verifies endpoints exist)")
    print("=" * 60)
