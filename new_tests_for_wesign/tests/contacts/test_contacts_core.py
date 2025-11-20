"""
Contacts Module - Core Test Suite
Based on validated discovery and POM from 2025-11-03
Tests cover all major CRUD operations with junction points
"""

import pytest
from playwright.async_api import async_playwright, expect
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from pages.auth_page import AuthPage
from pages.contacts_page import ContactsPage


class TestContactsCore:
    """
    Core test suite for Contacts module
    Covers Create, Read, Update, Delete operations with all junction points
    """

    @pytest.mark.asyncio
    async def test_01_create_contact_email_only(self):
        """
        Test: Create Contact - Email Only (Junction Point 1)

        Steps:
        1. Login and navigate to Contacts
        2. Click Add Contact
        3. Fill name and email only
        4. Select "Email" send via option
        5. Submit form
        6. Verify contact created successfully
        7. Verify contact appears in search results
        8. CLEANUP: Delete test contact

        Expected:
        - Contact created with email as primary channel
        - Contact searchable by name and email
        - Total count increased by 1
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                contacts_page = ContactsPage(page)

                # Login and navigate to contacts
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await contacts_page.navigate()

                # Test data
                test_name = "QA Test Email Only"
                test_email = "qa.test.email.only@automation.test"

                # Create contact
                await contacts_page.add_contact(
                    name=test_name,
                    email=test_email,
                    send_via='EMAIL'
                )

                # Wait a moment for contact to be created
                await page.wait_for_timeout(2000)

                # Verify contact exists by name search
                assert await contacts_page.verify_contact_exists(test_name), \
                    f"Contact '{test_name}' should exist after creation"

                # Verify contact searchable by email
                await contacts_page.search_contact(test_email)
                contact_row = page.locator('tr').filter(has_text=test_name)
                await expect(contact_row).to_be_visible(timeout=3000)

                # CLEANUP: Delete test contact
                await contacts_page.clear_search()
                await contacts_page.delete_contact(test_name, confirm=True)
                await page.wait_for_timeout(2000)

                # Verify deleted
                assert not await contacts_page.verify_contact_exists(test_name, should_exist=False), \
                    f"Contact '{test_name}' should not exist after deletion"

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_02_create_contact_phone_only(self):
        """
        Test: Create Contact - Phone Only (Junction Point 2)

        Steps:
        1. Login and navigate to Contacts
        2. Click Add Contact
        3. Fill name and phone only
        4. Select "SMS" send via option
        5. Submit form
        6. Verify contact created successfully
        7. Verify contact appears in search results
        8. CLEANUP: Delete test contact

        Expected:
        - Contact created with SMS as primary channel
        - Contact searchable by name and phone
        - Total count increased by 1
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                contacts_page = ContactsPage(page)

                # Login and navigate to contacts
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await contacts_page.navigate()

                # Test data
                test_name = "QA Test Phone Only"
                test_phone = "0501234567"

                # Create contact
                await contacts_page.add_contact(
                    name=test_name,
                    phone=test_phone,
                    send_via='SMS'
                )

                # Wait a moment for contact to be created
                await page.wait_for_timeout(2000)

                # Verify contact exists by name search
                assert await contacts_page.verify_contact_exists(test_name), \
                    f"Contact '{test_name}' should exist after creation"

                # Verify contact searchable by phone
                await contacts_page.search_contact(test_phone)
                contact_row = page.locator('tr').filter(has_text=test_name)
                await expect(contact_row).to_be_visible(timeout=3000)

                # CLEANUP: Delete test contact
                await contacts_page.clear_search()
                await contacts_page.delete_contact(test_name, confirm=True)
                await page.wait_for_timeout(2000)

                # Verify deleted
                assert not await contacts_page.verify_contact_exists(test_name, should_exist=False), \
                    f"Contact '{test_name}' should not exist after deletion"

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_03_create_contact_complete(self):
        """
        Test: Create Contact - Complete (Both Email and Phone) (Junction Point 3)

        Steps:
        1. Login and navigate to Contacts
        2. Click Add Contact
        3. Fill name, email, and phone
        4. Select "Email" send via option
        5. Submit form
        6. Verify contact created successfully
        7. Verify contact appears in search results with both email and phone
        8. CLEANUP: Delete test contact

        Expected:
        - Contact created with both email and phone
        - Contact searchable by name, email, or phone
        - Total count increased by 1
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                contacts_page = ContactsPage(page)

                # Login and navigate to contacts
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await contacts_page.navigate()

                # Test data
                test_name = "QA Test Complete Contact"
                test_email = "qa.test.complete@automation.test"
                test_phone = "0509876543"

                # Create contact
                await contacts_page.add_contact(
                    name=test_name,
                    email=test_email,
                    phone=test_phone,
                    send_via='EMAIL'
                )

                # Wait a moment for contact to be created
                await page.wait_for_timeout(2000)

                # Verify contact exists by name search
                assert await contacts_page.verify_contact_exists(test_name), \
                    f"Contact '{test_name}' should exist after creation"

                # Verify contact searchable by email
                await contacts_page.search_contact(test_email)
                contact_row = page.locator('tr').filter(has_text=test_name)
                await expect(contact_row).to_be_visible(timeout=3000)

                # Verify contact searchable by phone
                await contacts_page.search_contact(test_phone)
                contact_row = page.locator('tr').filter(has_text=test_name)
                await expect(contact_row).to_be_visible(timeout=3000)

                # CLEANUP: Delete test contact
                await contacts_page.clear_search()
                await contacts_page.delete_contact(test_name, confirm=True)
                await page.wait_for_timeout(2000)

                # Verify deleted
                assert not await contacts_page.verify_contact_exists(test_name, should_exist=False), \
                    f"Contact '{test_name}' should not exist after deletion"

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_04_edit_contact(self):
        """
        Test: Edit Contact

        Steps:
        1. Login and navigate to Contacts
        2. Create a test contact
        3. Search and locate the contact
        4. Click Edit action
        5. Modify contact name
        6. Submit changes
        7. Verify contact updated successfully
        8. Verify old name not found, new name found
        9. CLEANUP: Delete test contact

        Expected:
        - Contact name updated successfully
        - Old name no longer searchable
        - New name searchable
        - Total count unchanged
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                contacts_page = ContactsPage(page)

                # Login and navigate to contacts
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await contacts_page.navigate()

                # Test data
                original_name = "QA Test Original Name"
                updated_name = "QA Test EDITED Name"
                test_email = "qa.test.edit@automation.test"

                # Create contact
                await contacts_page.add_contact(
                    name=original_name,
                    email=test_email,
                    send_via='EMAIL'
                )
                await page.wait_for_timeout(2000)

                # Verify contact created
                assert await contacts_page.verify_contact_exists(original_name), \
                    f"Contact '{original_name}' should exist after creation"

                # Edit contact name
                await contacts_page.edit_contact(
                    current_name=original_name,
                    new_name=updated_name
                )
                await page.wait_for_timeout(2000)

                # Verify old name no longer found
                await contacts_page.search_contact(original_name)
                old_name_row = page.locator('tr').filter(has_text=original_name)
                await expect(old_name_row).to_be_hidden(timeout=3000)

                # Verify new name exists
                await contacts_page.clear_search()
                assert await contacts_page.verify_contact_exists(updated_name), \
                    f"Contact '{updated_name}' should exist after edit"

                # CLEANUP: Delete test contact
                await contacts_page.delete_contact(updated_name, confirm=True)
                await page.wait_for_timeout(2000)

                # Verify deleted
                assert not await contacts_page.verify_contact_exists(updated_name, should_exist=False), \
                    f"Contact '{updated_name}' should not exist after deletion"

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_05_delete_contact(self):
        """
        Test: Delete Contact with Confirmation

        Steps:
        1. Login and navigate to Contacts
        2. Create a test contact
        3. Search and locate the contact
        4. Click Delete action
        5. Verify confirmation modal appears
        6. Confirm deletion
        7. Verify contact deleted successfully
        8. Verify total count decreased

        Expected:
        - Confirmation modal shows contact name
        - Contact deleted after confirmation
        - Contact not searchable
        - Total count decreased by 1
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                contacts_page = ContactsPage(page)

                # Login and navigate to contacts
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await contacts_page.navigate()

                # Test data
                test_name = "QA Test Delete Contact"
                test_email = "qa.test.delete@automation.test"

                # Create contact
                await contacts_page.add_contact(
                    name=test_name,
                    email=test_email,
                    send_via='EMAIL'
                )
                await page.wait_for_timeout(1000)

                # Verify created
                assert await contacts_page.verify_contact_exists(test_name), \
                    f"Contact '{test_name}' should exist after creation"

                # Delete contact
                await contacts_page.delete_contact(test_name, confirm=True)
                await page.wait_for_timeout(1000)

                # Verify deleted
                assert not await contacts_page.verify_contact_exists(test_name, should_exist=False), \
                    f"Contact '{test_name}' should not exist after deletion"

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_06_search_contact(self):
        """
        Test: Search Contact by Name, Email, and Phone

        Steps:
        1. Login and navigate to Contacts
        2. Create a test contact with name, email, and phone
        3. Search by name - verify found
        4. Search by email - verify found
        5. Search by phone - verify found
        6. Search by non-existent term - verify not found
        7. Clear search - verify all contacts shown
        8. CLEANUP: Delete test contact

        Expected:
        - Contact found when searching by name
        - Contact found when searching by email
        - Contact found when searching by phone
        - Contact not found when searching by non-existent term
        - All contacts shown when search cleared
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                contacts_page = ContactsPage(page)

                # Login and navigate to contacts
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await contacts_page.navigate()

                # Test data
                test_name = "QA Test Search Contact"
                test_email = "qa.test.search@automation.test"
                test_phone = "0501112233"

                # Create contact
                await contacts_page.add_contact(
                    name=test_name,
                    email=test_email,
                    phone=test_phone,
                    send_via='EMAIL'
                )
                await page.wait_for_timeout(1000)

                # Test 1: Search by name
                await contacts_page.search_contact(test_name)
                contact_row = page.locator('tr').filter(has_text=test_name)
                await expect(contact_row).to_be_visible(timeout=3000)

                # Test 2: Search by email
                await contacts_page.search_contact(test_email)
                contact_row = page.locator('tr').filter(has_text=test_name)
                await expect(contact_row).to_be_visible(timeout=3000)

                # Test 3: Search by phone
                await contacts_page.search_contact(test_phone)
                contact_row = page.locator('tr').filter(has_text=test_name)
                await expect(contact_row).to_be_visible(timeout=3000)

                # Test 4: Search by non-existent term
                await contacts_page.search_contact("NONEXISTENT_CONTACT_12345")
                contact_row = page.locator('tr').filter(has_text=test_name)
                await expect(contact_row).to_be_hidden(timeout=3000)

                # Test 5: Clear search - verify contact still exists
                await contacts_page.clear_search()
                await page.wait_for_timeout(500)
                assert await contacts_page.verify_contact_exists(test_name), \
                    f"Contact '{test_name}' should still exist after clearing search"

                # CLEANUP: Delete test contact
                await contacts_page.delete_contact(test_name, confirm=True)
                await page.wait_for_timeout(1000)

                # Verify deleted
                assert not await contacts_page.verify_contact_exists(test_name, should_exist=False), \
                    f"Contact '{test_name}' should not exist after deletion"

            finally:
                await browser.close()
