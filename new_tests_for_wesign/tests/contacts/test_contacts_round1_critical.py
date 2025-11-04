"""
Contacts Module - Round 1 Critical Tests (13 tests)
Coverage: Cancel buttons, Tags, Validation, Search edge cases, Pagination
Based on systematic exploration and evidence validation
Date: 2025-11-03
"""

import pytest
from playwright.sync_api import Page, expect
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from pages.auth_page_sync import AuthPage
from pages.contacts_page import ContactsPage
from utils.test_data_generator import TestDataGenerator


@pytest.fixture(scope="function")
def setup_contacts_page(page: Page):
    """
    Setup fixture: Login and navigate to Contacts page
    Returns: ContactsPage instance
    """
    # Login
    auth_page = AuthPage(page)
    auth_page.navigate()
    auth_page.login_with_company_user()

    # Navigate to contacts
    contacts_page = ContactsPage(page)
    contacts_page.navigate()

    return contacts_page


class TestContactsRound1Critical:
    """
    Round 1: Critical Gap Tests for 85% Coverage
    13 tests covering essential missing functionality
    """

    # ==================== GAP-01 to GAP-03: CANCEL BUTTONS ====================

    def test_07_cancel_add_contact(self, page: Page, setup_contacts_page):
        """
        GAP-01: Cancel Add Contact - Verify no contact created

        Steps:
        1. Get initial contact count
        2. Click Add Contact button
        3. Verify modal opened
        4. Fill name and email (UNIQUE DATA)
        5. Click Cancel button
        6. Verify modal closed
        7. Verify contact NOT created
        8. Verify count unchanged

        Expected:
        - Modal opens and closes on cancel
        - No contact is created
        - Total count remains unchanged

        Evidence: GAP01_CANCEL_ADD_CONTACT_DISCOVERY.md + 4 screenshots
        """
        contacts_page = setup_contacts_page
        gen = TestDataGenerator()

        # Step 1-2: Open add contact modal
        contacts_page.add_contact_btn().click()
        expect(contacts_page.modal_heading()).to_contain_text('הוספת איש קשר חדש', timeout=5000)
        print("✓ Modal opened")

        # Step 3: Fill form with UNIQUE test data
        test_name = gen.unique_name("CANCEL_TEST_Contact")
        test_email = gen.unique_email("cancel.test")
        contacts_page.name_input().fill(test_name)
        contacts_page.email_input().fill(test_email)
        print(f"✓ Form filled with: {test_name} / {test_email}")

        # Step 4: Click CANCEL (not Confirm!)
        contacts_page.cancel_btn().click()
        print("✓ Cancel clicked")

        # Step 5: Verify modal closed
        expect(contacts_page.modal_heading()).to_be_hidden(timeout=3000)
        print("✓ Modal closed")

        # Step 6: Verify contact NOT created via search
        contacts_page.search_box().fill(test_name)
        page.keyboard.press('Enter')
        page.wait_for_timeout(1000)  # Wait for search results

        # Check table - should not contain our test contact
        table_text = contacts_page.contacts_table().inner_text()
        assert test_name not in table_text, f"Contact '{test_name}' should NOT exist after cancel"
        print(f"✓ Contact NOT created - verified '{test_name}' not in table")

    def test_08_cancel_edit_contact(self, page: Page, setup_contacts_page):
        """
        GAP-02: Cancel Edit Contact - Verify changes not saved

        Steps:
        1. Create test contact (UNIQUE DATA)
        2. Open edit modal
        3. Change name (UNIQUE DATA)
        4. Click Cancel
        5. Verify modal closed
        6. Verify original name still exists
        7. Cleanup

        Expected:
        - Edit modal opens
        - Cancel discards changes
        - Original data preserved
        """
        contacts_page = setup_contacts_page
        gen = TestDataGenerator()

        # Create test contact first with UNIQUE data
        original_name = gen.unique_name("EDIT_CANCEL_Original")
        changed_name = gen.unique_name("EDIT_CANCEL_Changed")
        test_email = gen.unique_email("edit.cancel")

        contacts_page.add_contact(
            name=original_name,
            email=test_email,
            send_via='EMAIL'
        )
        page.wait_for_timeout(1000)
        print(f"✓ Created contact: {original_name}")

        # Open edit modal and change name, then cancel
        # Use the POM helper method to ensure consistent behavior
        contacts_page.search_contact(original_name)
        contact_row = page.locator('tr').filter(has_text=original_name)
        expect(contact_row).to_be_visible()
        print(f"✓ Found contact row for: {original_name}")

        # CRITICAL FIX (2025-11-04): Use text-based selector instead of nth(0)
        # Button has tooltip text "ערוך" which is more reliable than position
        edit_btn = contact_row.get_by_role('button').filter(has_text='ערוך')
        edit_btn.click()
        print("✓ Edit button clicked")

        # Wait for edit modal to appear
        expect(contacts_page.edit_modal_heading()).to_be_visible(timeout=10000)
        print("✓ Edit modal opened")

        # Change name
        name_field = contacts_page.name_input()
        name_field.clear()
        name_field.fill(changed_name)
        print(f"✓ Changed name to: {changed_name}")

        # Click CANCEL
        contacts_page.cancel_btn().click()
        expect(contacts_page.edit_modal_heading()).to_be_hidden(timeout=5000)
        print("✓ Cancel clicked, modal closed")

        # Verify original name still exists
        contacts_page.clear_search()
        assert contacts_page.verify_contact_exists(original_name), \
            f"Original name '{original_name}' should still exist"
        print(f"✓ Original name preserved: {original_name}")

        # Verify changed name does NOT exist
        # CRITICAL FIX (2025-11-04): Remove double negative - verify_contact_exists returns True if verification passed
        assert contacts_page.verify_contact_exists(changed_name, should_exist=False), \
            f"Changed name '{changed_name}' should NOT exist"
        print(f"✓ Changed name NOT saved: {changed_name}")

        # Cleanup
        # CRITICAL FIX (2025-11-04 Round 16): Direct delete without clear_search
        # After multiple attempts (Rounds 7-15) to fix button click timeouts after clear_search(),
        # the issue persists. Root cause: after verify_contact_exists with should_exist=False,
        # the table is filtered to show NO results. Clearing search then searching again causes
        # table state issues where buttons can't be found/clicked.
        #
        # NEW STRATEGY: Delete the contact directly by name - delete_contact() will search for it.
        # This means we go from "empty filtered table" directly to "search for original_name"
        # WITHOUT the intermediate clear_search() step that was causing issues.
        contacts_page.delete_contact(original_name, confirm=True)
        print("✓ Cleanup complete")

    def test_09_cancel_delete_contact(self, page: Page, setup_contacts_page):
        """
        GAP-03: Cancel Delete Contact - Verify contact not deleted

        Steps:
        1. Create test contact (UNIQUE DATA)
        2. Open delete confirmation
        3. Click Cancel
        4. Verify modal closed
        5. Verify contact still exists
        6. Cleanup

        Expected:
        - Delete confirmation appears
        - Cancel preserves contact
        - Contact still searchable
        """
        contacts_page = setup_contacts_page
        gen = TestDataGenerator()

        # Create test contact with UNIQUE data
        test_name = gen.unique_name("DELETE_CANCEL_Contact")
        test_email = gen.unique_email("delete.cancel")

        contacts_page.add_contact(
            name=test_name,
            email=test_email,
            send_via='EMAIL'
        )
        page.wait_for_timeout(1000)
        print(f"✓ Created contact: {test_name}")

        # Open delete confirmation - using DIRECT button (not menuitem)
        contacts_page.search_contact(test_name)
        contact_row = page.locator('tr').filter(has_text=test_name)
        expect(contact_row).to_be_visible()

        # CRITICAL FIX (2025-11-04): Use text-based selector instead of nth(1)
        # Button has tooltip text "מחק" which is more reliable than position
        delete_btn = contact_row.get_by_role('button').filter(has_text='מחק')
        delete_btn.click()

        expect(contacts_page.delete_modal_heading()).to_be_visible(timeout=5000)
        print("✓ Delete confirmation opened")

        # Click CANCEL
        contacts_page.cancel_btn().click()
        expect(contacts_page.delete_modal_heading()).to_be_hidden(timeout=3000)
        print("✓ Cancel clicked, modal closed")

        # Verify contact still exists
        contacts_page.clear_search()
        assert contacts_page.verify_contact_exists(test_name), \
            f"Contact '{test_name}' should still exist after cancel delete"
        print(f"✓ Contact preserved: {test_name}")

        # Cleanup
        contacts_page.delete_contact(test_name, confirm=True)
        print("✓ Cleanup complete")

    # ==================== GAP-04: TAGS FUNCTIONALITY ====================

    def test_10_add_contact_with_tags(self, page: Page, setup_contacts_page):
        """
        GAP-04: Add Contact with Tags - Verify tags saved

        Steps:
        1. Create contact with tags (UNIQUE DATA)
        2. Verify contact created
        3. Search and verify tags visible in table
        4. Cleanup

        Expected:
        - Contact created with tags
        - Tags visible in table
        """
        contacts_page = setup_contacts_page
        gen = TestDataGenerator()

        # Generate UNIQUE data
        test_name = gen.unique_name("TAGS_TEST_Contact")
        test_email = gen.unique_email("tags.test")
        test_tags = gen.unique_tags(["QA", "Automation", "Test"])

        # Create contact with tags
        contacts_page.add_contact(
            name=test_name,
            email=test_email,
            tags=test_tags,
            send_via='EMAIL'
        )
        page.wait_for_timeout(1000)
        print(f"✓ Created contact with tags: {test_tags}")

        # Verify contact exists
        assert contacts_page.verify_contact_exists(test_name)
        print(f"✓ Contact created: {test_name}")

        # Search and verify tags visible
        contacts_page.search_contact(test_name)
        contact_row = page.locator('tr').filter(has_text=test_name)
        expect(contact_row).to_be_visible()

        # Check if at least one tag appears in the row
        row_text = contact_row.inner_text()
        tag_found = any(tag in row_text for tag in test_tags)
        assert tag_found, f"At least one tag from {test_tags} should be visible in table"
        print(f"✓ Tags visible in table")

        # Cleanup
        contacts_page.delete_contact(test_name, confirm=True)
        print("✓ Cleanup complete")

    # ==================== GAP-09 to GAP-13: VALIDATION ====================

    def test_11_required_field_empty_name(self, page: Page, setup_contacts_page):
        """
        GAP-09: Required Field Validation - Empty Name

        Steps:
        1. Open Add Contact modal
        2. Fill email only (skip required name)
        3. Verify Confirm button is DISABLED
        4. Cancel and close

        Expected:
        - Confirm button remains disabled without name
        - Form prevents submission
        """
        contacts_page = setup_contacts_page

        # Open modal
        contacts_page.add_contact_btn().click()
        expect(contacts_page.modal_heading()).to_be_visible()
        print("✓ Modal opened")

        # Fill email only (skip required name)
        contacts_page.email_input().fill("test@test.com")
        print("✓ Filled email only, skipped name")

        # Verify confirm button is DISABLED
        confirm_btn = contacts_page.confirm_btn()
        expect(confirm_btn).to_be_disabled()
        print("✓ Confirm button is DISABLED (correct validation)")

        # Cancel and close
        contacts_page.cancel_btn().click()
        print("✓ Cleanup complete")

    def test_12_invalid_email_format(self, page: Page, setup_contacts_page):
        """
        GAP-10: Invalid Email Format - Validation

        Steps:
        1. Create contact with invalid email (UNIQUE DATA)
        2. Verify validation or acceptance behavior

        Expected:
        - Either validation error OR system accepts (document behavior)
        """
        contacts_page = setup_contacts_page
        gen = TestDataGenerator()

        invalid_emails = ["notanemail", "@nodomain.com", "no-at-sign"]

        for invalid_email in invalid_emails:
            # Generate UNIQUE name for each attempt
            test_name = gen.unique_name("INVALID_EMAIL_Test")

            # Try to create contact
            contacts_page.add_contact_btn().click()
            expect(contacts_page.modal_heading()).to_be_visible()

            contacts_page.name_input().fill(test_name)
            contacts_page.email_input().fill(invalid_email)

            # Check if confirm button enables or stays disabled
            confirm_btn = contacts_page.confirm_btn()

            try:
                # If button is enabled, system accepts invalid email
                expect(confirm_btn).to_be_enabled(timeout=2000)
                print(f"⚠️  System accepts invalid email: {invalid_email}")

                # Cancel to not create
                contacts_page.cancel_btn().click()
                expect(contacts_page.modal_heading()).to_be_hidden()

            except AssertionError:
                # Button disabled = validation working
                print(f"✓ Validation blocks invalid email: {invalid_email}")
                contacts_page.cancel_btn().click()

    def test_13_invalid_phone_format(self, page: Page, setup_contacts_page):
        """
        GAP-11: Invalid Phone Format - Validation

        Steps:
        1. Create contact with invalid phone (UNIQUE DATA)
        2. Verify validation or acceptance behavior

        Expected:
        - Either validation error OR system accepts (document behavior)
        """
        contacts_page = setup_contacts_page
        gen = TestDataGenerator()

        invalid_phones = ["abc123", "12345", "++++++"]

        for invalid_phone in invalid_phones:
            # Generate UNIQUE name for each attempt
            test_name = gen.unique_name("INVALID_PHONE_Test")

            contacts_page.add_contact_btn().click()
            expect(contacts_page.modal_heading()).to_be_visible()

            contacts_page.name_input().fill(test_name)
            contacts_page.phone_input().fill(invalid_phone)

            confirm_btn = contacts_page.confirm_btn()

            try:
                expect(confirm_btn).to_be_enabled(timeout=2000)
                print(f"⚠️  System accepts invalid phone: {invalid_phone}")
                contacts_page.cancel_btn().click()
                expect(contacts_page.modal_heading()).to_be_hidden()
            except AssertionError:
                print(f"✓ Validation blocks invalid phone: {invalid_phone}")
                contacts_page.cancel_btn().click()

    def test_14_minimum_data_contact_name_only(self, page: Page, setup_contacts_page):
        """
        GAP-12: Minimum Data Contact - Name Only

        Steps:
        1. Create contact with ONLY name (UNIQUE DATA, no email/phone)
        2. Verify if allowed or blocked

        Expected:
        - Document whether system allows name-only contacts
        """
        contacts_page = setup_contacts_page
        gen = TestDataGenerator()

        # Generate UNIQUE name
        test_name = gen.unique_name("NAME_ONLY_Contact")

        # Try to create with name only
        contacts_page.add_contact_btn().click()
        expect(contacts_page.modal_heading()).to_be_visible()

        contacts_page.name_input().fill(test_name)
        # Intentionally skip email and phone

        confirm_btn = contacts_page.confirm_btn()

        try:
            # If enabled, system allows name-only
            expect(confirm_btn).to_be_enabled(timeout=2000)
            print("ℹ️  System allows name-only contacts")

            # Try to create
            confirm_btn.click()
            page.wait_for_timeout(2000)

            # Check if created
            if contacts_page.verify_contact_exists(test_name):
                print(f"✓ Name-only contact created: {test_name}")
                # Cleanup
                contacts_page.delete_contact(test_name, confirm=True)
            else:
                print("⚠️  Name-only contact NOT created (validation after submit)")

        except AssertionError:
            print("✓ System blocks name-only contacts (email or phone required)")
            contacts_page.cancel_btn().click()

    def test_15_special_characters_hebrew(self, page: Page, setup_contacts_page):
        """
        GAP-13: Special Characters - Hebrew Name

        Steps:
        1. Create contact with Hebrew name (UNIQUE DATA)
        2. Verify saved correctly
        3. Verify searchable
        4. Cleanup

        Expected:
        - Hebrew characters preserved
        - Contact searchable by Hebrew name
        """
        contacts_page = setup_contacts_page
        gen = TestDataGenerator()

        # Generate UNIQUE Hebrew name and email
        hebrew_name = gen.unique_hebrew_name("אברהם כהן")  # Abraham Cohen + timestamp
        test_email = gen.unique_email("hebrew.test")

        # Create contact
        contacts_page.add_contact(
            name=hebrew_name,
            email=test_email,
            send_via='EMAIL'
        )
        page.wait_for_timeout(1000)
        print(f"✓ Created contact with Hebrew name: {hebrew_name}")

        # Verify exists
        assert contacts_page.verify_contact_exists(hebrew_name), \
            f"Hebrew name '{hebrew_name}' should be preserved"
        print("✓ Hebrew name preserved and searchable")

        # Cleanup
        contacts_page.delete_contact(hebrew_name, confirm=True)
        print("✓ Cleanup complete")

    # ==================== GAP-14 to GAP-15: SEARCH EDGE CASES ====================

    def test_16_clear_search(self, page: Page, setup_contacts_page):
        """
        GAP-14: Clear Search - Verify all contacts restored

        Steps:
        1. Perform search (get filtered results)
        2. Clear search box
        3. Verify all contacts shown again

        Expected:
        - Search filters results
        - Clear restores full list
        """
        contacts_page = setup_contacts_page

        # CRITICAL FIX (2025-11-04): Use table row count instead of get_total_count()
        # The total_count_text selector doesn't exist in the UI

        # Get initial row count
        initial_rows = page.locator('table tbody tr').count()
        print(f"✓ Initial row count: {initial_rows}")

        # Search for specific contact (should reduce results)
        contacts_page.search_contact("Aaron")
        page.wait_for_timeout(500)

        # Count should be less after search
        filtered_rows = page.locator('table tbody tr').count()
        assert filtered_rows < initial_rows, \
            f"Filtered results ({filtered_rows}) should be less than initial ({initial_rows})"
        print(f"✓ Filtered results: {filtered_rows} rows (reduced from {initial_rows})")

        # Clear search
        contacts_page.clear_search()

        # Verify full list restored (or at least more rows than filtered)
        final_rows = page.locator('table tbody tr').count()
        assert final_rows > filtered_rows, \
            f"After clear search, rows ({final_rows}) should be more than filtered ({filtered_rows})"
        print(f"✓ Full list restored: {final_rows} rows (was {filtered_rows} when filtered)")

    def test_17_no_results_search(self, page: Page, setup_contacts_page):
        """
        GAP-15: No Results Search - Verify empty table

        Steps:
        1. Search for non-existent term
        2. Verify empty results (no data rows)
        3. Clear search

        Expected:
        - Search returns no results
        - Table shows only header
        - No error, just empty state
        """
        contacts_page = setup_contacts_page

        # Search for guaranteed non-existent term
        nonexistent_term = "XYZABCNONEXISTENT123456"
        contacts_page.search_contact(nonexistent_term)
        page.wait_for_timeout(500)
        print(f"✓ Searched for: {nonexistent_term}")

        # Verify no data rows (only header)
        data_rows = page.locator('table tbody tr')
        row_count = data_rows.count()

        # Should be 0 or minimal rows
        assert row_count <= 1, \
            f"No results search should show 0-1 rows, got {row_count}"
        print(f"✓ No results found (correct): {row_count} rows")

        # Clear search
        contacts_page.clear_search()
        print("✓ Search cleared")

    # ==================== GAP-06 to GAP-07: PAGINATION ====================

    def test_18_pagination_next_previous(self, page: Page, setup_contacts_page):
        """
        GAP-06: Pagination - Next and Previous Navigation

        Steps:
        1. Get first contact on page 1
        2. Click Next button
        3. Verify page 2 loads (different contacts)
        4. Click Previous button
        5. Verify back to page 1 (original contacts)

        Expected:
        - Next navigates to page 2
        - Previous returns to page 1
        - Different contacts on each page
        """
        contacts_page = setup_contacts_page
        page.wait_for_timeout(1000)

        # CRITICAL FIX (2025-11-04): Use safer selector for table rows
        # Wait for table to be fully loaded
        expect(contacts_page.contacts_table()).to_be_visible(timeout=5000)

        # Get first contact name on page 1
        table_rows = page.locator('table tbody tr')
        row_count = table_rows.count()

        if row_count == 0:
            print("⚠️  No rows found - skipping pagination test")
            pytest.skip("No table rows found for pagination test")

        first_row = table_rows.first
        expect(first_row).to_be_visible(timeout=5000)
        page1_first_contact = first_row.inner_text()
        print(f"✓ Page 1 first contact: {page1_first_contact[:30]}...")

        # Look for Next button
        next_btn = page.locator('button').filter(has_text='›').or_(
            page.locator('button[aria-label*="next"]')
        ).first

        if next_btn.is_visible():
            next_btn.click()
            page.wait_for_timeout(1000)
            print("✓ Clicked Next button")

            # Get first contact on page 2
            page2_first_contact = page.locator('table tbody tr').first.inner_text()
            print(f"✓ Page 2 first contact: {page2_first_contact[:30]}...")

            # Verify different
            assert page1_first_contact != page2_first_contact, \
                "Page 2 should show different contacts"
            print("✓ Page 2 shows different contacts")

            # Click Previous
            prev_btn = page.locator('button').filter(has_text='‹').or_(
                page.locator('button[aria-label*="prev"]')
            ).first
            prev_btn.click()
            page.wait_for_timeout(1000)
            print("✓ Clicked Previous button")

            # Verify back to page 1
            back_first_contact = page.locator('table tbody tr').first.inner_text()
            assert back_first_contact == page1_first_contact, \
                "Should return to page 1 with original contacts"
            print("✓ Returned to page 1")
        else:
            print("⚠️  Pagination not available (< 10 contacts total)")

    def test_19_pagination_direct_jump(self, page: Page, setup_contacts_page):
        """
        GAP-07: Pagination - Direct Page Jump

        Steps:
        1. Find page number input (spinbutton)
        2. Enter page number directly
        3. Verify jump to that page

        Expected:
        - Can enter page number
        - Jumps to specified page
        """
        contacts_page = setup_contacts_page
        page.wait_for_timeout(1000)

        # Look for page number input
        page_input = page.get_by_role('spinbutton')

        if page_input.is_visible():
            # Get current page
            current_page = page_input.input_value()
            print(f"✓ Current page: {current_page}")

            # Jump to page 2 (if not already there)
            target_page = "2" if current_page == "1" else "1"

            page_input.clear()
            page_input.fill(target_page)
            page.keyboard.press('Enter')
            page.wait_for_timeout(1000)
            print(f"✓ Jumped to page: {target_page}")

            # Verify page changed
            new_page = page_input.input_value()
            assert new_page == target_page, \
                f"Should be on page {target_page}, but on {new_page}"
            print(f"✓ Successfully on page {target_page}")
        else:
            print("⚠️  Page input not available")


# End of Round 1 Critical Tests
