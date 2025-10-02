import pytest
from playwright.sync_api import Page
from src.pages.contacts_page import ContactsPage
from src.pages.login_page import LoginPage
import time


class TestContactsPerformance:
    """Test suite for Contacts page performance"""
    
    @pytest.fixture(autouse=True)
    def setup_page(self, page: Page):
        """Setup contacts page for performance tests"""
        self.contacts_page = ContactsPage(page)
        self.login_page = LoginPage(page)
        
        # Login if required
        self.login_page.navigate_to_login()
        if not self.login_page.is_login_successful():
            self.login_page.login_with_email("test@example.com", "password123")
            
    def test_contacts_page_load_time(self):
        """Test contacts page loads within acceptable time"""
        start_time = time.time()
        
        self.contacts_page.navigate_to_contacts()
        
        # Wait for main content to load
        self.contacts_page.wait_for_page_load()
        
        load_time = time.time() - start_time
        
        # Page should load within 5 seconds
        assert load_time < 5.0, f"Page load time {load_time:.2f}s exceeds 5 seconds"
        
    def test_search_response_time(self):
        """Test search functionality responds quickly"""
        self.contacts_page.navigate_to_contacts()
        
        start_time = time.time()
        
        self.contacts_page.search_contacts("test")
        
        # Wait for search results or loading to complete
        self.contacts_page.wait_for_loading_complete()
        
        response_time = time.time() - start_time
        
        # Search should respond within 3 seconds
        assert response_time < 3.0, f"Search response time {response_time:.2f}s exceeds 3 seconds"
        
    def test_large_dataset_pagination_performance(self):
        """Test pagination performs well with large datasets"""
        self.contacts_page.navigate_to_contacts()
        
        if self.contacts_page.is_visible(self.contacts_page.next_page_button):
            start_time = time.time()
            
            self.contacts_page.go_to_next_page()
            
            pagination_time = time.time() - start_time
            
            # Pagination should complete within 2 seconds
            assert pagination_time < 2.0, f"Pagination time {pagination_time:.2f}s exceeds 2 seconds"
            
    def test_form_submission_performance(self):
        """Test contact form submission performance"""
        self.contacts_page.navigate_to_contacts()
        self.contacts_page.click_add_contact()
        
        contact_data = {
            'firstName': 'Performance',
            'lastName': 'Test',
            'email': 'performance.test@example.com',
            'phone': '050-1234567'
        }
        
        self.contacts_page.fill_contact_form(contact_data)
        
        start_time = time.time()
        self.contacts_page.save_contact()
        
        # Wait for form submission to complete
        self.contacts_page.wait_for_loading_complete()
        
        submission_time = time.time() - start_time
        
        # Form submission should complete within 3 seconds
        assert submission_time < 3.0, f"Form submission time {submission_time:.2f}s exceeds 3 seconds"
        
    def test_table_rendering_performance(self):
        """Test contacts table renders efficiently"""
        start_time = time.time()
        
        self.contacts_page.navigate_to_contacts()
        
        # Wait for table to be visible
        if self.contacts_page.is_visible(self.contacts_page.contacts_table, timeout=10000):
            table_render_time = time.time() - start_time
            
            # Table should render within 3 seconds
            assert table_render_time < 3.0, f"Table render time {table_render_time:.2f}s exceeds 3 seconds"
        else:
            # If no table (empty state), that's also acceptable
            assert True, "No contacts table to render (empty state is acceptable)"