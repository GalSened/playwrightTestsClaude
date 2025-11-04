"""
Debug test to investigate documents page navigation issue
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.documents_page import DocumentsPage


class TestDebugNavigation:
    """Debug test to see what's happening with documents navigation"""

    @pytest.mark.asyncio
    async def test_debug_documents_navigation(self):
        """Debug test with detailed logging and screenshots"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--start-maximized', '--force-device-scale-factor=1'],
                slow_mo=2000  # 2 seconds delay for maximum visibility
            )
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                print("\n=== STEP 1: Navigate to login page ===")
                await auth_page.navigate()
                await page.wait_for_timeout(3000)
                print(f"Current URL: {page.url}")
                await page.screenshot(path='debug_01_login_page.png')

                print("\n=== STEP 2: Login with company user ===")
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(3000)
                print(f"Current URL after login: {page.url}")
                await page.screenshot(path='debug_02_after_login.png')

                print("\n=== STEP 3: Check for documents navigation link ===")
                # Try to find documents link
                docs_selectors = [
                    'text=מסמכים',
                    'a[href*="documents"]',
                    'text=Documents',
                    '[data-nav="documents"]',
                    'nav a:has-text("מסמכים")'
                ]

                for selector in docs_selectors:
                    count = await page.locator(selector).count()
                    print(f"Selector '{selector}': found {count} elements")
                    if count > 0:
                        is_visible = await page.locator(selector).first.is_visible()
                        print(f"  First element visible: {is_visible}")

                print("\n=== STEP 4: Try to navigate to documents ===")
                await documents_page.navigate_to_documents()
                await page.wait_for_timeout(3000)
                print(f"Current URL after navigation: {page.url}")
                await page.screenshot(path='debug_03_documents_page.png')

                print("\n=== STEP 5: Check if documents page loaded ===")
                is_loaded = await documents_page.is_documents_page_loaded()
                print(f"Documents page loaded: {is_loaded}")

                print("\n=== STEP 6: Check page content ===")
                page_content = await page.content()
                print(f"Page title: {await page.title()}")
                print(f"Page has 'document' in content: {'document' in page_content.lower()}")
                print(f"Page has 'upload' in content: {'upload' in page_content.lower()}")

                # Pause for 5 seconds to see the final state
                await page.wait_for_timeout(5000)

            finally:
                await browser.close()
