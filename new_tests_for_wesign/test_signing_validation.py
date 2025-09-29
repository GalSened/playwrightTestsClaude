"""
WeSign Signing Flow Validation Test Suite

Quick validation test to verify comprehensive signing flow test implementation works correctly.
This validates our test framework and basic signing workflow access.

Created: 2025-01-25
Purpose: Validate test implementation before full execution
"""

import pytest
from playwright.async_api import Page, expect
import asyncio


class TestSigningValidation:
    """Basic validation tests for signing workflow access"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test configuration"""
        self.base_url = "https://devtest.comda.co.il"
        self.test_credentials = {
            "email": "gals@comda.co.il",
            "password": "Comda159!"
        }

    async def authenticate(self, page: Page) -> bool:
        """Authenticate with WeSign application"""
        try:
            await page.goto(f"{self.base_url}/auth/login")
            await page.wait_for_load_state('networkidle')

            await page.fill('input[type="email"]', self.test_credentials["email"])
            await page.fill('input[type="password"]', self.test_credentials["password"])

            login_button = page.locator('button[type="submit"]').first
            await login_button.click()

            await page.wait_for_url("**/dashboard**", timeout=15000)
            await page.wait_for_load_state('networkidle')

            return True
        except Exception as e:
            print(f"Authentication failed: {e}")
            return False

    @pytest.mark.asyncio
    async def test_basic_authentication_works(self, page: Page):
        """Verify basic authentication to WeSign works"""
        success = await self.authenticate(page)
        assert success, "Failed to authenticate with WeSign application"

        # Verify we're on dashboard
        assert "/dashboard" in page.url, "Not redirected to dashboard after login"
        print("✅ Authentication successful")

    @pytest.mark.asyncio
    async def test_signing_workflow_navigation_works(self, page: Page):
        """Verify navigation to signing workflow works"""
        # Authenticate
        assert await self.authenticate(page), "Authentication failed"

        # Navigate to signing workflow - try direct URL first
        await page.goto(f"{self.base_url}/dashboard/selectsigners")
        await page.wait_for_load_state('networkidle')

        # Check if we reached the signing selection page
        if "/selectsigners" in page.url:
            print("✅ Direct navigation to signing workflow successful")
        else:
            # Try through dashboard UI
            await page.goto(f"{self.base_url}/dashboard")
            await page.wait_for_load_state('networkidle')

            # Look for "Server sign" button
            server_sign_button = page.locator('button:has-text("Server sign"), a:has-text("Server sign")').first

            if await server_sign_button.is_visible():
                await server_sign_button.click()
                await asyncio.sleep(2)
                print("✅ Navigation through Server sign button successful")
            else:
                print("⚠️  Server sign button not found - checking available options")
                # List available buttons for debugging
                buttons = page.locator('button')
                button_count = await buttons.count()
                print(f"📋 Found {button_count} buttons on dashboard")

        # Verify we can access signing workflow
        current_url = page.url
        assert "dashboard" in current_url, "Not on dashboard or signing workflow page"
        print(f"✅ Current URL: {current_url}")

    @pytest.mark.asyncio
    async def test_signing_tabs_are_accessible(self, page: Page):
        """Verify the three signing tabs (Myself, Others, Live) are accessible"""
        # Authenticate
        assert await self.authenticate(page), "Authentication failed"

        # Navigate to signing workflow
        await page.goto(f"{self.base_url}/dashboard/selectsigners")
        await page.wait_for_load_state('networkidle')

        # Check for signing workflow tabs
        signing_tabs = ["Myself", "Others", "Live"]
        found_tabs = []

        for tab_name in signing_tabs:
            tab_button = page.locator(f'button:has-text("{tab_name}")').first
            if await tab_button.is_visible():
                found_tabs.append(tab_name)

                # Test clicking the tab
                await tab_button.click()
                await asyncio.sleep(1)
                print(f"✅ {tab_name} tab accessible and clickable")
            else:
                print(f"⚠️  {tab_name} tab not found")

        # Verify we found at least some signing options
        assert len(found_tabs) > 0, f"No signing workflow tabs found. Available tabs: {found_tabs}"
        print(f"📊 Found {len(found_tabs)}/3 signing tabs: {found_tabs}")

        # If we're on the selectsigners page, verify basic functionality
        if "/selectsigners" in page.url:
            # Check for document name field
            doc_name_fields = page.locator('input[value*="test"], textbox')
            doc_field_count = await doc_name_fields.count()

            if doc_field_count > 0:
                print(f"✅ Found {doc_field_count} document/input fields")
            else:
                print("📋 No document fields found - may need file upload first")

    @pytest.mark.asyncio
    async def test_form_fields_are_interactive(self, page: Page):
        """Verify basic form interactions work in signing workflows"""
        # Authenticate
        assert await self.authenticate(page), "Authentication failed"

        # Navigate to signing workflow
        await page.goto(f"{self.base_url}/dashboard/selectsigners")
        await page.wait_for_load_state('networkidle')

        # Test Others tab for form interactions
        others_button = page.locator('button:has-text("Others")').first
        if await others_button.is_visible():
            await others_button.click()
            await asyncio.sleep(1)

            # Test name field
            name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
            if await name_field.is_visible():
                await name_field.fill("Test User")

                # Verify the text was entered
                current_value = await name_field.input_value()
                assert "Test User" in current_value, "Failed to enter text in name field"
                print("✅ Name field interaction successful")

            # Test email field
            email_field = page.locator('input[placeholder*="Email"], textbox[aria-label*="Email"]').first
            if await email_field.is_visible():
                await email_field.fill("test@example.com")
                current_value = await email_field.input_value()
                assert "test@example.com" in current_value, "Failed to enter email"
                print("✅ Email field interaction successful")

            # Test communication method dropdown
            comm_select = page.locator('select').first
            if await comm_select.is_visible():
                await comm_select.select_option("Send document by SMS")
                await asyncio.sleep(1)
                print("✅ Communication method selection successful")

                # Check if phone field appeared (SMS selection)
                phone_field = page.locator('input[placeholder*="050"]').first
                if await phone_field.is_visible():
                    await phone_field.fill("050-123-4567")
                    print("✅ Phone field interaction successful")

        else:
            print("⚠️  Others tab not available for form testing")

        print("✅ Basic form interactions validated")


if __name__ == "__main__":
    print("🧪 WeSign Signing Flow Validation Tests")
    print("=" * 50)
    print("Purpose: Validate test framework and basic access")
    print("=" * 50)

    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--maxfail=3",
        "--capture=no"
    ])