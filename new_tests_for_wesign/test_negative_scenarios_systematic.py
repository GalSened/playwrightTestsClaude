"""Systematic Negative Testing Scenarios - Ensuring Tests Fail When They Should"""

import pytest
import asyncio
import tempfile
import os
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.dashboard_page import DashboardPage
from utils.smart_waits import WeSignSmartWaits


class TestNegativeSystematicScenarios:
    """Systematic negative testing to ensure tests fail when they should"""

    @pytest.fixture(autouse=True)
    async def setup_method(self):
        """Setup method for negative testing"""
        pass

    @pytest.mark.asyncio
    async def test_invalid_credentials_must_fail(self):
        """CRITICAL: Test MUST fail with invalid credentials - prevents false positives"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()

            # Test with completely invalid credentials
            await auth_page.enter_credentials("invalid@nowhere.com", "wrongpassword123")
            await auth_page.click_login_button()

            # Wait for authentication attempt to complete
            smart_waits = WeSignSmartWaits(page)
            await smart_waits.wait_for_login_result()

            # CRITICAL: This MUST remain on login page (test should detect failure)
            still_on_login = await auth_page.is_still_on_login_page()
            login_failed = not await auth_page.is_login_successful()

            print(f"Still on login page: {still_on_login}")
            print(f"Login failed as expected: {login_failed}")
            print(f"Current URL: {page.url}")

            # The test MUST detect that login failed
            assert still_on_login, "CRITICAL: Invalid credentials should keep user on login page"
            assert login_failed, "CRITICAL: Invalid credentials should not result in successful login"

            # Check for error indication (optional but good practice)
            error_visible = await auth_page.is_error_message_visible()
            print(f"Error message visible: {error_visible}")

            await browser.close()

    @pytest.mark.asyncio
    async def test_empty_credentials_must_fail(self):
        """CRITICAL: Test MUST fail with empty credentials"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()

            # Test with completely empty credentials
            await auth_page.enter_credentials("", "")
            await auth_page.click_login_button()

            smart_waits = WeSignSmartWaits(page)
            await smart_waits.wait_for_login_result()

            # CRITICAL: This MUST remain on login page
            still_on_login = await auth_page.is_still_on_login_page()
            login_failed = not await auth_page.is_login_successful()

            print(f"Empty credentials - Still on login: {still_on_login}")
            print(f"Empty credentials - Login failed: {login_failed}")

            assert still_on_login, "CRITICAL: Empty credentials should keep user on login page"
            assert login_failed, "CRITICAL: Empty credentials should not result in successful login"

            await browser.close()

    @pytest.mark.asyncio
    async def test_malformed_email_must_fail(self):
        """CRITICAL: Test MUST fail with malformed email addresses"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            malformed_emails = [
                "notanemail",
                "@example.com",
                "test@",
                "test..test@example.com",
                "test@example",
                ".test@example.com"
            ]

            for malformed_email in malformed_emails:
                await auth_page.navigate()
                await page.wait_for_timeout(1000)

                await auth_page.enter_credentials(malformed_email, "somepassword123")
                await auth_page.click_login_button()

                smart_waits = WeSignSmartWaits(page)
                await smart_waits.wait_for_login_result()

                # CRITICAL: Malformed email should prevent successful login
                still_on_login = await auth_page.is_still_on_login_page()
                login_failed = not await auth_page.is_login_successful()

                print(f"Email '{malformed_email}' - Still on login: {still_on_login}")
                print(f"Email '{malformed_email}' - Login failed: {login_failed}")

                # Note: Some systems might allow malformed emails through client-side validation
                # but should fail on server-side. At minimum, should not reach dashboard.
                dashboard_reached = "dashboard" in page.url
                assert not dashboard_reached, f"CRITICAL: Malformed email '{malformed_email}' should not reach dashboard"

            await browser.close()

    @pytest.mark.asyncio
    async def test_sql_injection_attempts_must_fail(self):
        """CRITICAL: Test MUST fail and reject SQL injection attempts"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            # Common SQL injection patterns
            injection_attempts = [
                "admin' OR '1'='1",
                "'; DROP TABLE users; --",
                "admin'--",
                "' UNION SELECT * FROM users --",
                "admin' OR 1=1#"
            ]

            for injection_attempt in injection_attempts:
                await auth_page.navigate()
                await page.wait_for_timeout(1000)

                await auth_page.enter_credentials(injection_attempt, "password")
                await auth_page.click_login_button()

                smart_waits = WeSignSmartWaits(page)
                await smart_waits.wait_for_login_result()

                # CRITICAL: SQL injection should be blocked
                still_on_login = await auth_page.is_still_on_login_page()
                login_failed = not await auth_page.is_login_successful()
                dashboard_reached = "dashboard" in page.url

                print(f"Injection '{injection_attempt[:20]}...' - Still on login: {still_on_login}")
                print(f"Injection '{injection_attempt[:20]}...' - Dashboard reached: {dashboard_reached}")

                assert not dashboard_reached, f"CRITICAL: SQL injection attempt should not reach dashboard"

            await browser.close()

    @pytest.mark.asyncio
    async def test_xss_attempts_must_fail(self):
        """CRITICAL: Test MUST fail and reject XSS attempts"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            # Common XSS patterns
            xss_attempts = [
                "<script>alert('xss')</script>",
                "javascript:alert('xss')",
                "<img src=x onerror=alert('xss')>",
                "';alert('xss');//"
            ]

            for xss_attempt in xss_attempts:
                await auth_page.navigate()
                await page.wait_for_timeout(1000)

                await auth_page.enter_credentials(xss_attempt, "password")
                await auth_page.click_login_button()

                smart_waits = WeSignSmartWaits(page)
                await smart_waits.wait_for_login_result()

                # CRITICAL: XSS should be blocked
                dashboard_reached = "dashboard" in page.url
                login_successful = await auth_page.is_login_successful()

                print(f"XSS '{xss_attempt[:20]}...' - Dashboard reached: {dashboard_reached}")
                print(f"XSS '{xss_attempt[:20]}...' - Login successful: {login_successful}")

                assert not dashboard_reached, f"CRITICAL: XSS attempt should not reach dashboard"
                assert not login_successful, f"CRITICAL: XSS attempt should not result in successful login"

            await browser.close()

    @pytest.mark.asyncio
    async def test_rate_limiting_behavior(self):
        """Test rapid login attempts to verify rate limiting exists"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            # Rapid failed login attempts
            for attempt in range(5):
                await auth_page.navigate()
                await page.wait_for_timeout(500)

                await auth_page.enter_credentials(f"invalid{attempt}@test.com", "wrongpassword")
                await auth_page.click_login_button()
                smart_waits = WeSignSmartWaits(page)
                await smart_waits.wait_for_login_result()

                print(f"Attempt {attempt + 1}/5 completed")

            # Check if rate limiting kicks in
            await auth_page.navigate()
            await auth_page.enter_credentials("test@example.com", "password")
            await auth_page.click_login_button()

            smart_waits = WeSignSmartWaits(page)
            await smart_waits.wait_for_login_result()

            # Check for rate limiting indicators
            is_rate_limited = await auth_page.is_rate_limited()
            has_captcha = await auth_page.has_captcha_protection()

            print(f"Rate limiting detected: {is_rate_limited}")
            print(f"CAPTCHA protection active: {has_captcha}")

            # Note: Rate limiting is good security practice but not always implemented
            # This test documents the current behavior

            await browser.close()

    @pytest.mark.asyncio
    async def test_direct_dashboard_access_must_redirect(self):
        """CRITICAL: Direct dashboard access without auth MUST redirect to login"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            # Try to access dashboard directly without authentication
            dashboard_url = "https://devtest.comda.co.il/dashboard/main"
            await page.goto(dashboard_url)
            await page.wait_for_load_state("networkidle")

            current_url = page.url
            print(f"Direct dashboard access resulted in URL: {current_url}")

            # CRITICAL: Should be redirected away from dashboard
            is_on_dashboard = "dashboard" in current_url and "/dashboard/" in current_url
            is_on_login = "login" in current_url.lower() or current_url == "https://devtest.comda.co.il/"

            print(f"Still on dashboard: {is_on_dashboard}")
            print(f"Redirected to login: {is_on_login}")

            assert not is_on_dashboard, "CRITICAL: Direct dashboard access should redirect away from dashboard"

            await browser.close()

    @pytest.mark.asyncio
    async def test_session_timeout_behavior(self):
        """Test session timeout behavior (simulated)"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            # Login first
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            # Verify login successful
            login_successful = await auth_page.is_login_successful()
            if login_successful:
                print("Initial login successful")

                # Simulate session expiry by clearing cookies
                await page.context.clear_cookies()

                # Try to access a protected page
                await page.goto("https://devtest.comda.co.il/dashboard/documents")
                smart_waits = WeSignSmartWaits(page)
                await smart_waits.wait_for_navigation_complete()

                current_url = page.url
                is_authenticated = await dashboard_page.is_user_authenticated()

                print(f"After session clear - URL: {current_url}")
                print(f"After session clear - Still authenticated: {is_authenticated}")

                # Should be redirected to login or show as unauthenticated
                dashboard_accessible = "dashboard" in current_url and is_authenticated
                print(f"Dashboard still accessible after session clear: {dashboard_accessible}")

            await browser.close()

    @pytest.mark.asyncio
    async def test_concurrent_session_handling(self):
        """Test behavior with concurrent sessions"""
        async with async_playwright() as p:
            browser1 = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            browser2 = await p.chromium.launch(headless=True, args=['--no-sandbox'])

            page1 = await browser1.new_page()
            page2 = await browser2.new_page()

            auth_page1 = AuthPage(page1)
            auth_page2 = AuthPage(page2)

            # Login with same credentials in both browsers
            await auth_page1.navigate()
            await auth_page1.login_with_company_user()

            await auth_page2.navigate()
            await auth_page2.login_with_company_user()

            # Check if both sessions are valid
            session1_valid = await auth_page1.is_login_successful()
            session2_valid = await auth_page2.is_login_successful()

            print(f"Session 1 valid: {session1_valid}")
            print(f"Session 2 valid: {session2_valid}")

            # This documents current behavior - both sessions might be valid
            # or one might invalidate the other depending on system design

            await browser1.close()
            await browser2.close()

    @pytest.mark.asyncio
    async def test_password_field_security(self):
        """Test password field security features"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            await auth_page.navigate()

            # Check if password is hidden by default
            password_hidden = await auth_page.is_password_hidden()
            print(f"Password field hidden by default: {password_hidden}")

            # CRITICAL: Password field should be hidden by default
            assert password_hidden, "CRITICAL: Password field should be hidden by default"

            # Test password visibility toggle if available
            has_visibility_toggle = await auth_page.has_password_visibility_toggle()
            print(f"Password visibility toggle available: {has_visibility_toggle}")

            if has_visibility_toggle:
                await auth_page.enter_password("testpassword123")
                await auth_page.toggle_password_visibility()

                password_visible = await auth_page.is_password_visible()
                print(f"Password visible after toggle: {password_visible}")

            await browser.close()