"""
Pydantic Models for WeSign SelfSign API

Type-safe request/response models for the SelfSign module endpoints.
Provides automatic validation and clear documentation of API contracts.

Based on: api_tests/SelfSign_Module.postman_collection.json

Endpoints covered:
- POST /v3/selfsign/sign - Sign document using Signer1
- POST /v3/selfsign/identity/check - Check identity for eIDAS
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger()


# ==================== Sign Request/Response Models ====================

class SignRequest(BaseModel):
    """
    Request to sign document using self-sign.

    Example:
        request = SignRequest(documentId="doc-123", signatureType="simple")
    """
    documentId: str = Field(..., description="UUID of the document to sign")
    signatureType: str = Field(default="simple", description="Type of signature (simple, advanced)")
    signatureData: Optional[str] = Field(default=None, description="Base64 signature image (optional)")

    class Config:
        json_schema_extra = {
            "example": {
                "documentId": "550e8400-e29b-41d4-a716-446655440000",
                "signatureType": "simple"
            }
        }


class SignResponse(BaseModel):
    """
    Response from signing operation.

    Contains signed document info or success indicator.
    """
    success: Optional[bool] = None
    message: Optional[str] = None
    documentId: Optional[str] = None
    signedAt: Optional[datetime] = None
    signatureId: Optional[str] = None

    class Config:
        extra = "allow"  # Allow additional fields


# ==================== Identity Check Models ====================

class IdentityCheckRequest(BaseModel):
    """
    Request to check identity for eIDAS signing.

    Example:
        request = IdentityCheckRequest(userId="user-123", identityType="passport")
    """
    userId: str = Field(..., description="UUID of the user")
    identityType: str = Field(default="passport", description="Type of identity document")
    identityNumber: Optional[str] = Field(default=None, description="Identity document number")

    class Config:
        json_schema_extra = {
            "example": {
                "userId": "550e8400-e29b-41d4-a716-446655440000",
                "identityType": "passport",
                "identityNumber": "AB123456"
            }
        }


class IdentityCheckResponse(BaseModel):
    """
    Response from identity check operation.

    Contains verification status and any required actions.
    """
    verified: Optional[bool] = None
    status: Optional[str] = None  # "verified", "pending", "failed"
    message: Optional[str] = None
    requiredActions: Optional[List[str]] = None

    class Config:
        extra = "allow"


# ==================== Error Models ====================

class SelfSignErrorResponse(BaseModel):
    """
    Error response from SelfSign API.

    Returned for 400 Bad Request, 401 Unauthorized, etc.
    """
    error: Optional[str] = None
    message: Optional[str] = None
    errors: Optional[List[Dict[str, str]]] = None  # Validation errors
    statusCode: Optional[int] = None

    class Config:
        extra = "allow"
        json_schema_extra = {
            "example": {
                "error": "ValidationError",
                "message": "Invalid request data",
                "errors": [
                    {"field": "documentId", "message": "Document ID is required"}
                ]
            }
        }


# ==================== Test Data Factory ====================

class TestSelfSignFactory:
    """
    Factory for generating test data for SelfSign tests.

    Usage:
        factory = TestSelfSignFactory()
        request = factory.sign_request(documentId="doc-123")
    """

    @staticmethod
    def sign_request(
        documentId: str = "test-document-id",
        signatureType: str = "simple",
        signatureData: Optional[str] = None
    ) -> SignRequest:
        """
        Create a SignRequest for testing.

        Args:
            documentId: Document UUID
            signatureType: Type of signature
            signatureData: Optional base64 signature image

        Returns:
            SignRequest ready for API call
        """
        return SignRequest(
            documentId=documentId,
            signatureType=signatureType,
            signatureData=signatureData
        )

    @staticmethod
    def identity_check_request(
        userId: str = "test-user-id",
        identityType: str = "passport",
        identityNumber: Optional[str] = None
    ) -> IdentityCheckRequest:
        """
        Create an IdentityCheckRequest for testing.

        Args:
            userId: User UUID
            identityType: Type of ID document
            identityNumber: ID document number

        Returns:
            IdentityCheckRequest ready for API call
        """
        return IdentityCheckRequest(
            userId=userId,
            identityType=identityType,
            identityNumber=identityNumber
        )

    @staticmethod
    def invalid_document_id() -> str:
        """Return invalid document UUID for testing error cases"""
        return "00000000-0000-0000-0000-000000000000"

    @staticmethod
    def invalid_user_id() -> str:
        """Return invalid user UUID for testing error cases"""
        return "00000000-0000-0000-0000-000000000001"

    @staticmethod
    def empty_request() -> dict:
        """Return empty request body for testing validation"""
        return {}

    @staticmethod
    def mock_signature_image() -> str:
        """
        Return mock base64 signature image for testing.

        This is a 1x1 transparent PNG.
        """
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


# ==================== Exports ====================

__all__ = [
    # Sign
    "SignRequest",
    "SignResponse",

    # Identity
    "IdentityCheckRequest",
    "IdentityCheckResponse",

    # Errors
    "SelfSignErrorResponse",

    # Factory
    "TestSelfSignFactory",
]
