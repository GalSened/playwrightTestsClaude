"""
API Request/Response Models

Pydantic models for type-safe API request and response handling.
Validated against Swagger and backend source code.

Migrated Modules:
- Base: Common enums, error types
- Users: Login, profile, password management
- Documents: Document collections, signers, audit
- Distribution: Distribution campaigns
- Links: Signing links, templates, video conference
- Reports: Usage data, frequency reports
- Contacts: Contact CRUD, Signatures
- SelfSign: Document signing, Identity verification
- Admins: Admin notification endpoint
"""

# Base types and enums
from .base import (
    Language,
    AuthMode,
    DocumentStatus,
    SignerStatus,
    DocumentMode,
    UserType,
    GeneralError,
    PaginationParams,
    TestDataFactory,
)

# Users module
from .users import (
    LoginRequestDTO,
    LoginResponseDTO,
    UserResponseDTO,
    CreateUserDTO,
    UpdateUserDTO,
    ChangePasswordDTO,
    ResetPasswordRequestDTO,
    ResetPasswordConfirmDTO,
    OtpVerifyDTO,
    OtpResponseDTO,
    GroupResponseDTO,
    UserGroupsResponseDTO,
    ExternalAuthDTO,
    ExternalAuthResponseDTO,
    LogoutResponseDTO,
    AdminCreateUserDTO,
    AdminAllUsersResponseDTO,
    UserResponseAdminDTO,
    TestUserFactory,
)

# Documents module
from .documents import (
    SignerResponseDTO,
    SignerLink,
    DocumentCollectionResponseDTO,
    AllDocumentCollectionsResponseDTO,
    AuditEntry,
    AuditTrailResponseDTO,
    PageInfo,
    DocumentPagesResponseDTO,
    ResendNotificationRequest,
    ResendNotificationResponse,
    DownloadDocumentResponse,
    FieldNameToValuePair,
    CheckBoxField,
    ChoiceField,
    parse_document_collections,
    get_first_collection,
    TestDocumentFactory,
)

# Distribution module
from .distribution import (
    DistributionDocumentResponseDTO,
    DistributionDocumentExpandedResponseDTO,
    AllDistributionDocumentsResponseDTO,
    AllDistributionDocumentsExpandedResponseDTO,
    BaseSigner,
    ExtractedSigner,
    ExtractSignersResponse,
    CreateDistributionRequest,
    CreateDistributionResponse,
    DistributionDetailsResponse,
    ResendDistributionRequest,
    ResendDistributionResponse,
    DeleteDistributionResponse,
    DistributionReportRequest,
    DistributionReportResponse,
    parse_distribution_documents,
    TestDistributionFactory,
)

# Links module
from .links import (
    LinkTemplateRequest,
    VideoConferenceRequest,
    LinkInfo,
    LinkTemplateInfo,
    LinksListResponse,
    LinkTemplateResponse,
    VideoConferenceResponse,
    LinksErrorResponse,
    TestLinksFactory,
    parse_links_list,
    get_first_link_id,
    get_first_template_id,
)

# Reports module
from .reports import (
    CreateFrequencyReportRequest,
    ReportDownloadParams,
    UsageDataResponse,
    FrequencyReportInfo,
    FrequencyReportsListResponse,
    CreateFrequencyReportResponse,
    DeleteFrequencyReportsResponse,
    ReportsErrorResponse,
    TestReportsFactory,
    parse_usage_data,
    parse_frequency_reports_list,
    get_first_report_id,
)

# Contacts module (existing)
from .contacts import (
    # Auth
    LoginRequest,
    LoginResponse,
    UserInfo,
    # Contacts
    Contact,
    ContactListResponse,
    ContactCreateRequest,
    ContactUpdateRequest,
    # Signatures
    SignatureGetResponse,
    SignatureUpdateRequest,
    SignatureUpdateResponse,
    # Errors
    FieldError,
    ValidationErrorResponse,
    ErrorResponse,
    DeleteResponse,
    # Helpers
    parse_contact_list,
    validate_uuid,
    TestContactFactory,
)

# SelfSign module (existing)
from .selfsign import (
    # Sign
    SignRequest,
    SignResponse,
    # Identity
    IdentityCheckRequest,
    IdentityCheckResponse,
    # Errors
    SelfSignErrorResponse,
    # Factory
    TestSelfSignFactory,
)

# Admins module (existing)
from .admins import (
    # Requests
    AdminSendRequest,
    # Responses
    AdminSendResponse,
    AdminErrorResponse,
    # Factory
    TestAdminsFactory,
    # Helpers
    parse_admin_response,
    parse_admin_error,
)

__all__ = [
    # Base
    "Language",
    "AuthMode",
    "DocumentStatus",
    "SignerStatus",
    "DocumentMode",
    "UserType",
    "GeneralError",
    "PaginationParams",
    "TestDataFactory",
    # Users
    "LoginRequestDTO",
    "LoginResponseDTO",
    "UserResponseDTO",
    "CreateUserDTO",
    "UpdateUserDTO",
    "ChangePasswordDTO",
    "ResetPasswordRequestDTO",
    "ResetPasswordConfirmDTO",
    "OtpVerifyDTO",
    "OtpResponseDTO",
    "GroupResponseDTO",
    "UserGroupsResponseDTO",
    "ExternalAuthDTO",
    "ExternalAuthResponseDTO",
    "LogoutResponseDTO",
    "AdminCreateUserDTO",
    "AdminAllUsersResponseDTO",
    "UserResponseAdminDTO",
    "TestUserFactory",
    # Documents
    "SignerResponseDTO",
    "SignerLink",
    "DocumentCollectionResponseDTO",
    "AllDocumentCollectionsResponseDTO",
    "AuditEntry",
    "AuditTrailResponseDTO",
    "PageInfo",
    "DocumentPagesResponseDTO",
    "ResendNotificationRequest",
    "ResendNotificationResponse",
    "DownloadDocumentResponse",
    "FieldNameToValuePair",
    "CheckBoxField",
    "ChoiceField",
    "parse_document_collections",
    "get_first_collection",
    "TestDocumentFactory",
    # Distribution
    "DistributionDocumentResponseDTO",
    "DistributionDocumentExpandedResponseDTO",
    "AllDistributionDocumentsResponseDTO",
    "AllDistributionDocumentsExpandedResponseDTO",
    "BaseSigner",
    "ExtractedSigner",
    "ExtractSignersResponse",
    "CreateDistributionRequest",
    "CreateDistributionResponse",
    "DistributionDetailsResponse",
    "ResendDistributionRequest",
    "ResendDistributionResponse",
    "DeleteDistributionResponse",
    "DistributionReportRequest",
    "DistributionReportResponse",
    "parse_distribution_documents",
    "TestDistributionFactory",
    # Links
    "LinkTemplateRequest",
    "VideoConferenceRequest",
    "LinkInfo",
    "LinkTemplateInfo",
    "LinksListResponse",
    "LinkTemplateResponse",
    "VideoConferenceResponse",
    "LinksErrorResponse",
    "TestLinksFactory",
    "parse_links_list",
    "get_first_link_id",
    "get_first_template_id",
    # Reports
    "CreateFrequencyReportRequest",
    "ReportDownloadParams",
    "UsageDataResponse",
    "FrequencyReportInfo",
    "FrequencyReportsListResponse",
    "CreateFrequencyReportResponse",
    "DeleteFrequencyReportsResponse",
    "ReportsErrorResponse",
    "TestReportsFactory",
    "parse_usage_data",
    "parse_frequency_reports_list",
    "get_first_report_id",
    # Contacts (existing)
    "LoginRequest",
    "LoginResponse",
    "UserInfo",
    "Contact",
    "ContactListResponse",
    "ContactCreateRequest",
    "ContactUpdateRequest",
    "SignatureGetResponse",
    "SignatureUpdateRequest",
    "SignatureUpdateResponse",
    "FieldError",
    "ValidationErrorResponse",
    "ErrorResponse",
    "DeleteResponse",
    "parse_contact_list",
    "validate_uuid",
    "TestContactFactory",
    # SelfSign (existing)
    "SignRequest",
    "SignResponse",
    "IdentityCheckRequest",
    "IdentityCheckResponse",
    "SelfSignErrorResponse",
    "TestSelfSignFactory",
    # Admins (existing)
    "AdminSendRequest",
    "AdminSendResponse",
    "AdminErrorResponse",
    "TestAdminsFactory",
    "parse_admin_response",
    "parse_admin_error",
]

__version__ = "2.2.0"  # Added Base, Users, Documents, Distribution, Links, Reports models
