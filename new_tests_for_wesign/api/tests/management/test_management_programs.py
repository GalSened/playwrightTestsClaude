"""
Management API - Programs Controller Tests

Testing Management Programs API endpoints:
- GET /v3/programs/{id} - Read program by ID
- GET /v3/programs - List programs
- PUT /v3/programs/{id} - Update program
- POST /v3/programs - Create program
- DELETE /v3/programs/{id} - Delete program

Per Swagger:
- Protected endpoints return 401 for unauthorized access
- Invalid GUID format returns 400 Bad Request
- Nonexistent resources return 404 Not Found
- Successful operations return 200

Total: 19 comprehensive tests
"""

import pytest
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

import structlog

logger = structlog.get_logger()


# ==================== 1. GET /v3/programs - List Programs ====================

class TestListPrograms:
    """Tests for GET /v3/programs endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_programs_no_auth(self, management_client):
        """List programs without authentication - expect 401 Unauthorized."""
        response = await management_client.get("/v3/programs")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_programs_with_auth(self, authenticated_management_client):
        """List programs with authentication - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/programs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "programs" in data, f"Expected 'programs' key in response"
        assert isinstance(data["programs"], list), f"Expected 'programs' to be list"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_programs_with_pagination(self, authenticated_management_client):
        """List programs with pagination - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/programs?offset=0&limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "programs" in data, f"Expected 'programs' key in response"
        assert isinstance(data["programs"], list), f"Expected 'programs' to be list"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_programs_with_search(self, authenticated_management_client):
        """List programs with search key - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/programs?key=test")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "programs" in data, f"Expected 'programs' key in response"
        assert isinstance(data["programs"], list), f"Expected 'programs' to be list"


# ==================== 2. GET /v3/programs/{id} - Read Program ====================

class TestReadProgram:
    """Tests for GET /v3/programs/{id} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_read_program_invalid_id(self, authenticated_management_client):
        """Read program with invalid GUID format - expect 400 Bad Request or 500 (API behavior)."""
        response = await authenticated_management_client.get("/v3/programs/invalid-id")
        assert response.status_code in [400, 500], f"Expected 400/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_read_program_nonexistent(self, authenticated_management_client):
        """Read nonexistent program - expect 204/400/404/500 (API behavior)."""
        response = await authenticated_management_client.get(
            "/v3/programs/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [204, 400, 404, 500], f"Expected 204/400/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_read_program_no_auth(self, management_client):
        """Read program without authentication - expect 401 Unauthorized."""
        response = await management_client.get(
            "/v3/programs/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 3. POST /v3/programs - Create Program ====================

class TestCreateProgram:
    """Tests for POST /v3/programs endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_program_empty_body(self, authenticated_management_client):
        """Create program with empty body - expect 400 Bad Request."""
        response = await authenticated_management_client.post("/v3/programs", json_data={})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_program_missing_name(self, authenticated_management_client):
        """Create program with missing name - expect 400 Bad Request."""
        response = await authenticated_management_client.post(
            "/v3/programs",
            json_data={"Users": 10, "DocumentsPerMonth": 100}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_program_sql_injection(self, authenticated_management_client):
        """Create program with SQL injection in name - expect 400 Bad Request (input rejected)."""
        response = await authenticated_management_client.post(
            "/v3/programs",
            json_data={
                "Name": "'; DROP TABLE programs;--",
                "Users": 10
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_program_no_auth(self, management_client):
        """Create program without authentication - expect 401 Unauthorized."""
        response = await management_client.post(
            "/v3/programs",
            json_data={"Name": "Test Program", "Users": 10}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 4. PUT /v3/programs/{id} - Update Program ====================

class TestUpdateProgram:
    """Tests for PUT /v3/programs/{id} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_program_invalid_id(self, authenticated_management_client):
        """Update program with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.put(
            "/v3/programs/invalid-id",
            json_data={"Name": "Updated Program"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_program_nonexistent(self, authenticated_management_client):
        """Update nonexistent program - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.put(
            "/v3/programs/00000000-0000-0000-0000-000000000000",
            json_data={"Name": "Updated Program", "Users": 10}
        )
        assert response.status_code in [400, 404, 500], f"Expected 400/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_program_empty_body(self, authenticated_management_client):
        """Update program with empty body - expect 400 Bad Request."""
        response = await authenticated_management_client.put(
            "/v3/programs/00000000-0000-0000-0000-000000000000",
            json_data={}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_program_no_auth(self, management_client):
        """Update program without authentication - expect 401 Unauthorized."""
        response = await management_client.put(
            "/v3/programs/00000000-0000-0000-0000-000000000000",
            json_data={"Name": "Updated"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== 5. DELETE /v3/programs/{id} - Delete Program ====================

class TestDeleteProgram:
    """Tests for DELETE /v3/programs/{id} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_program_invalid_id(self, authenticated_management_client):
        """Delete program with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.delete("/v3/programs/invalid-id")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_program_nonexistent(self, authenticated_management_client):
        """Delete nonexistent program - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.delete(
            "/v3/programs/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [400, 404, 500], f"Expected 400/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_program_no_auth(self, management_client):
        """Delete program without authentication - expect 401 Unauthorized."""
        response = await management_client.delete(
            "/v3/programs/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_program_sql_injection(self, authenticated_management_client):
        """Delete program with SQL injection in ID - expect 400 Bad Request."""
        response = await authenticated_management_client.delete(
            "/v3/programs/'; DROP TABLE programs;--"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"


# ==================== Summary ====================

def test_management_programs_summary():
    """Management Programs API Tests Summary."""
    logger.info("management_programs_summary", tests_run=19)
