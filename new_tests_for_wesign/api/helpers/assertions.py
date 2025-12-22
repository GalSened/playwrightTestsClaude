"""
Fluent Assertions for WeSign API Testing

Provides chainable assertion helpers for API responses,
equivalent to Postman's pm.test() and pm.expect() patterns.

Key Features:
- Fluent/chainable API for readable tests
- Clear error messages with response details
- Support for status codes, JSON structure, Pydantic models
- Type-safe assertions

Usage:
    # Basic assertions
    assert_response(response).status_is(200).has_field("token")

    # Status code assertions
    assert_response(response).status_in([200, 201]).is_success()

    # JSON structure assertions
    assert_response(response).is_array().has_min_items(1)

    # Pydantic model validation
    assert_response(response).json_matches(LoginResponseDTO)

    # Combine assertions
    assert_response(response).status_is(200).has_field("documentCollections").is_array_at("documentCollections")
"""

from typing import Any, List, Type, Optional, Union
from pydantic import BaseModel, ValidationError
import structlog

logger = structlog.get_logger()


class AssertionError(Exception):
    """Custom assertion error with response context."""

    def __init__(self, message: str, response: Any = None):
        self.response = response
        super().__init__(message)


class APIAssertions:
    """
    Fluent assertions for API responses.

    Provides chainable methods for validating API response properties.
    Each assertion returns self, allowing method chaining.
    """

    def __init__(self, response: Any):
        """
        Initialize with API response.

        Args:
            response: APIResponse object or similar with status_code and body/json()
        """
        self._response = response

        # Extract commonly used properties
        self._status_code = getattr(response, 'status_code', None)
        self._body = self._get_body(response)

    def _get_body(self, response: Any) -> Any:
        """Extract response body, handling various response types."""
        if hasattr(response, 'json'):
            try:
                return response.json() if callable(response.json) else response.json
            except Exception:
                pass
        if hasattr(response, 'body'):
            return response.body
        return response

    def _fail(self, message: str) -> None:
        """Raise assertion error with context."""
        full_message = (
            f"{message}\n"
            f"Status Code: {self._status_code}\n"
            f"Response Body: {str(self._body)[:500]}"
        )
        raise AssertionError(full_message, self._response)

    # ==================== Status Code Assertions ====================

    def status_is(self, expected: int) -> "APIAssertions":
        """
        Assert exact status code.

        Args:
            expected: Expected status code

        Returns:
            self for chaining

        Example:
            assert_response(response).status_is(200)
        """
        if self._status_code != expected:
            self._fail(f"Expected status {expected}, got {self._status_code}")
        return self

    def status_in(self, expected: List[int]) -> "APIAssertions":
        """
        Assert status code is one of expected values.

        Args:
            expected: List of valid status codes

        Returns:
            self for chaining

        Example:
            assert_response(response).status_in([200, 201, 204])
        """
        if self._status_code not in expected:
            self._fail(f"Expected status in {expected}, got {self._status_code}")
        return self

    def is_success(self) -> "APIAssertions":
        """
        Assert status code is 2xx.

        Returns:
            self for chaining
        """
        if not (200 <= self._status_code < 300):
            self._fail(f"Expected success status (2xx), got {self._status_code}")
        return self

    def is_client_error(self) -> "APIAssertions":
        """
        Assert status code is 4xx.

        Returns:
            self for chaining
        """
        if not (400 <= self._status_code < 500):
            self._fail(f"Expected client error (4xx), got {self._status_code}")
        return self

    def is_server_error(self) -> "APIAssertions":
        """
        Assert status code is 5xx.

        Returns:
            self for chaining
        """
        if not (500 <= self._status_code < 600):
            self._fail(f"Expected server error (5xx), got {self._status_code}")
        return self

    def is_unauthorized(self) -> "APIAssertions":
        """
        Assert status code is 401.

        Returns:
            self for chaining
        """
        return self.status_is(401)

    def is_forbidden(self) -> "APIAssertions":
        """
        Assert status code is 403.

        Returns:
            self for chaining
        """
        return self.status_is(403)

    def is_not_found(self) -> "APIAssertions":
        """
        Assert status code is 404.

        Returns:
            self for chaining
        """
        return self.status_is(404)

    def is_bad_request(self) -> "APIAssertions":
        """
        Assert status code is 400.

        Returns:
            self for chaining
        """
        return self.status_is(400)

    # ==================== Field Assertions ====================

    def has_field(self, field: str) -> "APIAssertions":
        """
        Assert response has a specific field.

        Args:
            field: Field name (supports dot notation)

        Returns:
            self for chaining

        Example:
            assert_response(response).has_field("token")
            assert_response(response).has_field("user.email")
        """
        if not isinstance(self._body, dict):
            self._fail(f"Expected dict response to check field '{field}'")

        # Handle nested fields with dot notation
        parts = field.split('.')
        current = self._body
        for part in parts:
            if not isinstance(current, dict) or part not in current:
                self._fail(f"Response missing field: {field}")
            current = current[part]

        return self

    def has_fields(self, *fields: str) -> "APIAssertions":
        """
        Assert response has all specified fields.

        Args:
            *fields: Field names to check

        Returns:
            self for chaining

        Example:
            assert_response(response).has_fields("token", "user", "expiresIn")
        """
        for field in fields:
            self.has_field(field)
        return self

    def field_equals(self, field: str, expected: Any) -> "APIAssertions":
        """
        Assert field has expected value.

        Args:
            field: Field name
            expected: Expected value

        Returns:
            self for chaining

        Example:
            assert_response(response).field_equals("status", "active")
        """
        if not isinstance(self._body, dict):
            self._fail(f"Expected dict response to check field '{field}'")

        actual = self._body.get(field)
        if actual != expected:
            self._fail(f"Field '{field}' expected {expected}, got {actual}")
        return self

    def field_not_empty(self, field: str) -> "APIAssertions":
        """
        Assert field exists and is not empty/None.

        Args:
            field: Field name

        Returns:
            self for chaining
        """
        self.has_field(field)
        value = self._body.get(field)
        if not value:
            self._fail(f"Field '{field}' is empty or None")
        return self

    # ==================== Array Assertions ====================

    def is_array(self) -> "APIAssertions":
        """
        Assert response body is an array.

        Returns:
            self for chaining
        """
        if not isinstance(self._body, list):
            self._fail(f"Expected array response, got {type(self._body).__name__}")
        return self

    def is_array_at(self, field: str) -> "APIAssertions":
        """
        Assert field value is an array.

        Args:
            field: Field name containing array

        Returns:
            self for chaining

        Example:
            assert_response(response).is_array_at("documentCollections")
        """
        self.has_field(field)
        value = self._body.get(field)
        if not isinstance(value, list):
            self._fail(f"Field '{field}' expected array, got {type(value).__name__}")
        return self

    def has_items(self, count: int) -> "APIAssertions":
        """
        Assert array has exact number of items.

        Args:
            count: Expected number of items

        Returns:
            self for chaining
        """
        self.is_array()
        if len(self._body) != count:
            self._fail(f"Expected {count} items, got {len(self._body)}")
        return self

    def has_min_items(self, min_count: int) -> "APIAssertions":
        """
        Assert array has at least N items.

        Args:
            min_count: Minimum number of items

        Returns:
            self for chaining
        """
        self.is_array()
        if len(self._body) < min_count:
            self._fail(f"Expected at least {min_count} items, got {len(self._body)}")
        return self

    def has_items_at(self, field: str, count: int) -> "APIAssertions":
        """
        Assert array field has exact number of items.

        Args:
            field: Field name containing array
            count: Expected number of items

        Returns:
            self for chaining
        """
        self.is_array_at(field)
        actual = len(self._body[field])
        if actual != count:
            self._fail(f"Field '{field}' expected {count} items, got {actual}")
        return self

    def has_min_items_at(self, field: str, min_count: int) -> "APIAssertions":
        """
        Assert array field has at least N items.

        Args:
            field: Field name containing array
            min_count: Minimum number of items

        Returns:
            self for chaining
        """
        self.is_array_at(field)
        actual = len(self._body[field])
        if actual < min_count:
            self._fail(f"Field '{field}' expected at least {min_count} items, got {actual}")
        return self

    # ==================== Pydantic Model Assertions ====================

    def json_matches(self, model: Type[BaseModel]) -> "APIAssertions":
        """
        Assert response body matches Pydantic model.

        Args:
            model: Pydantic model class

        Returns:
            self for chaining

        Example:
            assert_response(response).json_matches(LoginResponseDTO)
        """
        try:
            model(**self._body) if isinstance(self._body, dict) else model.parse_obj(self._body)
        except ValidationError as e:
            self._fail(f"Response doesn't match {model.__name__}: {e}")
        return self

    def parse_as(self, model: Type[BaseModel]) -> BaseModel:
        """
        Parse response body as Pydantic model.

        Args:
            model: Pydantic model class

        Returns:
            Parsed model instance

        Example:
            user = assert_response(response).parse_as(UserResponseDTO)
        """
        self.json_matches(model)
        return model(**self._body) if isinstance(self._body, dict) else model.parse_obj(self._body)

    # ==================== Helper Methods ====================

    def log(self, message: str = "Response") -> "APIAssertions":
        """
        Log response details (useful for debugging).

        Args:
            message: Log message prefix

        Returns:
            self for chaining
        """
        logger.info(
            f"api_assertion_{message.lower().replace(' ', '_')}",
            status_code=self._status_code,
            body_type=type(self._body).__name__,
            body_preview=str(self._body)[:200]
        )
        return self

    def get_body(self) -> Any:
        """
        Get the response body.

        Returns:
            Response body
        """
        return self._body

    def get_field(self, field: str, default: Any = None) -> Any:
        """
        Get field value from response.

        Args:
            field: Field name
            default: Default value if not found

        Returns:
            Field value or default
        """
        if isinstance(self._body, dict):
            return self._body.get(field, default)
        return default


# ==================== Factory Function ====================

def assert_response(response: Any) -> APIAssertions:
    """
    Create APIAssertions for fluent assertion chaining.

    Args:
        response: API response object

    Returns:
        APIAssertions instance

    Example:
        assert_response(response).status_is(200).has_field("token").is_success()
    """
    return APIAssertions(response)


# ==================== Exports ====================

__all__ = [
    "APIAssertions",
    "assert_response",
    "AssertionError",
]
