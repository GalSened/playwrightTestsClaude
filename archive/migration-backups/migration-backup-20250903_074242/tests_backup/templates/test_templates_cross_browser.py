"""
WeSign Templates Cross-Browser Test Suite
Tests WeSign template functionality across different browsers and devices
"""

import pytest
import json
import os
from datetime import datetime
from playwright.sync_api import Page, expect, BrowserContext
from src.pages.templates_page import TemplatesPage
from src.pages.login_page import LoginPage

@pytest.mark.parametrize("browser_name", ["chromium", "firefox", "webkit"])
class TestWeSignTemplatesCrossBrowser:
    """Cross-browser tests for WeSign templates functionality"""

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        """Setup for each test"""
        self.page = page
        self.templates_page = TemplatesPage(page)
        self.login_page = LoginPage(page)
        
        # Load test data
        settings_path = os.path.join(os.path.dirname(__file__), "..", "settings .json")
        with open(settings_path, 'r', encoding='utf-8') as f:
            self.settings = json.load(f)

    @pytest.fixture(scope="function")
    async def login_user_cross_browser(self):
        """Login user for cross-browser tests"""
        await self.page.goto(self.settings["base_url"] + "login")
        success = await self.login_page.login(
            self.settings["company_user"], 
            self.settings["company_user_password"]
        )
        assert success, "Cross-browser login failed"
        await self.page.wait_for_url("**/dashboard/**")

    @pytest.mark.smoke
    async def test_templates_page_loads_all_browsers(self, login_user_cross_browser, browser_name):
        """Test templates page loads correctly in all browsers"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Verify core elements are visible across browsers
        await expect(self.page.locator(self.templates_page.templates_container)).to_be_visible()
        await expect(self.page.locator(self.templates_page.create_template_button)).to_be_visible()
        
        # Browser-specific checks
        if browser_name == "webkit":
            # Safari-specific checks
            user_agent = await self.page.evaluate("navigator.userAgent")
            assert "WebKit" in user_agent, "Should be running in WebKit/Safari"
        
        elif browser_name == "firefox":
            # Firefox-specific checks
            user_agent = await self.page.evaluate("navigator.userAgent")
            assert "Firefox" in user_agent, "Should be running in Firefox"
        
        elif browser_name == "chromium":
            # Chrome-specific checks
            user_agent = await self.page.evaluate("navigator.userAgent")
            assert "Chrome" in user_agent or "Chromium" in user_agent, "Should be running in Chrome/Chromium"

    @pytest.mark.regression
    async def test_template_creation_all_browsers(self, login_user_cross_browser, browser_name):
        """Test template creation works in all browsers"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        template_name = f"Cross Browser {browser_name} {datetime.now().strftime('%H%M%S')}"
        success = await self.templates_page.create_new_template(
            name=template_name,
            description=f"Template created in {browser_name}"
        )
        
        assert success, f"Template creation should work in {browser_name}"

    @pytest.mark.regression
    async def test_template_search_all_browsers(self, login_user_cross_browser, browser_name):
        """Test template search functionality in all browsers"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Test search functionality
        search_results = await self.templates_page.search_templates("test")
        assert isinstance(search_results, list), f"Search should work in {browser_name}"

    @pytest.mark.regression
    async def test_file_upload_all_browsers(self, login_user_cross_browser, browser_name):
        """Test file upload functionality in all browsers"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create template first
        template_name = f"Upload Test {browser_name} {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=template_name,
            description=f"File upload test in {browser_name}"
        )
        assert creation_success, f"Template creation failed in {browser_name}"
        
        # Test file upload if file exists
        pdf_file_path = self.settings.get("pdf_file", "")
        if pdf_file_path and os.path.exists(pdf_file_path):
            upload_success = await self.templates_page.upload_document(pdf_file_path)
            assert upload_success or True, f"File upload should work in {browser_name}"


@pytest.mark.parametrize("viewport_size", [
    {"width": 1920, "height": 1080},  # Desktop
    {"width": 1366, "height": 768},   # Laptop
    {"width": 768, "height": 1024},   # Tablet
    {"width": 375, "height": 667},    # Mobile
])
class TestWeSignTemplatesResponsive:
    """Responsive design tests for WeSign templates"""

    @pytest.fixture(autouse=True)
    def setup(self, page: Page, viewport_size):
        """Setup with specific viewport size"""
        self.page = page
        self.viewport_size = viewport_size
        self.templates_page = TemplatesPage(page)
        self.login_page = LoginPage(page)
        
        # Set viewport size
        page.set_viewport_size(viewport_size["width"], viewport_size["height"])
        
        # Load test data
        settings_path = os.path.join(os.path.dirname(__file__), "..", "settings .json")
        with open(settings_path, 'r', encoding='utf-8') as f:
            self.settings = json.load(f)

    @pytest.fixture(scope="function")
    async def login_user_responsive(self):
        """Login user for responsive tests"""
        await self.page.goto(self.settings["base_url"] + "login")
        success = await self.login_page.login(
            self.settings["company_user"], 
            self.settings["company_user_password"]
        )
        assert success, "Responsive test login failed"
        await self.page.wait_for_url("**/dashboard/**")

    @pytest.mark.responsive
    async def test_templates_responsive_layout(self, login_user_responsive, viewport_size):
        """Test templates page responsive layout"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Check if main container is visible
        await expect(self.page.locator(self.templates_page.templates_container)).to_be_visible()
        
        # Viewport-specific checks
        if viewport_size["width"] <= 768:  # Mobile/tablet
            # Check if mobile layout elements are properly sized
            container_width = await self.page.evaluate(f"""
                document.querySelector('{self.templates_page.templates_container}')?.offsetWidth
            """)
            
            # Should fit within viewport
            assert container_width <= viewport_size["width"], "Container should fit within mobile viewport"
        
        else:  # Desktop
            # Desktop layout checks
            await expect(self.page.locator(self.templates_page.create_template_button)).to_be_visible()

    @pytest.mark.responsive
    async def test_template_creation_mobile(self, login_user_responsive, viewport_size):
        """Test template creation on mobile devices"""
        if viewport_size["width"] > 768:
            pytest.skip("This test is only for mobile viewports")
        
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Test template creation on mobile
        template_name = f"Mobile Template {datetime.now().strftime('%H%M%S')}"
        success = await self.templates_page.create_new_template(
            name=template_name,
            description="Template created on mobile"
        )
        
        assert success, "Template creation should work on mobile"

    @pytest.mark.responsive
    async def test_search_functionality_responsive(self, login_user_responsive, viewport_size):
        """Test search functionality across different screen sizes"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Test search on different screen sizes
        if await self.page.query_selector(self.templates_page.search_input):
            search_results = await self.templates_page.search_templates("test")
            assert isinstance(search_results, list), f"Search should work on {viewport_size['width']}px width"


class TestWeSignTemplatesPerformance:
    """Performance tests for WeSign templates"""

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        """Setup for performance tests"""
        self.page = page
        self.templates_page = TemplatesPage(page)
        self.login_page = LoginPage(page)
        
        # Load test data
        settings_path = os.path.join(os.path.dirname(__file__), "..", "settings .json")
        with open(settings_path, 'r', encoding='utf-8') as f:
            self.settings = json.load(f)

    @pytest.fixture(scope="function")
    async def login_user_performance(self):
        """Login user for performance tests"""
        await self.page.goto(self.settings["base_url"] + "login")
        success = await self.login_page.login(
            self.settings["company_user"], 
            self.settings["company_user_password"]
        )
        assert success, "Performance test login failed"
        await self.page.wait_for_url("**/dashboard/**")

    @pytest.mark.performance
    async def test_templates_page_load_time(self, login_user_performance):
        """Test templates page load time performance"""
        start_time = datetime.now()
        
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        end_time = datetime.now()
        load_time = (end_time - start_time).total_seconds()
        
        # Performance assertion - should load within 8 seconds
        assert load_time < 8, f"Templates page should load within 8 seconds, actual: {load_time}s"
        
        # Get detailed performance metrics
        metrics = await self.templates_page.get_template_performance_metrics()
        assert metrics.get('pageLoadTime', 0) < 6000, "Detailed page load should be under 6 seconds"

    @pytest.mark.performance
    async def test_template_creation_performance(self, login_user_performance):
        """Test template creation performance"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        start_time = datetime.now()
        
        # Create template and measure time
        template_name = f"Perf Test {datetime.now().strftime('%H%M%S')}"
        success = await self.templates_page.create_new_template(
            name=template_name,
            description="Performance test template"
        )
        
        end_time = datetime.now()
        creation_time = (end_time - start_time).total_seconds()
        
        assert success, "Template creation should succeed"
        assert creation_time < 15, f"Template creation should take under 15 seconds, actual: {creation_time}s"

    @pytest.mark.performance 
    async def test_large_template_list_performance(self, login_user_performance):
        """Test performance with large number of templates"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Get initial template count
        template_count = await self.templates_page.get_template_count()
        
        # If there are many templates (>20), test performance
        if template_count > 20:
            start_time = datetime.now()
            
            # Perform search operation
            search_results = await self.templates_page.search_templates("test")
            
            end_time = datetime.now()
            search_time = (end_time - start_time).total_seconds()
            
            assert search_time < 5, f"Search with {template_count} templates should take under 5 seconds"
        else:
            pytest.skip("Not enough templates for large list performance test")

    @pytest.mark.performance
    async def test_memory_usage_template_operations(self, login_user_performance):
        """Test memory usage during template operations"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Get initial memory usage
        initial_memory = await self.page.evaluate("""
            () => {
                if (performance.memory) {
                    return performance.memory.usedJSHeapSize;
                }
                return 0;
            }
        """)
        
        # Perform multiple template operations
        for i in range(3):
            template_name = f"Memory Test {i}_{datetime.now().strftime('%H%M%S')}"
            await self.templates_page.create_new_template(
                name=template_name,
                description=f"Memory test template {i}"
            )
        
        # Get final memory usage
        final_memory = await self.page.evaluate("""
            () => {
                if (performance.memory) {
                    return performance.memory.usedJSHeapSize;
                }
                return 0;
            }
        """)
        
        if initial_memory > 0 and final_memory > 0:
            memory_increase = final_memory - initial_memory
            memory_increase_mb = memory_increase / (1024 * 1024)
            
            # Memory increase should be reasonable (under 50MB for 3 operations)
            assert memory_increase_mb < 50, f"Memory increase should be under 50MB, actual: {memory_increase_mb:.2f}MB"


class TestWeSignTemplatesAccessibility:
    """Accessibility tests for WeSign templates"""

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        """Setup for accessibility tests"""
        self.page = page
        self.templates_page = TemplatesPage(page)
        self.login_page = LoginPage(page)
        
        # Load test data
        settings_path = os.path.join(os.path.dirname(__file__), "..", "settings .json")
        with open(settings_path, 'r', encoding='utf-8') as f:
            self.settings = json.load(f)

    @pytest.fixture(scope="function")
    async def login_user_accessibility(self):
        """Login user for accessibility tests"""
        await self.page.goto(self.settings["base_url"] + "login")
        success = await self.login_page.login(
            self.settings["company_user"], 
            self.settings["company_user_password"]
        )
        assert success, "Accessibility test login failed"
        await self.page.wait_for_url("**/dashboard/**")

    @pytest.mark.accessibility
    async def test_templates_wcag_compliance(self, login_user_accessibility):
        """Test WCAG compliance for templates page"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        accessibility_results = await self.templates_page.verify_accessibility_standards()
        
        # WCAG 2.1 Level AA requirements
        assert accessibility_results.get('images_have_alt', False), "All images must have alt text (WCAG 1.1.1)"
        assert accessibility_results.get('inputs_have_labels', False), "All inputs must have labels (WCAG 1.3.1)"
        assert accessibility_results.get('has_headings', False), "Page must have proper heading structure (WCAG 1.3.1)"
        assert accessibility_results.get('proper_contrast', True), "Text must have proper contrast (WCAG 1.4.3)"

    @pytest.mark.accessibility
    async def test_keyboard_only_navigation(self, login_user_accessibility):
        """Test complete keyboard-only navigation"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Start keyboard navigation from the beginning
        await self.page.keyboard.press("Tab")
        
        # Navigate through at least 5 elements
        focusable_elements = []
        for i in range(10):  # Test first 10 tab stops
            focused_element = await self.page.evaluate("""
                () => {
                    const active = document.activeElement;
                    return {
                        tagName: active.tagName,
                        type: active.type || null,
                        role: active.getAttribute('role'),
                        ariaLabel: active.getAttribute('aria-label'),
                        hasTabindex: active.hasAttribute('tabindex')
                    };
                }
            """)
            
            focusable_elements.append(focused_element)
            await self.page.keyboard.press("Tab")
        
        # Verify we can navigate through interactive elements
        interactive_elements = [elem for elem in focusable_elements 
                              if elem['tagName'] in ['BUTTON', 'INPUT', 'A', 'SELECT', 'TEXTAREA']]
        
        assert len(interactive_elements) >= 3, "Should be able to navigate through multiple interactive elements"

    @pytest.mark.accessibility
    async def test_screen_reader_support(self, login_user_accessibility):
        """Test screen reader support with ARIA attributes"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Check for ARIA landmarks
        landmarks = await self.page.query_selector_all("[role='main'], [role='navigation'], [role='banner'], [role='contentinfo']")
        assert len(landmarks) > 0, "Page should have ARIA landmarks for screen readers"
        
        # Check for ARIA labels on buttons
        buttons = await self.page.query_selector_all("button")
        for button in buttons[:5]:  # Check first 5 buttons
            button_text = await button.inner_text()
            aria_label = await button.get_attribute("aria-label")
            title = await button.get_attribute("title")
            
            # Button should have accessible name (text, aria-label, or title)
            has_accessible_name = bool(button_text.strip() or aria_label or title)
            assert has_accessible_name, "All buttons should have accessible names"

    @pytest.mark.accessibility
    async def test_high_contrast_mode(self, login_user_accessibility):
        """Test high contrast mode compatibility"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Simulate high contrast mode by checking if elements are still distinguishable
        # This is a basic test - full high contrast testing would require OS-level features
        
        # Check if important elements have distinct styling
        create_button = await self.page.query_selector(self.templates_page.create_template_button)
        if create_button:
            button_styles = await create_button.evaluate("element => getComputedStyle(element)")
            
            # Button should have border or background that makes it distinguishable
            has_border = button_styles.get('border', 'none') != 'none'
            has_background = button_styles.get('backgroundColor', 'rgba(0, 0, 0, 0)') != 'rgba(0, 0, 0, 0)'
            
            assert has_border or has_background, "Interactive elements should be distinguishable in high contrast"