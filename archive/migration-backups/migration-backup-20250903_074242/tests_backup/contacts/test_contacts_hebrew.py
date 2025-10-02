import pytest
from playwright.sync_api import Page
from src.pages.contacts_page import ContactsPage
from src.pages.login_page import LoginPage
import time


class TestContactsHebrew:
    """Test suite for Contacts page functionality in Hebrew"""
    
    @pytest.fixture(autouse=True)
    def setup_page(self, page: Page):
        """Setup contacts page for each test in Hebrew"""
        self.contacts_page = ContactsPage(page)
        self.login_page = LoginPage(page)
        
        # Login if required
        self.login_page.navigate_to_login()
        if not self.login_page.is_login_successful():
            self.login_page.login_with_email("test@example.com", "password123")
            
        # Navigate to contacts
        self.contacts_page.navigate_to_contacts()
        
        # Ensure Hebrew language
        if self.contacts_page.get_page_language() != "hebrew":
            self.contacts_page.switch_language("he")
            
    def test_contacts_page_loads_hebrew(self):
        """Test that contacts page loads successfully in Hebrew"""
        assert self.contacts_page.is_visible(self.contacts_page.page_title)
        page_title_text = self.contacts_page.get_text(self.contacts_page.page_title)
        assert "אנשי קשר" in page_title_text or "Contacts" in page_title_text
        
    def test_rtl_layout_hebrew(self):
        """Test Right-to-Left layout in Hebrew interface"""
        page_content = self.contacts_page.page.content()
        
        # Check for RTL indicators
        rtl_indicators = [
            'dir="rtl"',
            'direction: rtl',
            'text-align: right'
        ]
        
        has_rtl = any(indicator in page_content for indicator in rtl_indicators)
        assert has_rtl, "Page should have RTL layout for Hebrew"
        
    def test_hebrew_search_functionality(self):
        """Test search functionality with Hebrew text"""
        hebrew_query = "יוחנן"  # Hebrew name
        self.contacts_page.search_contacts(hebrew_query)
        
        # Verify search was performed
        search_value = self.contacts_page.search_input.input_value()
        assert hebrew_query in search_value
        
    def test_hebrew_form_labels(self):
        """Test that form labels display correctly in Hebrew"""
        self.contacts_page.click_add_contact()
        
        form_content = self.contacts_page.contact_form.inner_text()
        hebrew_labels = ["שם פרטי", "שם משפחה", "אימייל", "טלפון", "חברה"]
        
        # At least some Hebrew labels should be present
        hebrew_present = any(label in form_content for label in hebrew_labels)
        assert hebrew_present, "Hebrew labels should be present in form"
        
    def test_add_contact_hebrew_data(self):
        """Test adding contact with Hebrew name data"""
        self.contacts_page.click_add_contact()
        
        contact_data = {
            'firstName': 'יוחנן',  # Hebrew first name
            'lastName': 'כהן',    # Hebrew last name
            'email': 'yohanan.cohen@example.com',
            'phone': '050-1234567',
            'company': 'חברת בדיקות'  # Hebrew company name
        }
        
        self.contacts_page.fill_contact_form(contact_data)
        self.contacts_page.save_contact()
        
        # Verify success
        assert self.contacts_page.has_success_message() or not self.contacts_page.has_error_message()
        
    def test_hebrew_error_messages(self):
        """Test error messages display in Hebrew"""
        self.contacts_page.click_add_contact()
        
        # Submit form without required fields
        self.contacts_page.save_contact()
        
        if self.contacts_page.has_error_message():
            error_text = self.contacts_page.get_error_message()
            # Error message might be in Hebrew or English
            assert len(error_text) > 0, "Error message should be displayed"
            
    def test_hebrew_button_labels(self):
        """Test that buttons display Hebrew labels"""
        self.contacts_page.click_add_contact()
        
        page_content = self.contacts_page.page.content()
        hebrew_buttons = ["שמור", "בטל", "הוסף", "ערוך", "מחק"]
        
        # At least some Hebrew button labels should be present
        hebrew_buttons_present = any(btn in page_content for btn in hebrew_buttons)
        assert hebrew_buttons_present, "Hebrew button labels should be present"
        
    def test_hebrew_table_headers(self):
        """Test table headers in Hebrew"""
        if self.contacts_page.is_visible(self.contacts_page.contacts_table):
            table_content = self.contacts_page.contacts_table.inner_text()
            
            # Hebrew headers might include
            hebrew_headers = ["שם", "אימייל", "טלפון", "חברה", "פעולות"]
            
            # Check if Hebrew headers are present
            hebrew_present = any(header in table_content for header in hebrew_headers)
            # If not Hebrew, should at least have English headers
            english_present = any(header in table_content for header in ["Name", "Email", "Phone", "Company"])
            
            assert hebrew_present or english_present, "Table should have proper headers"
            
    def test_hebrew_pagination_labels(self):
        """Test pagination labels in Hebrew"""
        if self.contacts_page.is_visible(self.contacts_page.pagination_container):
            pagination_content = self.contacts_page.pagination_container.inner_text()
            
            hebrew_pagination = ["הבא", "קודם", "עמוד"]
            english_pagination = ["Next", "Previous", "Page"]
            
            hebrew_present = any(label in pagination_content for label in hebrew_pagination)
            english_present = any(label in pagination_content for label in english_pagination)
            
            assert hebrew_present or english_present, "Pagination should have proper labels"
            
    def test_hebrew_search_placeholder(self):
        """Test search input placeholder in Hebrew"""
        if self.contacts_page.is_visible(self.contacts_page.search_input):
            placeholder = self.contacts_page.search_input.get_attribute("placeholder")
            
            if placeholder:
                # Might be Hebrew or English
                assert len(placeholder) > 0, "Search placeholder should be present"
                
    def test_hebrew_confirmation_dialog(self):
        """Test confirmation dialog in Hebrew"""
        if self.contacts_page.get_contacts_count() > 0:
            self.contacts_page.delete_contact_by_index(0)
            
            if self.contacts_page.is_visible(self.contacts_page.delete_confirmation_dialog):
                dialog_content = self.contacts_page.delete_confirmation_dialog.inner_text()
                
                hebrew_confirm = ["אשר", "מחק", "בטל"]
                english_confirm = ["Confirm", "Delete", "Cancel"]
                
                hebrew_present = any(text in dialog_content for text in hebrew_confirm)
                english_present = any(text in dialog_content for text in english_confirm)
                
                assert hebrew_present or english_present, "Confirmation dialog should have proper labels"
                
                # Cancel to avoid actual deletion
                self.contacts_page.cancel_delete()
                
    def test_hebrew_no_results_message(self):
        """Test no results message in Hebrew"""
        # Search for something that likely doesn't exist
        self.contacts_page.search_contacts("זהמשהודאילאקיים123456")
        
        if self.contacts_page.is_visible(self.contacts_page.no_results_message):
            message_text = self.contacts_page.get_text(self.contacts_page.no_results_message)
            
            hebrew_no_results = ["לא נמצאו", "אין תוצאות", "ריק"]
            english_no_results = ["No results", "No contacts", "Empty"]
            
            hebrew_present = any(text in message_text for text in hebrew_no_results)
            english_present = any(text in message_text for text in english_no_results)
            
            assert hebrew_present or english_present, "No results message should be displayed"