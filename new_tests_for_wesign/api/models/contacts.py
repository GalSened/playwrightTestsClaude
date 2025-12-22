"""
Pydantic Models for WeSign Contacts API

Type-safe request/response models for the Contacts module endpoints.
Provides automatic validation and clear documentation of API contracts.

Based on API Discovery: API_MIGRATION_PHASE2_DAY3_CONTACTS_DISCOVERY.md
"""

from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
import structlog

logger = structlog.get_logger()


# ==================== Authentication Models ====================

class LoginRequest(BaseModel):
    """
    Login request to obtain JWT token.

    Example:
        request = LoginRequest(email="admin@companya.com", password="1234")
    """
    email: EmailStr
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email": "admin@companya.com",
                "password": "1234"
            }
        }


class UserInfo(BaseModel):
    """User information returned in login response"""
    id: str
    email: EmailStr
    name: Optional[str] = None

    class Config:
        # Allow extra fields for forward compatibility
        extra = "allow"


class LoginResponse(BaseModel):
    """
    Login response containing JWT token and user info.

    Example:
        response = LoginResponse(**api_response.json())
        token = response.token
    """
    token: str
    user: Optional[UserInfo] = None


# ==================== Contact Models ====================

class Contact(BaseModel):
    """
    Contact entity representing a single contact.

    Core fields are required, additional fields are optional.
    Extra fields allowed for forward compatibility.
    """
    id: str  # UUID
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    # Common optional fields (may vary by API version)
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    companyId: Optional[str] = None
    tags: Optional[List[str]] = None

    class Config:
        # Allow extra fields that API may return
        extra = "allow"
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "John Doe",
                "email": "john.doe@example.com",
                "phone": "+1234567890",
                "tags": ["VIP", "Partner"]
            }
        }


class ContactListResponse(BaseModel):
    """
    List of contacts response.

    API returns two possible formats:
    1. {"contacts": [...], "total": N}
    2. [...]  (direct array)

    This model handles both via model_validator.
    """
    contacts: List[Contact]
    total: Optional[int] = None
    page: Optional[int] = None
    pageSize: Optional[int] = None

    @model_validator(mode='before')
    @classmethod
    def handle_array_format(cls, data: Any) -> Dict[str, Any]:
        """
        Handle both response formats:
        - {"contacts": [...]} -> use as-is
        - [...] -> wrap in {"contacts": [...]}
        """
        if isinstance(data, list):
            # Direct array format
            logger.info("contacts_list_format_array", count=len(data))
            return {"contacts": data}
        elif isinstance(data, dict) and "contacts" not in data:
            # Object but no contacts field - assume it's a single contact
            logger.info("contacts_list_format_single_object")
            return {"contacts": [data]}
        else:
            # Standard format
            logger.info("contacts_list_format_standard",
                       has_total="total" in data if isinstance(data, dict) else False)
            return data


class ContactCreateRequest(BaseModel):
    """
    Request to create a new contact.

    NOTE: This endpoint is not in the P3 collection but likely exists.
    Include for completeness and future coverage.
    """
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    tags: Optional[List[str]] = None


class ContactUpdateRequest(BaseModel):
    """
    Request to update an existing contact.

    NOTE: This endpoint is not in the P3 collection but likely exists.
    Include for completeness and future coverage.
    """
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    tags: Optional[List[str]] = None


# ==================== Signature Models ====================

class SignatureGetResponse(BaseModel):
    """
    Response from GET /v3/contacts/signatures/{id}

    Contains signature image data for a contact.
    """
    contactId: str
    signatureImage: str  # Base64 encoded image
    signatureDate: Optional[datetime] = None

    class Config:
        extra = "allow"


class SignatureUpdateRequest(BaseModel):
    """
    Request to update contact signatures.

    Endpoint: PUT /v3/contacts/signatures
    """
    contactId: str = Field(..., description="UUID of the contact")
    signatureImage: str = Field(..., description="Base64 encoded signature image")

    class Config:
        json_schema_extra = {
            "example": {
                "contactId": "550e8400-e29b-41d4-a716-446655440000",
                "signatureImage": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            }
        }


class SignatureUpdateResponse(BaseModel):
    """
    Response from signature update operation.

    May return success indicator or updated signature data.
    """
    success: Optional[bool] = None
    message: Optional[str] = None
    contactId: Optional[str] = None

    class Config:
        extra = "allow"


# ==================== Error Models ====================

class FieldError(BaseModel):
    """
    Single field validation error.

    Used in ValidationErrorResponse.
    """
    field: str
    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "field": "email",
                "message": "Invalid email format"
            }
        }


class ValidationErrorResponse(BaseModel):
    """
    Validation error response (400 Bad Request).

    Returns list of field-specific errors.
    """
    errors: List[FieldError]

    class Config:
        json_schema_extra = {
            "example": {
                "errors": [
                    {"field": "contactId", "message": "Contact ID is required"},
                    {"field": "signatureImage", "message": "Signature image is required"}
                ]
            }
        }


class ErrorResponse(BaseModel):
    """
    Generic error response for non-validation errors.

    Used for 401 Unauthorized, 404 Not Found, 500 Internal Server Error, etc.
    """
    error: Optional[str] = None
    message: Optional[str] = None
    statusCode: Optional[int] = None
    timestamp: Optional[datetime] = None

    class Config:
        extra = "allow"
        json_schema_extra = {
            "example": {
                "error": "Unauthorized",
                "message": "Invalid or missing authentication token",
                "statusCode": 401
            }
        }


# ==================== Delete Response Models ====================

class DeleteResponse(BaseModel):
    """
    Response from DELETE operations.

    Note: DELETE may return:
    - 204 No Content (empty body)
    - 200 OK with success message
    - 404 Not Found with error

    This model handles the 200 OK case.
    """
    success: Optional[bool] = None
    message: Optional[str] = None
    id: Optional[str] = None  # Deleted resource ID

    class Config:
        extra = "allow"


# ==================== Helper Functions ====================

def parse_contact_list(response_data: Union[Dict, List]) -> ContactListResponse:
    """
    Parse contact list response handling both formats.

    Args:
        response_data: API response data (dict or list)

    Returns:
        ContactListResponse with normalized structure

    Example:
        response = await api_client.get("/v3/contacts")
        contacts = parse_contact_list(response.json())
        print(f"Found {len(contacts.contacts)} contacts")
    """
    return ContactListResponse(**response_data)


def validate_uuid(value: str) -> bool:
    """
    Validate if string is a valid UUID.

    Args:
        value: String to validate

    Returns:
        True if valid UUID, False otherwise
    """
    import re
    uuid_pattern = re.compile(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        re.IGNORECASE
    )
    return bool(uuid_pattern.match(value))


# ==================== Test Data Generators ====================

class TestContactFactory:
    """
    Factory for generating test contact data.

    Usage:
        factory = TestContactFactory()
        request = factory.create_request(name="Test Contact")
    """

    @staticmethod
    def create_request(
        name: str = "Test Contact",
        email: Optional[str] = None,
        phone: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> ContactCreateRequest:
        """
        Create a ContactCreateRequest with test data.

        Args:
            name: Contact name (default: "Test Contact")
            email: Contact email (optional)
            phone: Contact phone (optional)
            tags: Contact tags (optional)

        Returns:
            ContactCreateRequest ready for API call
        """
        return ContactCreateRequest(
            name=name,
            email=email,
            phone=phone,
            tags=tags or []
        )

    @staticmethod
    def invalid_uuid() -> str:
        """Return invalid UUID for testing error cases"""
        return "00000000-0000-0000-0000-000000000000"

    @staticmethod
    def mock_signature_image() -> str:
        """
        Return mock base64 signature image for testing.

        This is a 1x1 transparent PNG.
        """
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


# ==================== Exports ====================

__all__ = [
    # Auth
    "LoginRequest",
    "LoginResponse",
    "UserInfo",

    # Contacts
    "Contact",
    "ContactListResponse",
    "ContactCreateRequest",
    "ContactUpdateRequest",

    # Signatures
    "SignatureGetResponse",
    "SignatureUpdateRequest",
    "SignatureUpdateResponse",

    # Errors
    "FieldError",
    "ValidationErrorResponse",
    "ErrorResponse",
    "DeleteResponse",

    # Helpers
    "parse_contact_list",
    "validate_uuid",
    "TestContactFactory",
]
