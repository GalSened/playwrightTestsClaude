"""
Pydantic Models for WeSign Admins Module

Endpoint Coverage:
- POST /v3/admins/send - Admin notification endpoint

Migrated from: Admins_Module.postman_collection.json

SMART Principles:
- Systematic: Type-safe request/response models
- Resilient: Validation with clear error messages
- Test-driven: Factory for generating test data
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr
import structlog

logger = structlog.get_logger()


# ==================== Request Models ====================

class AdminSendRequest(BaseModel):
    """
    Request model for POST /v3/admins/send

    Used to send admin notifications to specified recipients.

    Postman equivalent:
        {
            "recipientEmail": "admin@example.com",
            "subject": "System Notification",
            "message": "This is a test notification from the API"
        }
    """
    recipientEmail: str = Field(
        ...,
        description="Email address of the notification recipient"
    )
    subject: str = Field(
        ...,
        description="Subject line of the notification"
    )
    message: str = Field(
        ...,
        description="Body content of the notification"
    )

    class Config:
        extra = "allow"  # Allow additional fields


# ==================== Response Models ====================

class AdminSendResponse(BaseModel):
    """
    Response model for successful admin notification send.

    The actual response structure may vary - this allows flexible parsing.
    """
    success: Optional[bool] = None
    message: Optional[str] = None

    class Config:
        extra = "allow"  # Allow additional fields from API


class AdminErrorResponse(BaseModel):
    """
    Error response from admin endpoints.

    Covers:
    - 400 Bad Request (validation errors)
    - 401 Unauthorized (missing/invalid token)
    - 403 Forbidden (insufficient permissions)
    """
    error: Optional[str] = None
    message: Optional[str] = None
    errors: Optional[Dict[str, Any]] = None
    statusCode: Optional[int] = None

    class Config:
        extra = "allow"


# ==================== Test Data Factory ====================

class TestAdminsFactory:
    """
    Factory for generating test data for Admins module.

    Provides both valid and invalid data for comprehensive testing.

    Usage:
        factory = TestAdminsFactory()
        valid_request = factory.valid_send_request()
        empty_request = factory.empty_request()
    """

    @staticmethod
    def valid_send_request() -> dict:
        """
        Generate a valid admin send request.

        Postman equivalent:
            {
                "recipientEmail": "admin@example.com",
                "subject": "System Notification",
                "message": "This is a test notification from the API"
            }
        """
        return {
            "recipientEmail": "admin@example.com",
            "subject": "System Notification",
            "message": "This is a test notification from the API"
        }

    @staticmethod
    def valid_send_request_model() -> AdminSendRequest:
        """Generate a valid AdminSendRequest model instance."""
        return AdminSendRequest(
            recipientEmail="admin@example.com",
            subject="System Notification",
            message="This is a test notification from the API"
        )

    @staticmethod
    def empty_request() -> dict:
        """
        Empty request for testing validation errors.

        Expected response: 400 Bad Request with validation errors
        """
        return {}

    @staticmethod
    def partial_request() -> dict:
        """
        Partial request with only recipientEmail.

        Expected response: 400 Bad Request (missing subject/message)
        """
        return {
            "recipientEmail": "admin@example.com"
        }

    @staticmethod
    def invalid_email_request() -> dict:
        """
        Request with invalid email format.

        Expected response: 400 Bad Request (invalid email)
        """
        return {
            "recipientEmail": "not-an-email",
            "subject": "Test Subject",
            "message": "Test message"
        }

    @staticmethod
    def custom_send_request(
        recipient_email: str = "test@example.com",
        subject: str = "Test Subject",
        message: str = "Test message"
    ) -> dict:
        """
        Generate a custom admin send request.

        Args:
            recipient_email: Email address of recipient
            subject: Notification subject
            message: Notification message body

        Returns:
            dict: Request body for POST /v3/admins/send
        """
        return {
            "recipientEmail": recipient_email,
            "subject": subject,
            "message": message
        }


# ==================== Helper Functions ====================

def parse_admin_response(response_data: dict) -> AdminSendResponse:
    """
    Parse API response into AdminSendResponse model.

    Args:
        response_data: Raw response JSON from API

    Returns:
        AdminSendResponse: Parsed response model
    """
    try:
        return AdminSendResponse.model_validate(response_data)
    except Exception as e:
        logger.warning("admin_response_parse_error", error=str(e), data=response_data)
        return AdminSendResponse(**response_data)


def parse_admin_error(response_data: dict) -> AdminErrorResponse:
    """
    Parse API error response into AdminErrorResponse model.

    Args:
        response_data: Raw error response JSON from API

    Returns:
        AdminErrorResponse: Parsed error model
    """
    try:
        return AdminErrorResponse.model_validate(response_data)
    except Exception as e:
        logger.warning("admin_error_parse_error", error=str(e), data=response_data)
        return AdminErrorResponse(**response_data)
