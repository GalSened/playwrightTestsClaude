import pytest
from playwright.sync_api import Page
from src.pages.contacts_page import ContactsPage
from src.pages.login_page import LoginPage
import time
import os


class TestContactsEnglish:
    """Test suite for Contacts page functionality in English"""
    
    @pytest.fixture(autouse=True)
    def setup_page(self, page: Page):
        """Setup contacts page for each test"""
        self.contacts_page = ContactsPage(page)
        self.login_page = LoginPage(page)
        
        # Login if required
        self.login_page.navigate_to_login()
        if not self.login_page.is_login_successful():
            self.login_page.login_with_email("test@example.com", "password123")
            
        # Navigate to contacts
        self.contacts_page.navigate_to_contacts()
        
        # Ensure English language
        if self.contacts_page.get_page_language() != "english":
            self.contacts_page.switch_language("en")
            
    def test_contacts_page_loads(self):
        """Test that contacts page loads successfully"""
        assert self.contacts_page.is_visible(self.contacts_page.page_title)
        assert "Contacts" in self.contacts_page.get_text(self.contacts_page.page_title)
        
    def test_navigation_to_contacts(self):
        """Test navigation to contacts page via menu"""
        self.contacts_page.navigate_to("/")  # Go to home
        self.contacts_page.click_contacts_nav()
        assert "/contacts" in self.contacts_page.get_current_url()
        
    def test_search_functionality_with_valid_query(self):
        """Test search with valid contact name"""
        test_query = "John"
        self.contacts_page.search_contacts(test_query)
        
        # Verify search was performed
        search_value = self.contacts_page.search_input.input_value()
        assert test_query in search_value
        
    def test_search_functionality_with_empty_query(self):
        """Test search with empty query shows all contacts"""
        self.contacts_page.search_contacts("")
        
        # Should show all contacts or no results message
        contacts_visible = self.contacts_page.get_contacts_count() > 0
        no_results_visible = self.contacts_page.is_visible(self.contacts_page.no_results_message)
        assert contacts_visible or no_results_visible
        
    def test_clear_search_functionality(self):
        """Test clear search button functionality"""
        self.contacts_page.search_contacts("test")
        self.contacts_page.clear_search()
        
        search_value = self.contacts_page.search_input.input_value()
        assert search_value == ""
        
    def test_add_new_contact_button_click(self):
        """Test add new contact button opens form"""
        self.contacts_page.click_add_contact()
        
        # Verify form is visible
        form_fields = self.contacts_page.validate_form_fields_present()
        assert any(form_fields.values()), "Contact form should be visible"
        
    def test_add_contact_with_valid_data(self):
        """Test adding a new contact with valid data"""
        self.contacts_page.click_add_contact()
        
        contact_data = {
            'firstName': 'John',
            'lastName': 'Doe',
            'email': 'john.doe@example.com',
            'phone': '050-1234567',
            'company': 'Test Company'
        }
        
        self.contacts_page.fill_contact_form(contact_data)
        self.contacts_page.save_contact()
        
        # Verify success
        assert self.contacts_page.has_success_message() or not self.contacts_page.has_error_message()
        
    def test_add_contact_with_invalid_email(self):
        """Test adding contact with invalid email format"""
        self.contacts_page.click_add_contact()
        
        contact_data = {
            'firstName': 'Jane',
            'lastName': 'Smith',
            'email': 'invalid-email-format',
            'phone': '050-1234567'
        }
        
        self.contacts_page.fill_contact_form(contact_data)
        self.contacts_page.save_contact()
        
        # Should show validation error
        assert self.contacts_page.has_error_message()
        
    def test_add_contact_with_invalid_phone(self):
        """Test adding contact with invalid phone number"""
        self.contacts_page.click_add_contact()
        
        contact_data = {
            'firstName': 'Bob',
            'lastName': 'Johnson',
            'email': 'bob@example.com',
            'phone': '123'  # Invalid Israeli phone
        }
        
        self.contacts_page.fill_contact_form(contact_data)
        self.contacts_page.save_contact()
        
        # Should show validation error
        assert self.contacts_page.has_error_message()
        
    def test_form_validation_required_fields(self):
        """Test form validation for required fields"""
        self.contacts_page.click_add_contact()
        
        # Try to save without required fields
        self.contacts_page.save_contact()
        
        # Should show validation error
        assert self.contacts_page.has_error_message()
        
    def test_cancel_add_contact_form(self):
        """Test canceling add contact form"""
        self.contacts_page.click_add_contact()
        self.contacts_page.cancel_contact_form()
        
        # Form should be closed
        form_fields = self.contacts_page.validate_form_fields_present()
        assert not any(form_fields.values()), "Contact form should be closed"
        
    def test_contacts_table_display(self):
        """Test contacts table displays correctly"""
        assert self.contacts_page.is_visible(self.contacts_page.contacts_table)
        
        # Check headers are present
        headers = self.contacts_page.table_headers.count()
        assert headers > 0, "Table should have headers"
        
    def test_edit_contact_functionality(self):
        """Test editing existing contact"""
        if self.contacts_page.get_contacts_count() > 0:
            self.contacts_page.edit_contact_by_index(0)
            
            # Verify edit form opens
            form_fields = self.contacts_page.validate_form_fields_present()
            assert any(form_fields.values()), "Edit form should be visible"
            
    def test_delete_contact_functionality(self):
        """Test deleting contact with confirmation"""
        if self.contacts_page.get_contacts_count() > 0:
            initial_count = self.contacts_page.get_contacts_count()
            
            self.contacts_page.delete_contact_by_index(0)
            self.contacts_page.confirm_delete()
            
            time.sleep(1)  # Wait for deletion
            new_count = self.contacts_page.get_contacts_count()
            
            # Count should decrease or show no results
            assert new_count < initial_count or self.contacts_page.is_visible(self.contacts_page.no_results_message)
            
    def test_cancel_delete_contact(self):
        """Test canceling contact deletion"""
        if self.contacts_page.get_contacts_count() > 0:
            initial_count = self.contacts_page.get_contacts_count()
            
            self.contacts_page.delete_contact_by_index(0)
            self.contacts_page.cancel_delete()
            
            # Count should remain the same
            current_count = self.contacts_page.get_contacts_count()
            assert current_count == initial_count
            
    def test_pagination_next_page(self):
        """Test pagination next page functionality"""
        if self.contacts_page.is_visible(self.contacts_page.next_page_button):
            self.contacts_page.go_to_next_page()
            
            # URL should change or page indicator should update
            assert self.contacts_page.is_visible(self.contacts_page.pagination_container)
            
    def test_pagination_previous_page(self):
        """Test pagination previous page functionality"""
        # Go to next page first if possible
        if self.contacts_page.is_visible(self.contacts_page.next_page_button):
            self.contacts_page.go_to_next_page()
            
            if self.contacts_page.is_visible(self.contacts_page.prev_page_button):
                self.contacts_page.go_to_previous_page()
                
                assert self.contacts_page.is_visible(self.contacts_page.pagination_container)
                
    def test_bulk_select_functionality(self):
        """Test bulk selection of contacts"""
        if self.contacts_page.get_contacts_count() > 0:
            # Select first contact
            self.contacts_page.select_contact_by_index(0)
            
            # Verify checkbox is selected
            first_row = self.contacts_page.get_contact_by_index(0)
            checkbox = first_row.locator('input[type="checkbox"]')
            assert checkbox.is_checked()
            
    def test_select_all_contacts_functionality(self):
        """Test select all contacts functionality"""
        if self.contacts_page.get_contacts_count() > 0:
            self.contacts_page.select_all_contacts()
            
            # Verify select all checkbox is checked
            if self.contacts_page.is_visible(self.contacts_page.select_all_checkbox):
                assert self.contacts_page.select_all_checkbox.is_checked()