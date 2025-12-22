"""
Base Models and Common Types for WeSign API

Contains enums, shared DTOs, and utility types used across all API modules.
Extracted from Swagger OpenAPI 3.0.1 specification.

Source: C:\\Users\\gals\\Desktop\\swaggerWESIGN.txt
"""

from enum import IntEnum
from typing import Optional, Any, Dict
from pydantic import BaseModel, Field
from datetime import datetime


# ==================== Enums (From Swagger) ====================

class Language(IntEnum):
    """
    Language enum for user preferences.

    From Swagger: Language enum [1, 2]
    """
    HEBREW = 1
    ENGLISH = 2


class AuthMode(IntEnum):
    """
    Authentication mode enum.

    From Swagger: AuthMode enum [0, 1, 2, 3]
    """
    NONE = 0
    OTP = 1
    SMART_ID = 2
    CERTIFICATE = 3


class DocumentStatus(IntEnum):
    """
    Document status enum.

    Common values observed in API responses.
    """
    CREATED = 0
    PENDING = 1
    VIEWED = 2
    SIGNED = 3
    DECLINED = 4
    EXPIRED = 5
    FAILED = 6


class SignerStatus(IntEnum):
    """
    Signer status enum.

    Common values for signer workflow states.
    """
    PENDING = 0
    SENT = 1
    VIEWED = 2
    SIGNED = 3
    REJECTED = 4
    EXPIRED = 5


class DocumentMode(IntEnum):
    """
    Document mode enum.

    Defines signing flow type.
    """
    SEQUENTIAL = 0
    PARALLEL = 1


class UserType(IntEnum):
    """
    User type enum.

    Defines user role in the system.
    """
    STANDARD = 0
    ADMIN = 1
    SUPER_ADMIN = 2


class CompanyStatus(IntEnum):
    """
    Company status enum.
    """
    ACTIVE = 0
    INACTIVE = 1
    SUSPENDED = 2


# ==================== Common DTOs ====================

class GeneralError(BaseModel):
    """
    General error response model.

    From Swagger: GeneralError schema
    Used for 400/401/404/500 error responses.
    """
    message: Optional[str] = None
    code: Optional[int] = None
    error: Optional[str] = None
    statusCode: Optional[int] = None
    timestamp: Optional[datetime] = None

    class Config:
        extra = "allow"


class PaginationParams(BaseModel):
    """
    Common pagination parameters for list endpoints.
    """
    page: int = Field(default=1, ge=1)
    pageSize: int = Field(default=10, ge=1, le=100)
    sortBy: Optional[str] = None
    sortOrder: Optional[str] = Field(default="asc", pattern="^(asc|desc)$")


class PaginatedResponse(BaseModel):
    """
    Base class for paginated responses.
    """
    total: Optional[int] = None
    page: Optional[int] = None
    pageSize: Optional[int] = None
    hasMore: Optional[bool] = None

    class Config:
        extra = "allow"


class BatchRequestDTO(BaseModel):
    """
    Request for batch operations.

    From Swagger: BatchRequestDTO
    """
    ids: Optional[list[str]] = None


class LinkResponse(BaseModel):
    """
    Simple link response.

    From Swagger: LinkResponse
    """
    link: Optional[str] = None


class ActivationDTO(BaseModel):
    """
    Activation request DTO.

    From Swagger: ActivationDTO
    """
    token: Optional[str] = None


# ==================== Helper Types ====================

class ApiResponseMeta(BaseModel):
    """
    Metadata that may be included in API responses.
    """
    requestId: Optional[str] = None
    processingTime: Optional[float] = None
    serverVersion: Optional[str] = None


# ==================== Factory Helpers ====================

class TestDataFactory:
    """
    Base factory for generating test data.
    Provides common utilities for all modules.
    """

    @staticmethod
    def invalid_uuid() -> str:
        """Return invalid UUID for testing error cases"""
        return "00000000-0000-0000-0000-000000000000"

    @staticmethod
    def random_uuid() -> str:
        """Generate a random UUID for testing"""
        import uuid
        return str(uuid.uuid4())

    @staticmethod
    def timestamp() -> str:
        """Get current timestamp string for unique test data"""
        return datetime.now().strftime("%Y%m%d_%H%M%S")

    @staticmethod
    def test_email(prefix: str = "test") -> str:
        """Generate unique test email"""
        ts = TestDataFactory.timestamp()
        return f"{prefix}_{ts}@automation.test"


# ==================== Exports ====================

__all__ = [
    # Enums
    "Language",
    "AuthMode",
    "DocumentStatus",
    "SignerStatus",
    "DocumentMode",
    "UserType",
    "CompanyStatus",

    # DTOs
    "GeneralError",
    "PaginationParams",
    "PaginatedResponse",
    "BatchRequestDTO",
    "LinkResponse",
    "ActivationDTO",
    "ApiResponseMeta",

    # Factories
    "TestDataFactory",
]
