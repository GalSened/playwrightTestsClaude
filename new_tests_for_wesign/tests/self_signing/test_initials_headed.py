"""Run initials test in HEADED mode to see what happens"""
import pytest, asyncio
from pathlib import Path
from playwright.async_api import async_playwright
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from pages.auth_page import AuthPage

async def main():
    test_pdf = Path(__file__).parent.parent.parent / "test_files" / "sample.pdf"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, args=['--start-maximized'], slow_mo=1000)
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()
        
        # Login
        auth_page = AuthPage(page)
        await auth_page.navigate()
        await auth_page.login_with_company_user()
        
        # Upload
        upload_btn = page.locator('button:has-text("העלאת קובץ")').first
        async with page.expect_file_chooser() as fc:
            await upload_btn.click()
        (await fc.value).set_files(str(test_pdf.absolute()))
        await page.wait_for_timeout(2000)
        
        # Self-sign
        await page.locator('button:has-text("חתימה אישית")').first.click()
        await page.wait_for_timeout(2000)
        await page.locator('button:has-text("עריכת מסמך")').first.click()
        await page.wait_for_timeout(3000)
        
        # Add initials
        await page.locator('button:has-text("ראשי תיבות")').first.click()
        await page.wait_for_timeout(2000)
        
        # Open modal
        await page.locator('.ct-button--icon.button--field').first.click()
        print("\n\n✋ MODAL OPENED - Check the browser window!")
        print("What do you see in the modal?")
        await page.wait_for_timeout(60000)  # Wait 60 seconds to inspect
        
        await context.close()
        await browser.close()

asyncio.run(main())
