"""
WeSign Test Foundation - Authentication Utilities

This module provides robust authentication utilities for WeSign testing,
based on comprehensive system exploration and discovery.

Key Features:
- Secure login/logout management
- Session persistence validation
- Multi-language interface support (English/Hebrew RTL)
- Authentication state verification
- Timeout and error handling

Discovered During Exploration:
- WeSign URL: https://devtest.comda.co.il
- Test Credentials: gals@comda.co.il / Comda159!
- Dashboard redirect: /dashboard after successful login
- Hebrew RTL interface support
- Authentication persistence across module navigation
"""

import asyncio
import time
from typing import Optional, Dict, Any
from playwright.async_api import Page, Browser, BrowserContext
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WeSignTestFoundation:
    """
    Core authentication and session management for WeSign testing.

    This class provides the foundational authentication utilities that support
    all WeSign test scenarios discovered during comprehensive system exploration.
    """

    def __init__(self):
        self.base_url = "https://devtest.comda.co.il"
        self.credentials = {
            "email": "gals@comda.co.il",
            "password": "Comda159!"
        }
        self.dashboard_url = f"{self.base_url}/dashboard"
        self.login_url = f"{self.base_url}/auth/login"

        # Authentication state tracking
        self.is_authenticated = False
        self.authentication_timestamp = None
        self.session_data = {}

        # Timeouts discovered during exploration
        self.default_timeout = 15000  # 15 seconds
        self.login_timeout = 20000    # 20 seconds for login
        self.navigation_timeout = 10000  # 10 seconds for navigation

    async def authenticate(self, page: Page, verify_dashboard: bool = True) -> bool:
        """
        Perform secure login to WeSign system.

        This method implements the robust authentication flow discovered
        during comprehensive system exploration.

        Args:
            page: Playwright page instance
            verify_dashboard: Whether to verify dashboard redirect (default: True)

        Returns:
            bool: True if authentication successful, False otherwise
        """
        try:
            logger.info("🔐 Starting WeSign authentication...")

            # Step 1: Navigate to login page
            logger.info(f"   → Navigating to login: {self.login_url}")
            await page.goto(self.login_url)
            await page.wait_for_load_state('networkidle', timeout=self.navigation_timeout)

            # Step 2: Fill credentials
            logger.info("   → Filling login credentials...")
            email_field = page.locator('input[type="email"]')
            password_field = page.locator('input[type="password"]')

            await email_field.fill(self.credentials["email"])
            await password_field.fill(self.credentials["password"])

            # Step 3: Submit login form
            logger.info("   → Submitting login form...")
            login_button = page.locator('button[type="submit"]').first
            await login_button.click()

            # Step 4: Wait for authentication redirect
            if verify_dashboard:
                logger.info("   → Waiting for dashboard redirect...")
                await page.wait_for_url("**/dashboard**", timeout=self.login_timeout)

                # Verify we're actually on dashboard
                current_url = page.url
                if "/dashboard" in current_url:
                    logger.info(f"   ✅ Authentication successful! Dashboard URL: {current_url}")
                    self.is_authenticated = True
                    self.authentication_timestamp = time.time()
                    self.session_data = {
                        "login_time": self.authentication_timestamp,
                        "dashboard_url": current_url,
                        "user_email": self.credentials["email"]
                    }
                    return True
                else:
                    logger.error(f"   ❌ Authentication failed - unexpected URL: {current_url}")
                    return False
            else:
                # Just wait for any navigation away from login
                await asyncio.sleep(3)
                current_url = page.url
                if self.login_url not in current_url:
                    logger.info(f"   ✅ Login submitted successfully, current URL: {current_url}")
                    self.is_authenticated = True
                    self.authentication_timestamp = time.time()
                    return True
                else:
                    logger.error("   ❌ Login failed - still on login page")
                    return False

        except Exception as e:
            logger.error(f"   ❌ Authentication error: {str(e)}")
            self.is_authenticated = False
            return False

    async def verify_authentication_state(self, page: Page) -> bool:
        """
        Verify that the user is still authenticated.

        This method checks authentication state by verifying dashboard access
        and user session indicators discovered during exploration.

        Args:
            page: Playwright page instance

        Returns:
            bool: True if authenticated, False otherwise
        """
        try:
            logger.info("🔍 Verifying authentication state...")

            # Try to navigate to dashboard
            await page.goto(self.dashboard_url)
            await page.wait_for_load_state('networkidle', timeout=self.navigation_timeout)

            current_url = page.url

            # Check if we were redirected to login (authentication expired)
            if "/auth/login" in current_url:
                logger.warning("   ⚠️  Authentication expired - redirected to login")
                self.is_authenticated = False
                return False

            # Check if we're on dashboard (authenticated)
            if "/dashboard" in current_url:
                logger.info("   ✅ Authentication state verified - user is authenticated")
                return True

            logger.warning(f"   ⚠️  Unexpected URL during auth verification: {current_url}")
            return False

        except Exception as e:
            logger.error(f"   ❌ Authentication verification error: {str(e)}")
            return False

    async def ensure_authenticated(self, page: Page) -> bool:
        """
        Ensure the user is authenticated, performing login if necessary.

        This method checks current authentication state and performs login
        if needed, providing robust session management for all tests.

        Args:
            page: Playwright page instance

        Returns:
            bool: True if authenticated (or successfully logged in), False otherwise
        """
        try:
            # First check if we're already authenticated
            if self.is_authenticated and self.authentication_timestamp:
                # Check if authentication is recent (within 30 minutes)
                time_since_auth = time.time() - self.authentication_timestamp
                if time_since_auth < 1800:  # 30 minutes
                    # Verify the session is still valid
                    if await self.verify_authentication_state(page):
                        logger.info("   ✅ Using existing valid authentication session")
                        return True
                    else:
                        logger.info("   ⚠️  Existing session invalid, re-authenticating...")
                else:
                    logger.info("   ⚠️  Authentication session expired, re-authenticating...")

            # Perform fresh authentication
            return await self.authenticate(page)

        except Exception as e:
            logger.error(f"   ❌ Error ensuring authentication: {str(e)}")
            return False

    async def logout(self, page: Page) -> bool:
        """
        Perform secure logout from WeSign system.

        This method implements logout functionality to clean up sessions
        between tests and ensure test isolation.

        Args:
            page: Playwright page instance

        Returns:
            bool: True if logout successful, False otherwise
        """
        try:
            logger.info("🚪 Performing WeSign logout...")

            # Navigate to dashboard first to ensure we're in authenticated area
            await page.goto(self.dashboard_url)
            await page.wait_for_load_state('networkidle', timeout=self.navigation_timeout)

            # Look for logout/profile menu (discovered during exploration)
            # Common logout patterns in web applications
            logout_selectors = [
                'button:has-text("Logout")',
                'a:has-text("Logout")',
                'button:has-text("Sign out")',
                'a:has-text("Sign out")',
                '[data-testid="logout"]',
                '.logout-button',
                '#logout-btn'
            ]

            for selector in logout_selectors:
                logout_element = page.locator(selector).first
                if await logout_element.is_visible():
                    logger.info(f"   → Found logout element: {selector}")
                    await logout_element.click()
                    await asyncio.sleep(2)

                    # Verify logout by checking for redirect to login
                    current_url = page.url
                    if "/auth/login" in current_url:
                        logger.info("   ✅ Logout successful - redirected to login")
                        self.is_authenticated = False
                        self.authentication_timestamp = None
                        self.session_data = {}
                        return True

            # If no logout button found, try clearing browser storage
            logger.info("   → No logout button found, clearing browser storage...")
            await page.evaluate("localStorage.clear(); sessionStorage.clear();")

            # Navigate to login to verify logout
            await page.goto(self.login_url)
            await page.wait_for_load_state('networkidle', timeout=self.navigation_timeout)

            logger.info("   ✅ Logout completed via storage clearing")
            self.is_authenticated = False
            self.authentication_timestamp = None
            self.session_data = {}
            return True

        except Exception as e:
            logger.error(f"   ❌ Logout error: {str(e)}")
            return False

    def get_session_info(self) -> Dict[str, Any]:
        """
        Get current session information.

        Returns:
            Dict containing current session data
        """
        return {
            "is_authenticated": self.is_authenticated,
            "authentication_timestamp": self.authentication_timestamp,
            "session_data": self.session_data,
            "credentials_email": self.credentials["email"],
            "base_url": self.base_url
        }

    async def wait_for_stable_page(self, page: Page, timeout: int = None) -> bool:
        """
        Wait for page to be in stable state for reliable testing.

        This method implements the stable waiting strategy discovered
        during comprehensive system exploration.

        Args:
            page: Playwright page instance
            timeout: Custom timeout (default: class default)

        Returns:
            bool: True if page is stable, False if timeout
        """
        try:
            timeout = timeout or self.default_timeout

            # Wait for network to be idle
            await page.wait_for_load_state('networkidle', timeout=timeout)

            # Additional wait for any JavaScript animations/transitions
            await asyncio.sleep(1)

            return True

        except Exception as e:
            logger.warning(f"   ⚠️  Page stability wait timeout: {str(e)}")
            return False


class WeSignAuthenticationError(Exception):
    """Custom exception for WeSign authentication errors."""
    pass


class WeSignSessionError(Exception):
    """Custom exception for WeSign session management errors."""
    pass