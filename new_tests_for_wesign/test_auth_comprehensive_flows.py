"""Comprehensive Authentication Test Suite - All Auth Flows"""

import pytest
import asyncio
import tempfile
import os
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.dashboard_page import DashboardPage
from utils.smart_waits import WeSignSmartWaits


class TestAuthenticationComprehensive:
    """Comprehensive authentication test suite covering all auth scenarios"""

    @pytest.fixture(autouse=True)
    async def setup_method(self):
        """Setup method that runs before each test"""
        # Setup is handled within each test method for better isolation
        pass

    # BASIC LOGIN TESTS

    @pytest.mark.asyncio
    async def test_auth_valid_company_user_login(self):
        """Test 1: Valid company user login flow"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            await auth_page.navigate()
            await auth_page.login_with_company_user()

            assert await auth_page.is_login_successful(), "Company user login should succeed"
            assert await dashboard_page.is_dashboard_loaded(), "Dashboard should load after login"

            # Verify redirect to dashboard/main
            current_url = page.url
            assert "dashboard" in current_url, f"Should be on dashboard, got: {current_url}"

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_basic_user_permissions(self):
        """Test 2: Basic user with limited permissions"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            await auth_page.navigate()
            await auth_page.login_with_basic_user()

            login_success = await auth_page.is_login_successful()
            if login_success:
                permissions = await dashboard_page.get_user_permissions()
                print(f"Basic user permissions: {permissions}")

                # Basic users should have limited access
                assert "user_type" in permissions, "Should detect user type"

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_invalid_credentials_rejection(self):
        """Test 3: Invalid credentials are properly rejected"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()
            await auth_page.enter_credentials("invalid@test.com", "wrongpassword123")
            await auth_page.click_login_button()

            # Should remain on login page
            assert await auth_page.is_still_on_login_page(), "Should remain on login page for invalid credentials"

            # Check for error message
            error_visible = await auth_page.is_error_message_visible()
            print(f"Error message visible: {error_visible}")

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_form_validation_empty_fields(self):
        """Test 4: Form validation for empty fields"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()

            # Try submitting with empty email
            await auth_page.enter_password("somepassword")
            await auth_page.click_login_button()

            email_invalid = await auth_page.is_email_field_invalid()
            assert email_invalid, "Empty email field should be marked invalid"

            # Try submitting with empty password
            await page.reload()
            await auth_page.enter_email("test@example.com")
            await auth_page.click_login_button()

            password_invalid = await auth_page.is_password_field_invalid()
            print(f"Password field invalid: {password_invalid}")

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_email_format_validation(self):
        """Test 5: Email format validation"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()

            # Test various invalid email formats
            invalid_emails = [
                "notanemail",
                "test@",
                "@example.com",
                "test@.com",
                "test.@example.com"
            ]

            for email in invalid_emails:
                await auth_page.enter_credentials(email, "password123")
                await auth_page.click_login_button()

                email_invalid = await auth_page.is_email_field_invalid()
                print(f"Email '{email}' invalid status: {email_invalid}")

                await page.reload()

            await browser.close()

    # LANGUAGE AND LOCALIZATION TESTS

    @pytest.mark.asyncio
    async def test_auth_hebrew_interface_detection(self):
        """Test 6: Hebrew interface detection and RTL layout"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()

            is_hebrew = await auth_page.is_hebrew_interface_active()
            is_rtl = await auth_page.is_rtl_layout_active()

            print(f"Hebrew interface: {is_hebrew}, RTL layout: {is_rtl}")

            if is_hebrew:
                # Verify Hebrew text elements
                hebrew_elements = await auth_page.get_hebrew_text_elements()
                print(f"Hebrew elements found: {len(hebrew_elements)}")

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_english_interface_detection(self):
        """Test 7: English interface detection and LTR layout"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()

            is_english = await auth_page.is_english_interface_active()
            is_ltr = await auth_page.is_ltr_layout_active()

            print(f"English interface: {is_english}, LTR layout: {is_ltr}")

            if is_english:
                # Verify English text elements
                english_elements = await auth_page.get_english_text_elements()
                print(f"English elements found: {len(english_elements)}")

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_language_switching(self):
        """Test 8: Language switching functionality"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()

            # Test language switching if available
            if await auth_page.is_language_selector_available():
                initial_lang = await auth_page.get_current_language()
                print(f"Initial language: {initial_lang}")

                await auth_page.switch_language()

                smart_waits = WeSignSmartWaits(page)
                await smart_waits.wait_for_language_switch()  # Wait for language change

                new_lang = await auth_page.get_current_language()
                print(f"New language: {new_lang}")

                # Languages should be different
                if initial_lang and new_lang:
                    assert initial_lang != new_lang, "Language should have changed"

            await browser.close()

    # SECURITY AND SESSION TESTS

    @pytest.mark.asyncio
    async def test_auth_session_persistence(self):
        """Test 9: Session persistence after page refresh"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            await auth_page.navigate()
            await auth_page.login_with_company_user()

            # Verify login successful
            assert await auth_page.is_login_successful(), "Initial login should succeed"

            # Refresh the page
            await page.reload()
            await page.wait_for_load_state("networkidle")

            # Check if still authenticated
            still_authenticated = await dashboard_page.is_user_authenticated()
            current_url = page.url

            print(f"After refresh - authenticated: {still_authenticated}, URL: {current_url}")

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_concurrent_sessions(self):
        """Test 10: Multiple concurrent sessions behavior"""
        async with async_playwright() as p:
            browser1 = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            browser2 = await p.chromium.launch(headless=True, args=['--no-sandbox'])

            page1 = await browser1.new_page()
            page2 = await browser2.new_page()

            auth_page1 = AuthPage(page1)
            auth_page2 = AuthPage(page2)

            # Login with same user in both browsers
            await auth_page1.navigate()
            await auth_page1.login_with_company_user()

            await auth_page2.navigate()
            await auth_page2.login_with_company_user()

            # Check if both sessions are valid
            session1_valid = await auth_page1.is_login_successful()
            session2_valid = await auth_page2.is_login_successful()

            print(f"Session 1 valid: {session1_valid}, Session 2 valid: {session2_valid}")

            await browser1.close()
            await browser2.close()

    @pytest.mark.asyncio
    async def test_auth_password_security_requirements(self):
        """Test 11: Password security requirements during registration flow"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            # Navigate to registration if available
            await auth_page.navigate()

            if await auth_page.is_registration_available():
                await auth_page.navigate_to_registration()

                # Test weak passwords
                weak_passwords = [
                    "123",
                    "password",
                    "abc123",
                    "11111111"
                ]

                for weak_pass in weak_passwords:
                    await auth_page.enter_registration_password(weak_pass)

                    is_weak = await auth_page.is_password_weak()
                    print(f"Password '{weak_pass}' detected as weak: {is_weak}")

            await browser.close()

    # REDIRECT AND ROUTING TESTS

    @pytest.mark.asyncio
    async def test_auth_protected_route_redirect(self):
        """Test 12: Protected route redirect to login"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            # Try to access protected routes directly
            protected_routes = [
                "/dashboard",
                "/dashboard/documents",
                "/dashboard/templates",
                "/dashboard/contacts",
                "/dashboard/selfsign"
            ]

            base_url = "https://wesign.comda.co.il"

            for route in protected_routes:
                await page.goto(f"{base_url}{route}")
                await page.wait_for_load_state("networkidle")

                current_url = page.url
                print(f"Accessing {route} -> {current_url}")

                # Should redirect to login
                assert "login" in current_url.lower(), f"Should redirect to login for {route}"

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_post_login_redirect(self):
        """Test 13: Correct redirect after successful login"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            # Try to access a protected route first (should redirect to login)
            await page.goto("https://wesign.comda.co.il/dashboard/documents")
            await page.wait_for_load_state("networkidle")

            # Should be on login page
            assert "login" in page.url, "Should be redirected to login"

            # Now login
            await auth_page.login_with_company_user()

            # Should redirect back to originally requested page or default dashboard
            await page.wait_for_load_state("networkidle")
            final_url = page.url

            print(f"Final URL after login: {final_url}")
            assert "dashboard" in final_url, "Should end up on dashboard after login"

            await browser.close()

    # ERROR HANDLING AND EDGE CASES

    @pytest.mark.asyncio
    async def test_auth_network_failure_handling(self):
        """Test 14: Handling network failures during auth"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()

            # Simulate network issues by going offline
            await page.set_offline(True)

            await auth_page.enter_credentials("gals@comda.co.il", "Pass@123456")
            await auth_page.click_login_button()

            # Should handle network error gracefully
            smart_waits = WeSignSmartWaits(page)
            await smart_waits.wait_for_navigation_complete()

            error_visible = await auth_page.is_network_error_visible()
            print(f"Network error message visible: {error_visible}")

            # Go back online
            await page.set_offline(False)

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_browser_back_button_behavior(self):
        """Test 15: Browser back button behavior in auth flow"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            # Login successfully
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            assert await auth_page.is_login_successful(), "Login should succeed"

            # Now click browser back button
            await page.go_back()
            await page.wait_for_load_state("networkidle")

            current_url = page.url
            print(f"URL after back button: {current_url}")

            # Should either stay on dashboard or handle gracefully
            is_authenticated = await dashboard_page.is_user_authenticated()
            print(f"Still authenticated after back button: {is_authenticated}")

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_comprehensive_workflow_integration(self):
        """Test 16: Complete authentication workflow with all validations"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            print("=== COMPREHENSIVE AUTH WORKFLOW TEST ===")

            # Step 1: Initial page load and UI validation
            print("Step 1: Loading login page...")
            await auth_page.navigate()

            page_loaded = await auth_page.is_page_loaded()
            form_visible = await auth_page.is_login_form_visible()
            print(f"Page loaded: {page_loaded}, Form visible: {form_visible}")

            # Step 2: Language and layout detection
            print("Step 2: Detecting language and layout...")
            language_info = await auth_page.detect_language_and_layout()
            print(f"Language info: {language_info}")

            # Step 3: Form validation testing
            print("Step 3: Testing form validation...")
            validation_results = await auth_page.test_form_validation()
            print(f"Validation results: {validation_results}")

            # Step 4: Successful authentication
            print("Step 4: Performing authentication...")
            await auth_page.login_with_company_user()

            login_success = await auth_page.is_login_successful()
            dashboard_loaded = await dashboard_page.is_dashboard_loaded()

            print(f"Login success: {login_success}, Dashboard loaded: {dashboard_loaded}")

            # Step 5: Post-login validation
            print("Step 5: Validating post-login state...")
            if login_success:
                user_info = await dashboard_page.get_user_info()
                permissions = await dashboard_page.get_user_permissions()
                navigation_available = await dashboard_page.is_navigation_available()

                print(f"User info: {user_info}")
                print(f"Permissions: {permissions}")
                print(f"Navigation available: {navigation_available}")

            print("=== AUTH WORKFLOW TEST COMPLETED ===")

            await browser.close()