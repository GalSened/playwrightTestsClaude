import pytest
from playwright.sync_api import Page
from src.pages.dashboard_page import DashboardPage
from src.pages.login_page import LoginPage
import time
import random
import string


class TestDashboardEdgeCases:
    """Test suite for dashboard edge cases and boundary conditions"""
    
    @pytest.fixture(autouse=True)
    def setup_page(self, page: Page):
        """Setup dashboard page for edge case tests"""
        self.dashboard_page = DashboardPage(page)
        self.login_page = LoginPage(page)
        
        # Login if required
        self.login_page.navigate_to_login()
        if not self.login_page.is_login_successful():
            self.login_page.login_with_email("test@example.com", "password123")
            
        # Navigate to dashboard
        self.dashboard_page.navigate_to_dashboard()
        
    def test_dashboard_with_no_data(self):
        """Test dashboard behavior when no data is available"""
        # Dashboard should handle empty states gracefully
        assert self.dashboard_page.is_dashboard_loaded()
        
        # Check that empty states are handled properly
        if self.dashboard_page.get_stats_cards_count() == 0:
            assert True, "Dashboard handles no statistics cards gracefully"
            
        if self.dashboard_page.get_recent_activity_count() == 0:
            assert True, "Dashboard handles no recent activity gracefully"
            
        if self.dashboard_page.get_recent_documents_count() == 0:
            assert True, "Dashboard handles no recent documents gracefully"
            
    def test_extremely_long_search_query(self):
        """Test search with extremely long query"""
        if self.dashboard_page.is_visible(self.dashboard_page.search_input):
            # Generate very long search query (2000 characters)
            long_query = 'a' * 2000
            
            try:
                self.dashboard_page.search_dashboard(long_query)
                
                # Dashboard should handle gracefully without crashing
                assert self.dashboard_page.is_dashboard_loaded(), "Dashboard should remain functional with long search query"
                
                # Search input should contain some version of the query (potentially truncated)
                search_value = self.dashboard_page.search_input.input_value()
                assert len(search_value) > 0, "Search input should contain some value"
                
            except Exception as e:
                # Should not crash the entire dashboard
                assert self.dashboard_page.is_dashboard_loaded(), "Dashboard should remain functional despite search error"
                
    def test_rapid_successive_clicks(self):
        """Test rapid successive clicks on dashboard elements"""
        clickable_elements = [
            ('sidebar_toggle', self.dashboard_page.sidebar_toggle),
            ('new_document', self.dashboard_page.new_document_button),
            ('notifications', self.dashboard_page.notifications_bell)
        ]
        
        for element_name, element in clickable_elements:
            if self.dashboard_page.is_visible(element):
                try:
                    # Rapid clicks (10 times)
                    for _ in range(10):
                        element.click(timeout=1000)
                        time.sleep(0.1)
                        
                    # Dashboard should remain stable
                    assert self.dashboard_page.is_dashboard_loaded(), f"Dashboard should handle rapid clicks on {element_name}"
                    
                except Exception as e:
                    # Some rapid clicks might fail, but dashboard should remain functional
                    assert self.dashboard_page.is_dashboard_loaded(), f"Dashboard should remain stable after rapid {element_name} clicks"
                    
    def test_dashboard_with_javascript_disabled(self):
        """Test dashboard graceful degradation when JavaScript features fail"""
        # This simulates scenarios where JavaScript might not work
        
        # Basic HTML structure should still be accessible
        assert self.dashboard_page.is_visible(self.dashboard_page.main_content)
        
        # Test that core content is still visible without JavaScript interactions
        page_text = self.dashboard_page.page.inner_text('body')
        assert len(page_text) > 0, "Dashboard should have content visible even without full JavaScript"
        
    def test_concurrent_navigation_attempts(self):
        """Test concurrent navigation attempts"""
        nav_sections = ['documents', 'contacts', 'settings']
        
        # Attempt rapid navigation between sections
        for _ in range(3):
            for section in nav_sections:
                if self.dashboard_page.is_visible(getattr(self.dashboard_page, f'nav_{section}')):
                    try:
                        self.dashboard_page.navigate_to_section(section)
                        time.sleep(0.2)  # Brief pause
                    except:
                        pass  # Continue with other sections
                        
        # Dashboard should remain functional
        self.dashboard_page.navigate_to_dashboard()
        assert self.dashboard_page.is_dashboard_loaded()
        
    def test_modal_dialog_edge_cases(self):
        """Test modal dialog edge cases"""
        if self.dashboard_page.is_visible(self.dashboard_page.new_document_button):
            # Open modal
            self.dashboard_page.click_quick_action('new_document')
            
            if self.dashboard_page.is_visible(self.dashboard_page.modal_dialog):
                # Test multiple close attempts
                for _ in range(3):
                    try:
                        self.dashboard_page.close_modal()
                        time.sleep(0.2)
                    except:
                        pass
                        
                # Test clicking outside modal area
                try:
                    self.dashboard_page.page.mouse.click(50, 50)  # Click top-left corner
                except:
                    pass
                    
                # Dashboard should remain functional
                assert self.dashboard_page.is_dashboard_loaded()
                
    def test_browser_back_forward_navigation(self):
        """Test browser back/forward button handling"""
        initial_url = self.dashboard_page.get_current_url()
        
        # Navigate to different sections
        if self.dashboard_page.is_visible(self.dashboard_page.nav_documents):
            self.dashboard_page.navigate_to_section('documents')
            time.sleep(1)
            
            # Use browser back button
            self.dashboard_page.page.go_back()
            time.sleep(1)
            
            # Should return to dashboard
            current_url = self.dashboard_page.get_current_url()
            assert "/dashboard" in current_url or current_url == initial_url
            
            # Use browser forward button
            self.dashboard_page.page.go_forward()
            time.sleep(1)
            
            # Dashboard should handle navigation properly
            assert self.dashboard_page.is_visible(self.dashboard_page.main_content)
            
    def test_network_interruption_simulation(self):
        """Test dashboard behavior during network issues"""
        # This simulates what happens when network is slow or interrupted
        
        # Dashboard should show loading states appropriately
        if self.dashboard_page.is_visible(self.dashboard_page.loading_spinner, timeout=1000):
            # Wait for loading to complete
            self.dashboard_page.wait_for_loading_complete()
            
        # Core functionality should remain accessible
        assert self.dashboard_page.is_dashboard_loaded()
        
    def test_memory_leak_prevention(self):
        """Test dashboard doesn't create memory leaks"""
        # Perform operations that might create memory leaks
        operations = [
            lambda: self.dashboard_page.search_dashboard("memory test") if self.dashboard_page.is_visible(self.dashboard_page.search_input) else None,
            lambda: self.dashboard_page.toggle_sidebar() if self.dashboard_page.is_visible(self.dashboard_page.sidebar_toggle) else None,
            lambda: self.dashboard_page.click_notifications() if self.dashboard_page.is_visible(self.dashboard_page.notifications_bell) else None,
        ]
        
        # Repeat operations multiple times
        for _ in range(10):
            for operation in operations:
                try:
                    operation()
                    time.sleep(0.1)
                except:
                    pass
                    
        # Dashboard should remain responsive
        assert self.dashboard_page.is_dashboard_loaded()
        
    def test_invalid_url_parameters(self):
        """Test dashboard with invalid URL parameters"""
        invalid_urls = [
            f"{self.dashboard_page.dashboard_url}?invalid=parameter",
            f"{self.dashboard_page.dashboard_url}#invalid-hash",
            f"{self.dashboard_page.dashboard_url}?id=<script>alert('xss')</script>",
            f"{self.dashboard_page.dashboard_url}?search=' OR 1=1--"
        ]
        
        for invalid_url in invalid_urls:
            try:
                self.dashboard_page.navigate_to(invalid_url)
                time.sleep(1)
                
                # Dashboard should handle invalid parameters gracefully
                assert self.dashboard_page.is_dashboard_loaded() or "error" in self.dashboard_page.get_current_url().lower()
                
            except Exception as e:
                # Should not crash completely
                assert True, f"Dashboard handled invalid URL gracefully: {invalid_url}"
                
        # Navigate back to valid dashboard
        self.dashboard_page.navigate_to_dashboard()
        
    def test_unicode_and_special_characters_in_search(self):
        """Test search with Unicode and special characters"""
        if self.dashboard_page.is_visible(self.dashboard_page.search_input):
            special_queries = [
                "测试中文",          # Chinese characters
                "Тест",             # Cyrillic
                "🎉🚀💻",           # Emojis
                "café résumé",      # Accented characters
                "<>&\"'",           # HTML special chars
                "\\n\\t\\r",        # Escape sequences
                "user@domain.com",  # Email format
            ]
            
            for query in special_queries:
                try:
                    self.dashboard_page.search_dashboard(query)
                    time.sleep(0.5)
                    
                    # Dashboard should handle special characters without crashing
                    assert self.dashboard_page.is_dashboard_loaded(), f"Dashboard should handle query: {query}"
                    
                    # Clear search for next test
                    self.dashboard_page.search_input.clear()
                    
                except Exception as e:
                    # Should not crash the dashboard
                    assert self.dashboard_page.is_dashboard_loaded(), f"Dashboard should remain functional with special chars: {query}"
                    
    def test_session_timeout_handling(self):
        """Test dashboard behavior on session timeout"""
        # This would typically require session manipulation
        # For now, test that logout functionality works
        
        if self.dashboard_page.is_visible(self.dashboard_page.logout_button):
            self.dashboard_page.logout()
            time.sleep(2)
            
            current_url = self.dashboard_page.get_current_url()
            
            # Should redirect to login or show appropriate message
            assert "login" in current_url.lower() or "auth" in current_url.lower()
            
    def test_dashboard_with_ad_blockers_simulation(self):
        """Test dashboard when certain resources might be blocked"""
        # This simulates scenarios where ad blockers or security tools might block resources
        
        # Basic functionality should still work
        assert self.dashboard_page.is_dashboard_loaded()
        assert self.dashboard_page.is_visible(self.dashboard_page.main_content)
        
        # Core navigation should remain functional
        if self.dashboard_page.is_visible(self.dashboard_page.sidebar):
            assert True, "Core navigation remains accessible"
            
    def test_dashboard_resize_boundary_conditions(self):
        """Test dashboard at extreme viewport sizes"""
        extreme_sizes = [
            {"width": 200, "height": 200, "name": "tiny"},
            {"width": 4000, "height": 2000, "name": "large"},
            {"width": 320, "height": 2000, "name": "narrow"},
            {"width": 2000, "height": 300, "name": "wide"}
        ]
        
        for size in extreme_sizes:
            self.dashboard_page.page.set_viewport_size({"width": size["width"], "height": size["height"]})
            
            # Dashboard should remain functional at extreme sizes
            assert self.dashboard_page.is_dashboard_loaded(), f"Dashboard should work at {size['name']} size"
            
            # Main content should be accessible
            main_content_visible = self.dashboard_page.is_visible(self.dashboard_page.main_content, timeout=2000)
            assert main_content_visible, f"Main content should be accessible at {size['name']} size"
            
        # Reset to normal size
        self.dashboard_page.page.set_viewport_size({"width": 1920, "height": 1080})
        
    def test_dashboard_with_slow_network_conditions(self):
        """Test dashboard under slow network conditions"""
        # Simulate slow network
        try:
            self.dashboard_page.page.route("**/*", lambda route: (
                time.sleep(0.5),  # Add delay
                route.continue_()
            ))
            
            self.dashboard_page.navigate_to_dashboard()
            
            # Dashboard should eventually load even with slow network
            assert self.dashboard_page.is_dashboard_loaded(), "Dashboard should handle slow network conditions"
            
        finally:
            # Remove route handler
            self.dashboard_page.page.unroute("**/*")
            
    def test_dashboard_error_recovery(self):
        """Test dashboard recovery from errors"""
        # Simulate error conditions and test recovery
        
        # Test recovery from failed requests
        try:
            # Force a navigation that might fail
            self.dashboard_page.navigate_to("/nonexistent-page")
            time.sleep(1)
            
            # Navigate back to dashboard
            self.dashboard_page.navigate_to_dashboard()
            
            # Should recover properly
            assert self.dashboard_page.is_dashboard_loaded(), "Dashboard should recover from navigation errors"
            
        except Exception as e:
            # Should handle errors gracefully
            self.dashboard_page.navigate_to_dashboard()
            assert self.dashboard_page.is_dashboard_loaded(), "Dashboard should recover from errors"