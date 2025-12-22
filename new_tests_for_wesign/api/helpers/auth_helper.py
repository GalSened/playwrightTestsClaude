"""
Authentication Helper for WeSign API Testing
Handles user login and token management for API tests.

SMART Principles:
- Manual-first: Login credentials match UI test credentials
- Resilient: Clear error messages, automatic token caching
- Test-driven: Easy to use in fixtures and tests
"""

import structlog
from typing import Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime, timedelta

from .api_client import APIClient, APIResponse

logger = structlog.get_logger()


@dataclass
class UserCredentials:
    """User credentials for login"""
    email: str
    password: str
    user_type: str = "company"  # "company", "admin", or "signer"

    def __str__(self):
        """Safe string representation (no password)"""
        return f"UserCredentials(email={self.email}, user_type={self.user_type})"


@dataclass
class AuthToken:
    """Authentication token with metadata"""
    token: str
    user_email: str
    expires_at: Optional[datetime] = None
    user_data: Optional[Dict[str, Any]] = None

    @property
    def is_expired(self) -> bool:
        """Check if token is expired"""
        if self.expires_at is None:
            return False
        return datetime.now() >= self.expires_at


class AuthHelper:
    """
    Helper class for WeSign API authentication.

    Features:
    - Login for different user types (company, admin, signer)
    - Token caching to avoid repeated logins
    - Token validation and expiry checking
    - Pre-configured test user credentials

    Usage:
        auth_helper = AuthHelper(api_client)
        token = await auth_helper.login_company_user()
        api_client.set_auth_token(token.token)

        # Or use convenience method
        await auth_helper.authenticate_as_company_user()
        # Now api_client has token set automatically
    """

    # Default test credentials for API testing
    DEFAULT_COMPANY_USER = UserCredentials(
        email="nirk@comsign.co.il",
        password="Comsign1!",  # Capital C - case sensitive
        user_type="company"
    )

    def __init__(self, api_client: APIClient):
        """
        Initialize AuthHelper.

        Args:
            api_client: APIClient instance to use for auth requests
        """
        self.api_client = api_client
        self._token_cache: Dict[str, AuthToken] = {}

        logger.info("auth_helper_initialized")

    async def login(
        self,
        email: str,
        password: str,
        use_cache: bool = True,
    ) -> AuthToken:
        """
        Login with email and password.

        Args:
            email: User email
            password: User password
            use_cache: Whether to use cached token if available

        Returns:
            AuthToken object

        Raises:
            AssertionError: If login fails
        """
        # Check cache first
        if use_cache and email in self._token_cache:
            cached_token = self._token_cache[email]
            if not cached_token.is_expired:
                logger.info("auth_token_from_cache", email=email)
                return cached_token

        logger.info("auth_login_start", email=email)

        # Make login request
        # Note: API expects PascalCase field names (Email, Password)
        response = await self.api_client.post(
            "/v3/users/login",
            json_data={
                "Email": email,
                "Password": password
            }
        )

        # Validate response
        assert response.is_success, (
            f"Login failed with status {response.status_code}. "
            f"Response: {response.body}"
        )

        response_data = response.json()
        assert "token" in response_data, (
            f"Login response missing 'token' field. Response: {response_data}"
        )

        token_str = response_data["token"]
        assert token_str and len(token_str) > 0, (
            "Login returned empty token"
        )

        # Create token object
        token = AuthToken(
            token=token_str,
            user_email=email,
            # WeSign tokens typically expire in 24 hours
            expires_at=datetime.now() + timedelta(hours=23, minutes=50),
            user_data=response_data.get("user")
        )

        # Cache token
        self._token_cache[email] = token

        logger.info(
            "auth_login_success",
            email=email,
            token_length=len(token_str),
            has_user_data=token.user_data is not None
        )

        return token

    async def login_with_credentials(
        self,
        credentials: UserCredentials,
        use_cache: bool = True,
    ) -> AuthToken:
        """
        Login with UserCredentials object.

        Args:
            credentials: UserCredentials object
            use_cache: Whether to use cached token

        Returns:
            AuthToken object
        """
        logger.info("auth_login_with_credentials", credentials=str(credentials))
        return await self.login(
            email=credentials.email,
            password=credentials.password,
            use_cache=use_cache
        )

    async def login_company_user(self, use_cache: bool = True) -> AuthToken:
        """
        Login as default company user (admin@companya.com).

        Args:
            use_cache: Whether to use cached token

        Returns:
            AuthToken object
        """
        return await self.login_with_credentials(self.DEFAULT_COMPANY_USER, use_cache)

    async def authenticate_as_company_user(self, use_cache: bool = True):
        """
        Login as company user and set token in APIClient automatically.

        This is a convenience method that combines login + set_auth_token.

        Args:
            use_cache: Whether to use cached token
        """
        token = await self.login_company_user(use_cache)
        self.api_client.set_auth_token(token.token)
        logger.info("api_client_authenticated", email=token.user_email)

    async def logout(self):
        """
        Logout current user (clear token from APIClient).

        Note: WeSign API doesn't have explicit logout endpoint,
        so we just clear the token from the client.
        """
        self.api_client.clear_auth_token()
        logger.info("auth_logout")

    def clear_token_cache(self):
        """Clear all cached tokens"""
        self._token_cache.clear()
        logger.info("auth_cache_cleared")

    def get_cached_token(self, email: str) -> Optional[AuthToken]:
        """
        Get cached token for email if available and not expired.

        Args:
            email: User email

        Returns:
            AuthToken if available and valid, None otherwise
        """
        if email in self._token_cache:
            token = self._token_cache[email]
            if not token.is_expired:
                return token
        return None

    async def verify_token(self, token: Optional[str] = None) -> bool:
        """
        Verify if token is valid by making a test request.

        Args:
            token: Token to verify (if None, uses current APIClient token)

        Returns:
            True if token is valid, False otherwise
        """
        # Save current token
        original_token = self.api_client._auth_token

        try:
            # Set token to verify
            if token is not None:
                self.api_client.set_auth_token(token)

            # Make test request (get current user)
            response = await self.api_client.get("/v3/users/me")

            # Restore original token
            if token is not None and original_token is not None:
                self.api_client.set_auth_token(original_token)

            return response.is_success

        except Exception as e:
            logger.warning("token_verification_failed", error=str(e))

            # Restore original token on error
            if token is not None and original_token is not None:
                self.api_client.set_auth_token(original_token)

            return False

    async def get_current_user(self) -> Dict[str, Any]:
        """
        Get current authenticated user's data.

        Returns:
            User data dictionary

        Raises:
            AssertionError: If not authenticated or request fails
        """
        assert self.api_client._auth_token is not None, (
            "No auth token set. Call authenticate_as_company_user() first."
        )

        response = await self.api_client.get("/v3/users/me")

        assert response.is_success, (
            f"Get current user failed with status {response.status_code}. "
            f"Response: {response.body}"
        )

        return response.json()


# Convenience function for quick testing
async def quick_auth(base_url: str) -> tuple[APIClient, AuthHelper]:
    """
    Quick authentication setup for testing/debugging.

    Args:
        base_url: API base URL

    Returns:
        Tuple of (authenticated APIClient, AuthHelper)

    Usage:
        api_client, auth_helper = await quick_auth("https://devtest.wesign.cloud")
        response = await api_client.get("/v3/contacts")
    """
    api_client = APIClient(base_url=base_url)
    await api_client.start()

    auth_helper = AuthHelper(api_client)
    await auth_helper.authenticate_as_company_user()

    logger.info("quick_auth_complete", base_url=base_url)

    return api_client, auth_helper
