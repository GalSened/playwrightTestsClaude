"""
Links Module - Pydantic Models

Based on WeSign API Swagger spec for Links endpoints:
- GET /v3/links - List signing links
- GET /v3/links/template/{id} - Get link template
- POST /v3/links/template/{id} - Create/update link template
- POST /v3/links/videoconference - Create video conference link

Migrated from: api_tests/Links_Module.postman_collection.json
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# ==================== Request Models ====================

class LinkTemplateRequest(BaseModel):
    """Request model for creating/updating link template"""
    name: Optional[str] = None
    description: Optional[str] = None


class VideoConferenceRequest(BaseModel):
    """Request model for creating video conference link"""
    meetingTitle: Optional[str] = Field(None, alias="meetingTitle")
    participantEmail: Optional[str] = Field(None, alias="participantEmail")
    scheduledTime: Optional[str] = None
    duration: Optional[int] = None

    class Config:
        populate_by_name = True


# ==================== Response Models ====================

class LinkInfo(BaseModel):
    """Individual link information"""
    id: str
    name: Optional[str] = None
    url: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    createdAt: Optional[str] = None
    expiresAt: Optional[str] = None


class LinkTemplateInfo(BaseModel):
    """Link template information"""
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    templateUrl: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class LinksListResponse(BaseModel):
    """Response from GET /v3/links"""
    links: Optional[List[LinkInfo]] = None
    templates: Optional[List[LinkTemplateInfo]] = None
    total: Optional[int] = None


class LinkTemplateResponse(BaseModel):
    """Response from GET/POST /v3/links/template/{id}"""
    id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    templateUrl: Optional[str] = None
    settings: Optional[dict] = None


class VideoConferenceResponse(BaseModel):
    """Response from POST /v3/links/videoconference"""
    id: Optional[str] = None
    meetingUrl: Optional[str] = None
    joinUrl: Optional[str] = None
    meetingTitle: Optional[str] = None
    scheduledTime: Optional[str] = None
    status: Optional[str] = None


class LinksErrorResponse(BaseModel):
    """Error response for Links endpoints"""
    message: Optional[str] = None
    errors: Optional[dict] = None
    code: Optional[str] = None


# ==================== Test Data Factory ====================

class TestLinksFactory:
    """Factory for generating test data for Links endpoints"""

    @staticmethod
    def valid_template_request() -> dict:
        """Generate valid link template request"""
        return {
            "name": "Test Link Template",
            "description": "Created by automated testing"
        }

    @staticmethod
    def empty_template_request() -> dict:
        """Generate empty template request (for validation testing)"""
        return {}

    @staticmethod
    def valid_video_conference_request() -> dict:
        """Generate valid video conference request"""
        return {
            "meetingTitle": "Test Video Conference",
            "participantEmail": "test@example.com"
        }

    @staticmethod
    def empty_video_conference_request() -> dict:
        """Generate empty video conference request (for validation testing)"""
        return {}

    @staticmethod
    def invalid_uuid() -> str:
        """Generate an invalid/non-existent UUID for testing"""
        return "00000000-0000-0000-0000-000000000000"


# ==================== Helper Functions ====================

def parse_links_list(response_json: Any) -> LinksListResponse:
    """Parse links list response, handling various formats"""
    if isinstance(response_json, dict):
        return LinksListResponse(**response_json)
    return LinksListResponse(links=[], templates=[])


def get_first_link_id(response_json: Any) -> Optional[str]:
    """Extract first link ID from response for subsequent tests"""
    if isinstance(response_json, dict):
        # Check for links array
        links = response_json.get("links", [])
        if links and len(links) > 0:
            return links[0].get("id")

        # Check for templates array
        templates = response_json.get("templates", [])
        if templates and len(templates) > 0:
            return templates[0].get("id")

    return None


def get_first_template_id(response_json: Any) -> Optional[str]:
    """Extract first template ID from response"""
    if isinstance(response_json, dict):
        templates = response_json.get("templates", [])
        if templates and len(templates) > 0:
            return templates[0].get("id")

    return None
