"""
Manual exploration script for Date Field
Opens browser, navigates to date field page, and PAUSES for you to show me the steps
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from pages.auth_page import AuthPage

# Test PDF path
test_pdf = Path(__file__).parent / "test_files" / "sample.pdf"


async def manual_exploration():
    """Open browser and pause for manual exploration"""

    print("\n" + "="*80)
    print("MANUAL EXPLORATION: Date Field")
    print("="*80)

    # Launch browser HEADED with slow motion
    p = await async_playwright().start()
    browser = await p.chromium.launch(
        headless=False,
        slow_mo=500,
        args=['--no-sandbox', '--start-maximized']
    )
    context = await browser.new_context(no_viewport=True)
    page = await context.new_page()

    try:
        # Step 1: Login
        print("\n📍 STEP 1: Logging in...")
        auth_page = AuthPage(page)
        await auth_page.navigate()
        await auth_page.login_with_company_user()
        print("   ✅ Login successful")
        await page.wait_for_timeout(2000)

        # Step 2: Upload PDF
        print("\n📍 STEP 2: Uploading PDF...")
        upload_button = page.locator('button:has-text("העלאת קובץ")').first
        async with page.expect_file_chooser() as fc_info:
            await upload_button.click()
        file_chooser = await fc_info.value
        await file_chooser.set_files(str(test_pdf.absolute()))
        print("   ✅ PDF uploaded")
        await page.wait_for_timeout(2000)

        # Step 3: Navigate to self-sign
        print("\n📍 STEP 3: Navigating to self-sign mode...")
        self_sign_button = page.locator('button:has-text("חתימה אישית")').first
        await self_sign_button.click()
        await page.wait_for_timeout(2000)

        edit_button = page.locator('button:has-text("עריכת מסמך")').first
        await edit_button.click()
        await page.wait_for_timeout(3000)
        print(f"   ✅ On self-sign fields page: {page.url}")

        # Step 4: Click Date field button
        print("\n📍 STEP 4: Clicking Date field button...")
        date_button = page.locator('button:has-text("תאריך")').first
        await date_button.click()
        print("   ✅ Date field button clicked")
        await page.wait_for_timeout(3000)

        # NOW PAUSE - Browser stays open for you to show me
        print("\n" + "="*80)
        print("🛑 BROWSER IS NOW OPEN AND PAUSED")
        print("="*80)
        print("\n👉 Please show me step by step:")
        print("   1. Where is the date field on the PDF?")
        print("   2. What do you click to open the date picker?")
        print("   3. How do you select a date?")
        print("   4. After selecting date, what happens?")
        print("   5. Then can you click Finish and does it work?")
        print("\n📍 Current URL:", page.url)
        print("\n⏰ Browser will stay open for 10 MINUTES")
        print("   You can interact with the page freely during this time")
        print("="*80)

        # Wait 10 minutes for manual exploration
        await page.wait_for_timeout(600000)

    finally:
        print("\n🔚 Closing browser...")
        await browser.close()
        await p.stop()


if __name__ == "__main__":
    asyncio.run(manual_exploration())
