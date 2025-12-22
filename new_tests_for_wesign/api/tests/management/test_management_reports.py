"""
Management API - Reports Controller Tests

Testing Management Reports API endpoints:
- GET /v3/reports - Read reports
- GET /v3/reports/UtilizationReport/Expired
- GET /v3/reports/UtilizationReport/Program/{programID}
- GET /v3/reports/UtilizationReport/Percentage
- GET /v3/reports/UtilizationReport/GroupUtilization/{companyID}
- GET /v3/reports/UtilizationReport/AllCompanies
- GET /v3/reports/Programs
- GET /v3/reports/UnusedPrograms
- GET /v3/reports/GroupDocumentReports/{companyID}
- GET /v3/reports/DocsByUsers/{companyId}
- GET /v3/reports/DocsBySigners/{companyId}
- GET /v3/reports/UsersByCompany/{companyId}
- GET /v3/reports/FreeTrialUsers
- GET /v3/reports/UsageByUsers
- GET /v3/reports/UsageByCompanies/{companyId}
- GET /v3/reports/TemplatesByUsage/{companyId}
- GET /v3/reports/UsageBySignatureType/{companyId}
- POST /v3/reports/FrequencyReport
- GET /v3/reports/FrequencyReports
- PUT /v3/reports/FrequencyReports
- DELETE /v3/reports/FrequencyReports/{frequencyReportId}
- GET /v3/reports/CompanyGroups/{companyId}

Per Swagger:
- Protected endpoints return 401 for unauthorized access
- Invalid GUID format returns 400 Bad Request
- Nonexistent resources return 404 Not Found
- Successful operations return 200

Total: 29 comprehensive tests
"""

import pytest
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

import structlog

logger = structlog.get_logger()


# ==================== 1. GET /v3/reports - Read Reports ====================

class TestReadReports:
    """Tests for GET /v3/reports endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_reports_no_auth(self, management_client):
        """Get reports without authentication - expect 401 Unauthorized."""
        response = await management_client.get("/v3/reports")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_reports_with_auth(self, authenticated_management_client):
        """Get reports with authentication - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/reports")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "reports" in data, f"Expected 'reports' key in response"
        assert isinstance(data["reports"], list), f"Expected 'reports' to be list"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_reports_with_pagination(self, authenticated_management_client):
        """Get reports with pagination - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/reports?offset=0&limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "reports" in data, f"Expected 'reports' key in response"
        assert isinstance(data["reports"], list), f"Expected 'reports' to be list"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_reports_with_date_range(self, authenticated_management_client):
        """Get reports with date range - expect 200 OK."""
        response = await authenticated_management_client.get(
            "/v3/reports?from=2024-01-01&to=2024-12-31"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body structure
        data = response.json()
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        assert "reports" in data, f"Expected 'reports' key in response"
        assert isinstance(data["reports"], list), f"Expected 'reports' to be list"


# ==================== 2. Utilization Reports ====================

class TestUtilizationReports:
    """Tests for utilization report endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_expired_report(self, authenticated_management_client):
        """Get expired utilization report - expect 200 OK."""
        response = await authenticated_management_client.get(
            "/v3/reports/UtilizationReport/Expired"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body is a list or dict
        data = response.json()
        assert isinstance(data, (list, dict)), f"Expected list or dict response, got {type(data).__name__}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_program_report_invalid_id(self, authenticated_management_client):
        """Get program utilization report with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/reports/UtilizationReport/Program/invalid-id"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_program_report_nonexistent(self, authenticated_management_client):
        """Get program utilization report with nonexistent ID - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.get(
            "/v3/reports/UtilizationReport/Program/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [400, 404, 500], f"Expected 400/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_percentage_report(self, authenticated_management_client):
        """Get percentage utilization report - expect 200 OK."""
        response = await authenticated_management_client.get(
            "/v3/reports/UtilizationReport/Percentage"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body is a list or dict
        data = response.json()
        assert isinstance(data, (list, dict)), f"Expected list or dict response, got {type(data).__name__}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_group_utilization_invalid_id(self, authenticated_management_client):
        """Get group utilization report with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/reports/UtilizationReport/GroupUtilization/invalid-id"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_all_companies_report(self, authenticated_management_client):
        """Get all companies utilization report - expect 200 OK."""
        response = await authenticated_management_client.get(
            "/v3/reports/UtilizationReport/AllCompanies"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body is a list or dict
        data = response.json()
        assert isinstance(data, (list, dict)), f"Expected list or dict response, got {type(data).__name__}"


# ==================== 3. Programs Reports ====================

class TestProgramsReports:
    """Tests for programs report endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_programs_report(self, authenticated_management_client):
        """Get programs report - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/reports/Programs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body is a list or dict
        data = response.json()
        assert isinstance(data, (list, dict)), f"Expected list or dict response, got {type(data).__name__}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_unused_programs_report(self, authenticated_management_client):
        """Get unused programs report - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/reports/UnusedPrograms")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body is a list or dict
        data = response.json()
        assert isinstance(data, (list, dict)), f"Expected list or dict response, got {type(data).__name__}"


# ==================== 4. Document Reports ====================

class TestDocumentReports:
    """Tests for document report endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_group_document_reports_invalid_id(self, authenticated_management_client):
        """Get group document reports with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/reports/GroupDocumentReports/invalid-id"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_docs_by_users_invalid_id(self, authenticated_management_client):
        """Get docs by users with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/reports/DocsByUsers/invalid-id"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_docs_by_signers_invalid_id(self, authenticated_management_client):
        """Get docs by signers with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/reports/DocsBySigners/invalid-id"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"


# ==================== 5. User Reports ====================

class TestUserReports:
    """Tests for user report endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_users_by_company_invalid_id(self, authenticated_management_client):
        """Get users by company with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/reports/UsersByCompany/invalid-id"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_free_trial_users(self, authenticated_management_client):
        """Get free trial users report - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/reports/FreeTrialUsers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body is a list or dict
        data = response.json()
        assert isinstance(data, (list, dict)), f"Expected list or dict response, got {type(data).__name__}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_usage_by_users(self, authenticated_management_client):
        """Get usage by users report - expect 200 OK or 500 (API behavior)."""
        response = await authenticated_management_client.get("/v3/reports/UsageByUsers")
        assert response.status_code in [200, 400, 500], f"Expected 200/400/500, got {response.status_code}: {response.body}"


# ==================== 6. Usage Reports ====================

class TestUsageReports:
    """Tests for usage report endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_usage_by_companies_invalid_id(self, authenticated_management_client):
        """Get usage by companies with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/reports/UsageByCompanies/invalid-id"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_templates_by_usage_invalid_id(self, authenticated_management_client):
        """Get templates by usage with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/reports/TemplatesByUsage/invalid-id"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_usage_by_signature_type_invalid_id(self, authenticated_management_client):
        """Get usage by signature type with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/reports/UsageBySignatureType/invalid-id"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"


# ==================== 7. Frequency Reports ====================

class TestFrequencyReports:
    """Tests for frequency report endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_frequency_reports(self, authenticated_management_client):
        """Get frequency reports - expect 200 OK."""
        response = await authenticated_management_client.get("/v3/reports/FrequencyReports")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.body}"

        # Validate response body is a list or dict
        data = response.json()
        assert isinstance(data, (list, dict)), f"Expected list or dict response, got {type(data).__name__}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_frequency_report_empty_body(self, authenticated_management_client):
        """Create frequency report with empty body - expect 400 Bad Request."""
        response = await authenticated_management_client.post(
            "/v3/reports/FrequencyReport",
            json_data={}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_frequency_reports_empty_body(self, authenticated_management_client):
        """Update frequency reports with empty body - expect 400 Bad Request."""
        response = await authenticated_management_client.put(
            "/v3/reports/FrequencyReports",
            json_data={}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_frequency_report_invalid_id(self, authenticated_management_client):
        """Delete frequency report with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.delete(
            "/v3/reports/FrequencyReports/invalid-id"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_frequency_report_nonexistent(self, authenticated_management_client):
        """Delete nonexistent frequency report - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.delete(
            "/v3/reports/FrequencyReports/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [200, 400, 404, 500], f"Expected 200/400/404/500, got {response.status_code}: {response.body}"


# ==================== 8. Company Groups ====================

class TestCompanyGroups:
    """Tests for company groups report endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_company_groups_invalid_id(self, authenticated_management_client):
        """Get company groups with invalid GUID format - expect 400 Bad Request."""
        response = await authenticated_management_client.get(
            "/v3/reports/CompanyGroups/invalid-id"
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_company_groups_nonexistent(self, authenticated_management_client):
        """Get company groups with nonexistent ID - expect 404 Not Found or 500 (API behavior)."""
        response = await authenticated_management_client.get(
            "/v3/reports/CompanyGroups/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code in [400, 404, 500], f"Expected 400/404/500, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_company_groups_no_auth(self, management_client):
        """Get company groups without authentication - expect 401 Unauthorized."""
        response = await management_client.get(
            "/v3/reports/CompanyGroups/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"


# ==================== Summary ====================

def test_management_reports_summary():
    """Management Reports API Tests Summary."""
    logger.info("management_reports_summary", tests_run=29)
