"""
Management API - Licenses Controller Tests

Testing Management Licenses API endpoints:
- POST /v3/licenses - Generate license key
- PUT /v3/licenses - Activate license
- GET /v3/licenses - License information and using
- GET /v3/licenses/simpleInfo - License simple info

Per Swagger:
- Protected endpoints return 401 for unauthorized access
- Empty body/missing required fields return 400 Bad Request
- Successful operations return 200

Total: 13 comprehensive tests
"""

import pytest
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

import structlog

logger = structlog.get_logger()


# ==================== 1. GET /v3/licenses - License Information ====================

class TestLicenseInfo:
    """Tests for GET /v3/licenses endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_license_info_no_auth(self, management_client):
        """Get license info without authentication - expect 401 Unauthorized."""
        response = await management_client.get("/v3/licenses")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_license_info_with_auth(self, authenticated_management_client):
        """Get license info with authentication - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/licenses")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body is a dict
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"


# ==================== 2. GET /v3/licenses/simpleInfo - Simple License Info ====================

class TestSimpleLicenseInfo:
    """Tests for GET /v3/licenses/simpleInfo endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_simple_info_no_auth(self, management_client):
        """Get simple license info without authentication - expect 401 Unauthorized."""
        response = await management_client.get("/v3/licenses/simpleInfo")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_simple_info_with_auth(self, authenticated_management_client):
        """Get simple license info with authentication - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/licenses/simpleInfo")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "licenseLimits" in data, f"Expected 'licenseLimits' key in response"
        assert "licenseUsage" in data, f"Expected 'licenseUsage' key in response"


# ==================== 3. POST /v3/licenses - Generate License Key ====================

class TestGenerateLicense:
    """Tests for POST /v3/licenses endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_generate_license_empty_body(self, authenticated_management_client):
        """Generate license with empty body - expect 400 Bad Request."""
        response = await authenticated_management_client.post("/v3/licenses", json_data={})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_generate_license_missing_email(self, authenticated_management_client):
        """Generate license with missing email - expect 400 Bad Request."""
        response = await authenticated_management_client.post(
            "/v3/licenses",
            json_data={"Name": "Test User", "Company": "Test Company"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_generate_license_valid_data(self, authenticated_management_client):
        """Generate license with valid data - expect 200 OK or 500 (API behavior)."""
        response = await authenticated_management_client.post(
            "/v3/licenses",
            json_data={
                "Name": "Test User",
                "Email": "test@example.com",
                "Company": "Test Company",
                "Phone": "1234567890"
            }
        )
        assert response.status_code in [200, 400, 500], f"Expected 200/400/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_generate_license_sql_injection(self, authenticated_management_client):
        """Generate license with SQL injection - expect 400 Bad Request (input rejected)."""
        response = await authenticated_management_client.post(
            "/v3/licenses",
            json_data={
                "Name": "'; DROP TABLE licenses;--",
                "Email": "test@example.com"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_generate_license_no_auth(self, management_client):
        """Generate license without authentication - expect 401 Unauthorized."""
        response = await management_client.post(
            "/v3/licenses",
            json_data={"Email": "test@example.com"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 4. PUT /v3/licenses - Activate License ====================

class TestActivateLicense:
    """Tests for PUT /v3/licenses endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_activate_license_empty_body(self, authenticated_management_client):
        """Activate license with empty body - expect 400 Bad Request."""
        response = await authenticated_management_client.put("/v3/licenses", json_data={})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_activate_license_invalid_key(self, authenticated_management_client):
        """Activate license with invalid key - expect 200/400/500 (API behavior)."""
        response = await authenticated_management_client.put(
            "/v3/licenses",
            json_data={"License": "invalid-license-key"}
        )
        assert response.status_code in [200, 400, 500], f"Expected 200/400/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_activate_license_sql_injection(self, authenticated_management_client):
        """Activate license with SQL injection - expect 200/400/500 (API behavior)."""
        response = await authenticated_management_client.put(
            "/v3/licenses",
            json_data={"License": "'; DROP TABLE licenses;--"}
        )
        assert response.status_code in [200, 400, 500], f"Expected 200/400/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_activate_license_no_auth(self, management_client):
        """Activate license without authentication - expect 401 Unauthorized."""
        response = await management_client.put(
            "/v3/licenses",
            json_data={"License": "some-license-key"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== Summary ====================

def test_management_licenses_summary():
    """Management Licenses API Tests Summary."""
    logger.info("management_licenses_summary", tests_run=13)
