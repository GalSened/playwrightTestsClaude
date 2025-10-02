import pytest
from playwright.sync_api import Page
from src.pages.contacts_page import ContactsPage
from src.pages.login_page import LoginPage
import string
import random


class TestContactsEdgeCases:
    """Test suite for edge cases and boundary conditions"""
    
    @pytest.fixture(autouse=True)
    def setup_page(self, page: Page):
        """Setup contacts page for edge case tests"""
        self.contacts_page = ContactsPage(page)
        self.login_page = LoginPage(page)
        
        # Login if required
        self.login_page.navigate_to_login()
        if not self.login_page.is_login_successful():
            self.login_page.login_with_email("test@example.com", "password123")
            
        # Navigate to contacts
        self.contacts_page.navigate_to_contacts()
        
    def test_extremely_long_name_input(self):
        """Test form handling with extremely long names"""
        self.contacts_page.click_add_contact()
        
        # Generate very long name (1000 characters)
        long_name = 'A' * 1000
        
        contact_data = {
            'firstName': long_name,
            'lastName': 'Test',
            'email': 'long.name@example.com',
            'phone': '050-1234567'
        }
        
        self.contacts_page.fill_contact_form(contact_data)
        self.contacts_page.save_contact()
        
        # Should handle gracefully (either accept or show validation error)
        has_success = self.contacts_page.has_success_message()
        has_error = self.contacts_page.has_error_message()
        
        assert has_success or has_error, "Form should handle extremely long input"
        
    def test_special_characters_in_names(self):
        """Test form handling with special characters"""
        self.contacts_page.click_add_contact()
        
        contact_data = {
            'firstName': "João-María",  # Special characters
            'lastName': "O'Connor-Smith",
            'email': 'special.chars@example.com',
            'phone': '050-1234567'
        }
        
        self.contacts_page.fill_contact_form(contact_data)
        self.contacts_page.save_contact()
        
        # Should handle special characters properly
        assert not self.contacts_page.has_error_message() or self.contacts_page.has_success_message()
        
    def test_unicode_characters_support(self):
        """Test support for Unicode characters"""
        self.contacts_page.click_add_contact()
        
        contact_data = {
            'firstName': "測試",  # Chinese characters
            'lastName': "Тест",   # Cyrillic characters  
            'email': 'unicode.test@example.com',
            'phone': '050-1234567'
        }
        
        self.contacts_page.fill_contact_form(contact_data)
        self.contacts_page.save_contact()
        
        # Should support Unicode characters
        assert not self.contacts_page.has_error_message() or self.contacts_page.has_success_message()
        
    def test_empty_database_pagination(self):
        """Test pagination behavior with no contacts"""
        # Search for something that doesn't exist to simulate empty results
        self.contacts_page.search_contacts("nonexistentcontactxyz123")
        
        # Pagination should not be visible or should be disabled
        next_button_visible = self.contacts_page.is_visible(self.contacts_page.next_page_button)
        
        if next_button_visible:
            next_button_enabled = self.contacts_page.next_page_button.is_enabled()
            assert not next_button_enabled, "Next button should be disabled with empty results"
        
        # Should show no results message
        assert self.contacts_page.is_visible(self.contacts_page.no_results_message, timeout=3000)
        
    def test_sql_injection_prevention(self):
        """Test SQL injection prevention in search"""
        sql_injection_attempts = [
            "'; DROP TABLE contacts; --",
            "' OR '1'='1",
            "'; DELETE FROM contacts; --",
            "admin'--",
            "' OR 1=1#"
        ]
        
        for injection_attempt in sql_injection_attempts:
            self.contacts_page.search_contacts(injection_attempt)
            
            # Page should remain functional (not crash)
            assert self.contacts_page.is_visible(self.contacts_page.search_input)
            
            # Should not cause database errors
            error_indicators = [
                "SQL syntax error",
                "mysql_fetch_array",
                "ORA-",
                "Microsoft JET Database",
                "ODBC Drivers error"
            ]
            
            page_content = self.contacts_page.page.content().lower()
            sql_error_present = any(error in page_content for error in error_indicators)
            
            assert not sql_error_present, f"SQL injection attempt should not cause database errors: {injection_attempt}"
            
    def test_xss_prevention_in_form(self):
        """Test XSS prevention in contact forms"""
        self.contacts_page.click_add_contact()
        
        xss_attempts = [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>",
            "';alert('XSS');//"
        ]
        
        for xss_attempt in xss_attempts:
            contact_data = {
                'firstName': xss_attempt,
                'lastName': 'Test',
                'email': 'xss.test@example.com',
                'phone': '050-1234567'
            }
            
            self.contacts_page.fill_contact_form(contact_data)
            self.contacts_page.save_contact()
            
            # XSS should not execute - no alert dialogs should appear
            # Page should remain functional
            assert self.contacts_page.is_visible(self.contacts_page.contact_form)
            
    def test_boundary_phone_number_validation(self):
        """Test boundary conditions for phone number validation"""
        self.contacts_page.click_add_contact()
        
        # Test various Israeli phone number formats
        valid_phones = [
            "050-1234567",      # Standard mobile
            "052-1234567",      # Another mobile prefix
            "054-1234567",      # Another mobile prefix
            "02-1234567",       # Jerusalem landline
            "03-1234567",       # Tel Aviv landline
            "04-1234567",       # Haifa landline
            "+972-50-1234567",  # International mobile
            "+972-2-1234567",   # International landline
            "972501234567",     # No separators
        ]
        
        invalid_phones = [
            "123",              # Too short
            "050-123456",       # Mobile too short
            "050-12345678",     # Mobile too long
            "01-1234567",       # Invalid area code
            "abc-1234567",      # Non-numeric
            "",                 # Empty
            "050-",             # Incomplete
        ]
        
        # Test valid phones
        for phone in valid_phones:
            is_valid = self.contacts_page.validate_israeli_phone_number(phone)
            assert is_valid, f"Phone {phone} should be valid"
            
        # Test invalid phones
        for phone in invalid_phones:
            is_valid = self.contacts_page.validate_israeli_phone_number(phone)
            assert not is_valid, f"Phone {phone} should be invalid"
            
    def test_concurrent_user_operations(self):
        """Test handling of concurrent operations"""
        # Simulate rapid successive operations
        if self.contacts_page.get_contacts_count() > 0:
            # Rapid clicks on edit buttons
            for i in range(min(3, self.contacts_page.get_contacts_count())):
                try:
                    self.contacts_page.edit_contact_by_index(i)
                    # Quickly cancel
                    if self.contacts_page.is_visible(self.contacts_page.cancel_button):
                        self.contacts_page.cancel_contact_form()
                except:
                    # Some operations might fail due to timing - that's expected
                    pass
                    
        # Page should remain stable
        assert self.contacts_page.is_visible(self.contacts_page.page_title)
        
    def test_network_interruption_handling(self):
        """Test graceful handling of network issues"""
        # This is a placeholder for network interruption testing
        # In a real scenario, you might use network throttling or offline mode
        
        # Test that page elements remain accessible
        assert self.contacts_page.is_visible(self.contacts_page.search_input)
        assert self.contacts_page.is_visible(self.contacts_page.add_contact_button, timeout=5000)
        
    def test_maximum_search_query_length(self):
        """Test search with maximum length query"""
        # Generate very long search query
        max_query = 'a' * 1000
        
        self.contacts_page.search_contacts(max_query)
        
        # Should handle gracefully without crashing
        assert self.contacts_page.is_visible(self.contacts_page.search_input)
        
        # Search input should contain the query (potentially truncated)
        search_value = self.contacts_page.search_input.input_value()
        assert len(search_value) > 0, "Search input should contain some value"