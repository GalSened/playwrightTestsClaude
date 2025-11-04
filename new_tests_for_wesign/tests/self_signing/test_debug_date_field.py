"""
Debug script for Date Field test - ALWAYS RUNS HEADED
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright, Page
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from pages.auth_page import AuthPage

# Test PDF path
test_pdf = Path(__file__).parent.parent.parent / "test_files" / "sample.pdf"


async def debug_date_field():
    """Debug Date Field test - Step by step with headed browser"""

    print("\n" + "="*80)
    print("DEBUG: Date Field Test - HEADED MODE")
    print("="*80)

    # Launch browser HEADED with slow motion
    p = await async_playwright().start()
    browser = await p.chromium.launch(
        headless=False,  # ALWAYS HEADED
        slow_mo=500,     # Slow motion for visibility
        args=['--no-sandbox', '--start-maximized']
    )
    context = await browser.new_context(no_viewport=True)
    page = await context.new_page()

    try:
        # Step 1: Login
        print("\n📍 STEP 1: Login")
        auth_page = AuthPage(page)
        await auth_page.navigate()
        await auth_page.login_with_company_user()
        print("   ✅ Login successful")
        await page.wait_for_timeout(2000)

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
        print(f"   Current URL: {page.url}")

        self_sign_button = page.locator('button:has-text("חתימה אישית")').first
        await self_sign_button.click()
        await page.wait_for_timeout(2000)

        edit_button = page.locator('button:has-text("עריכת מסמך")').first
        await edit_button.click()
        await page.wait_for_timeout(3000)

        print(f"   Current URL: {page.url}")
        assert "selfsignfields" in page.url, f"Should be on selfsignfields page, got: {page.url}"
        print("   ✅ On self-sign fields page")

        # Step 4: Click Date field button
        print("\n📍 STEP 4: Click Date field button (תאריך)")
        date_button = page.locator('button:has-text("תאריך")').first
        await date_button.click()
        print("   ✅ Date field button clicked")
        await page.wait_for_timeout(2000)

        # Step 5: Fill the date field (CRITICAL: Must fill in self-sign!)
        print("\n📍 STEP 5: Fill the date field")
        print("   ⚠️  Rule: In self-sign mode, you MUST fill any field you add!")

        # Wait for the date field to appear and find the calendar button
        await page.wait_for_timeout(2000)

        # Look for the calendar button (📅) on the date field
        print("   Looking for calendar button on date field...")

        # Try different selectors for the calendar button
        calendar_button = page.locator('button[type="button"]:has(svg), .calendar-icon, [aria-label*="calendar"], button:has-text("📅")').first

        try:
            # Wait for calendar button to be visible
            await calendar_button.wait_for(state="visible", timeout=5000)
            print("   ✅ Found calendar button")

            # Click the calendar button to open date picker
            await calendar_button.click()
            print("   ✅ Clicked calendar button")
            await page.wait_for_timeout(2000)

            # Now select a date from the date picker
            # Try to click today's date or first available date
            print("   Looking for date to select in picker...")

            # Try multiple selectors for date cells
            date_option = page.locator('td[role="gridcell"]:not([aria-disabled="true"]), .mat-calendar-body-cell:not(.mat-calendar-body-disabled), button[aria-label*="2025"]').first
            await date_option.click()
            print("   ✅ Selected date from picker")
            await page.wait_for_timeout(2000)

        except Exception as e:
            print(f"   ⚠️  Could not auto-fill date: {e}")
            print("   👉 Pausing for 60 SECONDS - please manually:")
            print("      1. Click the calendar button (📅) on the date field")
            print("      2. Select a date from the date picker")
            await page.wait_for_timeout(60000)

        # Step 6: Try clicking Finish
        print("\n📍 STEP 6: Attempting to click Finish button")
        finish_button = page.locator('button:has-text("סיים")').first

        print("   Current URL before Finish:", page.url)
        await finish_button.click()
        await page.wait_for_timeout(5000)

        print("   Current URL after Finish:", page.url)

        if "success/selfsign" in page.url:
            print("   ✅ Successfully navigated to success page!")
            print("\n   👉 SUCCESS! Browser will stay open for 30 seconds...")
            await page.wait_for_timeout(30000)
        else:
            print("   ❌ Did NOT navigate to success page")
            print("\n⚠️  OBSERVATION NEEDED:")
            print("   - What do you see on the screen?")
            print("   - Is there an error message?")
            print("   - Is the date field highlighted in red?")
            print("   - What needs to be done before Finish works?")
            print("\n   👉 Browser will stay open for 5 MINUTES for observation...")

            await page.wait_for_timeout(300000)

    finally:
        print("\n🔚 Closing browser...")
        await browser.close()
        await p.stop()


if __name__ == "__main__":
    asyncio.run(debug_date_field())
