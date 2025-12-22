"""
Templates API Pydantic Models

Models for WeSign Templates API endpoints.
Based on Swagger OpenAPI 3.0.1 specification.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class TemplateResponseDTO(BaseModel):
    """Response model for template data."""
    id: Optional[str] = None
    templateId: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    pageCount: Optional[int] = None
    status: Optional[str] = None

    class Config:
        extra = "allow"


class TemplateCreateDTO(BaseModel):
    """Request model for creating a template."""
    name: str
    description: Optional[str] = None
    file: Optional[str] = None  # Base64 encoded

    class Config:
        extra = "allow"


class TemplateUpdateDTO(BaseModel):
    """Request model for updating a template."""
    name: Optional[str] = None
    description: Optional[str] = None

    class Config:
        extra = "allow"


class TemplateMergeDTO(BaseModel):
    """Request model for merging templates."""
    templateIds: List[str]
    newName: Optional[str] = None

    class Config:
        extra = "allow"


class TemplateBatchDeleteDTO(BaseModel):
    """Request model for batch deleting templates."""
    templateIds: List[str]

    class Config:
        extra = "allow"


class TestTemplateFactory:
    """Factory for creating test template data."""

    @staticmethod
    def valid_template_id() -> str:
        """Return a valid-looking UUID."""
        return "00000000-0000-0000-0000-000000000000"

    @staticmethod
    def invalid_template_id() -> str:
        """Return an invalid ID format."""
        return "invalid-template-id"

    @staticmethod
    def sql_injection_id() -> str:
        """Return SQL injection payload."""
        return "'; DROP TABLE templates;--"

    @staticmethod
    def xss_payload() -> str:
        """Return XSS payload."""
        return "<script>alert('xss')</script>"

    @staticmethod
    def path_traversal() -> str:
        """Return path traversal payload."""
        return "../../../etc/passwd"

    @staticmethod
    def valid_create_data() -> dict:
        """Return valid template creation data."""
        return {
            "name": "Test Template",
            "description": "A test template for API testing"
        }

    @staticmethod
    def empty_name_data() -> dict:
        """Return data with empty name."""
        return {
            "name": "",
            "description": "Template with empty name"
        }

    @staticmethod
    def long_name_data() -> dict:
        """Return data with very long name."""
        return {
            "name": "A" * 10000,
            "description": "Template with very long name"
        }

    @staticmethod
    def unicode_name_data() -> dict:
        """Return data with Unicode name."""
        return {
            "name": "תבנית בעברית 📄",
            "description": "Hebrew template with emoji"
        }

    @staticmethod
    def sql_injection_data() -> dict:
        """Return data with SQL injection in name."""
        return {
            "name": "'; DROP TABLE templates;--",
            "description": "SQL injection attempt"
        }

    @staticmethod
    def xss_data() -> dict:
        """Return data with XSS in name."""
        return {
            "name": "<script>alert('xss')</script>",
            "description": "<img src=x onerror=alert(1)>"
        }
