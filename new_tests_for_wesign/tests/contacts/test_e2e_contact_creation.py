"""
E2E Contact Creation Test - Actually creates a contact with full verification
Tests with different combinations of fields to find what's required
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.contacts_page import ContactsPage
import time


class TestE2EContactCreation:
    """E2E tests that ACTUALLY create contacts and verify they exist"""

    @pytest.mark.asyncio
    async def test_create_contact_with_phone_number(self):
        """Test 1: Create contact with name, email AND phone number"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--start-maximized'],
                slow_mo=1500
            )
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()

            try:
                await page.wait_for_timeout(1000)
                auth_page = AuthPage(page)

                timestamp = int(time.time())
                unique_name = f"E2E Test {timestamp}"
                unique_email = f"e2e{timestamp}@example.com"
                unique_phone = "0501234567"  # Israeli phone format

                print(f"\n{'='*70}")
                print(f"TEST 1: Creating contact WITH phone number")
                print(f"  Name: {unique_name}")
                print(f"  Email: {unique_email}")
                print(f"  Phone: {unique_phone}")
                print(f"{'='*70}\n")

                # Login
                print("STEP 1: Logging in...")
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(3000)
                print("✅ Logged in")

                # Navigate to contacts
                print("\nSTEP 2: Navigating to contacts...")
                contacts_link = page.locator('text=אנשי קשר').first
                await contacts_link.click()
                await page.wait_for_timeout(3000)
                assert 'contacts' in page.url
                print("✅ On contacts page")

                # Count initial contacts
                print("\nSTEP 3: Counting contacts...")
                contact_rows = page.locator('tr.ws_tr__menu')
                initial_count = await contact_rows.count()
                print(f"✅ Initial count: {initial_count}")

                # Click Add Contact
                print("\nSTEP 4: Clicking Add Contact...")
                add_button = page.locator('li#addContact').first
                await add_button.click()
                await page.wait_for_timeout(3000)
                print("✅ Modal opened")

                # Fill name
                print(f"\nSTEP 5: Filling name '{unique_name}'...")
                name_input = page.locator('input#fullNameFieldInput').first
                await name_input.wait_for(state='visible')
                await name_input.fill(unique_name)
                await page.wait_for_timeout(1500)
                print("✅ Name filled")

                # Fill email
                print(f"\nSTEP 6: Filling email '{unique_email}'...")
                email_input = page.locator('input#emailFieldInput').first
                await email_input.fill(unique_email)
                await page.wait_for_timeout(1500)
                print("✅ Email filled")

                # Fill phone
                print(f"\nSTEP 7: Filling phone '{unique_phone}'...")
                phone_input = page.locator('input#phoneFieldInput').first
                await phone_input.fill(unique_phone)
                await page.wait_for_timeout(1500)
                print("✅ Phone filled")

                # Check if button is enabled now
                print("\nSTEP 8: Checking if submit button is enabled...")
                submit_button = page.locator('button#addContactButton')
                is_disabled = await submit_button.get_attribute('disabled')
                button_class = await submit_button.get_attribute('class')
                print(f"  Button disabled attribute: {is_disabled}")
                print(f"  Button class: {button_class}")

                # Try to click submit
                print("\nSTEP 9: Clicking submit button...")
                await submit_button.click()
                await page.wait_for_timeout(5000)
                print("✅ Submit button clicked")

                # Count after creation
                print("\nSTEP 10: Counting contacts after creation...")
                await page.wait_for_timeout(2000)
                final_count = await contact_rows.count()
                print(f"  Initial: {initial_count}")
                print(f"  Final: {final_count}")
                print(f"  Difference: {final_count - initial_count}")

                # Search for the contact
                print(f"\nSTEP 11: Searching for '{unique_email}'...")
                search_input = page.locator('input[type="search"]').first
                await search_input.fill(unique_email)
                await page.wait_for_timeout(3000)

                page_content = await page.content()
                contact_found = unique_email in page_content or unique_name in page_content

                print(f"\n{'='*70}")
                print(f"RESULTS:")
                print(f"  Count increased: {final_count > initial_count}")
                print(f"  Contact found in page: {contact_found}")
                print(f"{'='*70}\n")

                # Verify
                if contact_found and final_count > initial_count:
                    print("✅✅✅ SUCCESS: Contact was CREATED and VERIFIED!")
                    assert True
                else:
                    print("❌ FAILED: Contact not found")
                    await page.screenshot(path='e2e_contact_creation_failure.png')
                    assert False, f"Contact not created. Found: {contact_found}, Count: {final_count} vs {initial_count}"

                await page.wait_for_timeout(5000)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_create_contact_email_only(self):
        """Test 2: Try to create contact with ONLY name and email (no phone)"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--start-maximized'],
                slow_mo=1500
            )
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()

            try:
                await page.wait_for_timeout(1000)
                auth_page = AuthPage(page)

                timestamp = int(time.time())
                unique_name = f"E2E NoPhone {timestamp}"
                unique_email = f"nophone{timestamp}@example.com"

                print(f"\n{'='*70}")
                print(f"TEST 2: Creating contact WITHOUT phone number")
                print(f"  Name: {unique_name}")
                print(f"  Email: {unique_email}")
                print(f"  Phone: (empty)")
                print(f"{'='*70}\n")

                # Login and navigate
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(2000)

                contacts_link = page.locator('text=אנשי קשר').first
                await contacts_link.click()
                await page.wait_for_timeout(3000)

                # Click Add Contact
                add_button = page.locator('li#addContact').first
                await add_button.click()
                await page.wait_for_timeout(3000)

                # Fill only name and email
                name_input = page.locator('input#fullNameFieldInput').first
                await name_input.fill(unique_name)
                await page.wait_for_timeout(1500)

                email_input = page.locator('input#emailFieldInput').first
                await email_input.fill(unique_email)
                await page.wait_for_timeout(1500)

                # Check button state
                submit_button = page.locator('button#addContactButton')
                is_disabled = await submit_button.get_attribute('disabled')

                print(f"\nButton disabled without phone: {is_disabled}")

                if is_disabled is None:
                    print("✅ Button is ENABLED - trying to submit...")
                    await submit_button.click()
                    await page.wait_for_timeout(5000)

                    # Check if contact was created
                    search_input = page.locator('input[type="search"]').first
                    await search_input.fill(unique_email)
                    await page.wait_for_timeout(3000)

                    page_content = await page.content()
                    contact_found = unique_email in page_content

                    if contact_found:
                        print("✅ SUCCESS: Contact created WITHOUT phone number!")
                    else:
                        print("❌ Contact not created")
                else:
                    print("⚠️ Button is DISABLED - phone number is REQUIRED")

                await page.wait_for_timeout(5000)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_create_contact_phone_only(self):
        """Test 3: Try to create contact with ONLY name and phone (no email)"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--start-maximized'],
                slow_mo=1500
            )
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()

            try:
                await page.wait_for_timeout(1000)
                auth_page = AuthPage(page)

                timestamp = int(time.time())
                unique_name = f"E2E NoEmail {timestamp}"
                unique_phone = "0507654321"

                print(f"\n{'='*70}")
                print(f"TEST 3: Creating contact WITHOUT email")
                print(f"  Name: {unique_name}")
                print(f"  Email: (empty)")
                print(f"  Phone: {unique_phone}")
                print(f"{'='*70}\n")

                # Login and navigate
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(2000)

                contacts_link = page.locator('text=אנשי קשר').first
                await contacts_link.click()
                await page.wait_for_timeout(3000)

                # Click Add Contact
                add_button = page.locator('li#addContact').first
                await add_button.click()
                await page.wait_for_timeout(3000)

                # Fill only name and phone
                name_input = page.locator('input#fullNameFieldInput').first
                await name_input.fill(unique_name)
                await page.wait_for_timeout(1500)

                phone_input = page.locator('input#phoneFieldInput').first
                await phone_input.fill(unique_phone)
                await page.wait_for_timeout(1500)

                # Check button state
                submit_button = page.locator('button#addContactButton')
                is_disabled = await submit_button.get_attribute('disabled')

                print(f"\nButton disabled without email: {is_disabled}")

                if is_disabled is None:
                    print("✅ Button is ENABLED - trying to submit...")
                    await submit_button.click()
                    await page.wait_for_timeout(5000)

                    # Check if contact was created
                    search_input = page.locator('input[type="search"]').first
                    await search_input.fill(unique_name)
                    await page.wait_for_timeout(3000)

                    page_content = await page.content()
                    contact_found = unique_name in page_content

                    if contact_found:
                        print("✅ SUCCESS: Contact created WITHOUT email!")
                    else:
                        print("❌ Contact not created")
                else:
                    print("⚠️ Button is DISABLED - email might be REQUIRED")

                await page.wait_for_timeout(5000)

            finally:
                await browser.close()
