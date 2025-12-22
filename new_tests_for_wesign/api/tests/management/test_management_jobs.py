"""
Management API - Jobs Controller Tests

Testing Management Jobs API endpoints:
- POST /v3/jobs/create-active-directory-users-and-contacts
- POST /v3/jobs/clean-db
- POST /v3/jobs/send-program-expired-notification
- POST /v3/jobs/reset-programs-utilization
- POST /v3/jobs/send-program-capacity-about-to-expire-notification
- POST /v3/jobs/delete-logs-from-db
- POST /v3/jobs/send-document-about-to-be-deleted-notification
- POST /v3/jobs/clean-unused-templates-and-contacts
- POST /v3/jobs/send-sign-reminders
- POST /v3/jobs/send-user-periodic-reports
- POST /v3/jobs/send-management-periodic-reports
- POST /v3/jobs/delete-expired-periodic-report-files
- POST /v3/jobs/update-expired-signer-tokens

Per API Behavior (Validated 2025-12-10):
- All jobs endpoints require POST method
- GET request returns 405 Method Not Allowed with Allow: POST header
- POST without auth returns 401 Unauthorized
- POST with user auth (but no AppKey) returns 401 "Missing AppKey header"
- Jobs endpoints require BOTH user auth token AND AppKey header for security
- These are background job triggers meant to be called by schedulers, not users

Total: 28 comprehensive tests
"""

import pytest
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

import structlog

logger = structlog.get_logger()


# ==================== 1. Create AD Users and Contacts ====================

class TestCreateADUsersAndContacts:
    """Tests for POST /v3/jobs/create-active-directory-users-and-contacts endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_ad_users_no_auth(self, management_client):
        """Trigger AD users creation without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/create-active-directory-users-and-contacts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_ad_users_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger AD users creation with user auth but no AppKey - expect 401 Missing AppKey."""
        response = await authenticated_management_client.post("/v3/jobs/create-active-directory-users-and-contacts")
        # Jobs endpoints require AppKey header in addition to user auth
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 2. Clean DB ====================

class TestCleanDB:
    """Tests for POST /v3/jobs/clean-db endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_clean_db_no_auth(self, management_client):
        """Trigger DB cleanup without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/clean-db")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_clean_db_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger DB cleanup with user auth but no AppKey - expect 401 Missing AppKey."""
        response = await authenticated_management_client.post("/v3/jobs/clean-db")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 3. Send Program Expired Notification ====================

class TestSendProgramExpiredNotification:
    """Tests for POST /v3/jobs/send-program-expired-notification endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_program_expired_no_auth(self, management_client):
        """Trigger program expired notification without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/send-program-expired-notification")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_program_expired_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger program expired notification with user auth but no AppKey - expect 401."""
        response = await authenticated_management_client.post("/v3/jobs/send-program-expired-notification")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 4. Reset Programs Utilization ====================

class TestResetProgramsUtilization:
    """Tests for POST /v3/jobs/reset-programs-utilization endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_reset_utilization_no_auth(self, management_client):
        """Trigger utilization reset without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/reset-programs-utilization")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_reset_utilization_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger utilization reset with user auth but no AppKey - expect 401."""
        response = await authenticated_management_client.post("/v3/jobs/reset-programs-utilization")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 5. Send Program Capacity About to Expire Notification ====================

class TestSendProgramCapacityNotification:
    """Tests for POST /v3/jobs/send-program-capacity-about-to-expire-notification endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_capacity_notification_no_auth(self, management_client):
        """Trigger capacity notification without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/send-program-capacity-about-to-expire-notification")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_capacity_notification_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger capacity notification with user auth but no AppKey - expect 401."""
        response = await authenticated_management_client.post("/v3/jobs/send-program-capacity-about-to-expire-notification")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 6. Delete Logs from DB ====================

class TestDeleteLogsFromDB:
    """Tests for POST /v3/jobs/delete-logs-from-db endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_logs_no_auth(self, management_client):
        """Trigger log deletion without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/delete-logs-from-db")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_logs_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger log deletion with user auth but no AppKey - expect 401."""
        response = await authenticated_management_client.post("/v3/jobs/delete-logs-from-db")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 7. Send Document About to be Deleted Notification ====================

class TestSendDocumentDeleteNotification:
    """Tests for POST /v3/jobs/send-document-about-to-be-deleted-notification endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_doc_delete_notification_no_auth(self, management_client):
        """Trigger document deletion notification without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/send-document-about-to-be-deleted-notification")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_doc_delete_notification_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger document deletion notification with user auth but no AppKey - expect 401."""
        response = await authenticated_management_client.post("/v3/jobs/send-document-about-to-be-deleted-notification")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 8. Clean Unused Templates and Contacts ====================

class TestCleanUnusedTemplatesAndContacts:
    """Tests for POST /v3/jobs/clean-unused-templates-and-contacts endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_clean_unused_no_auth(self, management_client):
        """Trigger cleanup without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/clean-unused-templates-and-contacts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_clean_unused_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger cleanup with user auth but no AppKey - expect 401."""
        response = await authenticated_management_client.post("/v3/jobs/clean-unused-templates-and-contacts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 9. Send Sign Reminders ====================

class TestSendSignReminders:
    """Tests for POST /v3/jobs/send-sign-reminders endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_sign_reminders_no_auth(self, management_client):
        """Trigger sign reminders without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/send-sign-reminders")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_sign_reminders_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger sign reminders with user auth but no AppKey - expect 401."""
        response = await authenticated_management_client.post("/v3/jobs/send-sign-reminders")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 10. Send User Periodic Reports ====================

class TestSendUserPeriodicReports:
    """Tests for POST /v3/jobs/send-user-periodic-reports endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_user_reports_no_auth(self, management_client):
        """Trigger user periodic reports without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/send-user-periodic-reports")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_user_reports_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger user periodic reports with user auth but no AppKey - expect 401."""
        response = await authenticated_management_client.post("/v3/jobs/send-user-periodic-reports")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 11. Send Management Periodic Reports ====================

class TestSendManagementPeriodicReports:
    """Tests for POST /v3/jobs/send-management-periodic-reports endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_mgmt_reports_no_auth(self, management_client):
        """Trigger management periodic reports without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/send-management-periodic-reports")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_mgmt_reports_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger management periodic reports with user auth but no AppKey - expect 401."""
        response = await authenticated_management_client.post("/v3/jobs/send-management-periodic-reports")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 12. Delete Expired Periodic Report Files ====================

class TestDeleteExpiredPeriodicReportFiles:
    """Tests for POST /v3/jobs/delete-expired-periodic-report-files endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_expired_files_no_auth(self, management_client):
        """Trigger expired file deletion without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/delete-expired-periodic-report-files")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_delete_expired_files_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger expired file deletion with user auth but no AppKey - expect 401."""
        response = await authenticated_management_client.post("/v3/jobs/delete-expired-periodic-report-files")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== 13. Update Expired Signer Tokens ====================

class TestUpdateExpiredSignerTokens:
    """Tests for POST /v3/jobs/update-expired-signer-tokens endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_tokens_no_auth(self, management_client):
        """Trigger token update without authentication - expect 401 Unauthorized."""
        response = await management_client.post("/v3/jobs/update-expired-signer-tokens")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_tokens_with_auth_no_appkey(self, authenticated_management_client):
        """Trigger token update with user auth but no AppKey - expect 401."""
        response = await authenticated_management_client.post("/v3/jobs/update-expired-signer-tokens")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.body}"
        if response.body:
            assert "AppKey" in str(response.body), f"Expected AppKey error, got: {response.body}"


# ==================== HTTP Method Validation ====================

class TestJobsHTTPMethods:
    """Test HTTP method handling for Jobs endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_jobs_get_method_not_allowed(self, authenticated_management_client):
        """GET on jobs endpoint - expect 405 Method Not Allowed."""
        response = await authenticated_management_client.get("/v3/jobs/clean-db")
        assert response.status_code == 405, f"Expected 405, got {response.status_code}: {response.body}"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_jobs_put_method_not_allowed(self, authenticated_management_client):
        """PUT on jobs endpoint - expect 405 Method Not Allowed."""
        response = await authenticated_management_client.put(
            "/v3/jobs/clean-db",
            json_data={}
        )
        assert response.status_code == 405, f"Expected 405, got {response.status_code}: {response.body}"


# ==================== Summary ====================

def test_management_jobs_summary():
    """Management Jobs API Tests Summary.

    Note: Jobs endpoints require AppKey header for full access.
    Tests verify that:
    1. No auth -> 401
    2. User auth without AppKey -> 401 (Missing AppKey)
    3. Wrong HTTP method -> 405
    """
    logger.info("management_jobs_summary", tests_run=28)
