"""
Test: Initials Field - FIXED VERSION
Discovered pattern using Playwright MCP step-by-step method

CRITICAL DISCOVERY:
- Initials field works EXACTLY like Signature field
- Pattern: Click field button → Click pen icon → Click "ראשי תיבות" tab → Click Type button → Click "סיים"
- Modal interaction required
"""

import pytest
from pathlib import Path
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage


class TestInitialsFieldFixed:
    """Test Initials field with discovered pattern"""

    @pytest.mark.asyncio
    async def test_initials_field_success(self):
        """Test: Add initials field and complete successfully

        DISCOVERED PATTERN (Playwright MCP):
        1. Click "ראשי תיבות" (Initials) button to add field
        2. Click the initials field button on the document
        3. Click the pen/feather icon to open modal
        4. Click "ראשי תיבות" tab
        5. Click the Type button (second button)
        6. Click main "סיים" button to finish
        7. Navigate to success page
        """
        # Setup
        test_pdf = Path(__file__).parent.parent.parent / "test_files" / "sample.pdf"
        assert test_pdf.exists(), f"Test PDF not found: {test_pdf}"

        p = await async_playwright().__aenter__()
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--start-maximized'])
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        try:
            # Login
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            # Upload PDF
            upload_button = page.locator('button:has-text("העלאת קובץ")').first
            async with page.expect_file_chooser() as fc_info:
                await upload_button.click()
            file_chooser = await fc_info.value
            await file_chooser.set_files(str(test_pdf.absolute()))

            # Navigate to self-sign
            self_sign_button = page.locator('button:has-text("חתימה אישית")').first
            await self_sign_button.click()

            edit_button = page.locator('button:has-text("עריכת מסמך")').first
            await edit_button.click()

            # Verify on selfsignfields page
            assert "selfsignfields" in page.url

            # Step 1: Click "ראשי תיבות" (Initials) button to add field
            initials_sidebar_button = page.locator('button:has-text("ראשי תיבות")').first
            await initials_sidebar_button.click()

            # Wait for field to be added
            await page.wait_for_timeout(1000)

            # Step 2: Click the initials field button on the document
            initials_field_button = page.locator('button:has-text("ראשי תיבות")').nth(1)  # Second one (on document)
            await initials_field_button.click()

            # Wait for modal preparation
            await page.wait_for_timeout(500)

            # Step 3: Click the pen/feather icon to open modal (first button in navigation)
            pen_icon_button = page.locator('.ct-button--icon.button--field').first
            await pen_icon_button.click()

            # Wait for modal to open
            await page.wait_for_timeout(1000)

            # Step 4: Click "ראשי תיבות" tab in modal
            initials_tab_button = page.locator('sgn-sign-pad').get_by_role('button', name='ראשי תיבות')
            await initials_tab_button.click()

            # Wait for tab to activate
            await page.wait_for_timeout(500)

            # Step 5: Click the Type button (second button in modal - creates typed initials)
            type_button = page.get_by_role('button').filter(has_text='').nth(1)
            await type_button.click()

            # Wait for initials to be created
            await page.wait_for_timeout(1000)

            # Modal should close automatically after clicking Type button

            # Step 6: Click main "סיים" (Finish) button to complete
            finish_button = page.locator('button:has-text("סיים")').first
            await finish_button.click()

            # Wait for navigation
            await page.wait_for_timeout(3000)

            # Verify success
            assert "success/selfsign" in page.url, f"Expected success URL, got: {page.url}"

        finally:
            await context.close()
            await browser.close()
            await p.__aexit__(None, None, None)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
