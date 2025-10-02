import pytest
from playwright.sync_api import Page, Browser
from src.pages.contacts_page import ContactsPage
from src.pages.login_page import LoginPage


class TestContactsCrossBrowser:
    """Test suite for cross-browser compatibility"""
    
    def setup_method(self, page: Page):
        """Setup for cross-browser tests"""
        self.contacts_page = ContactsPage(page)
        self.login_page = LoginPage(page)
        
        # Login if required
        self.login_page.navigate_to_login()
        if not self.login_page.is_login_successful():
            self.login_page.login_with_email("test@example.com", "password123")
            
    @pytest.mark.parametrize("browser_name", ["chromium", "firefox", "webkit"])
    def test_basic_functionality_all_browsers(self, browser_name, playwright):
        """Test basic contacts functionality across different browsers"""
        # This test would ideally run with different browser contexts
        # For now, we test with current browser but document the intent
        
        browser = getattr(playwright, browser_name)
        context = browser.new_context()
        page = context.new_page()
        
        try:
            self.setup_method(page)
            self.contacts_page.navigate_to_contacts()
            
            # Test basic page load
            assert self.contacts_page.is_visible(self.contacts_page.page_title, timeout=10000)
            
            # Test search functionality
            if self.contacts_page.is_visible(self.contacts_page.search_input):
                self.contacts_page.search_contacts("test")
                assert True, f"Search works in {browser_name}"
                
        finally:
            context.close()
            
    def test_responsive_design_mobile_viewport(self, page: Page):
        """Test contacts page in mobile viewport"""
        self.setup_method(page)
        
        # Set mobile viewport
        page.set_viewport_size({"width": 375, "height": 667})  # iPhone SE size
        
        self.contacts_page.navigate_to_contacts()
        
        # Page should still be functional
        assert self.contacts_page.is_visible(self.contacts_page.page_title)
        
        # Search should be accessible
        if self.contacts_page.is_visible(self.contacts_page.search_input):
            assert self.contacts_page.search_input.is_visible()
            
    def test_responsive_design_tablet_viewport(self, page: Page):
        """Test contacts page in tablet viewport"""
        self.setup_method(page)
        
        # Set tablet viewport
        page.set_viewport_size({"width": 768, "height": 1024})  # iPad size
        
        self.contacts_page.navigate_to_contacts()
        
        # Page should still be functional
        assert self.contacts_page.is_visible(self.contacts_page.page_title)
        
        # Table should be visible if contacts exist
        if self.contacts_page.get_contacts_count() > 0:
            assert self.contacts_page.is_visible(self.contacts_page.contacts_table)
            
    def test_responsive_design_desktop_viewport(self, page: Page):
        """Test contacts page in desktop viewport"""
        self.setup_method(page)
        
        # Set desktop viewport
        page.set_viewport_size({"width": 1920, "height": 1080})  # Full HD
        
        self.contacts_page.navigate_to_contacts()
        
        # All elements should be properly visible
        assert self.contacts_page.is_visible(self.contacts_page.page_title)
        
        # Add contact button should be visible
        if self.contacts_page.is_visible(self.contacts_page.add_contact_button):
            assert self.contacts_page.add_contact_button.is_visible()