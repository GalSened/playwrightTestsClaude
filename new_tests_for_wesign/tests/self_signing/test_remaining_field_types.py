"""
Remaining Field Types Tests - Initials, List, Radio, Two Signatures
Based on discovered patterns from previous field types
"""
import pytest
from pathlib import Path
from playwright.async_api import Page, async_playwright
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from pages.auth_page import AuthPage

# Test PDF
test_pdf = Path(__file__).parent.parent.parent / "test_files" / "sample.pdf"


class TestRemainingFieldTypes:
    """Tests for Initials, List, Radio, Two Signatures fields"""

    async def _setup_and_navigate_to_fields_page(self):
        """Helper: Setup browser and navigate to selfsignfields page"""
        p = await async_playwright().__aenter__()
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--start-maximized'])
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        # Login
        auth_page = AuthPage(page)
        await auth_page.navigate()
        await auth_page.login_with_company_user()
        await page.wait_for_timeout(2000)

        # Upload PDF
        upload_button = page.locator('button:has-text("העלאת קובץ")').first
        async with page.expect_file_chooser() as fc_info:
            await upload_button.click()
        file_chooser = await fc_info.value
        await file_chooser.set_files(str(test_pdf.absolute()))
        await page.wait_for_timeout(2000)

        # Navigate to self-sign
        self_sign_button = page.locator('button:has-text("חתימה אישית")').first
        await self_sign_button.click()
        await page.wait_for_timeout(2000)

        edit_button = page.locator('button:has-text("עריכת מסמך")').first
        await edit_button.click()
        await page.wait_for_timeout(3000)

        assert "selfsignfields" in page.url

        return p, browser, page


    @pytest.mark.asyncio
    async def test_initials_field_success(self):
        """Test: Initials field - likely modal-based like Signature"""
        p, browser, page = await self._setup_and_navigate_to_fields_page()

        try:
            print("\n" + "="*80)
            print("TEST: Initials Field")
            print("="*80)

            # Add initials field
            print("\n📍 Add initials field")
            initials_button = page.locator('button:has-text("ראשי תיבות")').first
            await initials_button.click()
            print("   ✅ Initials field added")
            await page.wait_for_timeout(2000)

            # Try to interact - check if modal appears
            # Look for feather icon (like signature field)
            print("\n📍 Looking for feather icon...")
            feather_icon = page.locator('.ct-button--icon.button--field').first

            if await feather_icon.is_visible(timeout=3000):
                print("   ✅ Feather icon found - clicking...")
                await feather_icon.click()
                await page.wait_for_timeout(2000)

                # Look for saved initials in modal (similar to signature)
                print("   Looking for saved initials...")
                saved_initials = page.locator('sgn-sign-pad button img').first

                if await saved_initials.is_visible(timeout=3000):
                    await saved_initials.click()
                    print("   ✅ Selected saved initials")
                    await page.wait_for_timeout(2000)
                else:
                    # May need to draw initials - try textbox pattern
                    print("   Trying textbox pattern...")
                    initials_input = page.locator('sgn-self-sign-place-fields').get_by_role('textbox')
                    await initials_input.fill('AB')
                    print("   ✅ Filled initials: AB")
            else:
                # Direct fill pattern (like Number/Phone)
                print("   No modal - trying direct fill...")
                initials_input = page.locator('sgn-self-sign-place-fields').get_by_role('textbox')
                await initials_input.fill('AB')
                print("   ✅ Filled initials: AB")

            await page.wait_for_timeout(1000)

            # Click Finish
            print("\n📍 Click Finish")
            finish_button = page.locator('button:has-text("סיים")').first
            await finish_button.click()
            await page.wait_for_timeout(5000)

            # Verify success
            print("\n📍 Verify success page")
            assert "success/selfsign" in page.url, f"Should navigate to success, got: {page.url}"
            print("   ✅ SUCCESS!")

        finally:
            await browser.close()
            await p.stop()


    @pytest.mark.asyncio
    async def test_list_field_success(self):
        """Test: List field - dropdown selection"""
        p, browser, page = await self._setup_and_navigate_to_fields_page()

        try:
            print("\n" + "="*80)
            print("TEST: List Field")
            print("="*80)

            # Add list field
            print("\n📍 Add list field")
            list_button = page.locator('button:has-text("רשימה")').first
            await list_button.click()
            print("   ✅ List field added")
            await page.wait_for_timeout(2000)

            # Try to find and select from dropdown
            print("\n📍 Looking for dropdown...")

            # Try combobox role first
            dropdown = page.locator('sgn-self-sign-place-fields').get_by_role('combobox').first

            if await dropdown.is_visible(timeout=3000):
                print("   ✅ Found combobox")
                # Click to open dropdown
                await dropdown.click()
                await page.wait_for_timeout(1000)

                # Try to select first option
                option = page.locator('option, [role="option"]').first
                if await option.is_visible(timeout=2000):
                    await option.click()
                    print("   ✅ Selected option from dropdown")
                else:
                    # Try select_option if it's a select element
                    await dropdown.select_option(index=0)
                    print("   ✅ Selected first option")
            else:
                # Try textbox pattern as fallback
                print("   Trying textbox pattern...")
                list_input = page.locator('sgn-self-sign-place-fields').get_by_role('textbox')
                await list_input.fill('Option 1')
                print("   ✅ Filled list value")

            await page.wait_for_timeout(1000)

            # Click Finish
            print("\n📍 Click Finish")
            finish_button = page.locator('button:has-text("סיים")').first
            await finish_button.click()
            await page.wait_for_timeout(5000)

            # Verify success
            print("\n📍 Verify success page")
            assert "success/selfsign" in page.url, f"Should navigate to success, got: {page.url}"
            print("   ✅ SUCCESS!")

        finally:
            await browser.close()
            await p.stop()


    @pytest.mark.asyncio
    async def test_radio_field_success(self):
        """Test: Radio field - similar to checkbox"""
        p, browser, page = await self._setup_and_navigate_to_fields_page()

        try:
            print("\n" + "="*80)
            print("TEST: Radio Field")
            print("="*80)

            # Add radio field
            print("\n📍 Add radio field")
            radio_button = page.locator('button:has-text("רדיו")').first
            await radio_button.click()
            print("   ✅ Radio field added")
            await page.wait_for_timeout(2000)

            # Try to select radio (similar to checkbox pattern)
            print("\n📍 Select radio")
            radio_input = page.locator('sgn-self-sign-place-fields').get_by_role('radio')
            await radio_input.check()
            print("   ✅ Radio selected")
            await page.wait_for_timeout(1000)

            # Verify checked
            is_checked = await radio_input.is_checked()
            assert is_checked, "Radio should be checked"

            # Click Finish
            print("\n📍 Click Finish")
            finish_button = page.locator('button:has-text("סיים")').first
            await finish_button.click()
            await page.wait_for_timeout(5000)

            # Verify success
            print("\n📍 Verify success page")
            assert "success/selfsign" in page.url, f"Should navigate to success, got: {page.url}"
            print("   ✅ SUCCESS!")

        finally:
            await browser.close()
            await p.stop()


    @pytest.mark.asyncio
    async def test_two_signature_fields_success(self):
        """Test: Two signature fields - modal sequence"""
        p, browser, page = await self._setup_and_navigate_to_fields_page()

        try:
            print("\n" + "="*80)
            print("TEST: Two Signature Fields")
            print("="*80)

            # Add first signature field
            print("\n📍 Add first signature field")
            sig_button = page.locator('button:has-text("חתימה")').first
            await sig_button.click()
            print("   ✅ First signature field added")
            await page.wait_for_timeout(2000)

            # Click feather icon for first signature
            print("\n📍 Click feather icon for first signature")
            feather_icon_1 = page.locator('.ct-button--icon.button--field').first
            await feather_icon_1.click()
            print("   ✅ Feather icon clicked")
            await page.wait_for_timeout(2000)

            # Select saved signature for first field
            print("\n📍 Select saved signature for first field")
            saved_sig_1 = page.locator('sgn-sign-pad button img').first
            await saved_sig_1.click()
            print("   ✅ First signature selected")
            await page.wait_for_timeout(2000)

            # Add second signature field
            print("\n📍 Add second signature field")
            await sig_button.click()
            print("   ✅ Second signature field added")
            await page.wait_for_timeout(2000)

            # Click feather icon for second signature
            print("\n📍 Click feather icon for second signature")
            # Get all feather icons and click the second one
            feather_icons = page.locator('.ct-button--icon.button--field')
            feather_count = await feather_icons.count()
            print(f"   Found {feather_count} feather icons")

            if feather_count >= 2:
                await feather_icons.nth(1).click()
            else:
                # If only one visible, it's the second field's icon
                await feather_icons.first.click()

            print("   ✅ Second feather icon clicked")
            await page.wait_for_timeout(2000)

            # Select saved signature for second field
            print("\n📍 Select saved signature for second field")
            saved_sig_2 = page.locator('sgn-sign-pad button img').first
            await saved_sig_2.click()
            print("   ✅ Second signature selected")
            await page.wait_for_timeout(2000)

            # Click Finish
            print("\n📍 Click Finish")
            finish_button = page.locator('button:has-text("סיים")').first
            await finish_button.click()
            await page.wait_for_timeout(5000)

            # Verify success
            print("\n📍 Verify success page")
            assert "success/selfsign" in page.url, f"Should navigate to success, got: {page.url}"
            print("   ✅ SUCCESS!")

        finally:
            await browser.close()
            await p.stop()
