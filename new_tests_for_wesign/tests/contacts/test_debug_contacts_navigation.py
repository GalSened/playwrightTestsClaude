"""
Debug test to investigate contacts page navigation issue
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.contacts_page import ContactsPage


class TestDebugContactsNavigation:
    """Debug test to see what's happening with contacts navigation"""

    @pytest.mark.asyncio
    async def test_debug_contacts_navigation(self):
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
                contacts_page = ContactsPage(page)

                print("\n=== STEP 1: Navigate to login page ===")
                await auth_page.navigate()
                await page.wait_for_timeout(3000)
                print(f"Current URL: {page.url}")

                print("\n=== STEP 2: Login with company user ===")
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(3000)
                print(f"Current URL after login: {page.url}")

                print("\n=== STEP 3: Check for contacts navigation link ===")
                # Try to find contacts link
                contacts_selectors = [
                    'text=אנשי קשר',
                    'text=Contacts',
                    'a[href*="contacts"]',
                    '[data-nav="contacts"]',
                    'nav a:has-text("אנשי קשר")'
                ]

                for selector in contacts_selectors:
                    count = await page.locator(selector).count()
                    print(f"Selector '{selector}': found {count} elements")
                    if count > 0:
                        is_visible = await page.locator(selector).first.is_visible()
                        print(f"  First element visible: {is_visible}")
                        if is_visible:
                            text = await page.locator(selector).first.text_content()
                            print(f"  Element text: {text}")

                print("\n=== STEP 4: Try to navigate to contacts ===")
                await contacts_page.navigate_to_contacts()
                await page.wait_for_timeout(3000)
                print(f"Current URL after navigation: {page.url}")

                print("\n=== STEP 5: Check page content ===")
                print(f"Page title: {await page.title()}")
                page_content = await page.content()
                print(f"Page has 'contact' in content: {'contact' in page_content.lower()}")
                print(f"Page has 'אנשי קשר' in content: {'אנשי קשר' in page_content}")

                # Pause for 5 seconds to see the final state
                await page.wait_for_timeout(5000)

            finally:
                await browser.close()
