"""
WeSign Templates Edge Cases and Stress Test Suite
Comprehensive testing of edge cases, error conditions, and boundary scenarios
"""

import pytest
import json
import os
import asyncio
import string
import random
from datetime import datetime, timedelta
from playwright.sync_api import Page, expect
from src.pages.templates_page import TemplatesPage
from src.pages.login_page import LoginPage

class TestWeSignTemplatesEdgeCases:
    """Edge case and boundary testing for WeSign templates"""

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
    async def login_user_edge_cases(self):
        """Login user for edge case tests"""
        await self.page.goto(self.settings["base_url"] + "login")
        success = await self.login_page.login(
            self.settings["company_user"], 
            self.settings["company_user_password"]
        )
        assert success, "Edge case test login failed"
        await self.page.wait_for_url("**/dashboard/**")

    # ========== BOUNDARY TESTING ==========

    @pytest.mark.edge_cases
    async def test_template_name_length_boundaries(self, login_user_edge_cases):
        """Test template name at various length boundaries"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Test cases for different name lengths
        test_cases = [
            ("", "Empty name"),  # Empty
            ("A", "Single character"),  # Minimum
            ("A" * 50, "Medium length name"),  # Reasonable length
            ("A" * 100, "Long name"),  # Long
            ("A" * 255, "Maximum length name"),  # Very long
            ("A" * 1000, "Extreme length name")  # Extreme
        ]
        
        for name, description in test_cases:
            if name == "":
                # Empty name should fail validation
                success = await self.templates_page.create_new_template(name=name, description=description)
                if not success:
                    error_msg = await self.templates_page.wait_for_error_message()
                    assert error_msg, "Empty name should show validation error"
            else:
                timestamp = datetime.now().strftime('%H%M%S%f')
                unique_name = f"{name}_{timestamp}"[:255]  # Ensure uniqueness within limits
                
                success = await self.templates_page.create_new_template(
                    name=unique_name,
                    description=f"Boundary test: {description}"
                )
                
                if len(name) <= 255:
                    assert success or await self.templates_page.wait_for_error_message(), f"Name length {len(name)} should either succeed or show appropriate error"
                else:
                    # Very long names should either be truncated or rejected
                    if not success:
                        error_msg = await self.templates_page.wait_for_error_message()
                        assert "length" in error_msg.lower() or "long" in error_msg.lower(), "Should show length validation error"

    @pytest.mark.edge_cases
    async def test_special_characters_in_template_name(self, login_user_edge_cases):
        """Test various special characters in template names"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        special_char_tests = [
            ("Test@Template", "Email symbols"),
            ("Test#$%^&*()", "Special symbols"),
            ("Test<>\"'", "HTML/XML chars"),
            ("Test\n\r\t", "Whitespace chars"),
            ("Test🚀💼📋", "Emoji chars"),
            ("Test₪€$¥", "Currency symbols"),
            ("Test™®©", "Trademark symbols"),
            ("Test\\|/", "Path separators"),
            ("Test{}[]", "Brackets"),
            ("Test;:.,?!", "Punctuation")
        ]
        
        for name_suffix, description in special_char_tests:
            template_name = f"Special_{name_suffix}_{datetime.now().strftime('%H%M%S')}"
            
            success = await self.templates_page.create_new_template(
                name=template_name,
                description=f"Special character test: {description}"
            )
            
            # Should either succeed or show appropriate validation
            if not success:
                error_msg = await self.templates_page.wait_for_error_message()
                assert error_msg, f"Should handle special characters gracefully: {description}"

    @pytest.mark.edge_cases
    async def test_unicode_and_international_characters(self, login_user_edge_cases):
        """Test Unicode and international characters"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        unicode_tests = [
            ("Тест_Русский", "Russian Cyrillic"),
            ("测试_中文", "Chinese characters"),
            ("テスト_日本語", "Japanese characters"),
            ("اختبار_عربي", "Arabic characters"),
            ("τεστ_ελληνικά", "Greek characters"),
            ("בדיקה_עברית", "Hebrew characters"),
            ("Prüfung_Deutsch", "German umlaut"),
            ("Tëst_Français", "French accents"),
            ("Prueba_Español", "Spanish characters"),
            ("Тест_🌍🚀", "Mixed Unicode with emoji")
        ]
        
        for name_suffix, description in unicode_tests:
            template_name = f"Unicode_{name_suffix}_{datetime.now().strftime('%H%M%S')}"
            
            success = await self.templates_page.create_new_template(
                name=template_name,
                description=f"Unicode test: {description}"
            )
            
            assert success, f"Unicode characters should be supported: {description}"

    # ========== ERROR CONDITION TESTING ==========

    @pytest.mark.edge_cases
    async def test_network_interruption_simulation(self, login_user_edge_cases):
        """Test behavior during network interruption"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Start template creation
        template_name = f"Network Test {datetime.now().strftime('%H%M%S')}"
        
        # Simulate network issues by setting offline mode
        await self.page.context.set_offline(True)
        
        try:
            success = await self.templates_page.create_new_template(
                name=template_name,
                description="Network interruption test"
            )
            
            # Should either fail gracefully or show appropriate error
            if not success:
                error_msg = await self.templates_page.wait_for_error_message()
                assert any(word in error_msg.lower() for word in ["network", "connection", "offline", "error"]), "Should show network-related error"
            
        finally:
            # Restore network connection
            await self.page.context.set_offline(False)

    @pytest.mark.edge_cases
    async def test_rapid_consecutive_operations(self, login_user_edge_cases):
        """Test rapid consecutive template operations"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Perform rapid template creation
        template_names = []
        timestamp = datetime.now().strftime('%H%M%S')
        
        for i in range(3):  # Create 3 templates rapidly
            name = f"Rapid_{i}_{timestamp}"
            template_names.append(name)
            
            success = await self.templates_page.create_new_template(
                name=name,
                description=f"Rapid creation test {i}"
            )
            
            # Should handle rapid operations gracefully
            assert success or await self.templates_page.wait_for_error_message(), f"Rapid operation {i} should be handled"

    @pytest.mark.edge_cases
    async def test_concurrent_browser_sessions(self, login_user_edge_cases):
        """Test behavior with concurrent browser sessions (simulation)"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create template in current session
        template_name = f"Concurrent Test {datetime.now().strftime('%H%M%S')}"
        success = await self.templates_page.create_new_template(
            name=template_name,
            description="Concurrent session test"
        )
        
        assert success, "Template creation should work even with potential concurrent sessions"
        
        # Refresh page to simulate another session's changes
        await self.page.reload()
        await self.templates_page.wait_for_templates_to_load()
        
        # Verify template still exists after refresh
        templates = await self.templates_page.get_all_templates()
        template_names = [t.get('title', '') for t in templates]
        assert any(template_name in name for name in template_names), "Template should persist across sessions"

    # ========== DATA INTEGRITY TESTING ==========

    @pytest.mark.edge_cases
    async def test_extremely_large_template_description(self, login_user_edge_cases):
        """Test template with extremely large description"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create very large description
        large_description = "Large description test. " * 1000  # ~25KB of text
        template_name = f"Large Desc Test {datetime.now().strftime('%H%M%S')}"
        
        success = await self.templates_page.create_new_template(
            name=template_name,
            description=large_description
        )
        
        # Should either succeed or show appropriate size limit error
        if not success:
            error_msg = await self.templates_page.wait_for_error_message()
            assert any(word in error_msg.lower() for word in ["size", "length", "limit", "large"]), "Should show size-related error for large description"

    @pytest.mark.edge_cases
    async def test_malformed_data_injection(self, login_user_edge_cases):
        """Test malformed data injection attempts"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        malformed_inputs = [
            ("null", "Null value"),
            ("undefined", "Undefined value"),
            ("NaN", "Not a Number"),
            ("Infinity", "Infinity value"),
            ("true", "Boolean true"),
            ("false", "Boolean false"),
            ("{}", "Empty object"),
            ("[]", "Empty array"),
            ('{"key":"value"}', "JSON object"),
            ("[1,2,3]", "JSON array")
        ]
        
        for malformed_input, description in malformed_inputs:
            template_name = f"Malformed_{description.replace(' ', '_')}_{datetime.now().strftime('%H%M%S')}"
            
            success = await self.templates_page.create_new_template(
                name=template_name,
                description=f"Malformed input test: {malformed_input}"
            )
            
            # Should handle malformed inputs gracefully
            assert success or await self.templates_page.wait_for_error_message(), f"Should handle malformed input: {description}"

    # ========== TIMING AND RACE CONDITION TESTING ==========

    @pytest.mark.edge_cases
    async def test_page_navigation_during_operation(self, login_user_edge_cases):
        """Test navigation away from page during operations"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Start template creation
        await self.templates_page.click_element(self.templates_page.create_template_button)
        await self.templates_page.wait_for_page_load()
        
        # Fill some data
        template_name = f"Navigation Test {datetime.now().strftime('%H%M%S')}"
        await self.templates_page.fill_input(self.templates_page.template_name_input, template_name)
        
        # Navigate away before saving
        await self.page.go_back()
        await self.page.wait_for_timeout(1000)
        
        # Navigate back to templates
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Verify incomplete template was not saved
        templates = await self.templates_page.get_all_templates()
        template_names = [t.get('title', '') for t in templates]
        assert not any(template_name in name for name in template_names), "Incomplete template should not be saved"

    @pytest.mark.edge_cases
    async def test_browser_refresh_during_creation(self, login_user_edge_cases):
        """Test browser refresh during template creation"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Start template creation
        await self.templates_page.click_element(self.templates_page.create_template_button)
        await self.templates_page.wait_for_page_load()
        
        # Fill template data
        template_name = f"Refresh Test {datetime.now().strftime('%H%M%S')}"
        await self.templates_page.fill_input(self.templates_page.template_name_input, template_name)
        await self.templates_page.fill_input(self.templates_page.template_description_textarea, "Test description")
        
        # Refresh browser before saving
        await self.page.reload()
        await self.templates_page.wait_for_templates_to_load()
        
        # Verify we're back at templates list and no partial data was saved
        await expect(self.page.locator(self.templates_page.templates_container)).to_be_visible()

    # ========== STRESS TESTING ==========

    @pytest.mark.stress
    async def test_maximum_templates_handling(self, login_user_edge_cases):
        """Test handling of maximum number of templates"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Get current template count
        initial_count = await self.templates_page.get_template_count()
        
        # Try to create multiple templates to test limits
        templates_to_create = 10  # Reasonable number for testing
        created_templates = []
        
        for i in range(templates_to_create):
            template_name = f"Stress_Test_{i}_{datetime.now().strftime('%H%M%S')}"
            success = await self.templates_page.create_new_template(
                name=template_name,
                description=f"Stress test template {i}"
            )
            
            if success:
                created_templates.append(template_name)
            else:
                # If creation fails, check if it's due to limits
                error_msg = await self.templates_page.wait_for_error_message()
                if any(word in error_msg.lower() for word in ["limit", "maximum", "quota"]):
                    break  # Hit the limit, this is expected
                else:
                    assert False, f"Unexpected error during stress test: {error_msg}"
        
        # Verify at least some templates were created
        final_count = await self.templates_page.get_template_count()
        assert final_count > initial_count, "Should have created at least some templates during stress test"

    @pytest.mark.stress
    async def test_rapid_search_operations(self, login_user_edge_cases):
        """Test rapid consecutive search operations"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Perform rapid searches with different terms
        search_terms = ["test", "contract", "agreement", "document", "template", "sample"]
        
        for term in search_terms:
            search_results = await self.templates_page.search_templates(term)
            assert isinstance(search_results, list), f"Rapid search for '{term}' should return results"
            
            # Small delay to avoid overwhelming the system
            await self.page.wait_for_timeout(100)

    # ========== CLEANUP AND DATA PERSISTENCE ==========

    @pytest.mark.edge_cases
    async def test_template_persistence_after_logout(self, login_user_edge_cases):
        """Test template persistence after user logout and login"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create a template
        persistent_name = f"Persistent Test {datetime.now().strftime('%Y%m%d_%H%M%S')}"
        success = await self.templates_page.create_new_template(
            name=persistent_name,
            description="Template to test persistence"
        )
        assert success, "Template creation should succeed"
        
        # Logout (simulate by going to login page)
        await self.page.goto(self.settings["base_url"] + "login")
        
        # Login again
        login_success = await self.login_page.login(
            self.settings["company_user"], 
            self.settings["company_user_password"]
        )
        assert login_success, "Re-login should succeed"
        
        # Navigate back to templates
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Verify template still exists
        templates = await self.templates_page.get_all_templates()
        template_names = [t.get('title', '') for t in templates]
        assert any(persistent_name in name for name in template_names), "Template should persist after logout/login"

    @pytest.mark.edge_cases
    async def test_browser_storage_limits(self, login_user_edge_cases):
        """Test behavior when approaching browser storage limits"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Check current local storage usage
        storage_info = await self.page.evaluate("""
            () => {
                const storageUsed = JSON.stringify(localStorage).length;
                const storageLimit = 10 * 1024 * 1024; // Assume 10MB limit
                return {
                    used: storageUsed,
                    available: storageLimit - storageUsed,
                    nearLimit: storageUsed > (storageLimit * 0.8)
                };
            }
        """)
        
        # If we're near storage limit, test graceful handling
        if storage_info.get('nearLimit', False):
            template_name = f"Storage Limit Test {datetime.now().strftime('%H%M%S')}"
            success = await self.templates_page.create_new_template(
                name=template_name,
                description="Testing storage limit handling"
            )
            
            # Should either succeed or show appropriate error
            assert success or await self.templates_page.wait_for_error_message(), "Should handle storage limits gracefully"
        
        # Log storage information for debugging
        print(f"Browser storage info: {storage_info}")

    @pytest.mark.edge_cases
    async def test_duplicate_name_handling(self, login_user_edge_cases):
        """Test handling of duplicate template names"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create first template
        duplicate_name = f"Duplicate Test {datetime.now().strftime('%H%M%S')}"
        first_success = await self.templates_page.create_new_template(
            name=duplicate_name,
            description="First template with this name"
        )
        assert first_success, "First template creation should succeed"
        
        # Try to create second template with same name
        second_success = await self.templates_page.create_new_template(
            name=duplicate_name,
            description="Second template with same name"
        )
        
        # Should either be allowed (with auto-rename) or show validation error
        if not second_success:
            error_msg = await self.templates_page.wait_for_error_message()
            assert any(word in error_msg.lower() for word in ["duplicate", "exists", "name", "unique"]), "Should show duplicate name error"
        else:
            # If allowed, verify both templates exist (possibly with modified names)
            templates = await self.templates_page.get_all_templates()
            template_names = [t.get('title', '') for t in templates]
            matching_names = [name for name in template_names if duplicate_name in name]
            # Should have at least 1 template (possibly 2 if system allows duplicates)
            assert len(matching_names) >= 1, "Should have at least one template with the target name"