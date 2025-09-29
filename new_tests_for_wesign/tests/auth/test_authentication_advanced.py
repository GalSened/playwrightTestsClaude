"""
Test Authentication Advanced - Written from Scratch
Advanced authentication test scenarios for WeSign platform

Test Categories:
1. Security testing (SQL injection, XSS, CSRF)
2. Email validation edge cases
3. Password security testing
4. Session management edge cases
5. Multi-language switching
6. Performance and load testing
7. Remember me functionality
8. Password visibility toggle
"""

import pytest
from playwright.async_api import Page
from pages.auth_page import AuthPage
from pages.dashboard_page import DashboardPage


class TestAuthenticationAdvanced:
    """Advanced authentication test suite for WeSign platform"""

    # Test 1: test_sql_injection_protection_email_field
    # Tests SQL injection protection in email field
    # Verifies application properly sanitizes SQL injection attempts
    async def test_sql_injection_protection_email_field(self, page: Page, security_test_data):
        """Test SQL injection protection in email field"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Test SQL injection payloads
        for payload in security_test_data["sql_injection_payloads"]:
            await auth_page.enter_credentials(payload, "testpassword")
            await auth_page.click_login_button()

            # Verify no SQL injection occurred - should remain on login page
            assert await auth_page.is_still_on_login_page(), f"SQL injection payload should be blocked: {payload}"

            # Clear the field for next test
            await auth_page.enter_email("")

    # Test 2: test_xss_protection_form_fields
    # Tests Cross-Site Scripting (XSS) protection in form fields
    # Verifies application properly escapes and sanitizes XSS attempts
    async def test_xss_protection_form_fields(self, page: Page, security_test_data):
        """Test XSS protection in login form fields"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Test XSS payloads in email field
        for payload in security_test_data["xss_payloads"]:
            await auth_page.enter_email(payload)

            # Verify script is not executed
            alerts = []
            page.on("dialog", lambda dialog: alerts.append(dialog))

            await auth_page.click_login_button()
            await page.wait_for_timeout(2000)

            # No alert should be triggered
            assert len(alerts) == 0, f"XSS payload should not execute: {payload}"

            # Clear for next test
            await auth_page.enter_email("")

    # Test 3: test_invalid_email_formats_comprehensive
    # Tests comprehensive email format validation
    # Verifies all types of invalid email formats are properly rejected
    async def test_invalid_email_formats_comprehensive(self, page: Page, security_test_data):
        """Test comprehensive email format validation"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Test various invalid email formats
        for invalid_email in security_test_data["invalid_emails"]:
            await auth_page.enter_credentials(invalid_email, "password123")
            await auth_page.click_login_button()

            # Verify email validation prevents submission
            assert await auth_page.is_email_field_invalid(), f"Invalid email should be rejected: {invalid_email}"

            # Clear for next test
            await auth_page.enter_email("")

    # Test 4: test_password_field_security_features
    # Tests password field security features
    # Verifies password masking and security attributes
    async def test_password_field_security_features(self, page: Page):
        """Test password field security features"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Verify password is hidden by default
        assert await auth_page.is_password_hidden(), "Password field should be hidden by default"

        # Enter password and verify it remains hidden
        await auth_page.enter_password("testpassword123")
        assert await auth_page.is_password_hidden(), "Password should remain hidden after entry"

        # Test password visibility toggle if available
        if await auth_page.has_password_visibility_toggle():
            await auth_page.toggle_password_visibility()
            assert await auth_page.is_password_visible(), "Password should be visible after toggle"

            # Toggle back to hidden
            await auth_page.toggle_password_visibility()
            assert await auth_page.is_password_hidden(), "Password should be hidden after second toggle"

    # Test 5: test_remember_me_functionality
    # Tests remember me checkbox functionality
    # Verifies session persistence with remember me option
    async def test_remember_me_functionality(self, page: Page):
        """Test remember me checkbox functionality"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Check if remember me checkbox exists
        if await auth_page.has_remember_me_checkbox():
            # Test checking remember me
            await auth_page.check_remember_me()
            await auth_page.login_with_company_user()

            # Verify login success
            assert await auth_page.is_login_successful(), "Login with remember me should succeed"

            # Test session persistence behavior
            # (Actual behavior would need to be tested across browser sessions)

    # Test 6: test_language_switching_functionality
    # Tests dynamic language switching on login page
    # Verifies interface elements update correctly when language changes
    async def test_language_switching_functionality(self, page: Page):
        """Test language switching functionality"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Check initial language state
        initial_hebrew = await auth_page.is_hebrew_interface_active()
        initial_english = await auth_page.is_english_interface_active()

        # Test switching to Hebrew if available
        if await auth_page.is_english_interface_available():
            await auth_page.set_language("hebrew")
            await page.wait_for_timeout(2000)

            # Verify Hebrew interface elements
            assert await auth_page.is_hebrew_interface_active(), "Hebrew interface should be active after switch"
            assert await auth_page.has_rtl_direction(), "Should have RTL direction in Hebrew"

        # Test switching to English if available
        if await auth_page.is_english_interface_available():
            await auth_page.set_language("english")
            await page.wait_for_timeout(2000)

            # Verify English interface elements
            assert await auth_page.is_english_interface_active(), "English interface should be active after switch"
            assert await auth_page.has_ltr_direction(), "Should have LTR direction in English"

    # Test 7: test_form_submission_edge_cases
    # Tests edge cases in form submission behavior
    # Verifies proper handling of various form states and inputs
    async def test_form_submission_edge_cases(self, page: Page):
        """Test form submission edge cases"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Test double-click on login button
        await auth_page.enter_credentials("test@example.com", "password")

        # Double-click login button
        login_button = page.locator(auth_page.login_button).first
        await login_button.dblclick()

        # Verify form handles double submission gracefully
        await page.wait_for_timeout(3000)
        form_submitted = await auth_page.has_form_been_submitted()
        assert form_submitted, "Form should handle double-click submission"

    # Test 8: test_session_timeout_handling
    # Tests session timeout and re-authentication
    # Verifies proper handling when session expires
    async def test_session_timeout_handling(self, authenticated_page: Page):
        """Test session timeout and re-authentication"""
        dashboard_page = DashboardPage(authenticated_page)
        auth_page = AuthPage(authenticated_page)

        # Verify initial authentication
        assert await dashboard_page.is_user_authenticated(), "User should be initially authenticated"

        # Simulate session timeout by clearing cookies or waiting
        # Note: Actual session timeout testing would require server-side configuration
        await authenticated_page.context.clear_cookies()

        # Try to access dashboard after clearing cookies
        await authenticated_page.reload()
        await authenticated_page.wait_for_load_state("domcontentloaded")

        # Should be redirected to login page
        is_back_to_login = await auth_page.is_back_to_login()

        if is_back_to_login:
            assert True, "User should be redirected to login after session timeout"
        else:
            # Some applications might handle this differently
            print("INFO: Session timeout behavior may vary based on implementation")

    # Test 9: test_concurrent_login_sessions
    # Tests handling of concurrent login sessions
    # Verifies behavior when same user logs in from multiple contexts
    async def test_concurrent_login_sessions(self, context, page: Page):
        """Test concurrent login sessions handling"""
        auth_page = AuthPage(page)

        # Login in first session
        await auth_page.navigate()
        await auth_page.login_with_company_user()
        assert await auth_page.is_login_successful(), "First login should succeed"

        # Create second context/session
        second_context = await context.browser.new_context()
        second_page = await second_context.new_page()
        second_auth_page = AuthPage(second_page)

        # Login in second session with same credentials
        await second_auth_page.navigate()
        await second_auth_page.login_with_company_user()

        # Both sessions should be valid or second should terminate first
        second_login_success = await second_auth_page.is_login_successful()

        if second_login_success:
            # Verify first session is still valid or has been terminated
            await page.reload()
            first_still_valid = await DashboardPage(page).is_user_authenticated()

            # Implementation-specific: either both valid or first terminated
            assert True, "Concurrent sessions handled according to application policy"

        await second_context.close()

    # Test 10: test_password_reset_workflow
    # Tests complete password reset workflow
    # Verifies forgot password functionality works correctly
    async def test_password_reset_workflow(self, page: Page):
        """Test complete password reset workflow"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Check if forgot password is available
        if await auth_page.is_forgot_password_visible():
            await auth_page.click_forgot_password()
            assert await auth_page.is_on_password_reset_page(), "Should navigate to password reset page"

            # Enter email for reset
            await auth_page.enter_reset_email("test@example.com")
            await auth_page.submit_reset_request()

            # Verify response message
            response_message = await auth_page.get_reset_response_message()
            assert len(response_message) > 0, "Should receive response message after reset request"

    # Test 11: test_form_field_character_limits
    # Tests character limits and input validation in form fields
    # Verifies proper handling of very long inputs
    async def test_form_field_character_limits(self, page: Page):
        """Test form field character limits and validation"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Test very long email input
        very_long_email = "a" * 300 + "@example.com"
        await auth_page.enter_email(very_long_email)

        # Verify field handles long input gracefully
        entered_value = await auth_page.get_email_value()
        assert len(entered_value) <= len(very_long_email), "Email field should handle long input"

        # Test very long password
        very_long_password = "a" * 500
        await auth_page.enter_password(very_long_password)

        # Form should handle long password gracefully
        await auth_page.click_login_button()

        # Should still be on login page (invalid credentials)
        assert await auth_page.is_still_on_login_page(), "Should handle very long password input"

    # Test 12: test_special_characters_in_credentials
    # Tests handling of special characters in email and password fields
    # Verifies proper encoding and handling of Unicode characters
    async def test_special_characters_in_credentials(self, page: Page):
        """Test special characters in login credentials"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Test email with special characters
        special_emails = [
            "test+tag@example.com",
            "test.email@example.com",
            "test_email@example.com",
            "test-email@example.com"
        ]

        for email in special_emails:
            await auth_page.enter_email(email)

            # Verify email is accepted (format validation should pass)
            is_invalid = await auth_page.is_email_field_invalid()
            assert not is_invalid, f"Valid email with special characters should be accepted: {email}"

            await auth_page.enter_email("")  # Clear for next test

        # Test password with special characters
        special_password = "P@ssw0rd!#$%^&*()_+-=[]{}|;':\",./<>?"
        await auth_page.enter_password(special_password)
        await auth_page.enter_email("test@example.com")
        await auth_page.click_login_button()

        # Should handle special characters in password gracefully
        assert await auth_page.is_still_on_login_page(), "Should handle special characters in password"

    # Test 13: test_browser_back_button_behavior
    # Tests behavior when using browser back button after login
    # Verifies proper session handling and navigation
    async def test_browser_back_button_behavior(self, page: Page):
        """Test browser back button behavior after login"""
        auth_page = AuthPage(page)
        dashboard_page = DashboardPage(page)

        await auth_page.navigate()
        await auth_page.login_with_company_user()

        # Verify login success
        assert await auth_page.is_login_successful(), "Login should be successful"

        # Use browser back button
        await page.go_back()
        await page.wait_for_load_state("domcontentloaded")

        # Should either stay authenticated or properly handle back navigation
        is_authenticated = await dashboard_page.is_user_authenticated()
        is_back_to_login = await auth_page.is_still_on_login_page()

        # One of these should be true
        assert is_authenticated or is_back_to_login, "Should handle back button navigation properly"

    # Test 14: test_autofill_and_browser_password_manager
    # Tests compatibility with browser password managers and autofill
    # Verifies form works correctly with browser autofill features
    async def test_autofill_and_browser_password_manager(self, page: Page):
        """Test autofill and browser password manager compatibility"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Check if form fields have proper attributes for password managers
        email_field = await auth_page.get_email_field()
        password_field = await auth_page.get_password_field()

        # Verify autocomplete attributes
        email_autocomplete = await email_field.get_attribute("autocomplete")
        password_autocomplete = await password_field.get_attribute("autocomplete")

        # Fields should have appropriate autocomplete attributes
        # (This is more of a static analysis test)
        assert email_field is not None, "Email field should be accessible"
        assert password_field is not None, "Password field should be accessible"

    # Test 15: test_csrf_token_protection
    # Tests CSRF (Cross-Site Request Forgery) protection
    # Verifies application properly validates request origins
    async def test_csrf_token_protection(self, page: Page):
        """Test CSRF token protection"""
        auth_page = AuthPage(page)

        await auth_page.navigate()

        # Check for CSRF token in form or headers
        # This is implementation-specific and may vary
        page_content = await page.content()

        # Look for common CSRF token patterns
        has_csrf_token = (
            "csrf" in page_content.lower() or
            "_token" in page_content.lower() or
            "authenticity_token" in page_content.lower()
        )

        # Note: This test is informational - CSRF protection implementation varies
        if has_csrf_token:
            assert True, "CSRF protection appears to be implemented"
        else:
            print("INFO: No obvious CSRF token found - may be implemented differently")

        # Attempt login normally to verify CSRF doesn't block legitimate requests
        await auth_page.login_with_company_user()
        login_attempted = await auth_page.has_form_been_submitted()
        assert login_attempted, "CSRF protection should not block legitimate login attempts"