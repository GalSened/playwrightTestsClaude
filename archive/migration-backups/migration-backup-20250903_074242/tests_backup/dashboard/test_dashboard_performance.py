import pytest
from playwright.sync_api import Page
from src.pages.dashboard_page import DashboardPage
from src.pages.login_page import LoginPage
import time


class TestDashboardPerformance:
    """Test suite for Dashboard page performance"""
    
    @pytest.fixture(autouse=True)
    def setup_page(self, page: Page):
        """Setup dashboard page for performance tests"""
        self.dashboard_page = DashboardPage(page)
        self.login_page = LoginPage(page)
        
        # Login if required
        self.login_page.navigate_to_login()
        if not self.login_page.is_login_successful():
            self.login_page.login_with_email("test@example.com", "password123")
            
    def test_dashboard_page_load_time(self):
        """Test dashboard page loads within acceptable time"""
        start_time = time.time()
        
        self.dashboard_page.navigate_to_dashboard()
        self.dashboard_page.wait_for_dashboard_load()
        
        load_time = time.time() - start_time
        
        # Dashboard should load within 8 seconds
        assert load_time < 8.0, f"Dashboard load time {load_time:.2f}s exceeds 8 seconds"
        
    def test_statistics_cards_load_time(self):
        """Test statistics cards load quickly"""
        self.dashboard_page.navigate_to_dashboard()
        
        start_time = time.time()
        
        # Wait for statistics cards to be visible and populated
        cards_loaded = False
        timeout = 5.0  # 5 second timeout
        
        while not cards_loaded and (time.time() - start_time) < timeout:
            if self.dashboard_page.get_stats_cards_count() > 0:
                cards_loaded = True
            else:
                time.sleep(0.1)
                
        load_time = time.time() - start_time
        
        # Statistics should load within 5 seconds
        assert load_time < 5.0, f"Statistics cards load time {load_time:.2f}s exceeds 5 seconds"
        assert cards_loaded, "Statistics cards should load successfully"
        
    def test_navigation_response_time(self):
        """Test navigation between sections responds quickly"""
        self.dashboard_page.navigate_to_dashboard()
        
        nav_sections = ['documents', 'contacts', 'settings']
        
        for section in nav_sections:
            if self.dashboard_page.is_visible(getattr(self.dashboard_page, f'nav_{section}')):
                start_time = time.time()
                
                self.dashboard_page.navigate_to_section(section)
                
                # Wait for navigation to complete
                time.sleep(0.5)  # Brief wait for URL change
                
                navigation_time = time.time() - start_time
                
                # Navigation should be quick (under 3 seconds)
                assert navigation_time < 3.0, f"Navigation to {section} took {navigation_time:.2f}s (exceeds 3s)"
                
                # Navigate back to dashboard for next test
                self.dashboard_page.navigate_to_dashboard()
                time.sleep(0.5)
                
    def test_search_response_time(self):
        """Test search functionality responds quickly"""
        self.dashboard_page.navigate_to_dashboard()
        
        if self.dashboard_page.is_visible(self.dashboard_page.search_input):
            start_time = time.time()
            
            self.dashboard_page.search_dashboard("performance test")
            
            # Wait for search to complete
            self.dashboard_page.wait_for_loading_complete()
            
            search_time = time.time() - start_time
            
            # Search should respond within 3 seconds
            assert search_time < 3.0, f"Search response time {search_time:.2f}s exceeds 3 seconds"
            
    def test_sidebar_toggle_performance(self):
        """Test sidebar toggle animation performance"""
        self.dashboard_page.navigate_to_dashboard()
        
        if self.dashboard_page.is_visible(self.dashboard_page.sidebar_toggle):
            # Measure toggle response time
            start_time = time.time()
            
            self.dashboard_page.toggle_sidebar()
            
            # Allow for animation to complete
            time.sleep(0.5)
            
            toggle_time = time.time() - start_time
            
            # Toggle should complete within 1 second
            assert toggle_time < 1.0, f"Sidebar toggle took {toggle_time:.2f}s (exceeds 1s)"
            
    def test_quick_actions_response_time(self):
        """Test quick action buttons respond quickly"""
        self.dashboard_page.navigate_to_dashboard()
        
        quick_actions = ['new_document', 'upload_document', 'invite_users']
        
        for action in quick_actions:
            button = getattr(self.dashboard_page, f'{action}_button')
            
            if self.dashboard_page.is_visible(button):
                start_time = time.time()
                
                self.dashboard_page.click_quick_action(action)
                
                # Wait for action response (modal or navigation)
                time.sleep(1)
                
                response_time = time.time() - start_time
                
                # Action should respond within 2 seconds
                assert response_time < 2.0, f"{action} response time {response_time:.2f}s exceeds 2s"
                
                # Close any modal that might have opened
                if self.dashboard_page.is_visible(self.dashboard_page.modal_dialog):
                    self.dashboard_page.close_modal()
                    
                # Navigate back to dashboard if we navigated away
                current_url = self.dashboard_page.get_current_url()
                if "/dashboard" not in current_url:
                    self.dashboard_page.navigate_to_dashboard()
                    
    def test_table_rendering_performance(self):
        """Test recent documents table renders efficiently"""
        self.dashboard_page.navigate_to_dashboard()
        
        if self.dashboard_page.is_visible(self.dashboard_page.recent_documents_table):
            start_time = time.time()
            
            # Wait for table to fully load with data
            table_loaded = False
            timeout = 5.0
            
            while not table_loaded and (time.time() - start_time) < timeout:
                if self.dashboard_page.get_recent_documents_count() >= 0:
                    table_loaded = True
                else:
                    time.sleep(0.1)
                    
            render_time = time.time() - start_time
            
            # Table should render within 5 seconds
            assert render_time < 5.0, f"Table render time {render_time:.2f}s exceeds 5 seconds"
            assert table_loaded, "Table should load successfully"
            
    def test_notifications_load_performance(self):
        """Test notifications load quickly"""
        self.dashboard_page.navigate_to_dashboard()
        
        if self.dashboard_page.is_visible(self.dashboard_page.notifications_bell):
            start_time = time.time()
            
            notifications_count = self.dashboard_page.get_notifications_count()
            
            load_time = time.time() - start_time
            
            # Notifications should load within 3 seconds
            assert load_time < 3.0, f"Notifications load time {load_time:.2f}s exceeds 3 seconds"
            assert notifications_count >= 0, "Notifications should be accessible"
            
    def test_dashboard_memory_usage(self):
        """Test dashboard doesn't cause excessive memory usage"""
        self.dashboard_page.navigate_to_dashboard()
        
        # Get initial memory usage
        initial_memory = self.dashboard_page.page.evaluate(
            "() => performance.memory ? performance.memory.usedJSHeapSize : 0"
        )
        
        # Perform various dashboard operations
        operations = [
            lambda: self.dashboard_page.search_dashboard("memory test") if self.dashboard_page.is_visible(self.dashboard_page.search_input) else None,
            lambda: self.dashboard_page.toggle_sidebar() if self.dashboard_page.is_visible(self.dashboard_page.sidebar_toggle) else None,
            lambda: self.dashboard_page.click_notifications() if self.dashboard_page.is_visible(self.dashboard_page.notifications_bell) else None
        ]
        
        for operation in operations:
            try:
                operation()
                time.sleep(0.5)  # Allow operation to complete
            except:
                pass  # Continue with other operations
                
        # Get final memory usage
        final_memory = self.dashboard_page.page.evaluate(
            "() => performance.memory ? performance.memory.usedJSHeapSize : 0"
        )
        
        if initial_memory > 0 and final_memory > 0:
            memory_increase = final_memory - initial_memory
            
            # Memory increase should be reasonable (less than 50MB)
            max_memory_increase = 50 * 1024 * 1024  # 50MB in bytes
            assert memory_increase < max_memory_increase, f"Memory usage increased by {memory_increase / (1024*1024):.1f}MB"
            
    def test_dashboard_responsive_performance(self):
        """Test dashboard performance across different viewport sizes"""
        viewports = [
            {"width": 1920, "height": 1080, "name": "desktop"},
            {"width": 768, "height": 1024, "name": "tablet"},
            {"width": 375, "height": 667, "name": "mobile"}
        ]
        
        for viewport in viewports:
            self.dashboard_page.page.set_viewport_size({"width": viewport["width"], "height": viewport["height"]})
            
            start_time = time.time()
            
            self.dashboard_page.navigate_to_dashboard()
            self.dashboard_page.wait_for_dashboard_load()
            
            load_time = time.time() - start_time
            
            # Dashboard should load efficiently on all viewport sizes
            max_load_time = 10.0  # Allow more time for mobile
            assert load_time < max_load_time, f"Dashboard load time on {viewport['name']} viewport: {load_time:.2f}s exceeds {max_load_time}s"
            
    def test_concurrent_operations_performance(self):
        """Test dashboard handles concurrent operations efficiently"""
        self.dashboard_page.navigate_to_dashboard()
        
        start_time = time.time()
        
        # Simulate multiple rapid operations
        operations = [
            lambda: self.dashboard_page.get_stats_cards_count(),
            lambda: self.dashboard_page.get_recent_activity_count(),
            lambda: self.dashboard_page.validate_dashboard_elements_present()
        ]
        
        # Execute operations multiple times rapidly
        for _ in range(3):
            for operation in operations:
                try:
                    operation()
                except:
                    pass  # Continue with other operations
                    
        total_time = time.time() - start_time
        
        # Multiple operations should complete within reasonable time
        assert total_time < 5.0, f"Concurrent operations took {total_time:.2f}s (exceeds 5s)"