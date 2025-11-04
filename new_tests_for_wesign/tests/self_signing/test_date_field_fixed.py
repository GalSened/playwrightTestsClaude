"""
Date Field Test - FIXED with fill logic
Based on manual discovery session
"""
import pytest
from pathlib import Path
from playwright.async_api import Page, async_playwright
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from pages.auth_page import AuthPage

# Test PDF
test_pdf = Path(__file__).parent.parent.parent / "test_files" / "sample.pdf"


class TestDateFieldFixed:
    """Date field test with correct fill pattern"""

    @pytest.mark.asyncio
    async def test_date_field_single_success(self):
        """
        Test: Add ONE date field, fill it, and finish successfully

        CRITICAL LEARNINGS:
        1. Date fields MUST be filled before finishing
        2. Format: YYYY-MM-DD (e.g., 2025-02-12)
        3. Use input[type="date"] selector
        """
        # Setup
        p = await async_playwright().__aenter__()
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--start-maximized'])
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        try:
            print("\n" + "="*80)
            print("TEST: Date Field - Single Field with Fill")
            print("="*80)

            # Step 1: Login
            print("\n📍 STEP 1: Login")
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()
            print("   ✅ Login successful")

            # Step 2: Upload PDF
            print("\n📍 STEP 2: Upload PDF")
            upload_button = page.locator('button:has-text("העלאת קובץ")').first
            async with page.expect_file_chooser() as fc_info:
                await upload_button.click()
            file_chooser = await fc_info.value
            await file_chooser.set_files(str(test_pdf.absolute()))
            print("   ✅ PDF uploaded")
            await page.wait_for_timeout(2000)

            # Step 3: Navigate to self-sign
            print("\n📍 STEP 3: Navigate to self-sign mode")
            self_sign_button = page.locator('button:has-text("חתימה אישית")').first
            await self_sign_button.click()
            await page.wait_for_timeout(2000)

            edit_button = page.locator('button:has-text("עריכת מסמך")').first
            await edit_button.click()
            await page.wait_for_timeout(3000)

            assert "selfsignfields" in page.url
            print(f"   ✅ On selfsignfields page: {page.url}")

            # Step 4: Add date field
            print("\n📍 STEP 4: Add date field")
            date_button = page.locator('button:has-text("תאריך")').first
            await date_button.click()
            print("   ✅ Date field added")
            await page.wait_for_timeout(2000)

            # Step 5: FILL the date field (CRITICAL!)
            print("\n📍 STEP 5: Fill date field")
            date_input = page.locator('input[type="date"]').first
            await date_input.fill('2025-02-12')
            print("   ✅ Date filled: 2025-02-12")
            await page.wait_for_timeout(1000)

            # Verify date was filled
            filled_value = await date_input.input_value()
            assert filled_value == '2025-02-12', f"Date not filled correctly: {filled_value}"
            print(f"   ✅ Date verified: {filled_value}")

            # Step 6: Click Finish
            print("\n📍 STEP 6: Click Finish")
            url_before = page.url
            print(f"   URL before Finish: {url_before}")

            finish_button = page.locator('button:has-text("סיים")').first
            await finish_button.click()
            await page.wait_for_timeout(5000)

            url_after = page.url
            print(f"   URL after Finish: {url_after}")

            # Step 7: Verify success page
            print("\n📍 STEP 7: Verify success page")
            assert "success/selfsign" in page.url, f"Should navigate to success, got: {page.url}"
            print("   ✅ Successfully navigated to success page!")

            # Verify success heading
            success_heading = page.locator('h1:has-text("הצלחה!"), h2:has-text("הצלחה!"), h3:has-text("הצלחה!")').first
            assert await success_heading.is_visible(), "Success heading not visible"
            print("   ✅ Success heading visible")

            print("\n" + "="*80)
            print("✅ TEST PASSED: Date field with fill works correctly!")
            print("="*80)

        finally:
            await browser.close()
            await p.stop()


    @pytest.mark.asyncio
    async def test_date_field_overlapping_validation(self):
        """
        Test: Add TWO overlapping date fields and verify error message

        CRITICAL LEARNING:
        - System validates overlapping fields
        - Error message: "שדות חופפים - אנא הזז אחד השדות"
        - Finish button won't work until fields are moved apart
        """
        # Setup
        p = await async_playwright().__aenter__()
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--start-maximized'])
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        try:
            print("\n" + "="*80)
            print("TEST: Date Field - Overlapping Validation")
            print("="*80)

            # Step 1: Login
            print("\n📍 STEP 1: Login")
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()
            print("   ✅ Login successful")

            # Step 2: Upload PDF
            print("\n📍 STEP 2: Upload PDF")
            upload_button = page.locator('button:has-text("העלאת קובץ")').first
            async with page.expect_file_chooser() as fc_info:
                await upload_button.click()
            file_chooser = await fc_info.value
            await file_chooser.set_files(str(test_pdf.absolute()))
            print("   ✅ PDF uploaded")
            await page.wait_for_timeout(2000)

            # Step 3: Navigate to self-sign
            print("\n📍 STEP 3: Navigate to self-sign mode")
            self_sign_button = page.locator('button:has-text("חתימה אישית")').first
            await self_sign_button.click()
            await page.wait_for_timeout(2000)

            edit_button = page.locator('button:has-text("עריכת מסמך")').first
            await edit_button.click()
            await page.wait_for_timeout(3000)

            assert "selfsignfields" in page.url
            print(f"   ✅ On selfsignfields page: {page.url}")

            # Step 4: Add FIRST date field
            print("\n📍 STEP 4: Add first date field")
            date_button = page.locator('button:has-text("תאריך")').first
            await date_button.click()
            print("   ✅ First date field added")
            await page.wait_for_timeout(1000)

            # Step 5: Fill first date field
            print("\n📍 STEP 5: Fill first date field")
            first_date_input = page.locator('input[type="date"]').first
            await first_date_input.fill('2025-02-12')
            print("   ✅ First date filled: 2025-02-12")
            await page.wait_for_timeout(1000)

            # Step 6: Add SECOND date field (will overlap)
            print("\n📍 STEP 6: Add second date field (overlapping)")
            await date_button.click()
            print("   ✅ Second date field added (overlapping position)")
            await page.wait_for_timeout(1000)

            # Step 7: Fill second date field
            print("\n📍 STEP 7: Fill second date field")
            second_date_input = page.locator('input[type="date"]').nth(1)
            await second_date_input.fill('2025-03-15')
            print("   ✅ Second date filled: 2025-03-15")
            await page.wait_for_timeout(1000)

            # Step 8: Try to click Finish (should show error)
            print("\n📍 STEP 8: Try to click Finish (expecting overlap error)")
            finish_button = page.locator('button:has-text("סיים")').first
            await finish_button.click()
            await page.wait_for_timeout(2000)

            # Step 9: Verify overlap error message appears
            print("\n📍 STEP 9: Verify overlap error message")
            error_message = page.locator('text="שדות חופפים - אנא הזז אחד השדות"').first

            is_error_visible = await error_message.is_visible()
            assert is_error_visible, "Overlap error message should be visible"
            print("   ✅ Overlap error message displayed correctly!")

            # Verify we're still on selfsignfields page (didn't navigate to success)
            assert "selfsignfields" in page.url, "Should stay on selfsignfields page"
            print(f"   ✅ Stayed on selfsignfields page (didn't navigate): {page.url}")

            print("\n" + "="*80)
            print("✅ TEST PASSED: Overlapping validation works correctly!")
            print("="*80)

        finally:
            await browser.close()
            await p.stop()
