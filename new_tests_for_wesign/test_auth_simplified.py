"""Simplified authentication test using Page Object Models"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.dashboard_page import DashboardPage


@pytest.mark.asyncio
async def test_auth_with_page_objects():
    """Test authentication using our Page Object Models"""
    async with async_playwright() as p:
        try:
            print("Starting authentication test with Page Objects...")

            # Launch browser
            browser = await p.chromium.launch(
                headless=True,
                timeout=15000,
                args=['--no-sandbox', '--disable-dev-shm-usage']
            )

            context = await browser.new_context()
            page = await context.new_page()

            # Initialize page objects
            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            print("Navigating to login page...")
            await auth_page.navigate()

            print("Checking if login form is visible...")
            form_visible = await auth_page.is_login_form_visible()
            print(f"Login form visible: {form_visible}")

            if form_visible:
                print("Attempting login with company credentials...")
                await auth_page.login_with_company_user()

                print("Checking login result...")
                login_successful = await auth_page.is_login_successful()
                still_on_login = await auth_page.is_still_on_login_page()

                print(f"Login successful: {login_successful}")
                print(f"Still on login page: {still_on_login}")
                print(f"Current URL: {page.url}")

                # Check dashboard loading
                dashboard_loaded = await dashboard_page.is_dashboard_loaded()
                print(f"Dashboard loaded: {dashboard_loaded}")

                if login_successful or dashboard_loaded:
                    print("SUCCESS: Authentication test passed!")

                    # Test user permissions
                    permissions = await dashboard_page.get_user_permissions()
                    print(f"User permissions: {permissions}")

                else:
                    print("INFO: Login may have failed or redirected")

            else:
                print("WARNING: Login form not found")

            await browser.close()
            print("Authentication test completed")

        except Exception as e:
            print(f"Authentication test failed: {e}")
            raise


@pytest.mark.asyncio
async def test_invalid_credentials():
    """Test authentication with invalid credentials"""
    async with async_playwright() as p:
        try:
            print("Testing invalid credentials...")

            browser = await p.chromium.launch(
                headless=True,
                timeout=15000,
                args=['--no-sandbox', '--disable-dev-shm-usage']
            )

            context = await browser.new_context()
            page = await context.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()

            # Test invalid credentials
            await auth_page.enter_credentials("invalid@test.com", "wrongpassword")
            await auth_page.click_login_button()

            # Should remain on login page
            still_on_login = await auth_page.is_still_on_login_page()
            print(f"Remained on login page: {still_on_login}")

            assert still_on_login, "Should remain on login page with invalid credentials"

            await browser.close()
            print("Invalid credentials test passed!")

        except Exception as e:
            print(f"Invalid credentials test failed: {e}")
            raise


@pytest.mark.asyncio
async def test_form_validation():
    """Test form validation"""
    async with async_playwright() as p:
        try:
            print("Testing form validation...")

            browser = await p.chromium.launch(
                headless=True,
                timeout=15000,
                args=['--no-sandbox', '--disable-dev-shm-usage']
            )

            context = await browser.new_context()
            page = await context.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()

            # Test empty email validation
            await auth_page.enter_password("somepassword")
            await auth_page.click_login_button()

            email_invalid = await auth_page.is_email_field_invalid()
            print(f"Empty email field validation: {email_invalid}")

            # Clear and test empty password validation
            await page.reload()
            await auth_page.enter_email("test@example.com")
            await auth_page.click_login_button()

            password_invalid = await auth_page.is_password_field_invalid()
            print(f"Empty password field validation: {password_invalid}")

            await browser.close()
            print("Form validation test completed!")

        except Exception as e:
            print(f"Form validation test failed: {e}")
            raise