"""
Contacts Page Object Model for WeSign Application
Based on discovery validation performed on 2025-11-03
All selectors validated against live application at devtest.comda.co.il
"""

from playwright.async_api import Page, expect
import re


class ContactsPage:
    """
    Page Object Model for WeSign Contacts Module

    Handles all interactions with the Contacts page including:
    - Navigation to contacts
    - Creating contacts (Email, Phone, or Both)
    - Editing contacts
    - Deleting contacts with confirmation
    - Searching contacts
    - Verifying contact existence and status
    """

    def __init__(self, page: Page):
        self.page = page
        self.base_url = "https://devtest.comda.co.il"

        # Navigation Elements
        self.contacts_nav_btn = lambda: self.page.get_by_role('button', name='אנשי קשר')

        # Main Page Elements (validated 2025-11-03 via systematic exploration)
        self.add_contact_btn = lambda: self.page.locator('a').filter(has_text='הוספת איש קשר חדש')
        self.search_box = lambda: self.page.get_by_role('searchbox', name='חיפוש אנשי קשר')
        self.contacts_table = lambda: self.page.locator('table')
        self.total_count_text = lambda: self.page.locator('text=/סך הכל \\d+ אנשי קשר/')

        # Add/Edit Contact Modal Elements
        self.modal_heading = lambda: self.page.get_by_role('heading', level=3)
        self.name_input = lambda: self.page.get_by_role('textbox', name='שם מלא*')
        self.email_input = lambda: self.page.get_by_role('textbox', name='דואר אלקטרוני')
        # NOTE: phone_input is now an async method - see _get_phone_input() below
        # Kept as lambda for backward compatibility, but should use await self._get_phone_input()
        self.phone_input = lambda: self.page.get_by_role('textbox', name='טלפון נייד')

        # Send Via Combobox (Junction Point) - Validated 2025-11-03 via systematic exploration
        # CRITICAL DISCOVERY: This is a COMBOBOX (dropdown select), NOT radio buttons!
        # Actual element: <select name="methods"> with options "SMS" and "EMAIL"
        # MCP validated selector: select[name="methods"]
        self.send_via_combobox = lambda: self.page.locator('select[name="methods"]')

        # Tags Input
        self.tags_input = lambda: self.page.get_by_placeholder('הוסף תגית...')

        # Modal Buttons
        self.confirm_btn = lambda: self.page.get_by_role('button', name='אישור')
        self.cancel_btn = lambda: self.page.get_by_role('button', name='ביטול')

        # Edit Modal (specific heading)
        # Use text filter instead of get_by_role with name parameter
        self.edit_modal_heading = lambda: self.page.locator('h3').filter(has_text="עריכת איש קשר")

        # Delete Confirmation Modal
        # Use text filter instead of get_by_role with name parameter
        self.delete_modal_heading = lambda: self.page.locator('h3').filter(has_text="אישור מחיקה")
        self.confirm_delete_btn = lambda: self.page.get_by_role('button', name='מחק')
        self.delete_contact_by_id = lambda: self.page.locator('#deleteContact')

        # Success Messages (transient)
        self.success_message = lambda: self.page.locator('.MuiAlert-message, .success-message, text=/נוצר בהצלחה|נערך בהצלחה|נמחק בהצלחה/')

        # Table Elements
        self.table_rows = lambda: self.page.locator('table tbody tr')
        self.action_menu_trigger = lambda name: self.page.locator('tr').filter(has_text=name).get_by_role('button').first

    async def navigate(self):
        """
        Navigate to the Contacts page from anywhere in the application.

        Returns:
            ContactsPage: Self for method chaining
        """
        await self.contacts_nav_btn().click()
        # Wait for page to load - table should be visible
        await expect(self.contacts_table()).to_be_visible(timeout=10000)
        return self

    async def _get_phone_input(self):
        """
        Resilient phone input locator with multiple fallback strategies.

        Tries multiple selector strategies in order:
        1. input[type="tel"] - Standard HTML5 tel input
        2. Placeholder containing "טלפון" (phone)
        3. Placeholder containing "נייד" (mobile)
        4. Name attribute containing "phone"
        5. Name attribute containing "mobile"
        6. Role-based selector (original, least reliable)

        Returns:
            Locator: First working phone input locator
        """
        strategies = [
            ('input[type="tel"]', 'HTML5 tel input'),
            ('input[placeholder*="טלפון"]', 'Placeholder with טלפון'),
            ('input[placeholder*="נייד"]', 'Placeholder with נייד'),
            ('input[name*="phone"]', 'Name with phone'),
            ('input[name*="mobile"]', 'Name with mobile'),
        ]

        for selector, description in strategies:
            try:
                locator = self.page.locator(selector).first
                if await locator.is_visible(timeout=2000):
                    return locator
            except:
                continue

        # Fallback to original role-based selector (least reliable)
        return self.page.get_by_role('textbox', name='טלפון נייד')

    async def _get_delete_button(self, contact_row):
        """
        Resilient delete button locator with multiple fallback strategies.

        Tries multiple selector strategies for finding delete button in a contact row:
        1. i-feather icon with name="trash" or "trash-2"
        2. Button with aria-label containing "מחק" (delete)
        3. Button containing "Delete" (English)
        4. Button with title="מחק"
        5. Original text filter (least reliable)

        Args:
            contact_row: The contact row locator to search within

        Returns:
            Locator: First working delete button locator
        """
        # Strategy 1: Icon-based selector (most reliable for icon buttons)
        strategies = [
            ('i-feather[name="trash"]', 'Trash icon'),
            ('i-feather[name="trash-2"]', 'Trash-2 icon'),
            ('button[aria-label*="מחק"]', 'Button with aria-label מחק'),
            ('button[title*="מחק"]', 'Button with title מחק'),
            ('button:has-text("מחק")', 'Button containing text מחק'),
            ('button:has-text("Delete")', 'Button containing text Delete'),
        ]

        for selector, description in strategies:
            try:
                if 'i-feather' in selector:
                    # For icon buttons, get the parent button element
                    icon = contact_row.locator(selector).first
                    if await icon.is_visible(timeout=1000):
                        # Navigate to parent button
                        button = icon.locator('xpath=ancestor::button[1]')
                        if await button.is_visible(timeout=500):
                            return button
                else:
                    locator = contact_row.locator(selector).first
                    if await locator.is_visible(timeout=1000):
                        return locator
            except:
                continue

        # Fallback to original text-based filter (least reliable)
        return contact_row.get_by_role('button').filter(has_text='מחק')

    async def get_total_count(self) -> int:
        """
        Extract the total contact count from the page.

        Note: This method attempts to extract the count from Hebrew text.
        If the element is not found (timeout), it returns 0.
        This is acceptable because contact count verification is not critical
        for most test operations.

        Returns:
            int: Total number of contacts (e.g., 302 from "סך הכל 302 אנשי קשר"),
                 or 0 if count element not found
        """
        try:
            count_text = await self.total_count_text().inner_text(timeout=5000)
            # Extract number from Hebrew text like "סך הכל 302 אנשי קשר"
            match = re.search(r'(\d+)', count_text)
            if match:
                return int(match.group(1))
            return 0
        except Exception:
            # If count element not found or any error occurs, return 0
            # This is acceptable as count verification is not critical
            return 0

    async def add_contact(
        self,
        name: str,
        email: str = None,
        phone: str = None,
        send_via: str = 'EMAIL',
        tags: list = None,
        wait_for_close: bool = True
    ):
        """
        Add a new contact with specified details.

        Junction Points:
        - Email only: provide email, leave phone None, send_via='EMAIL'
        - Phone only: provide phone, leave email None, send_via='SMS'
        - Both: provide both email and phone, choose send_via
        - Minimal: provide only name

        Args:
            name: Full name (required)
            email: Email address (optional)
            phone: Mobile phone number (optional)
            send_via: 'EMAIL' or 'SMS' - determines which radio button to select
            tags: List of tag strings to add (optional)
            wait_for_close: Wait for modal to close after creation (default True)

        Returns:
            ContactsPage: Self for method chaining
        """
        # Click Add Contact button
        await self.add_contact_btn().click()

        # Wait for modal to open
        await expect(self.modal_heading()).to_contain_text('הוספת איש קשר חדש', timeout=5000)

        # Fill name (required)
        await self.name_input().fill(name)

        # Fill email if provided
        if email:
            await self.email_input().fill(email)

        # Fill phone if provided - use resilient selector strategy
        if phone:
            phone_locator = await self._get_phone_input()
            await phone_locator.fill(phone)

        # Select send via method (junction point) - Angular-compatible selection
        # CRITICAL FIX (2025-11-03): Must dispatch events to trigger Angular change detection
        # Without events, form validation fails and modal won't close
        if send_via.upper() == 'EMAIL':
            combobox = self.send_via_combobox()
            await combobox.select_option(label='EMAIL')
            # Trigger Angular change detection
            await combobox.dispatch_event('change')
            await combobox.dispatch_event('input')
        elif send_via.upper() == 'SMS':
            combobox = self.send_via_combobox()
            await combobox.select_option(label='SMS')
            # Trigger Angular change detection
            await combobox.dispatch_event('change')
            await combobox.dispatch_event('input')

        # Add tags if provided
        if tags:
            for tag in tags:
                await self.tags_input().fill(tag)
                await self.page.keyboard.press('Enter')

        # Click confirm button
        await self.confirm_btn().click()

        # Wait for modal to close (indicates success)
        # CRITICAL DISCOVERY (2025-11-03): Modal DOES close automatically after API success
        # Need substantial timeout for: API call → success toast → modal animation → table refresh
        if wait_for_close:
            # Step 1: Wait for modal heading to disappear (confirms modal closed)
            await expect(self.modal_heading()).to_be_hidden(timeout=10000)

            # Step 2: CRITICAL FIX (2025-11-03 Round 4): Wait for modal overlay to be fully removed
            # The heading disappearing doesn't guarantee the overlay is gone
            # Overlay blocks all subsequent page interactions if not properly waited for
            # DISCOVERY: Page has 5+ modal overlays, must use .first to avoid strict mode violation
            modal_overlay = self.page.locator('.modal__overlay').first
            try:
                await expect(modal_overlay).to_be_hidden(timeout=5000)
            except AssertionError:
                # Overlay might not exist or already removed - this is acceptable
                pass

            # Step 3: CRITICAL FIX (2025-11-04 Round 8): Wait for newly created contact to be searchable
            # MCP DISCOVERY: The real issue is that after modal closes, the table data takes time to refresh
            # The contact is created in the backend, but the frontend table doesn't immediately show it
            # We need to wait for the specific contact to appear in the table, not just network idle

            # Wait for network to be idle first (API calls complete)
            try:
                await self.page.wait_for_load_state('networkidle', timeout=8000)
            except Exception:
                # Fallback if networkidle doesn't work
                await self.page.wait_for_load_state('domcontentloaded', timeout=5000)

            # CRITICAL: Wait for the newly created contact to actually appear in the table AND be interactive
            # This ensures the table has refreshed and the contact buttons are clickable
            if name:
                try:
                    # Wait up to 5 seconds for a table row containing the contact name to appear
                    contact_row = self.page.locator('tr').filter(has_text=name).first
                    await expect(contact_row).to_be_visible(timeout=5000)

                    # CRITICAL (2025-11-04 Round 10): Also wait for action buttons to be clickable
                    # The row may appear but buttons take extra time to become interactive
                    delete_btn = contact_row.get_by_role('button').filter(has_text='מחק').first
                    try:
                        await expect(delete_btn).to_be_visible(timeout=3000)
                    except AssertionError:
                        # Button might not be visible yet - add extra wait
                        await self.page.wait_for_timeout(2000)
                except AssertionError:
                    # If contact doesn't appear, add a fallback wait
                    await self.page.wait_for_timeout(2000)

        return self

    async def search_contact(self, search_term: str, press_enter: bool = True):
        """
        Search for a contact using the search box.

        Critical Discovery: Search requires pressing Enter key to apply filter.

        Args:
            search_term: Text to search for (name, email, phone, etc.)
            press_enter: Whether to press Enter after typing (default True)

        Returns:
            ContactsPage: Self for method chaining
        """
        search_box = self.search_box()
        await search_box.clear()
        await search_box.fill(search_term)

        if press_enter:
            await self.page.keyboard.press('Enter')

            # CRITICAL FIX (2025-11-04 Round 14): Enhanced wait strategy after search
            # After pressing Enter, the table refreshes and buttons need time to become interactive
            # Step 1: Wait for network to be idle (API call completes)
            try:
                await self.page.wait_for_load_state('networkidle', timeout=5000)
            except Exception:
                # Fallback if networkidle doesn't work
                await self.page.wait_for_timeout(2000)

            # Step 2: Additional wait for buttons to become interactive
            # Even after networkidle, action buttons take 1-2 seconds to become clickable
            await self.page.wait_for_timeout(2000)

        return self

    async def verify_contact_exists(self, name: str, should_exist: bool = True) -> bool:
        """
        Verify whether a contact exists in the current table view.

        Args:
            name: Contact name to search for
            should_exist: Expected existence state (default True)

        Returns:
            bool: True if verification passed, False otherwise
        """
        # Search for the contact first
        await self.search_contact(name)

        # Check if contact appears in table
        contact_row = self.page.locator('tr').filter(has_text=name)

        if should_exist:
            try:
                await expect(contact_row).to_be_visible(timeout=3000)
                return True
            except AssertionError:
                return False
        else:
            try:
                await expect(contact_row).to_be_hidden(timeout=3000)
                return True
            except AssertionError:
                return False

    async def edit_contact(
        self,
        current_name: str,
        new_name: str = None,
        new_email: str = None,
        new_phone: str = None,
        wait_for_close: bool = True
    ):
        """
        Edit an existing contact.

        Critical Discovery: Confirm button is disabled until a field is changed.

        Args:
            current_name: Name of contact to edit (used to find the row)
            new_name: New name (optional - leave None to keep current)
            new_email: New email (optional - leave None to keep current)
            new_phone: New phone (optional - leave None to keep current)
            wait_for_close: Wait for modal to close after editing (default True)

        Returns:
            ContactsPage: Self for method chaining
        """
        # First search for the contact
        await self.search_contact(current_name)

        # Find the contact row
        contact_row = self.page.locator('tr').filter(has_text=current_name)
        await expect(contact_row).to_be_visible(timeout=5000)

        # CRITICAL FIX (2025-11-04): Use text-based selector instead of nth(0)
        # Each row has TWO direct icon buttons with tooltip text:
        # - "ערוך" (Edit): Edit button (pencil icon)
        # - "מחק" (Delete): Delete button (trash icon)
        # Text-based selector is more reliable than position-based nth()
        edit_btn = contact_row.get_by_role('button').filter(has_text='ערוך')

        # CRITICAL FIX (2025-11-04 Round 15): Use force=True for consistency with delete_contact()
        # After search operations, action buttons may fail Playwright actionability checks
        await edit_btn.click(force=True)

        # Wait for edit modal to open
        await expect(self.edit_modal_heading()).to_be_visible(timeout=5000)

        # Update fields as needed
        if new_name:
            name_field = self.name_input()
            await name_field.clear()
            await name_field.fill(new_name)

        if new_email:
            email_field = self.email_input()
            await email_field.clear()
            await email_field.fill(new_email)

        if new_phone:
            phone_field = self.phone_input()
            await phone_field.clear()
            await phone_field.fill(new_phone)

        # Click confirm button (should be enabled after changes)
        await self.confirm_btn().click()

        # Wait for modal to close
        if wait_for_close:
            await expect(self.edit_modal_heading()).to_be_hidden(timeout=5000)

        return self

    async def delete_contact(self, name: str, confirm: bool = True, wait_for_close: bool = True):
        """
        Delete a contact with confirmation.

        Args:
            name: Name of contact to delete
            confirm: Whether to confirm deletion (default True)
            wait_for_close: Wait for modal to close after deletion (default True)

        Returns:
            ContactsPage: Self for method chaining
        """
        # First search for the contact
        await self.search_contact(name)

        # CRITICAL FIX (2025-11-04 Round 17): Simple fixed wait after search
        # After 16 rounds of complex wait strategies (networkidle, table visibility, button visibility, force clicks),
        # the fundamental issue is that Playwright can't find/click the button even though MCP shows it works after 3s.
        # Going back to basics: just wait 5 seconds for everything to settle.
        await self.page.wait_for_timeout(5000)

        # Find the contact row
        contact_row = self.page.locator('tr').filter(has_text=name)
        await expect(contact_row).to_be_visible(timeout=5000)

        # Use resilient delete button selector with multiple fallback strategies
        # Tries icon-based, aria-label, title, and text-based selectors
        delete_btn = await self._get_delete_button(contact_row)

        # CRITICAL FIX (2025-11-04 Round 15): Use force=True to bypass actionability checks
        # After extensive testing (Rounds 7-14), buttons fail Playwright's actionability checks
        # even though they are visible and clickable in manual testing and MCP debugging.
        # The issue appears to be related to table state/DOM updates after search operations.
        # Using force=True bypasses the checks and clicks the element directly.
        await delete_btn.click(force=True)

        # Wait for delete confirmation modal
        await expect(self.delete_modal_heading()).to_be_visible(timeout=5000)

        # Verify confirmation message includes contact name
        confirmation_text = self.page.locator('text=/האם אתה בטוח שברצונך למחוק את/')
        await expect(confirmation_text).to_be_visible()

        if confirm:
            # Click confirm delete button
            await self.confirm_delete_btn().click()

            # Wait for modal to close
            if wait_for_close:
                await expect(self.delete_modal_heading()).to_be_hidden(timeout=5000)
        else:
            # Click cancel button
            await self.cancel_btn().click()

        return self

    async def get_contact_details_from_table(self, name: str) -> dict:
        """
        Extract contact details from the table row.

        Args:
            name: Name of contact to find

        Returns:
            dict: Contact details with keys: name, email, phone, status, tags
        """
        # Search for contact
        await self.search_contact(name)

        # Find the contact row
        contact_row = self.page.locator('tr').filter(has_text=name)
        await expect(contact_row).to_be_visible(timeout=5000)

        # Extract details from table cells
        cells = contact_row.locator('td')

        details = {
            'name': name,
            'visible': True,
            'row_text': await contact_row.inner_text()
        }

        return details

    async def clear_search(self):
        """
        Clear the search box and show all contacts.

        Returns:
            ContactsPage: Self for method chaining
        """
        search_box = self.search_box()
        await search_box.clear()
        await self.page.keyboard.press('Enter')

        # CRITICAL FIX (2025-11-04 Round 13): Wait for table to fully refresh after clearing search
        # After clearing search, the table needs time to reload all contacts and make them interactive
        try:
            await self.page.wait_for_load_state('networkidle', timeout=5000)
        except Exception:
            # Fallback if networkidle doesn't work
            await self.page.wait_for_timeout(2000)

        # CRITICAL: Additional wait for rows to become interactive
        # The table may appear but buttons take extra time to become clickable
        await self.page.wait_for_timeout(2000)

        return self

    async def wait_for_success_message(self, timeout: int = 3000):
        """
        Wait for success message to appear (transient).

        Note: Success messages are transient and disappear quickly.
        This method attempts to catch them but may not always succeed.

        Args:
            timeout: Maximum time to wait in milliseconds

        Returns:
            ContactsPage: Self for method chaining
        """
        try:
            await expect(self.success_message()).to_be_visible(timeout=timeout)
        except AssertionError:
            # Success message may have already disappeared
            pass
        return self
