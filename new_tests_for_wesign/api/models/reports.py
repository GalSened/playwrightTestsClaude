"""
Reports Module - Pydantic Models

Based on WeSign API Swagger spec for Reports endpoints:
- GET /v3/reports/usagedata - Get usage statistics
- GET /v3/reports/frequencyreports - List frequency reports
- GET /v3/reports/frequencyreports/download - Download frequency report
- POST /v3/reports/frequencyreports - Create frequency report
- DELETE /v3/reports/frequencyreports - Delete frequency reports

Migrated from: api_tests/Reports_Module.postman_collection.json
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# ==================== Request Models ====================

class CreateFrequencyReportRequest(BaseModel):
    """Request model for creating a frequency report"""
    reportName: Optional[str] = Field(None, alias="reportName")
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    frequency: Optional[str] = None  # e.g., "monthly", "weekly", "daily"

    class Config:
        populate_by_name = True


class ReportDownloadParams(BaseModel):
    """Query parameters for report download"""
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    format: Optional[str] = None  # e.g., "csv", "xlsx", "pdf"


# ==================== Response Models ====================

class UsageDataResponse(BaseModel):
    """Response from GET /v3/reports/usagedata"""
    totalDocuments: Optional[int] = None
    signedDocuments: Optional[int] = None
    pendingDocuments: Optional[int] = None
    rejectedDocuments: Optional[int] = None
    totalSigners: Optional[int] = None
    completedSigners: Optional[int] = None
    pendingSigners: Optional[int] = None
    storageUsed: Optional[int] = None  # bytes
    storageLimit: Optional[int] = None  # bytes
    periodStart: Optional[str] = None
    periodEnd: Optional[str] = None


class FrequencyReportInfo(BaseModel):
    """Individual frequency report information"""
    id: str
    reportName: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    frequency: Optional[str] = None
    status: Optional[str] = None
    createdAt: Optional[str] = None
    lastGenerated: Optional[str] = None
    downloadUrl: Optional[str] = None


class FrequencyReportsListResponse(BaseModel):
    """Response from GET /v3/reports/frequencyreports"""
    reports: Optional[List[FrequencyReportInfo]] = None
    total: Optional[int] = None


class CreateFrequencyReportResponse(BaseModel):
    """Response from POST /v3/reports/frequencyreports"""
    id: Optional[str] = None
    reportName: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None


class DeleteFrequencyReportsResponse(BaseModel):
    """Response from DELETE /v3/reports/frequencyreports"""
    success: Optional[bool] = None
    deletedCount: Optional[int] = None
    message: Optional[str] = None


class ReportsErrorResponse(BaseModel):
    """Error response for Reports endpoints"""
    message: Optional[str] = None
    error: Optional[str] = None
    errors: Optional[dict] = None
    code: Optional[str] = None


# ==================== Test Data Factory ====================

class TestReportsFactory:
    """Factory for generating test data for Reports endpoints"""

    @staticmethod
    def valid_create_frequency_report() -> dict:
        """Generate valid frequency report creation request"""
        return {
            "reportName": "Test Frequency Report",
            "startDate": "2024-01-01",
            "endDate": "2024-12-31",
            "frequency": "monthly"
        }

    @staticmethod
    def incomplete_create_frequency_report() -> dict:
        """Generate incomplete request (for validation testing)"""
        return {
            "reportName": "Incomplete Report"
        }

    @staticmethod
    def download_params_with_dates() -> dict:
        """Generate download parameters with date range"""
        return {
            "startDate": "2024-01-01",
            "endDate": "2024-12-31"
        }

    @staticmethod
    def empty_request() -> dict:
        """Generate empty request (for validation testing)"""
        return {}


# ==================== Helper Functions ====================

def parse_usage_data(response_json: Any) -> UsageDataResponse:
    """Parse usage data response"""
    if isinstance(response_json, dict):
        return UsageDataResponse(**response_json)
    return UsageDataResponse()


def parse_frequency_reports_list(response_json: Any) -> FrequencyReportsListResponse:
    """Parse frequency reports list response"""
    if isinstance(response_json, dict):
        return FrequencyReportsListResponse(**response_json)
    return FrequencyReportsListResponse(reports=[], total=0)


def get_first_report_id(response_json: Any) -> Optional[str]:
    """Extract first report ID from response for subsequent tests"""
    if isinstance(response_json, dict):
        reports = response_json.get("reports", [])
        if reports and len(reports) > 0:
            return reports[0].get("id")
    return None
