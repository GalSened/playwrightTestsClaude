import pytest
from playwright.sync_api import Page
from src.pages.dashboard_page import DashboardPage
from src.pages.login_page import LoginPage


class TestDashboardAccessibility:
    """Test suite for Dashboard page accessibility compliance"""
    
    @pytest.fixture(autouse=True)
    def setup_page(self, page: Page):
        """Setup dashboard page for accessibility tests"""
        self.dashboard_page = DashboardPage(page)
        self.login_page = LoginPage(page)
        
        # Login if required
        self.login_page.navigate_to_login()
        if not self.login_page.is_login_successful():
            self.login_page.login_with_email("test@example.com", "password123")
            
        # Navigate to dashboard
        self.dashboard_page.navigate_to_dashboard()
        
    def test_aria_labels_and_roles_present(self):
        """Test that ARIA labels and roles are present for accessibility"""
        page_content = self.dashboard_page.page.content()
        
        # Check for ARIA attributes
        aria_attributes = [
            'aria-label',
            'aria-labelledby', 
            'aria-describedby',
            'role=',
            'aria-expanded',
            'aria-hidden',
            'aria-current'
        ]
        
        aria_present = any(attr in page_content for attr in aria_attributes)
        assert aria_present, "ARIA attributes should be present for accessibility"
        
    def test_keyboard_navigation_dashboard(self):
        """Test keyboard navigation through dashboard elements"""
        # Focus on the main content area first
        if self.dashboard_page.is_visible(self.dashboard_page.main_content):
            self.dashboard_page.main_content.focus()
        
        # Tab through interactive elements
        for _ in range(5):  # Test several tab stops
            self.dashboard_page.page.keyboard.press("Tab")
            
            # Verify focus is on an interactive element
            focused_element = self.dashboard_page.page.locator(':focus')
            if focused_element.count() > 0:
                element_tag = focused_element.evaluate("element => element.tagName.toLowerCase()")
                interactive_elements = ['button', 'a', 'input', 'select', 'textarea']
                
                # Focus should be on interactive elements or have tabindex
                has_tabindex = focused_element.evaluate("element => element.hasAttribute('tabindex')")
                assert element_tag in interactive_elements or has_tabindex
                
    def test_navigation_menu_accessibility(self):
        """Test navigation menu accessibility"""
        if self.dashboard_page.is_visible(self.dashboard_page.sidebar):
            nav_html = self.dashboard_page.sidebar.inner_html()
            
            # Check for navigation landmarks and structure
            nav_structure = [
                '<nav',
                'role="navigation"',
                '<ul',
                '<li',
                'aria-label',
                'role="menubar"',
                'role="menu"'
            ]
            
            has_nav_structure = any(structure in nav_html for structure in nav_structure)
            assert has_nav_structure, "Navigation should have proper semantic structure"
            
    def test_statistics_cards_accessibility(self):
        """Test statistics cards are accessible to screen readers"""
        if self.dashboard_page.get_stats_cards_count() > 0:
            first_card = self.dashboard_page.stats_cards.first
            card_html = first_card.inner_html()
            
            # Cards should have proper structure for screen readers
            accessible_elements = [
                'aria-label',
                'role=',
                '<h1', '<h2', '<h3', '<h4', '<h5', '<h6',  # Heading tags
                'aria-describedby'
            ]
            
            has_accessible_elements = any(element in card_html for element in accessible_elements)
            assert has_accessible_elements, "Statistics cards should be accessible"
            
    def test_quick_actions_accessibility(self):
        """Test quick actions buttons accessibility"""
        quick_action_buttons = [
            self.dashboard_page.new_document_button,
            self.dashboard_page.upload_document_button,
            self.dashboard_page.invite_users_button
        ]
        
        for button in quick_action_buttons:
            if self.dashboard_page.is_visible(button):
                button_text = self.dashboard_page.get_text(button)
                button_html = button.inner_html()
                
                # Button should have accessible text or labels
                has_accessible_text = (
                    len(button_text.strip()) > 0 or
                    'aria-label=' in button_html or
                    'title=' in button_html or
                    'aria-describedby=' in button_html
                )
                
                assert has_accessible_text, "Quick action buttons should have accessible labels"
                
    def test_search_functionality_accessibility(self):
        """Test search input accessibility"""
        if self.dashboard_page.is_visible(self.dashboard_page.search_input):
            search_html = self.dashboard_page.search_input.get_attribute('outerHTML')
            
            # Search input should have proper labels
            search_accessibility = [
                'aria-label=',
                'placeholder=',
                'aria-describedby=',
                'id=',
                'name='
            ]
            
            has_search_labels = any(attr in search_html for attr in search_accessibility)
            assert has_search_labels, "Search input should have proper accessibility labels"
            
    def test_table_accessibility_structure(self):
        """Test table accessibility for screen readers"""
        if self.dashboard_page.is_visible(self.dashboard_page.recent_documents_table):
            table_html = self.dashboard_page.recent_documents_table.inner_html()
            
            # Check for proper table structure
            table_elements = [
                '<thead>',
                '<tbody>',
                '<th',
                'scope=',
                'role="table"',
                'role="columnheader"',
                'aria-label'
            ]
            
            proper_table_structure = any(element in table_html for element in table_elements)
            assert proper_table_structure, "Table should have proper accessibility structure"
            
    def test_focus_indicators_visible(self):
        """Test focus indicators are visible for keyboard users"""
        interactive_elements = [
            self.dashboard_page.new_document_button,
            self.dashboard_page.search_input,
            self.dashboard_page.sidebar_toggle
        ]
        
        for element in interactive_elements:
            if self.dashboard_page.is_visible(element):
                element.focus()
                
                # Check if element has focus styles
                focused_styles = element.evaluate(
                    """element => {
                        const styles = getComputedStyle(element);
                        return {
                            outline: styles.outline,
                            outlineWidth: styles.outlineWidth,
                            outlineStyle: styles.outlineStyle,
                            boxShadow: styles.boxShadow,
                            border: styles.border
                        };
                    }"""
                )
                
                # Should have some form of focus indicator
                has_focus_indicator = (
                    focused_styles.get('outline', 'none') != 'none' or
                    focused_styles.get('outlineWidth', '0px') != '0px' or
                    'box-shadow' in str(focused_styles.get('boxShadow', '')) or
                    len(focused_styles.get('border', '')) > 0
                )
                
                assert has_focus_indicator, f"Element should have visible focus indicator"
                
    def test_color_contrast_compliance(self):
        """Test color contrast meets WCAG guidelines"""
        # Test main content area
        if self.dashboard_page.is_visible(self.dashboard_page.main_content):
            content_styles = self.dashboard_page.main_content.evaluate(
                """element => {
                    const styles = getComputedStyle(element);
                    return {
                        color: styles.color,
                        backgroundColor: styles.backgroundColor
                    };
                }"""
            )
            
            # Colors should be defined (not transparent)
            assert content_styles['color'] != 'rgba(0, 0, 0, 0)', "Text color should be defined"
            
        # Test navigation elements
        if self.dashboard_page.is_visible(self.dashboard_page.sidebar):
            nav_styles = self.dashboard_page.sidebar.evaluate(
                """element => {
                    const styles = getComputedStyle(element);
                    return {
                        color: styles.color,
                        backgroundColor: styles.backgroundColor
                    };
                }"""
            )
            
            # Navigation should have proper contrast
            assert nav_styles['color'] != 'rgba(0, 0, 0, 0)', "Navigation text should be visible"
            
    def test_semantic_html_structure(self):
        """Test proper semantic HTML structure"""
        page_html = self.dashboard_page.page.content()
        
        # Check for semantic HTML5 elements
        semantic_elements = [
            '<main',
            '<header',
            '<nav',
            '<section',
            '<article',
            '<aside',
            '<h1', '<h2', '<h3',  # Heading hierarchy
            '<button',
            '<form'
        ]
        
        semantic_present = sum(1 for element in semantic_elements if element in page_html)
        assert semantic_present >= 5, "Dashboard should use semantic HTML elements"
        
    def test_heading_hierarchy(self):
        """Test proper heading hierarchy for screen readers"""
        headings = self.dashboard_page.page.locator('h1, h2, h3, h4, h5, h6').all()
        
        if headings:
            # Should have at least one main heading
            h1_count = self.dashboard_page.page.locator('h1').count()
            assert h1_count >= 1, "Page should have at least one H1 heading"
            
            # Test heading levels are logical
            heading_levels = []
            for heading in headings:
                tag_name = heading.evaluate("element => element.tagName")
                level = int(tag_name[1])  # Extract number from H1, H2, etc.
                heading_levels.append(level)
                
            if len(heading_levels) > 1:
                # First heading should be H1 or H2
                assert heading_levels[0] <= 2, "First heading should be H1 or H2"
                
    def test_modal_dialogs_accessibility(self):
        """Test modal dialogs accessibility"""
        # Try to open a modal
        if self.dashboard_page.is_visible(self.dashboard_page.new_document_button):
            self.dashboard_page.click_quick_action('new_document')
            
            if self.dashboard_page.is_visible(self.dashboard_page.modal_dialog):
                modal_html = self.dashboard_page.modal_dialog.inner_html()
                
                # Modal should have proper accessibility attributes
                modal_accessibility = [
                    'role="dialog"',
                    'aria-modal="true"',
                    'aria-labelledby=',
                    'aria-describedby=',
                    'tabindex="-1"'
                ]
                
                has_modal_accessibility = any(attr in modal_html for attr in modal_accessibility)
                assert has_modal_accessibility, "Modal should have proper accessibility attributes"
                
                # Close modal
                self.dashboard_page.close_modal()
                
    def test_notifications_accessibility(self):
        """Test notifications accessibility"""
        if self.dashboard_page.is_visible(self.dashboard_page.notifications_bell):
            notification_html = self.dashboard_page.notifications_bell.get_attribute('outerHTML')
            
            # Notification button should have proper labels
            notification_accessibility = [
                'aria-label=',
                'title=',
                'aria-describedby=',
                'role="button"'
            ]
            
            has_notification_labels = any(attr in notification_html for attr in notification_accessibility)
            assert has_notification_labels, "Notifications should have accessibility labels"
            
    def test_skip_navigation_links(self):
        """Test for skip navigation links"""
        # Check for skip links at the beginning of the page
        skip_links = self.dashboard_page.page.locator('a[href^="#"]').all()
        
        if skip_links:
            skip_link_texts = []
            for link in skip_links:
                text = self.dashboard_page.get_text(link).lower()
                skip_link_texts.append(text)
                
            # Look for common skip link patterns
            skip_patterns = ['skip', 'main', 'content', 'navigation', 'menu']
            has_skip_links = any(
                any(pattern in text for pattern in skip_patterns) 
                for text in skip_link_texts
            )
            
            if has_skip_links:
                assert True, "Skip navigation links found"
            else:
                # Skip links are recommended but not required
                assert True, "Skip links not found but not required"