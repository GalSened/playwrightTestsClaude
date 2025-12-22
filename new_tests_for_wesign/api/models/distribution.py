"""
Pydantic Models for WeSign Distribution API

Type-safe request/response models for the Distribution module endpoints.
Provides automatic validation and clear documentation of API contracts.

Validated against:
- Swagger: C:\\Users\\gals\\Desktop\\swaggerWESIGN.txt
- Backend: C:\\Users\\gals\\Desktop\\user-backend-DEV\\WeSign\\Areas\\Ui\\Controllers\\DistributionController.cs

Endpoints covered:
- POST /v3/distribution/signers - Extract signers from Excel
- POST /v3/distribution - Create distribution campaign
- GET /v3/distribution/{id} - Get distribution documents
- DELETE /v3/distribution/{id} - Delete distribution
- GET /v3/distribution/resend/{id} - Resend to signers
"""

from typing import Optional, List, Any, Dict, Union
from datetime import datetime
from pydantic import BaseModel, Field, model_validator
from .documents import SignerResponseDTO, DocumentCollectionResponseDTO
import structlog

logger = structlog.get_logger()


# ==================== Distribution Document Models ====================

class DistributionDocumentResponseDTO(BaseModel):
    """
    Document in a distribution campaign.

    From Swagger: DistributionDocumentResposneDTO
    """
    documentCollectionId: str
    distributionId: Optional[str] = None
    name: Optional[str] = None
    creationTime: Optional[str] = None
    isWillDeletedIn24Hours: Optional[bool] = None
    user: Optional[str] = None

    class Config:
        extra = "allow"


class DistributionDocumentExpandedResponseDTO(BaseModel):
    """
    Expanded document info with status details.

    From Swagger: DistributionDocumentExpandedResposneDTO
    """
    documentCollectionId: str
    distributionId: Optional[str] = None
    name: Optional[str] = None
    creationTime: Optional[str] = None
    documentStatus: Optional[int] = None
    signers: Optional[List[SignerResponseDTO]] = None
    user: Optional[str] = None

    class Config:
        extra = "allow"


class AllDistributionDocumentsResponseDTO(BaseModel):
    """
    List of distribution documents.

    From Swagger: AllDistributionDocumentsResposneDTO
    """
    documentCollections: Optional[List[DistributionDocumentResponseDTO]] = None


class AllDistributionDocumentsExpandedResponseDTO(BaseModel):
    """
    Expanded response with status totals.

    From Swagger: AllDistributionDocumentsExpandedResposneDTO
    """
    totalPending: Optional[int] = None
    totalSigned: Optional[int] = None
    totalServerSigned: Optional[int] = None
    totalDeclined: Optional[int] = None
    totalFailed: Optional[int] = None
    totalViewed: Optional[int] = None
    totalCreatedButNotSent: Optional[int] = None
    shouldSignUsingSigner1AfterDocumentSigningFlow: Optional[bool] = None
    documentCollections: Optional[List[DistributionDocumentExpandedResponseDTO]] = None

    class Config:
        extra = "allow"

    @property
    def total_documents(self) -> int:
        """Get total number of documents."""
        return len(self.documentCollections) if self.documentCollections else 0


# ==================== Signer Extraction Models ====================

class BaseSigner(BaseModel):
    """
    Base signer information for distribution.

    From Swagger: BaseSigner
    """
    fullName: Optional[str] = None
    signerMeans: Optional[str] = None  # email, phone
    signerSecondaryMeans: Optional[str] = None
    phoneExtension: Optional[str] = None
    shouldSendOTP: Optional[bool] = None
    fields: Optional[List[Dict[str, Any]]] = None  # FieldNameToValuePair

    class Config:
        extra = "allow"


class ExtractedSigner(BaseModel):
    """
    Signer extracted from Excel/CSV file.
    """
    rowNumber: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    additionalData: Optional[Dict[str, str]] = None
    isValid: Optional[bool] = None
    validationErrors: Optional[List[str]] = None

    class Config:
        extra = "allow"


class ExtractSignersResponse(BaseModel):
    """
    Response from signer extraction endpoint.
    """
    signers: Optional[List[ExtractedSigner]] = None
    totalRows: Optional[int] = None
    validCount: Optional[int] = None
    invalidCount: Optional[int] = None
    errors: Optional[List[str]] = None

    class Config:
        extra = "allow"


# ==================== Distribution Campaign Models ====================

class CreateDistributionRequest(BaseModel):
    """
    Request to create a distribution campaign.

    Endpoint: POST /v3/distribution
    """
    name: str
    templateId: str
    signers: List[BaseSigner]
    sendImmediately: Optional[bool] = True
    reminderEnabled: Optional[bool] = None
    reminderDays: Optional[int] = None
    expirationDays: Optional[int] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Q4 Contracts Distribution",
                "templateId": "template-uuid",
                "signers": [
                    {
                        "fullName": "John Doe",
                        "signerMeans": "john@example.com"
                    }
                ],
                "sendImmediately": True
            }
        }


class CreateDistributionResponse(BaseModel):
    """
    Response from creating a distribution.
    """
    distributionId: str
    documentCollectionIds: Optional[List[str]] = None
    sentCount: Optional[int] = None
    failedCount: Optional[int] = None

    class Config:
        extra = "allow"


class DistributionDetailsResponse(BaseModel):
    """
    Detailed distribution information.
    """
    distributionId: str
    name: Optional[str] = None
    templateId: Optional[str] = None
    createdAt: Optional[str] = None
    createdBy: Optional[str] = None
    totalDocuments: Optional[int] = None
    signedCount: Optional[int] = None
    pendingCount: Optional[int] = None
    declinedCount: Optional[int] = None
    documents: Optional[List[DistributionDocumentExpandedResponseDTO]] = None

    class Config:
        extra = "allow"


# ==================== Resend Models ====================

class ResendDistributionRequest(BaseModel):
    """
    Request to resend distribution notifications.
    """
    documentCollectionIds: Optional[List[str]] = None
    resendAll: Optional[bool] = False

    class Config:
        json_schema_extra = {
            "example": {
                "documentCollectionIds": ["doc-uuid-1", "doc-uuid-2"],
                "resendAll": False
            }
        }


class ResendDistributionResponse(BaseModel):
    """
    Response from resend operation.
    """
    success: Optional[bool] = None
    resentCount: Optional[int] = None
    failedIds: Optional[List[str]] = None

    class Config:
        extra = "allow"


# ==================== Delete Models ====================

class DeleteDistributionResponse(BaseModel):
    """
    Response from deleting a distribution.
    """
    success: Optional[bool] = None
    deletedDocumentCount: Optional[int] = None
    message: Optional[str] = None

    class Config:
        extra = "allow"


# ==================== Report Models ====================

class DistributionReportRequest(BaseModel):
    """
    Request for distribution report.
    """
    distributionId: str
    format: Optional[str] = Field(default="csv", pattern="^(csv|xlsx|pdf)$")
    includeSignerDetails: Optional[bool] = True


class DistributionReportResponse(BaseModel):
    """
    Response with report download URL.
    """
    reportUrl: Optional[str] = None
    expiresAt: Optional[str] = None
    format: Optional[str] = None

    class Config:
        extra = "allow"


# ==================== Helper Functions ====================

def parse_distribution_documents(
    response_data: Union[Dict, List]
) -> AllDistributionDocumentsExpandedResponseDTO:
    """
    Parse distribution documents response.

    Args:
        response_data: API response data

    Returns:
        AllDistributionDocumentsExpandedResponseDTO
    """
    if isinstance(response_data, list):
        return AllDistributionDocumentsExpandedResponseDTO(
            documentCollections=response_data
        )
    return AllDistributionDocumentsExpandedResponseDTO(**response_data)


# ==================== Test Data Factory ====================

class TestDistributionFactory:
    """
    Factory for generating test distribution data.
    """

    @staticmethod
    def invalid_distribution_id() -> str:
        """Return invalid distribution ID for testing."""
        return "00000000-0000-0000-0000-000000000000"

    @staticmethod
    def base_signer(
        name: str = "Test Signer",
        email: str = "signer@test.com"
    ) -> BaseSigner:
        """Create a BaseSigner for testing."""
        return BaseSigner(
            fullName=name,
            signerMeans=email,
            shouldSendOTP=False
        )

    @staticmethod
    def create_distribution_request(
        name: str = "Test Distribution",
        template_id: str = "template-uuid",
        signers: Optional[List[BaseSigner]] = None
    ) -> CreateDistributionRequest:
        """Create a CreateDistributionRequest for testing."""
        if signers is None:
            signers = [TestDistributionFactory.base_signer()]
        return CreateDistributionRequest(
            name=name,
            templateId=template_id,
            signers=signers
        )

    @staticmethod
    def mock_excel_file_path() -> str:
        """Return path to mock Excel file for testing."""
        return "test_files/signers.xlsx"


# ==================== Exports ====================

__all__ = [
    # Documents
    "DistributionDocumentResponseDTO",
    "DistributionDocumentExpandedResponseDTO",
    "AllDistributionDocumentsResponseDTO",
    "AllDistributionDocumentsExpandedResponseDTO",

    # Signers
    "BaseSigner",
    "ExtractedSigner",
    "ExtractSignersResponse",

    # Distribution
    "CreateDistributionRequest",
    "CreateDistributionResponse",
    "DistributionDetailsResponse",

    # Resend
    "ResendDistributionRequest",
    "ResendDistributionResponse",

    # Delete
    "DeleteDistributionResponse",

    # Reports
    "DistributionReportRequest",
    "DistributionReportResponse",

    # Helpers
    "parse_distribution_documents",

    # Factory
    "TestDistributionFactory",
]
