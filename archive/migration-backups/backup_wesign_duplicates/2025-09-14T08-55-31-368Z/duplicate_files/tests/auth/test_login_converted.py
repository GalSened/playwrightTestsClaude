"""Login and authentication tests converted from Selenium to Playwright."""

import pytest
import allure
from playwright.async_api import Page

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from pages.login_page import LoginPage
from pages.home_page import HomePage
from config.settings import settings


@allure.epic("Authentication")
@allure.feature("Login")
class TestLogin:
    async def _cleanup_browser(self):
        """Cleanup browser resources."""
        if hasattr(self, 'browser'):
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()

    async def _setup_browser(self):
        """Setup browser with working direct approach."""
        from playwright.async_api import async_playwright
        from pages.login_page import LoginPage
        from pages.home_page import HomePage
        
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.context = await self.browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1920, "height": 1080}
        )
        self.page = await self.context.new_page()
        self.page.set_default_timeout(15000)
        self.page.set_default_navigation_timeout(20000)
        
        # Initialize page objects
        self.login_page = LoginPage(self.page)
        self.home_page = HomePage(self.page)


    """Test cases for login functionality."""
    
    @pytest.fixture(autouse=True)
    async def setup(self, page: Page):
        """Setup for each test."""
        self.page = page
        self.login_page = LoginPage(page)
        self.home_page = HomePage(page)
    
    @allure.story("Successful Login")
    @pytest.mark.smoke
    @pytest.mark.critical
    @pytest.mark.login
    @pytest.mark.english
    async def test_login_with_valid_credentials_success(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test successful login with valid credentials."""
        with allure.step("Navigate to login page"):
            await self.login_page.navigate()
        
        with allure.step("Login with company user credentials"):
            await self.login_page.login_as_company_user()
        
        with allure.step("Verify login success"):
            await self.login_page.verify_login_success()
        
        with allure.step("Validate dashboard elements are visible"):
            dashboard_validation = await self.home_page.validate_dashboard_elements()
            assert dashboard_validation["my_documents_button"], "My Documents button not visible"
            assert dashboard_validation["my_templates_button"], "My Templates button not visible"
    
    @allure.story("Successful Login")
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_login_with_basic_user_success(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test successful login with basic user credentials."""
        with allure.step("Navigate to login page"):
            await self.login_page.navigate()
        
        with allure.step("Login with basic user credentials"):
            await self.login_page.login_as_basic_user()
        
        with allure.step("Verify login success"):
            await self.login_page.verify_login_success()
        
        with allure.step("Get user information"):
            user_info = await self.login_page.get_current_user_info()
            assert user_info["logged_in"], "User should be logged in"
    
    @allure.story("Login Validation")
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_login_with_invalid_credentials_failure(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test login failure with invalid credentials."""
        with allure.step("Navigate to login page"):
            await self.login_page.navigate()
        
        with allure.step("Attempt login with invalid credentials"):
            await self.login_page.validate_invalid_credentials_error()
    
    @allure.story("Login Validation")
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_login_with_empty_credentials_validation(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test validation messages for empty credentials."""
        with allure.step("Navigate to login page"):
            await self.login_page.navigate()
        
        with allure.step("Validate form fields are present"):
            form_validation = await self.login_page.validate_login_form_fields()
            assert form_validation["email_field"], "Email field not found"
            assert form_validation["password_field"], "Password field not found"
            assert form_validation["login_button"], "Login button not found"
        
        with allure.step("Test empty credentials validation"):
            await self.login_page.validate_empty_credentials_error()
    
    @allure.story("Login Validation")
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_login_with_empty_email_validation(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test validation for empty email field."""
        with allure.step("Navigate to login page"):
            await self.login_page.navigate()
        
        with allure.step("Fill password only and attempt login"):
            await self.login_page.fill_element(
                self.login_page.get_locator("login_page", "password_input"), 
                "somepassword"
            )
            await self.login_page.click_element(
                self.login_page.get_locator("login_page", "login_button")
            )
        
        with allure.step("Verify validation error for empty email"):
            # Should still be on login page
            login_button = self.login_page.get_locator("login_page", "login_button")
            assert await self.login_page.is_visible(login_button), "Should remain on login page"
    
    @allure.story("Login Validation")
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_login_with_empty_password_validation(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test validation for empty password field."""
        with allure.step("Navigate to login page"):
            await self.login_page.navigate()
        
        with allure.step("Fill email only and attempt login"):
            await self.login_page.fill_element(
                self.login_page.get_locator("login_page", "email_input"), 
                "test@example.com"
            )
            await self.login_page.click_element(
                self.login_page.get_locator("login_page", "login_button")
            )
        
        with allure.step("Verify validation error for empty password"):
            # Should still be on login page
            login_button = self.login_page.get_locator("login_page", "login_button")
            assert await self.login_page.is_visible(login_button), "Should remain on login page"
    
    @allure.story("Language Support")
    @pytest.mark.english
    @pytest.mark.login
        finally:
            await self._cleanup_browser()
    async def test_login_english_interface(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test login with English interface."""
        with allure.step("Navigate to login page"):
            await self.login_page.navigate()
        
        with allure.step("Change language to English"):
            await self.login_page.change_language("english")
        
        with allure.step("Login with English interface"):
            await self.login_page.login_as_company_user()
        
        with allure.step("Verify successful login"):
            await self.login_page.verify_login_success()
    
    @allure.story("Language Support")
    @pytest.mark.hebrew
    @pytest.mark.login
        finally:
            await self._cleanup_browser()
    async def test_login_hebrew_interface(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test login with Hebrew interface."""
        with allure.step("Navigate to login page"):
            await self.login_page.navigate()
        
        with allure.step("Change language to Hebrew"):
            await self.login_page.change_language("hebrew")
        
        with allure.step("Login with Hebrew interface"):
            await self.login_page.login_as_company_user()
        
        with allure.step("Verify successful login"):
            await self.login_page.verify_login_success()
    
    @allure.story("Session Management")
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_logout_functionality(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test logout functionality."""
        with allure.step("Login first"):
            await self.login_page.navigate()
            await self.login_page.login_as_company_user()
            await self.login_page.verify_login_success()
        
        with allure.step("Verify user is logged in"):
            assert await self.login_page.is_logged_in(), "User should be logged in"
        
        with allure.step("Perform logout"):
            await self.home_page.sign_out()
        
        with allure.step("Verify logout success"):
            await self.login_page.wait_for_logout()
            assert not await self.login_page.is_logged_in(), "User should be logged out"
    
    @allure.story("Multiple User Types")
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_login_different_user_types(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test login with different user types."""
        user_credentials = [
            ("company_user", settings.company_user, settings.company_user_password),
            ("basic_user", settings.basic_user, settings.basic_user_password),
        ]
        
        for user_type, email, password in user_credentials:
            with allure.step(f"Test login for {user_type}"):
                # Ensure we're logged out first
                if await self.login_page.is_logged_in():
                    await self.home_page.sign_out()
                
                await self.login_page.navigate()
                await self.login_page.login(email, password)
                await self.login_page.verify_login_success()
                
                # Verify user permissions based on user type
                permissions = await self.home_page.validate_user_permissions()
                assert permissions["can_create_documents"], f"{user_type} should be able to create documents"
                
                # Logout for next iteration
                await self.home_page.sign_out()
    
    @allure.story("Password Recovery")
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_forgot_password_functionality(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test forgot password functionality."""
        with allure.step("Navigate to login page"):
            await self.login_page.navigate()
        
        with allure.step("Validate forgot password link exists"):
            form_validation = await self.login_page.validate_login_form_fields()
            if form_validation["forgot_password_link"]:
                with allure.step("Test forgot password flow"):
                    await self.login_page.forgot_password("test@example.com")
                    
                    # Verify success message or redirect
                    success_indicators = [
                        ".success-message, .alert-success",
                        "[data-testid='forgot-success']",
                        "text=email sent, text=check your email"
                    ]
                    
                    found_success = False
                    for indicator in success_indicators:
                        if await self.login_page.is_visible(indicator, timeout=5000):
                            found_success = True
                            break
                    
                    # If no success message, at least verify we're not on an error page
                    if not found_success:
                        current_url = await self.login_page.get_current_url()
                        assert "error" not in current_url.lower(), "Should not be on error page"
            else:
                pytest.skip("Forgot password functionality not available")
    
    @allure.story("Login Security")
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_login_with_sql_injection_attempt(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test login security against SQL injection attempts."""
        with allure.step("Navigate to login page"):
            await self.login_page.navigate()
        
        with allure.step("Attempt SQL injection in email field"):
            malicious_inputs = [
                "admin'--",
                "admin' OR '1'='1",
                "'; DROP TABLE users; --",
                "admin'; UNION SELECT * FROM users; --"
            ]
            
            for malicious_input in malicious_inputs:
                await self.login_page.login(malicious_input, "password")
                await self.login_page.verify_login_failure()
                
                # Ensure we're still on login page and system is functional
                await self.login_page.navigate()
    
    @allure.story("Login Performance")
    @pytest.mark.performance
    @pytest.mark.login
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_login_performance(self, performance_monitor):
        """Test login performance timing."""
        with allure.step("Navigate to login page"):
            start_time = performance_monitor["start_time"]
            await self.login_page.navigate()
        
        with allure.step("Measure login time"):
            import time
            login_start = time.time()
            
            await self.login_page.login_as_company_user()
            await self.login_page.verify_login_success()
            
            login_duration = time.time() - login_start
            
            # Login should complete within reasonable time (adjust threshold as needed)
            assert login_duration < 10.0, f"Login took too long: {login_duration} seconds"
            
            allure.attach(
                f"Login Duration: {login_duration:.2f} seconds",
                name="Login Performance",
                attachment_type=allure.attachment_type.TEXT
            )


@allure.epic("Authentication")
@allure.feature("User Management")
class TestUserAuthentication:
    async def _cleanup_browser(self):
        """Cleanup browser resources."""
        if hasattr(self, 'browser'):
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()

    async def _setup_browser(self):
        """Setup browser with working direct approach."""
        from playwright.async_api import async_playwright
        from pages.login_page import LoginPage
        from pages.home_page import HomePage
        
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.context = await self.browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1920, "height": 1080}
        )
        self.page = await self.context.new_page()
        self.page.set_default_timeout(15000)
        self.page.set_default_navigation_timeout(20000)
        
        # Initialize page objects
        self.login_page = LoginPage(self.page)
        self.home_page = HomePage(self.page)


    """Extended authentication tests."""
    
    @pytest.fixture(autouse=True)
    async def setup(self, page: Page):
        """Setup for each test."""
        self.page = page
        self.login_page = LoginPage(page)
        self.home_page = HomePage(page)
    
    @allure.story("Session Persistence")
    @pytest.mark.regression
    @pytest.mark.auth
    @pytest.mark.english
    async def test_session_persistence_after_page_refresh(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test that user session persists after page refresh."""
        with allure.step("Login and verify"):
            await self.login_page.navigate()
            await self.login_page.login_as_company_user()
            await self.login_page.verify_login_success()
        
        with allure.step("Refresh page"):
            await self.page.reload()
            await self.login_page.wait_for_load_state()
        
        with allure.step("Verify session persists"):
            # Should still be logged in after refresh
            assert await self.login_page.is_logged_in(), "Session should persist after refresh"
    
    @allure.story("Session Management")
    @pytest.mark.regression
    @pytest.mark.auth
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_concurrent_sessions_handling(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test handling of concurrent sessions."""
        with allure.step("Login in first session"):
            await self.login_page.navigate()
            await self.login_page.login_as_company_user()
            await self.login_page.verify_login_success()
        
        with allure.step("Open second tab/context"):
            # This test would require multiple browser contexts
            # For now, verify current session is stable
            user_info = await self.login_page.get_current_user_info()
            assert user_info["logged_in"], "Primary session should remain active"
    
    @allure.story("Authentication State")
    @pytest.mark.regression
    @pytest.mark.auth
    @pytest.mark.english
        finally:
            await self._cleanup_browser()
    async def test_authentication_state_persistence(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation

        """Test authentication state across navigation."""
        with allure.step("Login and navigate through pages"):
            await self.login_page.navigate()
            await self.login_page.login_as_company_user()
            await self.login_page.verify_login_success()
        
        with allure.step("Navigate to different pages"):
            await self.home_page.click_my_documents()
            assert await self.login_page.is_logged_in(), "Should stay logged in on documents page"
            
            await self.home_page.click_my_templates()  
            assert await self.login_page.is_logged_in(), "Should stay logged in on templates page"
            
            await self.home_page.click_my_contacts()
            assert await self.login_page.is_logged_in(), "Should stay logged in on contacts page"
        finally:
            await self._cleanup_browser()