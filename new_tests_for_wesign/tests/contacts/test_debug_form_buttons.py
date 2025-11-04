"""
Debug test to find the correct save button selector
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.contacts_page import ContactsPage
import time


class TestDebugFormButtons:
    @pytest.mark.asyncio
    async def test_find_save_button(self):
        """Find the correct save button after filling the form"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--start-maximized'],
                slow_mo=2000
            )
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                contacts_page = ContactsPage(page)

                # Login and navigate
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await contacts_page.navigate_to_contacts()
                await page.wait_for_timeout(3000)

                # Click add contact
                add_button = page.locator('li#addContact').first
                await add_button.click()
                await page.wait_for_timeout(3000)

                # Fill form
                name_input = page.locator('input#fullNameFieldInput').first
                await name_input.fill("Test Name")
                await page.wait_for_timeout(2000)

                email_input = page.locator('input#emailFieldInput').first
                await email_input.fill("test@example.com")
                await page.wait_for_timeout(2000)

                # Take screenshot
                await page.screenshot(path='form_filled.png', full_page=True)

                # Try to find all buttons
                print("\n=== Finding all buttons in the modal ===")
                all_buttons = page.locator('button, input[type="submit"]')
                button_count = await all_buttons.count()
                print(f"Found {button_count} buttons")

                for i in range(button_count):
                    try:
                        button = all_buttons.nth(i)
                        is_visible = await button.is_visible()
                        if is_visible:
                            text = await button.text_content()
                            html = await button.evaluate('el => el.outerHTML')
                            print(f"\nButton {i+1}:")
                            print(f"  Visible: {is_visible}")
                            print(f"  Text: '{text}'")
                            print(f"  HTML: {html[:200]}")
                    except:
                        pass

                # Wait to see
                await page.wait_for_timeout(10000)

            finally:
                await browser.close()
