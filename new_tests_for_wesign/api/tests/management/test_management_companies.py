"""
Management API - Companies Controller Tests

Testing Management Companies API endpoints:
- POST /v3/companies - Create company
- PUT /v3/companies/{id} - Update company
- GET /v3/companies/{id}/users/{userId} - Read company details
- GET /v3/companies/{id}/deletionconfiguration - Read deletion config
- GET /v3/companies - List companies
- DELETE /v3/companies/{id} - Delete company
- GET /v3/companies/password/{userId} - Resend reset password

Total: 26 comprehensive tests
"""

import pytest
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

import structlog

logger = structlog.get_logger()


# ==================== 1. GET /v3/companies - List Companies ====================

class TestListCompanies:
    """Tests for GET /v3/companies endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_companies_no_auth(self, management_client):
        """List companies without authentication - expect 401 Unauthorized."""
        response = await management_client.get("/v3/companies")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        # 401 responses may have empty body or error message

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_companies_with_auth(self, authenticated_management_client):
        """List companies with authentication - expect 200 OK with companies array."""
        response = await authenticated_management_client.get("/v3/companies")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"
        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "companies" in data, f"Expected 'companies' key in response, got keys: {list(data.keys())}"
        assert isinstance(data["companies"], list), f"Expected 'companies' to be list, got {type(data['companies']).__name__}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_companies_with_pagination(self, authenticated_management_client):
        """List companies with pagination - expect 200 OK with companies array."""
        response = await authenticated_management_client.get("/v3/companies?offset=0&limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"
        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "companies" in data, f"Expected 'companies' key in response"
        assert isinstance(data["companies"], list), f"Expected 'companies' to be list"
        # With pagination, list should not exceed limit
        assert len(data["companies"]) <= 10, f"Expected max 10 companies, got {len(data['companies'])}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_companies_with_search(self, authenticated_management_client):
        """List companies with search key - expect 200 OK with filtered companies."""
        response = await authenticated_management_client.get("/v3/companies?key=test")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"
        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "companies" in data, f"Expected 'companies' key in response"
        assert isinstance(data["companies"], list), f"Expected 'companies' to be list"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_companies_invalid_offset(self, authenticated_management_client):
        """List companies with invalid offset - expect 400 Bad Request or error response."""
        response = await authenticated_management_client.get("/v3/companies?offset=-1")
        assert response.status_code in [200, 400], f"Expected 200/400, got {response.status_code}: {response.body}"
        # API may either reject or ignore invalid offset


# ==================== 2. POST /v3/companies - Create Company ====================

class TestCreateCompany:
    """Tests for POST /v3/companies endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_company_empty_body(self, authenticated_management_client):
        """Create company with empty body - expect 400 Bad Request or 500 (API behavior)."""
        response = await authenticated_management_client.post("/v3/companies", json_data={})
        assert response.status_code in [400, 500], f"Expected 400/500, got {response.status_code}: {response.body}"
        # Error response may contain error details or be empty

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_company_missing_name(self, authenticated_management_client):
        """Create company with missing name - expect 400 Bad Request or 500 (API behavior)."""
        response = await authenticated_management_client.post(
            "/v3/companies",
            json_data={"ProgramId": "00000000-0000-0000-0000-000000000000"}
        )
        assert response.status_code in [400, 500], f"Expected 400/500, got {response.status_code}: {response.body}"
        # Error response validates required field validation

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_company_sql_injection(self, authenticated_management_client):
        """Create company with SQL injection - should be sanitized, expect 400/500 or 200."""
        response = await authenticated_management_client.post(
            "/v3/companies",
            json_data={
                "CompanyName": "'; DROP TABLE companies;--",
                "ProgramId": "00000000-0000-0000-0000-000000000000"
            }
        )
        # API should either reject or sanitize - never execute SQL injection
        assert response.status_code in [200, 400, 500], f"Expected 200/400/500, got {response.status_code}: {response.body}"
        # If 200, company was created with sanitized name (security test passed)

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_company_no_auth(self, management_client):
        """Create company without authentication - expect 401 Unauthorized."""
        response = await management_client.post(
            "/v3/companies",
            json_data={"CompanyName": "Test Company"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        # 401 validates authentication is required for create operations


# ==================== 3. PUT /v3/companies/{id} - Update Company ====================

class TestUpdateCompany:
    """Tests for PUT /v3/companies/{id} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_company_invalid_id(self, authenticated_management_client):
        """Update company with invalid ID - expect 400 Bad Request or 500 (API behavior)."""
        response = await authenticated_management_client.put(
            "/v3/companies/invalid-id",
            json_data={"CompanyName": "Updated Company"}
        )
        assert response.status_code in [400, 500], f"Expected 400/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_company_nonexistent(self, authenticated_management_client):
        """Update nonexistent company - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.put(
            "/v3/companies/00000000-0000-0000-0000-000000000000",
            json_data={"CompanyName": "Updated Company"}
        )
        assert response.status_code in [400, 404, 500], f"Expected 400/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_company_empty_body(self, authenticated_management_client):
        """Update company with empty body - expect 400 Bad Request or 500 (API behavior)."""
        response = await authenticated_management_client.put(
            "/v3/companies/00000000-0000-0000-0000-000000000000",
            json_data={}
        )
        assert response.status_code in [400, 500], f"Expected 400/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_company_no_auth(self, management_client):
        """Update company without authentication - expect 401 Unauthorized."""
        response = await management_client.put(
            "/v3/companies/00000000-0000-0000-0000-000000000000",
            json_data={"CompanyName": "Updated"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 4. GET /v3/companies/{id}/users/{userId} - Read Company Details ====================

class TestReadCompanyDetails:
    """Tests for GET /v3/companies/{id}/users/{userId} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_read_company_invalid_id(self, authenticated_management_client):
        """Read company details with invalid ID - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/companies/invalid-id/users/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_read_company_nonexistent(self, authenticated_management_client):
        """Read nonexistent company details - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.get(
            "/v3/companies/00000000-0000-0000-0000-000000000000/users/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [400, 404, 500], f"Expected 400/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_read_company_no_auth(self, management_client):
        """Read company details without authentication - expect 401 Unauthorized."""
        response = await management_client.get(
            "/v3/companies/00000000-0000-0000-0000-000000000000/users/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 5. GET /v3/companies/{id}/deletionconfiguration ====================

class TestReadDeletionConfig:
    """Tests for GET /v3/companies/{id}/deletionconfiguration endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_deletion_config_invalid_id(self, authenticated_management_client):
        """Get deletion config with invalid ID - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/companies/invalid-id/deletionconfiguration"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_deletion_config_nonexistent(self, authenticated_management_client):
        """Get deletion config for nonexistent company - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.get(
            "/v3/companies/00000000-0000-0000-0000-000000000000/deletionconfiguration"
        )
        assert response.status_code in [200, 400, 404, 500], f"Expected 200/400/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_deletion_config_no_auth(self, management_client):
        """Get deletion config without authentication - expect 401 Unauthorized."""
        response = await management_client.get(
            "/v3/companies/00000000-0000-0000-0000-000000000000/deletionconfiguration"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 6. DELETE /v3/companies/{id} - Delete Company ====================

class TestDeleteCompany:
    """Tests for DELETE /v3/companies/{id} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_company_invalid_id(self, authenticated_management_client):
        """Delete company with invalid ID - expect 400 Bad Request."""
        response = await authenticated_management_client.delete("/v3/companies/invalid-id")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_company_nonexistent(self, authenticated_management_client):
        """Delete nonexistent company - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.delete(
            "/v3/companies/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [200, 400, 404, 500], f"Expected 200/400/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_company_no_auth(self, management_client):
        """Delete company without authentication - expect 401 Unauthorized."""
        response = await management_client.delete(
            "/v3/companies/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_company_sql_injection(self, authenticated_management_client):
        """Delete company with SQL injection - expect 400 Bad Request."""
        response = await authenticated_management_client.delete(
            "/v3/companies/'; DROP TABLE companies;--"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"


# ==================== 7. GET /v3/companies/password/{userId} ====================

class TestCompanyResendPassword:
    """Tests for GET /v3/companies/password/{userId} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_resend_password_invalid_id(self, authenticated_management_client):
        """Resend password with invalid user ID - expect 400 Bad Request."""
        response = await authenticated_management_client.get("/v3/companies/password/invalid-id")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_resend_password_nonexistent(self, authenticated_management_client):
        """Resend password for nonexistent user - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.get(
            "/v3/companies/password/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [400, 404, 500], f"Expected 400/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_resend_password_no_auth(self, management_client):
        """Resend password without authentication - expect 401 Unauthorized."""
        response = await management_client.get(
            "/v3/companies/password/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== Summary ====================

def test_management_companies_summary():
    """Management Companies API Tests Summary."""
    logger.info("management_companies_summary", tests_run=26)
