"""
All Field Types Tests - FIXED with fill logic
Based on Date Field pattern discovery
"""
import pytest
from pathlib import Path
from playwright.async_api import Page, async_playwright
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from pages.auth_page import AuthPage

# Test PDF
test_pdf = Path(__file__).parent.parent.parent / "test_files" / "sample.pdf"


class TestAllFieldTypesFixed:
    """All field type tests with correct fill patterns"""

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
    async def test_number_field_success(self):
        """Test: Number field with fill"""
        p, browser, page = await self._setup_and_navigate_to_fields_page()

        try:
            print("\n" + "="*80)
            print("TEST: Number Field")
            print("="*80)

            # Add number field
            print("\n📍 Add number field")
            number_button = page.locator('button:has-text("מספר")').first
            await number_button.click()
            print("   ✅ Number field added")
            await page.wait_for_timeout(2000)

            # Fill the number field
            print("\n📍 Fill number field")
            # CORRECT SELECTOR: Use the parent component locator
            number_input = page.locator('sgn-self-sign-place-fields').get_by_role('textbox')
            await number_input.fill('12345')
            print("   ✅ Number filled: 12345")
            await page.wait_for_timeout(1000)

            # Verify filled
            filled_value = await number_input.input_value()
            assert filled_value == '12345', f"Number not filled correctly: {filled_value}"

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
    async def test_email_field_success(self):
        """Test: Email field with fill"""
        p, browser, page = await self._setup_and_navigate_to_fields_page()

        try:
            print("\n" + "="*80)
            print("TEST: Email Field")
            print("="*80)

            # Add email field
            print("\n📍 Add email field")
            email_button = page.locator('button:has-text("דוא\\"ל")').first
            await email_button.click()
            print("   ✅ Email field added")
            await page.wait_for_timeout(2000)

            # Fill the email field
            print("\n📍 Fill email field")
            email_input = page.locator('input[type="email"]').first
            await email_input.fill('test@example.com')
            print("   ✅ Email filled: test@example.com")
            await page.wait_for_timeout(1000)

            # Verify filled
            filled_value = await email_input.input_value()
            assert filled_value == 'test@example.com', f"Email not filled correctly: {filled_value}"

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
    async def test_phone_field_success(self):
        """Test: Phone field with fill"""
        p, browser, page = await self._setup_and_navigate_to_fields_page()

        try:
            print("\n" + "="*80)
            print("TEST: Phone Field")
            print("="*80)

            # Add phone field
            print("\n📍 Add phone field")
            phone_button = page.locator('button:has-text("טלפון")').first
            await phone_button.click()
            print("   ✅ Phone field added")
            await page.wait_for_timeout(2000)

            # Fill the phone field
            print("\n📍 Fill phone field")
            # CORRECT SELECTOR: Use the parent component locator (same as Number field)
            phone_input = page.locator('sgn-self-sign-place-fields').get_by_role('textbox')
            await phone_input.fill('0501234567')
            print("   ✅ Phone filled: 0501234567")
            await page.wait_for_timeout(1000)

            # Verify filled
            filled_value = await phone_input.input_value()
            assert '050' in filled_value, f"Phone not filled correctly: {filled_value}"

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
    async def test_checkbox_field_success(self):
        """Test: Checkbox field with check"""
        p, browser, page = await self._setup_and_navigate_to_fields_page()

        try:
            print("\n" + "="*80)
            print("TEST: Checkbox Field")
            print("="*80)

            # Add checkbox field
            print("\n📍 Add checkbox field")
            checkbox_button = page.locator('button:has-text("תיבת סימון")').first
            await checkbox_button.click()
            print("   ✅ Checkbox field added")
            await page.wait_for_timeout(2000)

            # Check the checkbox
            print("\n📍 Check checkbox")
            # CORRECT SELECTOR: Use the parent component locator
            checkbox_input = page.locator('sgn-self-sign-place-fields').get_by_role('checkbox')
            await checkbox_input.check()
            print("   ✅ Checkbox checked")
            await page.wait_for_timeout(1000)

            # Verify checked
            is_checked = await checkbox_input.is_checked()
            assert is_checked, "Checkbox should be checked"

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
    async def test_text_field_success(self):
        """Test: Text field (should work without fill based on previous tests)"""
        p, browser, page = await self._setup_and_navigate_to_fields_page()

        try:
            print("\n" + "="*80)
            print("TEST: Text Field (No fill required)")
            print("="*80)

            # Add text field
            print("\n📍 Add text field")
            text_button = page.locator('button:has-text("טקסט")').first
            await text_button.click()
            print("   ✅ Text field added")
            await page.wait_for_timeout(2000)

            # Text field doesn't require fill in self-sign mode
            # Click Finish directly
            print("\n📍 Click Finish (no fill needed)")
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
