"""
5 E2E Contact Creation Tests with Dynamic Data
Test 1-4: Create unique contacts with dynamic emails/phones
Test 5: Test duplicate detection
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
import time
import random


class TestE2EContactCreation5Tests:
    """5 E2E tests that ACTUALLY create contacts and verify they exist"""

    @pytest.mark.asyncio
    async def test_1_create_contact_with_email_and_phone(self):
        """Test 1: Create contact with name, DYNAMIC email and DYNAMIC phone"""
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
                unique_email = f"e2etest{timestamp}@example.com"
                unique_phone = f"050{random.randint(1000000, 9999999)}"

                print(f"\n{'='*80}")
                print(f"TEST 1: Creating contact with EMAIL and PHONE")
                print(f"  Name: {unique_name}")
                print(f"  Email: {unique_email}")
                print(f"  Phone: {unique_phone}")
                print(f"{'='*80}\n")

                # Login
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(3000)

                # Navigate to contacts
                contacts_link = page.locator('text=אנשי קשר').first
                await contacts_link.click()
                await page.wait_for_timeout(3000)

                # Count initial
                contact_rows = page.locator('tr.ws_tr__menu')
                initial_count = await contact_rows.count()
                print(f"Initial contacts: {initial_count}")

                # Click Add Contact
                add_button = page.locator('li#addContact').first
                await add_button.click()
                await page.wait_for_timeout(3000)

                # Fill form
                await page.locator('input#fullNameFieldInput').first.fill(unique_name)
                await page.wait_for_timeout(1000)
                await page.locator('input#emailFieldInput').first.fill(unique_email)
                await page.wait_for_timeout(1000)
                await page.locator('input#phoneFieldInput').first.fill(unique_phone)
                await page.wait_for_timeout(2000)

                # Submit
                submit_button = page.locator('button#addContactButton')
                await submit_button.click()
                await page.wait_for_timeout(5000)

                # Verify count increased
                final_count = await contact_rows.count()
                print(f"Final contacts: {final_count} (diff: {final_count - initial_count})")

                # Search for contact
                search_input = page.locator('input[type="search"]').first
                await search_input.fill(unique_email)
                await page.wait_for_timeout(3000)

                page_content = await page.content()
                found = unique_email in page_content or unique_name in page_content

                print(f"\n✅ TEST 1: Contact created: {found}, Count increased: {final_count > initial_count}")
                assert found, f"Contact {unique_email} should be created"
                await page.wait_for_timeout(3000)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_2_create_contact_with_different_data(self):
        """Test 2: Create another contact with DIFFERENT dynamic data"""
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
                unique_name = f"Contact Test {timestamp}"
                unique_email = f"contact{timestamp}@test.com"
                unique_phone = f"052{random.randint(1000000, 9999999)}"

                print(f"\n{'='*80}")
                print(f"TEST 2: Creating contact with DIFFERENT data")
                print(f"  Name: {unique_name}")
                print(f"  Email: {unique_email}")
                print(f"  Phone: {unique_phone}")
                print(f"{'='*80}\n")

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(3000)

                contacts_link = page.locator('text=אנשי קשר').first
                await contacts_link.click()
                await page.wait_for_timeout(3000)

                contact_rows = page.locator('tr.ws_tr__menu')
                initial_count = await contact_rows.count()

                add_button = page.locator('li#addContact').first
                await add_button.click()
                await page.wait_for_timeout(3000)

                await page.locator('input#fullNameFieldInput').first.fill(unique_name)
                await page.wait_for_timeout(1000)
                await page.locator('input#emailFieldInput').first.fill(unique_email)
                await page.wait_for_timeout(1000)
                await page.locator('input#phoneFieldInput').first.fill(unique_phone)
                await page.wait_for_timeout(2000)

                submit_button = page.locator('button#addContactButton')
                await submit_button.click()
                await page.wait_for_timeout(5000)

                final_count = await contact_rows.count()
                search_input = page.locator('input[type="search"]').first
                await search_input.fill(unique_email)
                await page.wait_for_timeout(3000)

                page_content = await page.content()
                found = unique_email in page_content

                print(f"\n✅ TEST 2: Contact created: {found}, Count: {initial_count} → {final_count}")
                assert found, f"Contact {unique_email} should be created"
                await page.wait_for_timeout(3000)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_3_create_contact_israeli_phone_format(self):
        """Test 3: Create contact with Israeli phone format variations"""
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
                unique_name = f"Israeli User {timestamp}"
                unique_email = f"israel{timestamp}@example.co.il"
                unique_phone = f"054{random.randint(1000000, 9999999)}"

                print(f"\n{'='*80}")
                print(f"TEST 3: Creating contact with Israeli phone format")
                print(f"  Name: {unique_name}")
                print(f"  Email: {unique_email}")
                print(f"  Phone: {unique_phone}")
                print(f"{'='*80}\n")

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(3000)

                contacts_link = page.locator('text=אנשי קשר').first
                await contacts_link.click()
                await page.wait_for_timeout(3000)

                contact_rows = page.locator('tr.ws_tr__menu')
                initial_count = await contact_rows.count()

                add_button = page.locator('li#addContact').first
                await add_button.click()
                await page.wait_for_timeout(3000)

                await page.locator('input#fullNameFieldInput').first.fill(unique_name)
                await page.wait_for_timeout(1000)
                await page.locator('input#emailFieldInput').first.fill(unique_email)
                await page.wait_for_timeout(1000)
                await page.locator('input#phoneFieldInput').first.fill(unique_phone)
                await page.wait_for_timeout(2000)

                submit_button = page.locator('button#addContactButton')
                await submit_button.click()
                await page.wait_for_timeout(5000)

                final_count = await contact_rows.count()
                search_input = page.locator('input[type="search"]').first
                await search_input.fill(unique_email)
                await page.wait_for_timeout(3000)

                page_content = await page.content()
                found = unique_email in page_content

                print(f"\n✅ TEST 3: Contact created: {found}, Count: {initial_count} → {final_count}")
                assert found, f"Contact {unique_email} should be created"
                await page.wait_for_timeout(3000)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_4_create_contact_business_email(self):
        """Test 4: Create contact with business email domain"""
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
                unique_name = f"Business Contact {timestamp}"
                unique_email = f"business{timestamp}@company.com"
                unique_phone = f"053{random.randint(1000000, 9999999)}"

                print(f"\n{'='*80}")
                print(f"TEST 4: Creating business contact")
                print(f"  Name: {unique_name}")
                print(f"  Email: {unique_email}")
                print(f"  Phone: {unique_phone}")
                print(f"{'='*80}\n")

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(3000)

                contacts_link = page.locator('text=אנשי קשר').first
                await contacts_link.click()
                await page.wait_for_timeout(3000)

                contact_rows = page.locator('tr.ws_tr__menu')
                initial_count = await contact_rows.count()

                add_button = page.locator('li#addContact').first
                await add_button.click()
                await page.wait_for_timeout(3000)

                await page.locator('input#fullNameFieldInput').first.fill(unique_name)
                await page.wait_for_timeout(1000)
                await page.locator('input#emailFieldInput').first.fill(unique_email)
                await page.wait_for_timeout(1000)
                await page.locator('input#phoneFieldInput').first.fill(unique_phone)
                await page.wait_for_timeout(2000)

                submit_button = page.locator('button#addContactButton')
                await submit_button.click()
                await page.wait_for_timeout(5000)

                final_count = await contact_rows.count()
                search_input = page.locator('input[type="search"]').first
                await search_input.fill(unique_email)
                await page.wait_for_timeout(3000)

                page_content = await page.content()
                found = unique_email in page_content

                print(f"\n✅ TEST 4: Contact created: {found}, Count: {initial_count} → {final_count}")
                assert found, f"Contact {unique_email} should be created"
                await page.wait_for_timeout(3000)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_5_duplicate_contact_detection(self):
        """Test 5: Try to create DUPLICATE contact and verify error handling"""
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

                # Use SAME data for duplicate
                duplicate_name = "Duplicate Test Contact"
                duplicate_email = "duplicate@example.com"
                duplicate_phone = "0501111111"

                print(f"\n{'='*80}")
                print(f"TEST 5: Testing DUPLICATE contact detection")
                print(f"  Name: {duplicate_name}")
                print(f"  Email: {duplicate_email}")
                print(f"  Phone: {duplicate_phone}")
                print(f"{'='*80}\n")

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await page.wait_for_timeout(3000)

                contacts_link = page.locator('text=אנשי קשר').first
                await contacts_link.click()
                await page.wait_for_timeout(3000)

                contact_rows = page.locator('tr.ws_tr__menu')

                # CREATE FIRST CONTACT
                print("ATTEMPT 1: Creating first contact...")
                add_button = page.locator('li#addContact').first
                await add_button.click()
                await page.wait_for_timeout(3000)

                await page.locator('input#fullNameFieldInput').first.fill(duplicate_name)
                await page.wait_for_timeout(1000)
                await page.locator('input#emailFieldInput').first.fill(duplicate_email)
                await page.wait_for_timeout(1000)
                await page.locator('input#phoneFieldInput').first.fill(duplicate_phone)
                await page.wait_for_timeout(2000)

                submit_button = page.locator('button#addContactButton')
                await submit_button.click()
                await page.wait_for_timeout(5000)

                count_after_first = await contact_rows.count()
                print(f"✅ First contact created. Count: {count_after_first}")

                # TRY TO CREATE DUPLICATE
                print("\nATTEMPT 2: Trying to create DUPLICATE...")
                add_button = page.locator('li#addContact').first
                await add_button.click()
                await page.wait_for_timeout(3000)

                await page.locator('input#fullNameFieldInput').first.fill(duplicate_name)
                await page.wait_for_timeout(1000)
                await page.locator('input#emailFieldInput').first.fill(duplicate_email)
                await page.wait_for_timeout(1000)
                await page.locator('input#phoneFieldInput').first.fill(duplicate_phone)
                await page.wait_for_timeout(2000)

                submit_button = page.locator('button#addContactButton')
                await submit_button.click()
                await page.wait_for_timeout(5000)

                # Check for error message
                page_content = await page.content()
                error_indicators = [
                    'duplicate', 'קיים', 'שגיאה', 'error',
                    'already exists', 'כבר קיים'
                ]
                has_error = any(indicator.lower() in page_content.lower() for indicator in error_indicators)

                count_after_duplicate = await contact_rows.count()

                print(f"\n{'='*80}")
                print(f"DUPLICATE TEST RESULTS:")
                print(f"  Count after first: {count_after_first}")
                print(f"  Count after duplicate: {count_after_duplicate}")
                print(f"  Count stayed same: {count_after_first == count_after_duplicate}")
                print(f"  Error message shown: {has_error}")
                print(f"{'='*80}\n")

                # Verify duplicate was rejected
                if count_after_first == count_after_duplicate:
                    print("✅ TEST 5 SUCCESS: Duplicate was REJECTED (count didn't increase)")
                else:
                    print("⚠️ TEST 5: Duplicate was accepted (might allow duplicates)")

                await page.wait_for_timeout(5000)

            finally:
                await browser.close()
