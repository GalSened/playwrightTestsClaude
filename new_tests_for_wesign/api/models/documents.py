"""
Pydantic Models for WeSign DocumentCollections API

Type-safe request/response models for the DocumentCollections module endpoints.
Provides automatic validation and clear documentation of API contracts.

Validated against:
- Swagger: C:\\Users\\gals\\Desktop\\swaggerWESIGN.txt
- Backend: C:\\Users\\gals\\Desktop\\user-backend-DEV\\WeSign\\Areas\\Ui\\Controllers\\DocumentCollectionsController.cs

Endpoints covered:
- GET /v3/documentCollections - List document collections
- GET /v3/documentCollections/{id} - Download signed document
- GET /v3/documentCollections/audit/{id} - Get audit trail
- GET /v3/documentCollections/pages/{id} - Get page information
- POST /v3/documentCollections/resend - Resend notifications
"""

from typing import Optional, List, Any, Dict, Union
from datetime import datetime
from pydantic import BaseModel, Field, model_validator
from .base import DocumentStatus, SignerStatus, DocumentMode
import structlog

logger = structlog.get_logger()


# ==================== Signer Models ====================

class SignerResponseDTO(BaseModel):
    """
    Signer information in a document collection.

    From Swagger: SignerResponseDTO
    """
    id: str
    name: Optional[str] = None
    status: Optional[int] = None  # SignerStatus enum
    email: Optional[str] = None
    phone: Optional[str] = None
    timeSent: Optional[str] = None  # datetime as string
    timeViewed: Optional[str] = None
    timeSigned: Optional[str] = None
    timeRejected: Optional[str] = None
    order: Optional[int] = None
    signerMeans: Optional[str] = None  # email, phone, etc.

    class Config:
        extra = "allow"

    @property
    def is_signed(self) -> bool:
        """Check if signer has signed."""
        return self.status == SignerStatus.SIGNED or self.timeSigned is not None

    @property
    def is_pending(self) -> bool:
        """Check if signer is pending."""
        return self.status in [SignerStatus.PENDING, SignerStatus.SENT, SignerStatus.VIEWED]


class SignerLink(BaseModel):
    """
    Link for a signer to sign documents.

    From Swagger: SignerLink
    """
    signerId: str
    link: Optional[str] = None


# ==================== Document Collection Models ====================

class DocumentCollectionResponseDTO(BaseModel):
    """
    Document collection information.

    From Swagger: DocumentCollectionResposneDTO (note: typo in original)
    """
    documentCollectionId: str
    distributionId: Optional[str] = None
    name: Optional[str] = None
    documentStatus: Optional[int] = None  # DocumentStatus enum
    mode: Optional[int] = None  # DocumentMode enum
    documentsIds: Optional[List[str]] = None
    signers: Optional[List[SignerResponseDTO]] = None
    creationTime: Optional[str] = None
    lastModified: Optional[str] = None
    user: Optional[str] = None  # Creator username
    isWillDeletedIn24Hours: Optional[bool] = None

    class Config:
        extra = "allow"

    @property
    def is_completed(self) -> bool:
        """Check if all signers have signed."""
        if not self.signers:
            return False
        return all(s.is_signed for s in self.signers)

    @property
    def signer_count(self) -> int:
        """Get number of signers."""
        return len(self.signers) if self.signers else 0

    @property
    def signed_count(self) -> int:
        """Get number of signers who have signed."""
        if not self.signers:
            return 0
        return sum(1 for s in self.signers if s.is_signed)


class AllDocumentCollectionsResponseDTO(BaseModel):
    """
    List of document collections response.

    From Swagger: AllDocumentCollectionsResposneDTO

    API may return:
    1. {"documentCollections": [...]}
    2. [...] (direct array)
    """
    documentCollections: Optional[List[DocumentCollectionResponseDTO]] = None
    total: Optional[int] = None

    @model_validator(mode='before')
    @classmethod
    def handle_array_format(cls, data: Any) -> Dict[str, Any]:
        """Handle both response formats."""
        if isinstance(data, list):
            logger.info("document_collections_format_array", count=len(data))
            return {"documentCollections": data}
        return data


# ==================== Audit Trail Models ====================

class AuditEntry(BaseModel):
    """
    Single audit trail entry.
    """
    action: Optional[str] = None
    timestamp: Optional[str] = None
    user: Optional[str] = None
    details: Optional[str] = None
    ipAddress: Optional[str] = None

    class Config:
        extra = "allow"


class AuditTrailResponseDTO(BaseModel):
    """
    Audit trail for a document collection.
    """
    documentCollectionId: str
    entries: Optional[List[AuditEntry]] = None

    class Config:
        extra = "allow"


# ==================== Page Information Models ====================

class PageInfo(BaseModel):
    """
    Information about a single document page.
    """
    pageNumber: int
    width: Optional[float] = None
    height: Optional[float] = None
    hasSignatureFields: Optional[bool] = None

    class Config:
        extra = "allow"


class DocumentPagesResponseDTO(BaseModel):
    """
    Page information for a document.
    """
    documentId: str
    pageCount: Optional[int] = None
    pages: Optional[List[PageInfo]] = None

    class Config:
        extra = "allow"


# ==================== Resend Notification Models ====================

class ResendNotificationRequest(BaseModel):
    """
    Request to resend signing notifications.
    """
    documentCollectionId: str
    signerIds: Optional[List[str]] = None  # If None, resend to all pending signers

    class Config:
        json_schema_extra = {
            "example": {
                "documentCollectionId": "550e8400-e29b-41d4-a716-446655440000",
                "signerIds": ["signer-1-uuid", "signer-2-uuid"]
            }
        }


class ResendNotificationResponse(BaseModel):
    """
    Response from resend notification.
    """
    success: Optional[bool] = None
    sentCount: Optional[int] = None
    failedSigners: Optional[List[str]] = None

    class Config:
        extra = "allow"


# ==================== Download Models ====================

class DownloadDocumentResponse(BaseModel):
    """
    Response when downloading a signed document.

    Note: Actual download may return binary PDF data.
    This model is for metadata/error responses.
    """
    documentCollectionId: Optional[str] = None
    fileName: Optional[str] = None
    contentType: Optional[str] = None
    downloadUrl: Optional[str] = None

    class Config:
        extra = "allow"


# ==================== Field Models ====================

class FieldNameToValuePair(BaseModel):
    """
    Field name to value mapping for signers.

    From Swagger: FieldNameToValuePair
    """
    templateId: Optional[str] = None
    fieldName: Optional[str] = None
    fieldValue: Optional[str] = None


class CheckBoxField(BaseModel):
    """
    Checkbox field in a document.

    From Swagger: CheckBoxField
    """
    name: Optional[str] = None
    description: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    mandatory: Optional[bool] = None
    page: Optional[int] = None
    isChecked: Optional[bool] = None


class ChoiceField(BaseModel):
    """
    Choice/dropdown field in a document.

    From Swagger: ChoiceField
    """
    name: Optional[str] = None
    description: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    mandatory: Optional[bool] = None
    page: Optional[int] = None
    options: Optional[List[str]] = None
    selectedOption: Optional[str] = None


# ==================== Helper Functions ====================

def parse_document_collections(response_data: Union[Dict, List]) -> AllDocumentCollectionsResponseDTO:
    """
    Parse document collections response handling both formats.

    Args:
        response_data: API response data (dict or list)

    Returns:
        AllDocumentCollectionsResponseDTO with normalized structure
    """
    return AllDocumentCollectionsResponseDTO(**response_data)


def get_first_collection(response_data: Union[Dict, List]) -> Optional[DocumentCollectionResponseDTO]:
    """
    Get first document collection from response.

    Args:
        response_data: API response data

    Returns:
        First DocumentCollectionResponseDTO or None
    """
    parsed = parse_document_collections(response_data)
    if parsed.documentCollections and len(parsed.documentCollections) > 0:
        return parsed.documentCollections[0]
    return None


# ==================== Test Data Factory ====================

class TestDocumentFactory:
    """
    Factory for generating test document data.
    """

    @staticmethod
    def invalid_collection_id() -> str:
        """Return invalid document collection ID for testing."""
        return "00000000-0000-0000-0000-000000000000"

    @staticmethod
    def resend_request(
        document_collection_id: str,
        signer_ids: Optional[List[str]] = None
    ) -> ResendNotificationRequest:
        """Create a ResendNotificationRequest for testing."""
        return ResendNotificationRequest(
            documentCollectionId=document_collection_id,
            signerIds=signer_ids
        )


# ==================== Exports ====================

__all__ = [
    # Signers
    "SignerResponseDTO",
    "SignerLink",

    # Document Collections
    "DocumentCollectionResponseDTO",
    "AllDocumentCollectionsResponseDTO",

    # Audit
    "AuditEntry",
    "AuditTrailResponseDTO",

    # Pages
    "PageInfo",
    "DocumentPagesResponseDTO",

    # Resend
    "ResendNotificationRequest",
    "ResendNotificationResponse",

    # Download
    "DownloadDocumentResponse",

    # Fields
    "FieldNameToValuePair",
    "CheckBoxField",
    "ChoiceField",

    # Helpers
    "parse_document_collections",
    "get_first_collection",

    # Factory
    "TestDocumentFactory",
]
