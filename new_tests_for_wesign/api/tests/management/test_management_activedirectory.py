"""
Management API - ActiveDirectory Controller Tests

Testing Management ActiveDirectory API endpoints:
- GET /v3/ActiveDirectory/groups - Read AD groups
- GET /v3/ActiveDirectory/configuration - Read AD configuration

Per Swagger:
- Protected endpoints return 401 for unauthorized access
- Invalid data returns 400 Bad Request
- Successful operations return 200

Total: 8 comprehensive tests
"""

import pytest
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

import structlog

logger = structlog.get_logger()


# ==================== 1. GET /v3/ActiveDirectory/groups - Read AD Groups ====================

class TestReadADGroups:
    """Tests for GET /v3/ActiveDirectory/groups endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ad_groups_no_auth(self, management_client):
        """Get AD groups without authentication - expect 401 Unauthorized."""
        response = await management_client.get("/v3/ActiveDirectory/groups")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ad_groups_with_auth(self, authenticated_management_client):
        """Get AD groups with authentication - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/ActiveDirectory/groups")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body is a list or dict
        data = response.json()
        assert isinstance(data, (list, dict)), f"Expected list or dict response, got {type(data).__name__}"


# ==================== 2. GET /v3/ActiveDirectory/configuration - Read AD Config ====================

class TestReadADConfiguration:
    """Tests for GET /v3/ActiveDirectory/configuration endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ad_config_no_auth(self, management_client):
        """Get AD configuration without authentication - expect 401 Unauthorized."""
        response = await management_client.get("/v3/ActiveDirectory/configuration")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ad_config_with_auth(self, authenticated_management_client):
        """Get AD configuration with authentication - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/ActiveDirectory/configuration")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body is a dict
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"


# ==================== HTTP Method Validation ====================

class TestADHTTPMethods:
    """Test HTTP method handling for ActiveDirectory endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ad_groups_post_method(self, authenticated_management_client):
        """POST on AD groups endpoint - expect 405 Method Not Allowed."""
        response = await authenticated_management_client.post(
            "/v3/ActiveDirectory/groups",
            json_data={}
        )
        assert response.status_code == 405, f"Expected 405, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ad_config_post_method(self, authenticated_management_client):
        """POST on AD configuration endpoint - expect 405 Method Not Allowed."""
        response = await authenticated_management_client.post(
            "/v3/ActiveDirectory/configuration",
            json_data={}
        )
        assert response.status_code == 405, f"Expected 405, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ad_groups_delete_method(self, authenticated_management_client):
        """DELETE on AD groups endpoint - expect 405 Method Not Allowed."""
        response = await authenticated_management_client.delete("/v3/ActiveDirectory/groups")
        assert response.status_code == 405, f"Expected 405, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ad_config_put_method(self, authenticated_management_client):
        """PUT on AD configuration endpoint - expect 405 Method Not Allowed."""
        response = await authenticated_management_client.put(
            "/v3/ActiveDirectory/configuration",
            json_data={}
        )
        assert response.status_code == 405, f"Expected 405, got {response.status_code}: {response.body}"


# ==================== Summary ====================

def test_management_activedirectory_summary():
    """Management ActiveDirectory API Tests Summary."""
    logger.info("management_activedirectory_summary", tests_run=8)
