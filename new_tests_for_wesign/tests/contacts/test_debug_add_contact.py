"""
Debug test to verify contact creation actually works
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.contacts_page import ContactsPage
import time


class TestDebugAddContact:
    """Debug test to verify contact is actually added"""

    @pytest.mark.asyncio
    async def test_debug_add_contact_with_verification(self):
        """Debug test to add contact and verify it appears in the list"""
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

                print("\n=== STEP 1: Login ===")
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(3000)
                print(f"Current URL: {page.url}")

                print("\n=== STEP 2: Navigate to contacts ===")
                await contacts_page.navigate_to_contacts()
                await page.wait_for_timeout(3000)
                print(f"Current URL: {page.url}")
                await page.screenshot(path='debug_contacts_01_page.png')

                print("\n=== STEP 3: Count existing contacts ===")
                initial_count = await contacts_page.count_contacts()
                print(f"Initial contact count: {initial_count}")

                print("\n=== STEP 4: Check if add contact button is available ===")
                add_available = await contacts_page.is_add_contact_available()
                print(f"Add contact available: {add_available}")

                if add_available:
                    print("\n=== STEP 5: Click add contact button ===")
                    await contacts_page.click_add_contact()
                    await page.wait_for_timeout(3000)
                    await page.screenshot(path='debug_contacts_02_modal.png')

                    modal_visible = await contacts_page.is_contact_modal_visible()
                    print(f"Modal visible: {modal_visible}")

                    print("\n=== STEP 6: Fill contact form ===")
                    unique_email = f"test_{int(time.time())}@example.com"
                    contact_data = {
                        'name': f'Test Contact {int(time.time())}',
                        'email': unique_email
                    }
                    print(f"Creating contact: {contact_data}")

                    # Use the create_contact method which fills and submits
                    print("\n=== STEP 7: Create contact using create_contact() method ===")
                    creation_result = await contacts_page.create_contact(contact_data)
                    print(f"Creation result: {creation_result}")
                    await page.wait_for_timeout(5000)  # Wait for contact to be added
                    await page.screenshot(path='debug_contacts_03_after_create.png')

                    print("\n=== STEP 8: Verify contact was added ===")
                    final_count = await contacts_page.count_contacts()
                    print(f"Final contact count: {final_count}")
                    print(f"Contact added: {final_count > initial_count}")

                    # Search for the new contact
                    print(f"\n=== STEP 9: Search for new contact by email ===")
                    await contacts_page.search_contacts(unique_email)
                    await page.wait_for_timeout(3000)
                    await page.screenshot(path='debug_contacts_04_search_result.png')

                    search_results = await contacts_page.count_contacts()
                    print(f"Search found {search_results} contacts")

                    if search_results > 0:
                        print("✅ SUCCESS: Contact was created and found in the list!")
                    else:
                        print("❌ FAILED: Contact not found after creation")

                else:
                    print("❌ Add contact button not available")

                # Pause for 5 seconds to see final state
                await page.wait_for_timeout(5000)

            finally:
                await browser.close()
