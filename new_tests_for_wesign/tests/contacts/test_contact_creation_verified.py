"""
Contact Creation Test - ACTUALLY creates and verifies contact exists
This test manually fills the form, submits it, and searches for the created contact
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.contacts_page import ContactsPage
import time


class TestContactCreationVerified:
    """Test that ACTUALLY creates a contact and verifies it exists"""

    @pytest.mark.asyncio
    async def test_create_contact_and_verify_it_exists(self):
        """Create a contact manually and verify it appears in the list"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--start-maximized', '--force-device-scale-factor=1'],
                slow_mo=1500  # 1.5 seconds delay for visibility
            )
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()

            try:
                await page.wait_for_timeout(1000)
                auth_page = AuthPage(page)
                contacts_page = ContactsPage(page)

                # Generate unique contact data
                timestamp = int(time.time())
                unique_name = f"Automated Test {timestamp}"
                unique_email = f"autotest{timestamp}@example.com"

                print(f"\n{'='*60}")
                print(f"CREATING CONTACT:")
                print(f"  Name: {unique_name}")
                print(f"  Email: {unique_email}")
                print(f"{'='*60}\n")

                # Step 1: Login
                print("STEP 1: Logging in...")
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(3000)
                assert 'dashboard' in page.url, "Login failed"
                print("✅ Login successful")

                # Step 2: Navigate to contacts
                print("\nSTEP 2: Navigating to contacts page...")
                await contacts_page.navigate_to_contacts()
                await page.wait_for_timeout(3000)
                assert 'contacts' in page.url, "Navigation to contacts failed"
                print("✅ Navigation successful")

                # Step 3: Count initial contacts
                print("\nSTEP 3: Counting initial contacts...")
                initial_count = await contacts_page.count_contacts()
                print(f"✅ Initial contact count: {initial_count}")

                # Step 4: Click Add Contact button
                print("\nSTEP 4: Clicking 'Add Contact' button...")
                add_button = page.locator('li#addContact, li:has-text("הוסף איש קשר חדש")').first
                await add_button.click()
                await page.wait_for_timeout(3000)
                print("✅ Add Contact button clicked")

                # Step 5: Wait for modal/form to appear
                print("\nSTEP 5: Waiting for contact form...")
                name_input = page.locator('input#fullNameFieldInput, input[name="contactName"]').first
                await name_input.wait_for(state='visible', timeout=10000)
                print("✅ Contact form appeared")

                # Step 6: Fill name field
                print(f"\nSTEP 6: Filling name field with '{unique_name}'...")
                await name_input.fill(unique_name)
                await page.wait_for_timeout(2000)
                print("✅ Name filled")

                # Step 7: Fill email field
                print(f"\nSTEP 7: Filling email field with '{unique_email}'...")
                email_input = page.locator('input#emailFieldInput, input[name="contactEmail"]').first
                await email_input.fill(unique_email)
                await page.wait_for_timeout(2000)
                print("✅ Email filled")

                # Step 8: Click Confirm/Submit button
                print("\nSTEP 8: Clicking 'אישור' (Confirm) button...")
                save_button = page.locator('button#addContactButton, button:has-text("אישור")').first
                await save_button.click()
                await page.wait_for_timeout(5000)  # Wait for contact to be saved
                print("✅ Save button clicked")

                # Step 9: Verify contact count increased
                print("\nSTEP 9: Verifying contact was added...")
                await page.wait_for_timeout(2000)
                final_count = await contacts_page.count_contacts()
                print(f"  Initial count: {initial_count}")
                print(f"  Final count: {final_count}")

                count_increased = final_count > initial_count
                if count_increased:
                    print(f"✅ Contact count increased by {final_count - initial_count}")
                else:
                    print(f"⚠️ Contact count did not increase (still {final_count})")

                # Step 10: Search for the created contact by email
                print(f"\nSTEP 10: Searching for contact by email '{unique_email}'...")
                search_input = page.locator('input[type="search"], input.ct-input--primary').first
                await search_input.fill(unique_email)
                await page.wait_for_timeout(3000)
                print("✅ Search performed")

                # Step 11: Verify contact appears in search results
                print("\nSTEP 11: Verifying contact appears in search results...")
                search_count = await contacts_page.count_contacts()
                print(f"  Search results count: {search_count}")

                # Check if contact appears in the visible table
                page_content = await page.content()
                contact_found_in_page = unique_email in page_content or unique_name in page_content

                print(f"\n{'='*60}")
                print("VERIFICATION RESULTS:")
                print(f"  Count increased: {count_increased}")
                print(f"  Search found {search_count} contact(s)")
                print(f"  Contact visible in page: {contact_found_in_page}")
                print(f"{'='*60}\n")

                # FINAL ASSERTION: Contact must be found
                if contact_found_in_page and search_count > 0:
                    print("✅✅✅ SUCCESS: Contact was CREATED and VERIFIED! ✅✅✅")
                    assert True
                else:
                    print("❌❌❌ FAILURE: Contact was NOT found after creation! ❌❌❌")
                    # Take screenshot for debugging
                    await page.screenshot(path='contact_creation_failure.png')
                    assert False, f"Contact not found. Email visible: {contact_found_in_page}, Search count: {search_count}"

                # Pause to see the final result
                await page.wait_for_timeout(5000)

            finally:
                await browser.close()
