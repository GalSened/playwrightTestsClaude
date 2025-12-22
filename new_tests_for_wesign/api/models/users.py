"""
Pydantic Models for WeSign Users API

Type-safe request/response models for the Users module endpoints.
Provides automatic validation and clear documentation of API contracts.

Validated against:
- Swagger: C:\\Users\\gals\\Desktop\\swaggerWESIGN.txt
- Backend: C:\\Users\\gals\\Desktop\\user-backend-DEV\\WeSign\\Areas\\Ui\\Controllers\\UsersController.cs

Endpoints covered:
- POST /v3/users/login - User login
- GET /v3/users - Get current user
- PUT /v3/users - Update user profile
- POST /v3/users - Sign up new user
- POST /v3/users/changePassword - Change password
- POST /v3/users/resetPassword - Reset password
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from .base import Language, UserType


# ==================== Login Models ====================

class LoginRequestDTO(BaseModel):
    """
    Login request to obtain JWT token.

    From Swagger: LoginRequestDTO
    Endpoint: POST /v3/users/login

    Note: ASP.NET Core accepts both PascalCase and camelCase.
    We use camelCase for consistency with Swagger schema.
    """
    email: Optional[str] = Field(None, alias="Email")
    password: Optional[str] = Field(None, alias="Password")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "Email": "nirk@comsign.co.il",
                "Password": "Comsign1!"
            }
        }


class UserResponseDTO(BaseModel):
    """
    User information returned in responses.

    From Swagger: UserResponseDTO
    """
    id: str
    companyId: Optional[str] = None
    groupId: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    type: Optional[int] = None  # UserType enum
    language: Optional[int] = None  # Language enum
    isActive: Optional[bool] = None
    createdAt: Optional[datetime] = None
    lastLogin: Optional[datetime] = None

    class Config:
        extra = "allow"


class LoginResponseDTO(BaseModel):
    """
    Login response containing JWT token and optional user info.

    From Swagger: Response for /v3/users/login
    """
    token: str
    user: Optional[UserResponseDTO] = None
    requiresOtp: Optional[bool] = None
    otpToken: Optional[str] = None

    class Config:
        extra = "allow"


# ==================== User CRUD Models ====================

class CreateUserDTO(BaseModel):
    """
    Request to create/sign up a new user.

    From Swagger: CreateUserDTO
    Endpoint: POST /v3/users
    """
    name: Optional[str] = None
    language: Optional[int] = Field(None, description="Language enum: 1=Hebrew, 2=English")
    email: Optional[str] = None
    password: Optional[str] = None
    reCAPCHA: Optional[str] = Field(None, description="reCAPTCHA token for verification")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Test User",
                "email": "test@example.com",
                "password": "SecureP@ss123",
                "language": 2
            }
        }


class UpdateUserDTO(BaseModel):
    """
    Request to update user profile.

    From Swagger: UpdateUserDTO
    Endpoint: PUT /v3/users
    """
    name: Optional[str] = None
    language: Optional[int] = None
    phone: Optional[str] = None
    signature: Optional[str] = Field(None, description="Base64 encoded signature image")

    class Config:
        extra = "allow"
        json_schema_extra = {
            "example": {
                "name": "Updated Name",
                "language": 2,
                "phone": "+972501234567"
            }
        }


# ==================== Password Management ====================

class ChangePasswordDTO(BaseModel):
    """
    Request to change user password.

    From Swagger: ChangePasswordDTO
    Endpoint: POST /v3/users/changePassword
    """
    oldPassword: Optional[str] = None
    newPassword: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "oldPassword": "OldP@ss123",
                "newPassword": "NewP@ss456"
            }
        }


class ResetPasswordRequestDTO(BaseModel):
    """
    Request to initiate password reset.

    Endpoint: POST /v3/users/resetPassword
    """
    email: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com"
            }
        }


class ResetPasswordConfirmDTO(BaseModel):
    """
    Confirm password reset with token.
    """
    token: str
    newPassword: str


# ==================== OTP Models ====================

class OtpVerifyDTO(BaseModel):
    """
    OTP verification request.

    Used when company requires OTP for login.
    """
    otpToken: str
    otpCode: str

    class Config:
        json_schema_extra = {
            "example": {
                "otpToken": "temp-token-from-login",
                "otpCode": "123456"
            }
        }


class OtpResponseDTO(BaseModel):
    """
    OTP verification response.
    """
    token: str
    user: Optional[UserResponseDTO] = None

    class Config:
        extra = "allow"


# ==================== Group Management ====================

class GroupResponseDTO(BaseModel):
    """
    User group information.

    From Swagger: GroupResponseAdminDTO (simplified)
    """
    id: str
    name: Optional[str] = None
    companyId: Optional[str] = None

    class Config:
        extra = "allow"


class UserGroupsResponseDTO(BaseModel):
    """
    Response containing user's groups.
    """
    groups: Optional[List[GroupResponseDTO]] = None
    primaryGroupId: Optional[str] = None


# ==================== External Auth ====================

class ExternalAuthDTO(BaseModel):
    """
    External authentication request (SSO, OAuth, etc.)
    """
    provider: str  # e.g., "google", "microsoft", "saml"
    token: str
    redirectUrl: Optional[str] = None


class ExternalAuthResponseDTO(BaseModel):
    """
    External authentication response.
    """
    token: str
    user: Optional[UserResponseDTO] = None
    isNewUser: Optional[bool] = None

    class Config:
        extra = "allow"


class LogoutResponseDTO(BaseModel):
    """
    Logout response.

    From Swagger: LogoutResponseDTO
    """
    logoutURL: Optional[str] = None


# ==================== Admin User Management ====================

class AdminCreateUserDTO(BaseModel):
    """
    Admin request to create a new user.

    From Swagger: AdminCreateUserDTO
    """
    name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    type: Optional[int] = None  # UserType enum
    groupId: Optional[str] = None
    additionalGroupsIds: Optional[List[str]] = None


class AdminAllUsersResponseDTO(BaseModel):
    """
    Response containing all users (admin view).

    From Swagger: AdminAllUsersResponseDTO
    """
    users: Optional[List[UserResponseDTO]] = None


class UserResponseAdminDTO(BaseModel):
    """
    Extended user info for admin view.

    From Swagger: UserResponseAdminDTO
    """
    id: str
    companyId: Optional[str] = None
    groupId: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    type: Optional[int] = None
    isActive: Optional[bool] = None
    lastLogin: Optional[datetime] = None
    createdAt: Optional[datetime] = None
    additionalGroups: Optional[List[GroupResponseDTO]] = None

    class Config:
        extra = "allow"


# ==================== Test Data Factory ====================

class TestUserFactory:
    """
    Factory for generating test user data.
    """

    @staticmethod
    def login_request(
        email: str = "nirk@comsign.co.il",
        password: str = "Comsign1!"
    ) -> dict:
        """
        Create login request payload.

        Note: Returns dict with PascalCase keys for ASP.NET compatibility.
        """
        return {
            "Email": email,
            "Password": password
        }

    @staticmethod
    def create_user_request(
        name: str = "Test User",
        email: str = "test@automation.test",
        password: str = "TestP@ss123",
        language: int = 2
    ) -> CreateUserDTO:
        """Create a CreateUserDTO for testing."""
        return CreateUserDTO(
            name=name,
            email=email,
            password=password,
            language=language
        )

    @staticmethod
    def update_user_request(
        name: Optional[str] = None,
        language: Optional[int] = None
    ) -> UpdateUserDTO:
        """Create an UpdateUserDTO for testing."""
        return UpdateUserDTO(
            name=name,
            language=language
        )

    @staticmethod
    def invalid_credentials() -> dict:
        """Return invalid credentials for testing error cases."""
        return {
            "Email": "invalid@nonexistent.com",
            "Password": "WrongPassword123!"
        }

    @staticmethod
    def empty_credentials() -> dict:
        """Return empty credentials for testing validation."""
        return {
            "Email": "",
            "Password": ""
        }


# ==================== Exports ====================

__all__ = [
    # Login
    "LoginRequestDTO",
    "LoginResponseDTO",
    "UserResponseDTO",

    # CRUD
    "CreateUserDTO",
    "UpdateUserDTO",

    # Password
    "ChangePasswordDTO",
    "ResetPasswordRequestDTO",
    "ResetPasswordConfirmDTO",

    # OTP
    "OtpVerifyDTO",
    "OtpResponseDTO",

    # Groups
    "GroupResponseDTO",
    "UserGroupsResponseDTO",

    # External Auth
    "ExternalAuthDTO",
    "ExternalAuthResponseDTO",
    "LogoutResponseDTO",

    # Admin
    "AdminCreateUserDTO",
    "AdminAllUsersResponseDTO",
    "UserResponseAdminDTO",

    # Factory
    "TestUserFactory",
]
