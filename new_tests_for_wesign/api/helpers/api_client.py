"""
Base API Client for WeSign API Testing
Uses httpx for async HTTP requests with built-in retry, timeout, and error handling.

SMART Principles:
- Systematic: Consistent request/response handling
- Resilient: Automatic retries, clear error messages
- Test-driven: Designed for easy assertion and validation
"""

import httpx
import json
from typing import Optional, Dict, Any, Union
from dataclasses import dataclass
import structlog
from pathlib import Path

logger = structlog.get_logger()


@dataclass
class APIResponse:
    """
    Wrapper for API responses with easy access to common attributes.
    Makes assertions cleaner and more readable.
    """
    status_code: int
    headers: Dict[str, str]
    body: Union[Dict, list, str, None]
    raw_response: httpx.Response

    @property
    def is_success(self) -> bool:
        """Check if response is successful (2xx status code)"""
        return 200 <= self.status_code < 300

    @property
    def is_client_error(self) -> bool:
        """Check if response is client error (4xx status code)"""
        return 400 <= self.status_code < 500

    @property
    def is_server_error(self) -> bool:
        """Check if response is server error (5xx status code)"""
        return self.status_code >= 500

    def json(self) -> Union[Dict, list]:
        """Get response body as JSON (dict or list)"""
        if isinstance(self.body, (dict, list)):
            return self.body
        try:
            return json.loads(self.body)
        except (json.JSONDecodeError, TypeError):
            return {}

    def get_header(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Get header value (case-insensitive)"""
        return self.headers.get(key.lower(), default)


class APIClient:
    """
    Async HTTP client for WeSign API testing.

    Features:
    - Automatic authentication token injection
    - Request/response logging with structlog
    - Configurable timeouts and retries
    - JSON serialization/deserialization
    - Error context for better debugging

    Usage:
        async with APIClient(base_url=BASE_URL) as client:
            client.set_auth_token(token)
            response = await client.get("/v3/users/me")
            assert response.is_success
            assert response.json()["email"] == "test@example.com"
    """

    def __init__(
        self,
        base_url: str,
        timeout: float = 30.0,
        verify_ssl: bool = True,
        max_retries: int = 0,  # No retries by default for API tests (want to see real failures)
    ):
        """
        Initialize API client.

        Args:
            base_url: Base URL for API (e.g., "https://devtest.wesign.cloud")
            timeout: Request timeout in seconds
            verify_ssl: Whether to verify SSL certificates
            max_retries: Number of retries for failed requests (0 = no retries)
        """
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.verify_ssl = verify_ssl
        self.max_retries = max_retries

        self._client: Optional[httpx.AsyncClient] = None
        self._auth_token: Optional[str] = None
        self._default_headers: Dict[str, str] = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        logger.info(
            "api_client_initialized",
            base_url=self.base_url,
            timeout=self.timeout,
            verify_ssl=self.verify_ssl,
        )

    async def __aenter__(self):
        """Async context manager entry"""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()

    async def start(self):
        """Initialize the HTTP client"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                verify=self.verify_ssl,
                follow_redirects=True,
            )
            logger.info("http_client_started")

    async def close(self):
        """Close the HTTP client"""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            logger.info("http_client_closed")

    def set_auth_token(self, token: str):
        """
        Set authentication token for all subsequent requests.
        Token will be sent as "Authorization: Bearer <token>"

        Args:
            token: JWT or bearer token
        """
        self._auth_token = token
        logger.info("auth_token_set", token_length=len(token))

    def clear_auth_token(self):
        """Clear authentication token"""
        self._auth_token = None
        logger.info("auth_token_cleared")

    def _build_headers(self, extra_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """Build request headers with auth token and custom headers"""
        headers = self._default_headers.copy()

        # Add auth token if set
        if self._auth_token:
            headers["Authorization"] = f"Bearer {self._auth_token}"

        # Add custom headers
        if extra_headers:
            headers.update(extra_headers)

        return headers

    def _build_url(self, path: str) -> str:
        """Build full URL from path"""
        # Remove leading slash if present (base_url already has it)
        path = path.lstrip("/")
        return f"{self.base_url}/{path}"

    async def _make_request(
        self,
        method: str,
        path: str,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Union[Dict, list]] = None,
        data: Optional[Union[Dict, str]] = None,
        files: Optional[Dict[str, Any]] = None,
    ) -> APIResponse:
        """
        Internal method to make HTTP request with error handling and logging.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE, PATCH)
            path: API path (e.g., "/v3/users/login")
            headers: Custom headers
            params: Query parameters
            json_data: JSON body (will be serialized)
            data: Form data or raw body
            files: Multipart file upload

        Returns:
            APIResponse object

        Raises:
            httpx.HTTPError: On network errors
        """
        if self._client is None:
            raise RuntimeError("Client not started. Use 'async with' or call start()")

        url = self._build_url(path)
        request_headers = self._build_headers(headers)

        # Log request
        logger.info(
            "api_request_start",
            method=method,
            url=url,
            params=params,
            has_json=json_data is not None,
            has_data=data is not None,
            has_files=files is not None,
        )

        try:
            # Make request
            response = await self._client.request(
                method=method,
                url=url,
                headers=request_headers,
                params=params,
                json=json_data,
                data=data,
                files=files,
            )

            # Parse response body
            content_type = response.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    body = response.json()
                except json.JSONDecodeError:
                    body = response.text
            else:
                body = response.text

            # Create response wrapper
            api_response = APIResponse(
                status_code=response.status_code,
                headers=dict(response.headers),
                body=body,
                raw_response=response,
            )

            # Log response
            logger.info(
                "api_request_complete",
                method=method,
                url=url,
                status_code=response.status_code,
                is_success=api_response.is_success,
                response_size=len(str(body)),
            )

            return api_response

        except httpx.HTTPError as e:
            logger.error(
                "api_request_failed",
                method=method,
                url=url,
                error=str(e),
                error_type=type(e).__name__,
            )
            raise

    async def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> APIResponse:
        """GET request"""
        return await self._make_request("GET", path, params=params, headers=headers)

    async def post(
        self,
        path: str,
        json_data: Optional[Union[Dict, list]] = None,
        data: Optional[Union[Dict, str]] = None,
        files: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> APIResponse:
        """POST request"""
        return await self._make_request(
            "POST", path, json_data=json_data, data=data, files=files,
            params=params, headers=headers
        )

    async def put(
        self,
        path: str,
        json_data: Optional[Union[Dict, list]] = None,
        data: Optional[Union[Dict, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> APIResponse:
        """PUT request"""
        return await self._make_request(
            "PUT", path, json_data=json_data, data=data,
            params=params, headers=headers
        )

    async def patch(
        self,
        path: str,
        json_data: Optional[Union[Dict, list]] = None,
        data: Optional[Union[Dict, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> APIResponse:
        """PATCH request"""
        return await self._make_request(
            "PATCH", path, json_data=json_data, data=data,
            params=params, headers=headers
        )

    async def delete(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> APIResponse:
        """DELETE request"""
        return await self._make_request("DELETE", path, params=params, headers=headers)

    async def upload_file(
        self,
        path: str,
        file_path: Union[str, Path],
        field_name: str = "file",
        additional_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> APIResponse:
        """
        Upload file to API endpoint.

        Args:
            path: API path
            file_path: Path to file to upload
            field_name: Form field name for file
            additional_data: Additional form fields
            headers: Custom headers

        Returns:
            APIResponse object
        """
        file_path = Path(file_path)

        with open(file_path, "rb") as f:
            files = {field_name: (file_path.name, f, "application/octet-stream")}

            logger.info(
                "file_upload_start",
                path=path,
                file_name=file_path.name,
                file_size=file_path.stat().st_size,
            )

            return await self.post(
                path=path,
                files=files,
                data=additional_data,
                headers=headers,
            )
