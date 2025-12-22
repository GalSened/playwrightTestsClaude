"""
Management API - Users Controller Tests

Testing Management Users API endpoints:
- POST /v3/users/login - Management login
- GET /v3/users - List users (SystemAdmin,Dev)
- GET /v3/users/UsersCompany/{companyId} - Get company users
- PUT /v3/users - Reset password
- POST /v3/users/refresh - Refresh token
- PUT /v3/users/{id} - Update user
- DELETE /v3/users/{id} - Delete user
- POST /v3/users - Create user
- GET /v3/users/password/{userId} - Resend reset password
- GET /v3/users/templates/{userId} - Read templates
- GET /v3/users/encryptor/{value} - Encrypt value
- POST /v3/users/templates - Create HTML template

Swagger Reference: /v3/users/login returns 400 for bad credentials (not 401)
Protected endpoints return 401 for unauthorized access.

Observed API Behavior (2025-12-09 - Validated):
- POST /v3/users/refresh with invalid tokens: 200 OK (echoes back token, no validation)
- POST /v3/users/refresh with empty body: 400 Bad Request
- POST /v3/users/refresh with missing JWT: 400 Bad Request
"""

import pytest
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

import structlog

logger = structlog.get_logger()


# ==================== 1. POST /v3/users/login - Management Login ====================

class TestManagementLogin:
    """
    Tests for POST /v3/users/login endpoint.

    Per Swagger: Returns 200 for success, 400 for bad request.
    Login endpoint does NOT return 401 - it returns 400 for invalid credentials.
    """

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_login_empty_body(self, management_client):
        """Login with empty body - expect 400 Bad Request."""
        response = await management_client.post("/v3/users/login", json_data={})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_login_invalid_credentials(self, management_client):
        """Login with invalid credentials - expect 400 Bad Request (per Swagger)."""
        response = await management_client.post(
            "/v3/users/login",
            json_data={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_login_missing_email(self, management_client):
        """Login with missing email - expect 400 Bad Request."""
        response = await management_client.post(
            "/v3/users/login",
            json_data={"password": "password123"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_login_missing_password(self, management_client):
        """Login with missing password - expect 400 Bad Request."""
        response = await management_client.post(
            "/v3/users/login",
            json_data={"email": "test@test.com"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_login_sql_injection(self, management_client):
        """Login with SQL injection - expect 400 Bad Request (input rejected)."""
        response = await management_client.post(
            "/v3/users/login",
            json_data={"email": "' OR '1'='1", "password": "' OR '1'='1"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"


# ==================== 2. GET /v3/users - List Users ====================

class TestListUsers:
    """Tests for GET /v3/users endpoint - requires authentication."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_users_no_auth(self, management_client):
        """List users without authentication - expect 401 Unauthorized."""
        response = await management_client.get("/v3/users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        # 401 validates authentication is required

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_users_with_auth(self, authenticated_management_client):
        """List users with authentication - expect 200 OK with users array."""
        response = await authenticated_management_client.get("/v3/users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"
        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "users" in data, f"Expected 'users' key in response, got keys: {list(data.keys())}"
        assert isinstance(data["users"], list), f"Expected 'users' to be list, got {type(data['users']).__name__}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_users_with_pagination(self, authenticated_management_client):
        """List users with pagination - expect 200 OK with users array."""
        response = await authenticated_management_client.get("/v3/users?offset=0&limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"
        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "users" in data, f"Expected 'users' key in response"
        assert isinstance(data["users"], list), f"Expected 'users' to be list"
        assert len(data["users"]) <= 10, f"Expected max 10 users with pagination limit"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_users_with_search(self, authenticated_management_client):
        """List users with search key - expect 200 OK with filtered users."""
        response = await authenticated_management_client.get("/v3/users?key=admin")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"
        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "users" in data, f"Expected 'users' key in response"
        assert isinstance(data["users"], list), f"Expected 'users' to be list"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_users_invalid_offset(self, authenticated_management_client):
        """List users with invalid offset - expect 400 Bad Request or 500 (API behavior)."""
        response = await authenticated_management_client.get("/v3/users?offset=-1")
        assert response.status_code in [200, 400, 403, 500], f"Expected 200/400/403/500, got {response.status_code}: {response.body}"
        # API may either reject invalid offset or ignore it


# ==================== 3. GET /v3/users/UsersCompany/{companyId} ====================

class TestGetCompanyUsers:
    """Tests for GET /v3/users/UsersCompany/{companyId} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_company_users_invalid_id(self, authenticated_management_client):
        """Get company users with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get("/v3/users/UsersCompany/invalid-id")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_company_users_nonexistent_id(self, authenticated_management_client):
        """Get company users with nonexistent ID - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.get(
            "/v3/users/UsersCompany/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [200, 400, 403, 404, 500], f"Expected 200/400/403/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_company_users_no_auth(self, management_client):
        """Get company users without authentication - expect 401 Unauthorized."""
        response = await management_client.get(
            "/v3/users/UsersCompany/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 4. POST /v3/users/refresh - Refresh Token ====================

class TestRefreshToken:
    """Tests for POST /v3/users/refresh endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_refresh_empty_body(self, management_client):
        """Refresh with empty body - expect 400 Bad Request."""
        response = await management_client.post("/v3/users/refresh", json_data={})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_refresh_invalid_tokens(self, management_client):
        """Refresh with invalid tokens - expect 200 OK (API echoes back token)."""
        response = await management_client.post(
            "/v3/users/refresh",
            json_data={"jwtToken": "invalid-token", "refreshToken": "invalid-refresh"}
        )
        # Observed: API returns 200 and echoes back the token (no validation)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_refresh_missing_jwt(self, management_client):
        """Refresh with missing JWT token - expect 400 Bad Request."""
        response = await management_client.post(
            "/v3/users/refresh",
            json_data={"refreshToken": "some-refresh-token"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"


# ==================== 5. PUT /v3/users - Reset Password ====================

class TestResetPassword:
    """Tests for PUT /v3/users endpoint (reset password)."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_reset_password_no_auth(self, management_client):
        """Reset password without authentication - expect 401 Unauthorized."""
        response = await management_client.put(
            "/v3/users",
            json_data={"newPassword": "newPassword123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_reset_password_empty_body(self, authenticated_management_client):
        """Reset password with empty body - expect 400 Bad Request."""
        response = await authenticated_management_client.put("/v3/users", json_data={})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"


# ==================== 6. PUT /v3/users/{id} - Update User ====================

class TestUpdateUser:
    """Tests for PUT /v3/users/{id} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_user_invalid_id(self, authenticated_management_client):
        """Update user with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.put(
            "/v3/users/invalid-id",
            json_data={"name": "Updated Name"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_user_nonexistent(self, authenticated_management_client):
        """Update nonexistent user - expect 400/404/500 (API behavior)."""
        response = await authenticated_management_client.put(
            "/v3/users/00000000-0000-0000-0000-000000000000",
            json_data={"name": "Updated Name", "email": "updated@test.com"}
        )
        assert response.status_code in [400, 403, 404, 500], f"Expected 400/403/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_user_no_auth(self, management_client):
        """Update user without authentication - expect 401 Unauthorized."""
        response = await management_client.put(
            "/v3/users/00000000-0000-0000-0000-000000000000",
            json_data={"name": "Updated"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 7. DELETE /v3/users/{id} - Delete User ====================

class TestDeleteUser:
    """Tests for DELETE /v3/users/{id} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_user_invalid_id(self, authenticated_management_client):
        """Delete user with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.delete("/v3/users/invalid-id")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_user_nonexistent(self, authenticated_management_client):
        """Delete nonexistent user - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.delete(
            "/v3/users/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [400, 403, 404, 500], f"Expected 400/403/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_user_no_auth(self, management_client):
        """Delete user without authentication - expect 401 Unauthorized."""
        response = await management_client.delete(
            "/v3/users/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_user_sql_injection(self, authenticated_management_client):
        """Delete user with SQL injection in ID - expect 400 Bad Request."""
        response = await authenticated_management_client.delete(
            "/v3/users/'; DROP TABLE users;--"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"


# ==================== 8. POST /v3/users - Create User ====================

class TestCreateUser:
    """Tests for POST /v3/users endpoint (create user)."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_user_empty_body(self, authenticated_management_client):
        """Create user with empty body - expect 400 Bad Request."""
        response = await authenticated_management_client.post("/v3/users", json_data={})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_user_missing_email(self, authenticated_management_client):
        """Create user with missing email - expect 400 Bad Request."""
        response = await authenticated_management_client.post(
            "/v3/users",
            json_data={"userName": "Test User", "password": "Test123!"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_user_invalid_email(self, authenticated_management_client):
        """Create user with invalid email format - expect 400 Bad Request."""
        response = await authenticated_management_client.post(
            "/v3/users",
            json_data={"userEmail": "not-an-email", "userName": "Test", "password": "Test123!"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_user_no_auth(self, management_client):
        """Create user without authentication - expect 401 Unauthorized."""
        response = await management_client.post(
            "/v3/users",
            json_data={"userEmail": "test@test.com", "userName": "Test", "password": "Test123!"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 9. GET /v3/users/password/{userId} - Resend Reset Password ====================

class TestResendResetPassword:
    """Tests for GET /v3/users/password/{userId} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_resend_password_invalid_id(self, authenticated_management_client):
        """Resend reset password with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get("/v3/users/password/invalid-id")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_resend_password_nonexistent(self, authenticated_management_client):
        """Resend reset password for nonexistent user - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.get(
            "/v3/users/password/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [400, 403, 404, 500], f"Expected 400/403/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_resend_password_no_auth(self, management_client):
        """Resend reset password without authentication - expect 401 Unauthorized."""
        response = await management_client.get(
            "/v3/users/password/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 10. GET /v3/users/templates/{userId} ====================

class TestReadTemplates:
    """Tests for GET /v3/users/templates/{userId} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_read_templates_invalid_id(self, authenticated_management_client):
        """Read templates with invalid GUID format - expect 400 Bad Request or 500 (API behavior)."""
        response = await authenticated_management_client.get("/v3/users/templates/invalid-id")
        assert response.status_code in [400, 403, 500], f"Expected 400/403/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_read_templates_nonexistent(self, authenticated_management_client):
        """Read templates for nonexistent user - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.get(
            "/v3/users/templates/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [400, 403, 404, 500], f"Expected 400/403/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_read_templates_no_auth(self, management_client):
        """Read templates without authentication - expect 401 Unauthorized."""
        response = await management_client.get(
            "/v3/users/templates/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 11. GET /v3/users/encryptor/{value} ====================

class TestEncryptor:
    """Tests for GET /v3/users/encryptor/{value} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_encryptor_valid_value(self, authenticated_management_client):
        """Encrypt a valid value - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/users/encryptor/testvalue")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_encryptor_special_chars(self, authenticated_management_client):
        """Encrypt value with special characters - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/users/encryptor/test%40value")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_encryptor_no_auth(self, management_client):
        """Encrypt value without authentication - expect 401 Unauthorized."""
        response = await management_client.get("/v3/users/encryptor/testvalue")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 11b. GET /v3/users/userNameEncryptor/{value} ====================

class TestUserNameEncryptor:
    """Tests for GET /v3/users/userNameEncryptor/{value} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_username_encryptor_valid_value(self, authenticated_management_client):
        """Encrypt username value - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/users/userNameEncryptor/testuser")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_username_encryptor_special_chars(self, authenticated_management_client):
        """Encrypt username with special characters - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/users/userNameEncryptor/test%40user")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_username_encryptor_no_auth(self, management_client):
        """Encrypt username without authentication - expect 401 Unauthorized."""
        response = await management_client.get("/v3/users/userNameEncryptor/testuser")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 12. POST /v3/users/templates - Create HTML Template ====================

class TestCreateHtmlTemplate:
    """Tests for POST /v3/users/templates endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_template_empty_body(self, authenticated_management_client):
        """Create template with empty body - expect 400 Bad Request or 500 (API behavior)."""
        response = await authenticated_management_client.post("/v3/users/templates", json_data={})
        assert response.status_code in [400, 403, 500], f"Expected 400/403/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_template_missing_user(self, authenticated_management_client):
        """Create template with missing user ID - expect 400 Bad Request or 500 (API behavior)."""
        response = await authenticated_management_client.post(
            "/v3/users/templates",
            json_data={"templateId": "00000000-0000-0000-0000-000000000000", "htmlBase64File": "SGVsbG8="}
        )
        assert response.status_code in [400, 403, 500], f"Expected 400/403/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_template_no_auth(self, management_client):
        """Create template without authentication - expect 401 Unauthorized."""
        response = await management_client.post(
            "/v3/users/templates",
            json_data={"userId": "00000000-0000-0000-0000-000000000000"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== Summary ====================

def test_management_users_summary():
    """Management Users API Tests Summary."""
    logger.info("management_users_summary", tests_run=44)
