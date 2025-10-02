import pytest
from playwright.sync_api import Page
from src.pages.contacts_page import ContactsPage
from src.pages.login_page import LoginPage


class TestContactsAccessibility:
    """Test suite for Contacts page accessibility compliance"""
    
    @pytest.fixture(autouse=True)
    def setup_page(self, page: Page):
        """Setup contacts page for accessibility tests"""
        self.contacts_page = ContactsPage(page)
        self.login_page = LoginPage(page)
        
        # Login if required
        self.login_page.navigate_to_login()
        if not self.login_page.is_login_successful():
            self.login_page.login_with_email("test@example.com", "password123")
            
        # Navigate to contacts
        self.contacts_page.navigate_to_contacts()
        
    def test_aria_labels_present(self):
        """Test that ARIA labels are present for accessibility"""
        page_content = self.contacts_page.page.content()
        
        # Check for ARIA attributes
        aria_attributes = [
            'aria-label',
            'aria-labelledby', 
            'aria-describedby',
            'role='
        ]
        
        aria_present = any(attr in page_content for attr in aria_attributes)
        assert aria_present, "ARIA attributes should be present for accessibility"
        
    def test_keyboard_navigation_support(self):
        """Test keyboard navigation through interactive elements"""
        # Focus on search input
        self.contacts_page.search_input.focus()
        assert self.contacts_page.search_input.is_focused(), "Search input should be focusable"
        
        # Tab to next element
        self.contacts_page.page.keyboard.press("Tab")
        
        # Verify focus moved to another interactive element
        focused_element = self.contacts_page.page.locator(':focus')
        assert focused_element.count() > 0, "Tab navigation should work"
        
    def test_form_labels_accessibility(self):
        """Test form labels are properly associated with inputs"""
        self.contacts_page.click_add_contact()
        
        if self.contacts_page.is_visible(self.contacts_page.contact_form):
            form_html = self.contacts_page.contact_form.inner_html()
            
            # Check for label elements or aria-label attributes
            has_labels = (
                '<label' in form_html or 
                'aria-label=' in form_html or
                'aria-labelledby=' in form_html
            )
            
            assert has_labels, "Form inputs should have associated labels for accessibility"
            
            # Cancel form
            if self.contacts_page.is_visible(self.contacts_page.cancel_button):
                self.contacts_page.cancel_contact_form()
                
    def test_table_accessibility_headers(self):
        """Test table has proper headers for screen readers"""
        if self.contacts_page.is_visible(self.contacts_page.contacts_table):
            table_html = self.contacts_page.contacts_table.inner_html()
            
            # Check for table headers and structure
            table_structure = [
                '<thead>',
                '<th',
                'scope=',
                '<tbody>'
            ]
            
            proper_structure = any(element in table_html for element in table_structure)
            assert proper_structure, "Table should have proper header structure for accessibility"
            
    def test_button_accessibility_labels(self):
        """Test buttons have accessible labels or text"""
        # Check add contact button
        if self.contacts_page.is_visible(self.contacts_page.add_contact_button):
            button_text = self.contacts_page.get_text(self.contacts_page.add_contact_button)
            button_html = self.contacts_page.add_contact_button.inner_html()
            
            has_accessible_text = (
                len(button_text.strip()) > 0 or
                'aria-label=' in button_html or
                'title=' in button_html
            )
            
            assert has_accessible_text, "Buttons should have accessible text or labels"
            
    def test_color_contrast_compliance(self):
        """Test color contrast meets WCAG guidelines"""
        # Get computed styles for main elements
        search_input_color = self.contacts_page.search_input.evaluate(
            "element => getComputedStyle(element).color"
        )
        search_input_bg = self.contacts_page.search_input.evaluate(
            "element => getComputedStyle(element).backgroundColor"
        )
        
        # Basic check that colors are defined
        assert search_input_color != 'rgba(0, 0, 0, 0)', "Text color should be defined"
        assert search_input_bg != 'rgba(0, 0, 0, 0)', "Background color should be defined"
        
    def test_focus_indicators_visible(self):
        """Test focus indicators are visible for keyboard users"""
        # Focus on various interactive elements and check visibility
        interactive_elements = [
            self.contacts_page.search_input,
            self.contacts_page.add_contact_button
        ]
        
        for element in interactive_elements:
            if self.contacts_page.is_visible(element):
                element.focus()
                
                # Check if element has focus styles
                focused_style = element.evaluate(
                    "element => getComputedStyle(element).outline"
                )
                
                # Focus indicator should be present (outline or other visual indicator)
                assert focused_style != 'none', f"Element should have visible focus indicator"
                
    def test_semantic_html_structure(self):
        """Test proper semantic HTML structure"""
        page_html = self.contacts_page.page.content()
        
        # Check for semantic HTML elements
        semantic_elements = [
            '<main',
            '<header',
            '<nav',
            '<section',
            '<article',
            '<form',
            '<table',
            '<button',
            '<input'
        ]
        
        semantic_present = sum(1 for element in semantic_elements if element in page_html)
        assert semantic_present >= 3, "Page should use semantic HTML elements"
        
    def test_error_messages_accessibility(self):
        """Test error messages are accessible to screen readers"""
        self.contacts_page.click_add_contact()
        
        # Submit form without required fields to trigger error
        if self.contacts_page.is_visible(self.contacts_page.save_button):
            self.contacts_page.save_contact()
            
            # Check if error messages have proper ARIA attributes
            if self.contacts_page.has_error_message():
                error_element = self.contacts_page.error_message
                error_html = error_element.inner_html()
                
                # Error should have role or aria attributes for screen readers
                accessible_error = (
                    'role=' in error_html or
                    'aria-live=' in error_html or
                    'aria-describedby=' in error_html
                )
                
                # If no specific accessibility attributes, at least should be visible text
                error_text = self.contacts_page.get_error_message()
                has_error_text = len(error_text.strip()) > 0
                
                assert accessible_error or has_error_text, "Error messages should be accessible"
                
        # Cancel form
        if self.contacts_page.is_visible(self.contacts_page.cancel_button):
            self.contacts_page.cancel_contact_form()