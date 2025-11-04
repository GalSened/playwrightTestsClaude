"""
Debug test to find the upload button/functionality
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.documents_page import DocumentsPage


@pytest.mark.asyncio
async def test_debug_find_upload_button():
    """Debug: Find upload button on documents page"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=['--no-sandbox', '--start-maximized', '--start-fullscreen'],
            slow_mo=1500
        )
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        try:
            auth_page = AuthPage(page)
            documents_page = DocumentsPage(page)

            print("\n" + "="*80)
            print("DEBUG: Finding upload button/functionality")
            print("="*80)

            # Login and navigate
            await auth_page.navigate()
            await auth_page.login_with_company_user()
            await documents_page.navigate_to_documents()
            await page.wait_for_timeout(3000)

            print(f"\n📍 Current URL: {page.url}")

            # List ALL buttons on the page
            print("\n📋 Listing all buttons on documents page:")
            all_buttons = page.locator('button')
            button_count = await all_buttons.count()
            print(f"Found {button_count} buttons\n")

            for i in range(min(button_count, 30)):
                btn = all_buttons.nth(i)
                try:
                    if await btn.is_visible(timeout=1000):
                        text = await btn.text_content()
                        html = await btn.evaluate('el => el.outerHTML')
                        print(f"Button {i+1}:")
                        print(f"  Text: '{text}'")
                        print(f"  HTML: {html[:200]}")
                        print()
                except Exception as e:
                    pass

            # Look for file input
            print("\n📋 Looking for file input elements:")
            file_inputs = page.locator('input[type="file"]')
            input_count = await file_inputs.count()
            print(f"Found {input_count} file input elements\n")

            for i in range(input_count):
                inp = file_inputs.nth(i)
                html = await inp.evaluate('el => el.outerHTML')
                print(f"File input {i+1}: {html}")

            # Keep browser open for manual inspection
            print("\n⏸️  Browser will stay open for 10 seconds for manual inspection...")
            await page.wait_for_timeout(10000)

        finally:
            await browser.close()
