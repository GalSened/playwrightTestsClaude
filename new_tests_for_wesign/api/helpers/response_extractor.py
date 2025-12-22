"""
Smart Response Extractor for WeSign API Testing

Provides intelligent extraction of values from API responses,
equivalent to Postman's pm.environment.set() functionality.

Key Features:
- Dot notation path extraction (e.g., "documentCollections[0].signers[0].id")
- Automatic extraction to TestContext
- Type-safe with clear error messages
- Support for arrays, nested objects, and optional fields

Usage:
    # Basic extraction
    extractor = ResponseExtractor(response.json())
    doc_id = extractor.get("documentCollections[0].documentCollectionId")

    # Extract multiple values to TestContext
    smart = SmartResponse(response)
    smart.extract_to_context(test_context, {
        "doc_collection_id": "documentCollections[0].documentCollectionId",
        "signer_id": "documentCollections[0].signers[0].id",
    })

    # Equivalent Postman:
    # pm.environment.set('docId', jsonData.documentCollections[0].documentCollectionId)
"""

import re
from typing import Any, Dict, Optional, Union, List
import structlog

logger = structlog.get_logger()


class ResponseExtractor:
    """
    Extract values from API responses using dot notation paths.

    Supports:
    - Simple paths: "token", "user.email"
    - Array indexing: "contacts[0].id", "signers[0].name"
    - Nested paths: "documentCollections[0].signers[0].id"
    - Optional chaining: Returns None if path doesn't exist
    """

    def __init__(self, data: Union[Dict, List, Any]):
        """
        Initialize with response data.

        Args:
            data: API response data (usually from response.json())
        """
        self._data = data

    @property
    def data(self) -> Any:
        """Get the raw data."""
        return self._data

    def get(self, path: str, default: Any = None) -> Any:
        """
        Extract value at the given path.

        Args:
            path: Dot notation path (e.g., "documentCollections[0].signers[0].id")
            default: Default value if path doesn't exist

        Returns:
            Extracted value or default

        Examples:
            extractor.get("token")  # Simple field
            extractor.get("user.email")  # Nested field
            extractor.get("contacts[0].id")  # Array index
            extractor.get("documentCollections[0].signers[0].id")  # Deep nested
        """
        try:
            return self._extract_path(self._data, path)
        except (KeyError, IndexError, TypeError) as e:
            logger.debug(
                "extraction_failed",
                path=path,
                error=str(e),
                data_type=type(self._data).__name__
            )
            return default

    def get_first(self, array_key: str, field: Optional[str] = None) -> Any:
        """
        Get first item from an array, optionally extracting a field.

        Args:
            array_key: Key containing the array
            field: Optional field to extract from the first item

        Returns:
            First item or field value, None if not found

        Examples:
            extractor.get_first("contacts")  # First contact object
            extractor.get_first("contacts", "id")  # First contact's ID
        """
        array = self.get(array_key)
        if not array or not isinstance(array, list) or len(array) == 0:
            return None

        first_item = array[0]
        if field:
            return first_item.get(field) if isinstance(first_item, dict) else None
        return first_item

    def get_all(self, array_key: str, field: str) -> List[Any]:
        """
        Extract a field from all items in an array.

        Args:
            array_key: Key containing the array
            field: Field to extract from each item

        Returns:
            List of field values

        Examples:
            extractor.get_all("contacts", "id")  # All contact IDs
            extractor.get_all("signers", "email")  # All signer emails
        """
        array = self.get(array_key)
        if not array or not isinstance(array, list):
            return []

        return [
            item.get(field)
            for item in array
            if isinstance(item, dict) and field in item
        ]

    def exists(self, path: str) -> bool:
        """
        Check if a path exists and has a non-None value.

        Args:
            path: Dot notation path

        Returns:
            True if path exists and has a value
        """
        return self.get(path) is not None

    def _extract_path(self, data: Any, path: str) -> Any:
        """
        Internal method to extract value at path.

        Handles:
        - Simple keys: "token"
        - Array indices: "contacts[0]"
        - Nested paths: "user.email"
        - Combined: "documentCollections[0].signers[0].id"
        """
        if not path:
            return data

        # Split path into parts, handling array indices
        # "documentCollections[0].signers[0].id" -> ["documentCollections", "[0]", "signers", "[0]", "id"]
        parts = re.split(r'\.|\[|\]', path)
        parts = [p for p in parts if p]  # Remove empty strings

        current = data
        for part in parts:
            if current is None:
                return None

            if part.isdigit():
                # Array index
                idx = int(part)
                if isinstance(current, list) and 0 <= idx < len(current):
                    current = current[idx]
                else:
                    return None
            else:
                # Dictionary key
                if isinstance(current, dict):
                    current = current.get(part)
                else:
                    return None

        return current


class SmartResponse:
    """
    Wrapper for API responses with smart extraction capabilities.

    Provides a higher-level interface for extracting values
    and populating TestContext automatically.
    """

    def __init__(self, response: Any):
        """
        Initialize with API response.

        Args:
            response: APIResponse object or dict/list data
        """
        # Handle both APIResponse objects and raw data
        if hasattr(response, 'json'):
            self._data = response.json() if callable(response.json) else response.json
        elif hasattr(response, 'body'):
            self._data = response.body
        else:
            self._data = response

        self._extractor = ResponseExtractor(self._data)

    @property
    def data(self) -> Any:
        """Get the raw response data."""
        return self._data

    @property
    def extractor(self) -> ResponseExtractor:
        """Get the underlying extractor."""
        return self._extractor

    def get(self, path: str, default: Any = None) -> Any:
        """Extract value at path."""
        return self._extractor.get(path, default)

    def extract_to_context(
        self,
        context: Any,
        mappings: Dict[str, str],
        skip_none: bool = True
    ) -> Dict[str, Any]:
        """
        Extract multiple values from response to TestContext.

        This is the primary method for "smart" response handling,
        equivalent to multiple pm.environment.set() calls in Postman.

        Args:
            context: TestContext instance
            mappings: Dict mapping context attribute/key to response path
            skip_none: If True, skip setting None values

        Returns:
            Dict of extracted values (for logging/debugging)

        Example:
            smart.extract_to_context(test_context, {
                "doc_collection_id": "documentCollections[0].documentCollectionId",
                "signer_id": "documentCollections[0].signers[0].id",
                "token": "token",
            })

            # Equivalent Postman:
            # pm.environment.set('doc_collection_id', jsonData.documentCollections[0].documentCollectionId)
            # pm.environment.set('signer_id', jsonData.documentCollections[0].signers[0].id)
        """
        extracted = {}

        for context_key, response_path in mappings.items():
            value = self._extractor.get(response_path)

            if value is None and skip_none:
                logger.debug(
                    "extract_skipped_none",
                    context_key=context_key,
                    response_path=response_path
                )
                continue

            # Set on context - try attribute first, then use set() method
            if hasattr(context, context_key):
                setattr(context, context_key, value)
            elif hasattr(context, 'set'):
                context.set(context_key, value)

            extracted[context_key] = value

            logger.info(
                "value_extracted_to_context",
                context_key=context_key,
                response_path=response_path,
                value_type=type(value).__name__,
                value_preview=str(value)[:50] if value else None
            )

        return extracted

    def extract_first_to_context(
        self,
        context: Any,
        array_key: str,
        mappings: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Extract values from first item in an array to context.

        Convenience method for common pattern of getting first item's fields.

        Args:
            context: TestContext instance
            array_key: Key containing the array
            mappings: Dict mapping context key to field in first item

        Returns:
            Dict of extracted values

        Example:
            smart.extract_first_to_context(test_context, "documentCollections", {
                "doc_collection_id": "documentCollectionId",
                "distribution_id": "distributionId",
            })
        """
        # Build full paths from array key
        full_mappings = {
            ctx_key: f"{array_key}[0].{field}"
            for ctx_key, field in mappings.items()
        }
        return self.extract_to_context(context, full_mappings)


# ==================== Convenience Functions ====================

def extract_from_response(
    response: Any,
    path: str,
    default: Any = None
) -> Any:
    """
    Quick extraction from response without creating SmartResponse.

    Args:
        response: API response
        path: Dot notation path
        default: Default value

    Returns:
        Extracted value or default
    """
    return SmartResponse(response).get(path, default)


def extract_to_context(
    response: Any,
    context: Any,
    mappings: Dict[str, str]
) -> Dict[str, Any]:
    """
    Quick extraction to context without creating SmartResponse.

    Args:
        response: API response
        context: TestContext instance
        mappings: Dict mapping context key to response path

    Returns:
        Dict of extracted values
    """
    return SmartResponse(response).extract_to_context(context, mappings)


# ==================== Exports ====================

__all__ = [
    "ResponseExtractor",
    "SmartResponse",
    "extract_from_response",
    "extract_to_context",
]
