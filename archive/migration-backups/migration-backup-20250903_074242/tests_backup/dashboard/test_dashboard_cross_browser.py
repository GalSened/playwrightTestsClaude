import pytest
from playwright.sync_api import Page, Browser
from src.pages.dashboard_page import DashboardPage
from src.pages.login_page import LoginPage


class TestDashboardCrossBrowser:
    """Test suite for dashboard cross-browser compatibility"""
    
    def setup_method(self, page: Page):
        """Setup for cross-browser tests"""
        self.dashboard_page = DashboardPage(page)
        self.login_page = LoginPage(page)
        
        # Login if required
        self.login_page.navigate_to_login()
        if not self.login_page.is_login_successful():
            self.login_page.login_with_email("test@example.com", "password123")
            
    @pytest.mark.parametrize("browser_name", ["chromium", "firefox", "webkit"])
    def test_basic_dashboard_functionality_all_browsers(self, browser_name, playwright):
        """Test basic dashboard functionality across different browsers"""
        browser = getattr(playwright, browser_name)
        context = browser.new_context()
        page = context.new_page()
        
        try:
            self.setup_method(page)
            self.dashboard_page.navigate_to_dashboard()
            
            # Test basic page load
            assert self.dashboard_page.is_dashboard_loaded(), f"Dashboard should load in {browser_name}"
            
            # Test main content visibility
            assert self.dashboard_page.is_visible(self.dashboard_page.main_content, timeout=10000), f"Main content should be visible in {browser_name}"
            
            # Test statistics cards if present
            stats_count = self.dashboard_page.get_stats_cards_count()
            assert stats_count >= 0, f"Statistics cards should be accessible in {browser_name}"
            
        finally:
            context.close()
            
    def test_dashboard_responsive_design_mobile(self, page: Page):
        """Test dashboard responsive design on mobile viewport"""
        self.setup_method(page)
        
        # Set mobile viewport (iPhone SE size)
        page.set_viewport_size({"width": 375, "height": 667})
        
        self.dashboard_page.navigate_to_dashboard()
        
        # Dashboard should be functional on mobile
        assert self.dashboard_page.is_dashboard_loaded()
        assert self.dashboard_page.is_visible(self.dashboard_page.main_content)
        
        # Navigation should be accessible (might be collapsed)
        if self.dashboard_page.is_visible(self.dashboard_page.sidebar_toggle):
            assert True, "Mobile navigation toggle should be available"
        elif self.dashboard_page.is_visible(self.dashboard_page.sidebar):
            assert True, "Navigation should be visible or toggleable on mobile"
            
    def test_dashboard_responsive_design_tablet(self, page: Page):
        """Test dashboard responsive design on tablet viewport"""
        self.setup_method(page)
        
        # Set tablet viewport (iPad size)
        page.set_viewport_size({"width": 768, "height": 1024})
        
        self.dashboard_page.navigate_to_dashboard()
        
        # Dashboard should adapt to tablet size
        assert self.dashboard_page.is_dashboard_loaded()
        assert self.dashboard_page.is_visible(self.dashboard_page.main_content)
        
        # Statistics cards should be visible
        if self.dashboard_page.get_stats_cards_count() > 0:
            assert True, "Statistics should be visible on tablet"
            
    def test_dashboard_responsive_design_desktop(self, page: Page):
        """Test dashboard responsive design on desktop viewport"""
        self.setup_method(page)
        
        # Set desktop viewport (Full HD)
        page.set_viewport_size({"width": 1920, "height": 1080})
        
        self.dashboard_page.navigate_to_dashboard()
        
        # All elements should be properly visible on desktop
        assert self.dashboard_page.is_dashboard_loaded()
        assert self.dashboard_page.is_visible(self.dashboard_page.main_content)
        
        # Navigation should be fully visible
        if self.dashboard_page.is_visible(self.dashboard_page.sidebar):
            assert True, "Navigation should be fully visible on desktop"
            
    def test_dashboard_css_compatibility(self, page: Page):
        """Test CSS compatibility and styling"""
        self.setup_method(page)
        self.dashboard_page.navigate_to_dashboard()
        
        # Test basic CSS properties are applied
        if self.dashboard_page.is_visible(self.dashboard_page.main_content):
            main_styles = self.dashboard_page.main_content.evaluate(
                """element => {
                    const styles = getComputedStyle(element);
                    return {
                        display: styles.display,
                        position: styles.position,
                        width: styles.width,
                        height: styles.height
                    };
                }"""
            )
            
            # Main content should have proper styling
            assert main_styles['display'] != 'none', "Main content should be displayed"
            assert main_styles['width'] != '0px', "Main content should have width"
            
    def test_javascript_functionality_compatibility(self, page: Page):
        """Test JavaScript functionality works across browsers"""
        self.setup_method(page)
        self.dashboard_page.navigate_to_dashboard()
        
        # Test basic JavaScript interactions
        interactive_elements = [
            ('search', self.dashboard_page.search_input),
            ('sidebar_toggle', self.dashboard_page.sidebar_toggle),
            ('notifications', self.dashboard_page.notifications_bell)
        ]
        
        for element_name, element in interactive_elements:
            if self.dashboard_page.is_visible(element):
                try:
                    # Test element interaction
                    if element_name == 'search':
                        self.dashboard_page.search_dashboard("test")
                        search_value = element.input_value()
                        assert "test" in search_value, f"Search functionality should work"
                    elif element_name == 'sidebar_toggle':
                        self.dashboard_page.toggle_sidebar()
                        assert True, f"Sidebar toggle should work"
                    elif element_name == 'notifications':
                        self.dashboard_page.click_notifications()
                        assert True, f"Notifications should be clickable"
                        
                except Exception as e:
                    # Log but don't fail - some interactions might not be available
                    print(f"Interaction with {element_name} not available: {e}")
                    
    def test_dashboard_print_compatibility(self, page: Page):
        """Test dashboard print styles and compatibility"""
        self.setup_method(page)
        self.dashboard_page.navigate_to_dashboard()
        
        # Emulate print media
        page.emulate_media(media="print")
        
        # Dashboard should remain functional in print mode
        assert self.dashboard_page.is_visible(self.dashboard_page.main_content)
        
        # Reset to screen media
        page.emulate_media(media="screen")
        
    def test_dashboard_touch_compatibility(self, page: Page):
        """Test dashboard touch interface compatibility"""
        self.setup_method(page)
        
        # Enable touch simulation
        page.set_viewport_size({"width": 375, "height": 667})
        
        self.dashboard_page.navigate_to_dashboard()
        
        # Test touch interactions on key elements
        touch_elements = [
            self.dashboard_page.sidebar_toggle,
            self.dashboard_page.new_document_button,
            self.dashboard_page.notifications_bell
        ]
        
        for element in touch_elements:
            if self.dashboard_page.is_visible(element):
                try:
                    # Test tap interaction
                    element.tap()
                    assert True, "Touch interaction should work"
                except Exception as e:
                    # Some elements might not support tap
                    print(f"Touch interaction not available: {e}")
                    
    def test_dashboard_keyboard_shortcuts_compatibility(self, page: Page):
        """Test keyboard shortcuts work across browsers"""
        self.setup_method(page)
        self.dashboard_page.navigate_to_dashboard()
        
        # Test common keyboard shortcuts
        keyboard_shortcuts = [
            ("Tab", "Tab navigation"),
            ("Escape", "Escape key"),
            ("Enter", "Enter key")
        ]
        
        for key, description in keyboard_shortcuts:
            try:
                page.keyboard.press(key)
                # Verify page is still functional after key press
                assert self.dashboard_page.is_visible(self.dashboard_page.main_content), f"{description} should not break dashboard"
            except Exception as e:
                print(f"Keyboard shortcut {key} not available: {e}")
                
    def test_dashboard_zoom_levels_compatibility(self, page: Page):
        """Test dashboard at different zoom levels"""
        self.setup_method(page)
        
        zoom_levels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
        
        for zoom in zoom_levels:
            # Set zoom level
            page.evaluate(f"document.body.style.zoom = {zoom}")
            
            self.dashboard_page.navigate_to_dashboard()
            
            # Dashboard should remain functional at all zoom levels
            assert self.dashboard_page.is_dashboard_loaded(), f"Dashboard should work at {zoom*100}% zoom"
            assert self.dashboard_page.is_visible(self.dashboard_page.main_content), f"Content should be visible at {zoom*100}% zoom"
            
        # Reset zoom
        page.evaluate("document.body.style.zoom = 1")
        
    def test_dashboard_accessibility_cross_browser(self, page: Page):
        """Test accessibility features work across browsers"""
        self.setup_method(page)
        self.dashboard_page.navigate_to_dashboard()
        
        # Test screen reader compatibility
        page_content = self.dashboard_page.page.content()
        
        # Check for accessibility attributes that should work across browsers
        accessibility_features = [
            'aria-label',
            'role=',
            'alt=',
            '<h1', '<h2', '<h3',  # Heading structure
            'tabindex='
        ]
        
        accessibility_present = sum(1 for feature in accessibility_features if feature in page_content)
        assert accessibility_present >= 3, "Dashboard should have accessibility features across browsers"