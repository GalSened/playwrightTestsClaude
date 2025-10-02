from playwright.sync_api import Page, Locator
from .base_page import BasePage
from typing import Dict, Optional, List
import os
import re


class ContactsPage(BasePage):
    """Page Object Model for Contacts Page"""
    
    def __init__(self, page: Page, base_url: str = None):
        super().__init__(page)
        self.base_url = base_url or os.getenv("BASE_URL", "https://devtest.comda.co.il/")
        self.contacts_url = f"{self.base_url.rstrip('/')}/contacts" if not self.base_url.endswith('/contacts') else self.base_url
        self._init_locators()
        
    def _init_locators(self) -> None:
        """Initialize all locators for the contacts page with self-healing capabilities"""
        
        # Navigation elements
        self.contacts_nav_button = self.page.locator('''
            button:has-text("Contacts"), 
            button:has-text("אנשי קשר"),
            a:has-text("Contacts"),
            a:has-text("אנשי קשר"),
            [data-testid="contacts-nav"],
            .nav-contacts,
            #contacts-nav
        ''')
        
        # Page title and header
        self.page_title = self.page.locator('''
            h1:has-text("Contacts"),
            h1:has-text("אנשי קשר"),
            .page-title,
            [data-testid="page-title"],
            .contacts-title
        ''')
        
        # Search functionality
        self.search_input = self.page.locator('''
            input[placeholder*="Search"],
            input[placeholder*="חיפוש"],
            input[name="search"],
            input[type="search"],
            [data-testid="search-input"],
            .search-input,
            #search-contacts
        ''')
        
        self.search_button = self.page.locator('''
            button:has-text("Search"),
            button:has-text("חיפוש"),
            button[type="submit"],
            [data-testid="search-button"],
            .search-btn,
            .fa-search
        ''')
        
        self.clear_search_button = self.page.locator('''
            button:has-text("Clear"),
            button:has-text("נקה"),
            [data-testid="clear-search"],
            .clear-search,
            .search-clear
        ''')
        
        # Add new contact
        self.add_contact_button = self.page.locator('''
            button:has-text("Add Contact"),
            button:has-text("הוסף איש קשר"),
            button:has-text("New Contact"),
            button:has-text("איש קשר חדש"),
            [data-testid="add-contact"],
            .add-contact-btn,
            #add-contact
        ''')
        
        # Contact form elements
        self.contact_form = self.page.locator('form, .contact-form, [data-testid="contact-form"]')
        
        self.first_name_input = self.page.locator('''
            input[name="firstName"],
            input[name="first_name"],
            input[placeholder*="First Name"],
            input[placeholder*="שם פרטי"],
            [data-testid="first-name"],
            #firstName,
            .first-name
        ''')
        
        self.last_name_input = self.page.locator('''
            input[name="lastName"],
            input[name="last_name"],
            input[placeholder*="Last Name"],
            input[placeholder*="שם משפחה"],
            [data-testid="last-name"],
            #lastName,
            .last-name
        ''')
        
        self.email_input = self.page.locator('''
            input[name="email"],
            input[type="email"],
            input[placeholder*="Email"],
            input[placeholder*="אימייל"],
            [data-testid="email"],
            #email,
            .email-input
        ''')
        
        self.phone_input = self.page.locator('''
            input[name="phone"],
            input[type="tel"],
            input[placeholder*="Phone"],
            input[placeholder*="טלפון"],
            [data-testid="phone"],
            #phone,
            .phone-input
        ''')
        
        self.company_input = self.page.locator('''
            input[name="company"],
            input[placeholder*="Company"],
            input[placeholder*="חברה"],
            [data-testid="company"],
            #company,
            .company-input
        ''')
        
        self.notes_input = self.page.locator('''
            textarea[name="notes"],
            textarea[placeholder*="Notes"],
            textarea[placeholder*="הערות"],
            [data-testid="notes"],
            #notes,
            .notes-input
        ''')
        
        # Form buttons
        self.save_button = self.page.locator('''
            button:has-text("Save"),
            button:has-text("שמור"),
            button[type="submit"],
            [data-testid="save-contact"],
            .save-btn
        ''')
        
        self.cancel_button = self.page.locator('''
            button:has-text("Cancel"),
            button:has-text("בטל"),
            [data-testid="cancel"],
            .cancel-btn
        ''')
        
        # Contacts table
        self.contacts_table = self.page.locator('table, .contacts-table, [data-testid="contacts-table"]')
        self.table_headers = self.page.locator('thead th, .table-header, [data-testid="table-header"]')
        self.table_rows = self.page.locator('tbody tr, .table-row, [data-testid="contact-row"]')
        self.no_results_message = self.page.locator('''
            .no-results,
            .empty-state,
            :has-text("No contacts found"),
            :has-text("לא נמצאו אנשי קשר"),
            [data-testid="no-results"]
        ''')
        
        # Pagination
        self.pagination_container = self.page.locator('.pagination, [data-testid="pagination"]')
        self.page_info = self.page.locator('.page-info, [data-testid="page-info"]')
        self.prev_page_button = self.page.locator('''
            button:has-text("Previous"),
            button:has-text("קודם"),
            .page-prev,
            [data-testid="prev-page"]
        ''')
        self.next_page_button = self.page.locator('''
            button:has-text("Next"),
            button:has-text("הבא"),
            .page-next,
            [data-testid="next-page"]
        ''')
        self.page_numbers = self.page.locator('.page-number, [data-testid="page-number"]')
        
        # Bulk operations
        self.select_all_checkbox = self.page.locator('''
            input[name="selectAll"],
            thead input[type="checkbox"],
            [data-testid="select-all"]
        ''')
        self.contact_checkboxes = self.page.locator('''
            tbody input[type="checkbox"],
            [data-testid="contact-checkbox"]
        ''')
        self.bulk_actions_dropdown = self.page.locator('''
            select[name="bulkAction"],
            .bulk-actions,
            [data-testid="bulk-actions"]
        ''')
        self.delete_selected_button = self.page.locator('''
            button:has-text("Delete Selected"),
            button:has-text("מחק נבחרים"),
            [data-testid="delete-selected"]
        ''')
        
        # Individual contact actions
        self.edit_buttons = self.page.locator('''
            button:has-text("Edit"),
            button:has-text("ערוך"),
            .edit-btn,
            [data-testid="edit-contact"]
        ''')
        self.delete_buttons = self.page.locator('''
            button:has-text("Delete"),
            button:has-text("מחק"),
            .delete-btn,
            [data-testid="delete-contact"]
        ''')
        self.view_buttons = self.page.locator('''
            button:has-text("View"),
            button:has-text("צפה"),
            .view-btn,
            [data-testid="view-contact"]
        ''')
        
        # Confirmation dialogs
        self.delete_confirmation_dialog = self.page.locator('.modal, .dialog, [role="dialog"]')
        self.confirm_delete_button = self.page.locator('''
            button:has-text("Confirm"),
            button:has-text("אשר"),
            button:has-text("Delete"),
            button:has-text("מחק"),
            [data-testid="confirm-delete"]
        ''')
        self.cancel_delete_button = self.page.locator('''
            button:has-text("Cancel"),
            button:has-text("בטל"),
            [data-testid="cancel-delete"]
        ''')
        
        # File operations
        self.import_button = self.page.locator('''
            button:has-text("Import"),
            button:has-text("ייבא"),
            [data-testid="import-contacts"],
            .import-btn
        ''')
        self.export_button = self.page.locator('''
            button:has-text("Export"),
            button:has-text("ייצא"),
            [data-testid="export-contacts"],
            .export-btn
        ''')
        self.file_input = self.page.locator('input[type="file"]')
        
        # Filters and sorting
        self.filter_dropdown = self.page.locator('''
            select[name="filter"],
            .filter-dropdown,
            [data-testid="filter"]
        ''')
        self.sort_dropdown = self.page.locator('''
            select[name="sort"],
            .sort-dropdown,
            [data-testid="sort"]
        ''')
        
        # Success and error messages
        self.success_message = self.page.locator('''
            .alert-success,
            .success-message,
            .toast-success,
            [data-testid="success-message"]
        ''')
        self.error_message = self.page.locator('''
            .alert-error,
            .error-message,
            .toast-error,
            [data-testid="error-message"]
        ''')
        
        # Language selector
        self.language_selector = self.page.locator('''
            select[name="language"],
            .language-selector,
            [data-testid="language"]
        ''')
        
        # Loading indicators
        self.loading_spinner = self.page.locator('.loading, .spinner, [data-testid="loading"]')
        
    def navigate_to_contacts(self) -> None:
        """Navigate to contacts page"""
        self.navigate_to(self.contacts_url)
        self.wait_for_page_load()
        
    def click_contacts_nav(self) -> None:
        """Click contacts navigation button"""
        self.click_element(self.contacts_nav_button)
        
    def search_contacts(self, query: str) -> None:
        """Search for contacts"""
        self.fill_input(self.search_input, query)
        self.click_element(self.search_button)
        self.wait_for_loading_complete()
        
    def clear_search(self) -> None:
        """Clear search input"""
        if self.is_visible(self.clear_search_button):
            self.click_element(self.clear_search_button)
        else:
            self.search_input.clear()
            
    def click_add_contact(self) -> None:
        """Click add new contact button"""
        self.click_element(self.add_contact_button)
        
    def fill_contact_form(self, contact_data: Dict[str, str]) -> None:
        """Fill contact form with provided data"""
        if contact_data.get('firstName'):
            self.fill_input(self.first_name_input, contact_data['firstName'])
        if contact_data.get('lastName'):
            self.fill_input(self.last_name_input, contact_data['lastName'])
        if contact_data.get('email'):
            self.fill_input(self.email_input, contact_data['email'])
        if contact_data.get('phone'):
            self.fill_input(self.phone_input, contact_data['phone'])
        if contact_data.get('company'):
            self.fill_input(self.company_input, contact_data['company'])
        if contact_data.get('notes'):
            self.fill_input(self.notes_input, contact_data['notes'])
            
    def save_contact(self) -> None:
        """Save contact form"""
        self.click_element(self.save_button)
        self.wait_for_loading_complete()
        
    def cancel_contact_form(self) -> None:
        """Cancel contact form"""
        self.click_element(self.cancel_button)
        
    def get_contacts_count(self) -> int:
        """Get total number of contacts displayed"""
        return self.table_rows.count()
        
    def get_contact_by_index(self, index: int) -> Locator:
        """Get contact row by index"""
        return self.table_rows.nth(index)
        
    def edit_contact_by_index(self, index: int) -> None:
        """Edit contact by index"""
        contact_row = self.get_contact_by_index(index)
        edit_button = contact_row.locator(self.edit_buttons.locator)
        self.click_element(edit_button)
        
    def delete_contact_by_index(self, index: int) -> None:
        """Delete contact by index"""
        contact_row = self.get_contact_by_index(index)
        delete_button = contact_row.locator(self.delete_buttons.locator)
        self.click_element(delete_button)
        
    def confirm_delete(self) -> None:
        """Confirm delete operation"""
        if self.is_visible(self.delete_confirmation_dialog):
            self.click_element(self.confirm_delete_button)
            self.wait_for_loading_complete()
            
    def cancel_delete(self) -> None:
        """Cancel delete operation"""
        if self.is_visible(self.delete_confirmation_dialog):
            self.click_element(self.cancel_delete_button)
            
    def select_all_contacts(self) -> None:
        """Select all contacts"""
        if self.is_visible(self.select_all_checkbox):
            self.click_element(self.select_all_checkbox)
            
    def select_contact_by_index(self, index: int) -> None:
        """Select contact by index"""
        contact_row = self.get_contact_by_index(index)
        checkbox = contact_row.locator('input[type="checkbox"]')
        self.click_element(checkbox)
        
    def delete_selected_contacts(self) -> None:
        """Delete selected contacts"""
        self.click_element(self.delete_selected_button)
        self.confirm_delete()
        
    def go_to_next_page(self) -> None:
        """Navigate to next page"""
        if self.is_visible(self.next_page_button) and self.next_page_button.is_enabled():
            self.click_element(self.next_page_button)
            self.wait_for_loading_complete()
            
    def go_to_previous_page(self) -> None:
        """Navigate to previous page"""
        if self.is_visible(self.prev_page_button) and self.prev_page_button.is_enabled():
            self.click_element(self.prev_page_button)
            self.wait_for_loading_complete()
            
    def go_to_page(self, page_number: int) -> None:
        """Navigate to specific page"""
        page_button = self.page.locator(f'[data-testid="page-{page_number}"], button:has-text("{page_number}")')
        if self.is_visible(page_button):
            self.click_element(page_button)
            self.wait_for_loading_complete()
            
    def export_contacts(self) -> None:
        """Export contacts"""
        self.click_element(self.export_button)
        
    def import_contacts(self, file_path: str) -> None:
        """Import contacts from file"""
        self.click_element(self.import_button)
        self.file_input.set_input_files(file_path)
        
    def validate_israeli_phone_number(self, phone: str) -> bool:
        """Validate Israeli phone number format"""
        # Remove all non-digit characters
        clean_phone = re.sub(r'\D', '', phone)
        
        # Israeli mobile patterns
        mobile_patterns = [
            r'^(05[0-9])[0-9]{7}$',  # 05X-XXXXXXX
            r'^(\+97205[0-9])[0-9]{7}$',  # +972-05X-XXXXXXX
            r'^(97205[0-9])[0-9]{7}$'  # 972-05X-XXXXXXX
        ]
        
        # Israeli landline patterns
        landline_patterns = [
            r'^(0[2-4])[0-9]{7}$',  # 0X-XXXXXXX
            r'^(\+9720[2-4])[0-9]{7}$',  # +972-0X-XXXXXXX
            r'^(9720[2-4])[0-9]{7}$'  # 972-0X-XXXXXXX
        ]
        
        all_patterns = mobile_patterns + landline_patterns
        
        return any(re.match(pattern, clean_phone) for pattern in all_patterns)
        
    def get_page_language(self) -> str:
        """Detect current page language"""
        page_content = self.page.content()
        hebrew_indicators = ["אנשי קשר", "חיפוש", "הוסף", "ערוך", "מחק", "שמור", "בטל"]
        
        if any(hebrew_text in page_content for hebrew_text in hebrew_indicators):
            return "hebrew"
        return "english"
        
    def switch_language(self, language: str) -> None:
        """Switch page language"""
        if self.is_visible(self.language_selector):
            self.language_selector.select_option(language)
            self.wait_for_page_load()
            
    def wait_for_loading_complete(self) -> None:
        """Wait for loading spinner to disappear"""
        if self.is_visible(self.loading_spinner, timeout=2000):
            self.loading_spinner.wait_for(state="hidden", timeout=self.timeout)
            
    def get_success_message(self) -> str:
        """Get success message text"""
        if self.is_visible(self.success_message, timeout=2000):
            return self.get_text(self.success_message)
        return ""
        
    def get_error_message(self) -> str:
        """Get error message text"""
        if self.is_visible(self.error_message, timeout=2000):
            return self.get_text(self.error_message)
        return ""
        
    def has_success_message(self) -> bool:
        """Check if success message is displayed"""
        return bool(self.get_success_message())
        
    def has_error_message(self) -> bool:
        """Check if error message is displayed"""
        return bool(self.get_error_message())
        
    def validate_form_fields_present(self) -> Dict[str, bool]:
        """Validate that required form fields are present"""
        return {
            "first_name_field": self.is_visible(self.first_name_input, timeout=2000),
            "last_name_field": self.is_visible(self.last_name_input, timeout=2000),
            "email_field": self.is_visible(self.email_input, timeout=2000),
            "phone_field": self.is_visible(self.phone_input, timeout=2000),
            "save_button": self.is_visible(self.save_button, timeout=2000)
        }
        
    def get_contact_data_from_row(self, index: int) -> Dict[str, str]:
        """Extract contact data from table row"""
        contact_row = self.get_contact_by_index(index)
        cells = contact_row.locator('td')
        
        contact_data = {}
        if cells.count() >= 4:
            contact_data['name'] = self.get_text(cells.nth(0))
            contact_data['email'] = self.get_text(cells.nth(1))
            contact_data['phone'] = self.get_text(cells.nth(2))
            contact_data['company'] = self.get_text(cells.nth(3))
            
        return contact_data
        
    def sort_contacts_by_column(self, column_name: str) -> None:
        """Sort contacts by clicking column header"""
        header = self.page.locator(f'th:has-text("{column_name}")')
        if self.is_visible(header):
            self.click_element(header)
            self.wait_for_loading_complete()
            
    def filter_contacts(self, filter_value: str) -> None:
        """Apply filter to contacts"""
        if self.is_visible(self.filter_dropdown):
            self.filter_dropdown.select_option(filter_value)
            self.wait_for_loading_complete()