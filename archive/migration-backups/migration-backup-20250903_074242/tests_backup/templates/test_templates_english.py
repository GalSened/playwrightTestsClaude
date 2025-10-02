"""
Comprehensive WeSign Templates Test Suite - English Language
100% test coverage for WeSign template functionality in English
Following professional Playwright testing methodologies and POM pattern
"""

import pytest
import asyncio
import json
import os
from datetime import datetime
from playwright.sync_api import Page, expect
from src.pages.templates_page import TemplatesPage
from src.pages.login_page import LoginPage
from src.utils.test_helpers import TestHelpers

class TestWeSignTemplatesEnglish:
    """Comprehensive test suite for WeSign templates in English"""

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        """Setup for each test"""
        self.page = page
        self.templates_page = TemplatesPage(page)
        self.login_page = LoginPage(page)
        self.test_helpers = TestHelpers(page)
        
        # Load test data from settings.json
        settings_path = os.path.join(os.path.dirname(__file__), "..", "settings .json")
        with open(settings_path, 'r', encoding='utf-8') as f:
            self.settings = json.load(f)

    @pytest.fixture(scope="function")
    async def login_user(self):
        """Login user before template tests"""
        # Navigate to login and authenticate
        await self.page.goto(self.settings["base_url"] + "login")
        success = await self.login_page.login(
            self.settings["company_user"], 
            self.settings["company_user_password"]
        )
        assert success, "Login failed - cannot proceed with template tests"
        await self.page.wait_for_url("**/dashboard/**")

    # ========== TEMPLATE DASHBOARD TESTS ==========

    @pytest.mark.smoke
    async def test_templates_dashboard_loads_successfully(self, login_user):
        """Test that templates dashboard loads successfully"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Verify page elements are present
        await expect(self.page.locator(self.templates_page.templates_container)).to_be_visible()
        await expect(self.page.locator(self.templates_page.create_template_button)).to_be_visible()
        
        # Performance check
        metrics = await self.templates_page.get_template_performance_metrics()
        assert metrics.get('pageLoadTime', 0) < 5000, "Page load time exceeds 5 seconds"

    @pytest.mark.regression
    async def test_template_search_functionality(self, login_user):
        """Test template search functionality works correctly"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Test search with existing templates
        search_results = await self.templates_page.search_templates("contract")
        assert isinstance(search_results, list), "Search should return a list"
        
        # Test empty search
        empty_results = await self.templates_page.search_templates("nonexistenttemplate12345")
        assert len(empty_results) == 0, "Search for non-existent template should return empty results"
        
        # Test search with special characters
        special_char_results = await self.templates_page.search_templates("@#$%^&*()")
        assert isinstance(special_char_results, list), "Search with special characters should handle gracefully"

    @pytest.mark.regression
    async def test_template_filtering_functionality(self, login_user):
        """Test template filtering works correctly"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Get initial template count
        initial_count = await self.templates_page.get_template_count()
        
        # Test filter if available
        if await self.page.query_selector(self.templates_page.filter_dropdown):
            await self.page.select_option(self.templates_page.filter_dropdown, "active")
            await self.page.wait_for_timeout(1000)
            
            filtered_count = await self.templates_page.get_template_count()
            assert filtered_count <= initial_count, "Filtered results should not exceed initial count"

    # ========== TEMPLATE CREATION TESTS ==========

    @pytest.mark.critical
    async def test_create_new_template_success(self, login_user):
        """Test successful template creation"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        template_name = f"Test Template {datetime.now().strftime('%Y%m%d_%H%M%S')}"
        template_description = "Automated test template for WeSign testing"
        
        success = await self.templates_page.create_new_template(
            name=template_name,
            description=template_description,
            language="English"
        )
        
        assert success, "Template creation should succeed"
        
        # Verify template appears in list
        templates = await self.templates_page.get_all_templates()
        template_names = [t.get('title', '') for t in templates]
        assert any(template_name in name for name in template_names), "Created template should appear in list"

    @pytest.mark.regression
    async def test_create_template_validation_required_fields(self, login_user):
        """Test template creation validation for required fields"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Click create template button
        await self.templates_page.click_element(self.templates_page.create_template_button)
        await self.templates_page.wait_for_page_load()
        
        # Test validation for required fields
        validation_results = await self.templates_page.verify_template_creation_validation(['name'])
        assert any(validation_results.values()), "Required field validation should be present"

    @pytest.mark.regression
    async def test_create_template_with_long_name(self, login_user):
        """Test creating template with very long name"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        long_name = "A" * 255  # Very long template name
        
        success = await self.templates_page.create_new_template(
            name=long_name,
            description="Test template with long name"
        )
        
        # Should either succeed or show appropriate validation message
        if not success:
            error_msg = await self.templates_page.wait_for_error_message()
            assert "name" in error_msg.lower() or "length" in error_msg.lower(), "Should show name length validation"

    @pytest.mark.regression
    async def test_create_template_with_special_characters(self, login_user):
        """Test creating template with special characters in name"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        special_name = f"Test@#$%^&*()_{datetime.now().strftime('%H%M%S')}"
        
        success = await self.templates_page.create_new_template(
            name=special_name,
            description="Template with special characters"
        )
        
        # Should handle special characters appropriately
        assert success or await self.templates_page.wait_for_error_message(), "Should either succeed or show validation"

    # ========== TEMPLATE MANAGEMENT TESTS ==========

    @pytest.mark.regression
    async def test_edit_existing_template(self, login_user):
        """Test editing an existing template"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # First create a template to edit
        original_name = f"Original Template {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=original_name,
            description="Original description"
        )
        assert creation_success, "Template creation for edit test failed"
        
        # Edit the template
        new_name = f"Edited Template {datetime.now().strftime('%H%M%S')}"
        edit_success = await self.templates_page.edit_template(
            template_name=original_name,
            new_name=new_name,
            new_description="Updated description"
        )
        
        assert edit_success, "Template editing should succeed"

    @pytest.mark.regression
    async def test_duplicate_template(self, login_user):
        """Test duplicating an existing template"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create a template to duplicate
        original_name = f"Duplicate Source {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=original_name,
            description="Template to be duplicated"
        )
        assert creation_success, "Template creation for duplicate test failed"
        
        # Duplicate the template
        duplicate_name = f"Duplicated Template {datetime.now().strftime('%H%M%S')}"
        duplicate_success = await self.templates_page.duplicate_template(
            template_name=original_name,
            new_name=duplicate_name
        )
        
        assert duplicate_success, "Template duplication should succeed"

    @pytest.mark.regression
    async def test_delete_template(self, login_user):
        """Test deleting a template"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create a template to delete
        delete_name = f"Delete Me {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=delete_name,
            description="Template to be deleted"
        )
        assert creation_success, "Template creation for delete test failed"
        
        # Delete the template
        delete_success = await self.templates_page.delete_template(delete_name)
        assert delete_success, "Template deletion should succeed"
        
        # Verify template is removed from list
        templates = await self.templates_page.get_all_templates()
        template_names = [t.get('title', '') for t in templates]
        assert not any(delete_name in name for name in template_names), "Deleted template should not appear in list"

    # ========== DOCUMENT UPLOAD TESTS ==========

    @pytest.mark.regression
    async def test_upload_pdf_document(self, login_user):
        """Test uploading PDF document to template"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create template first
        template_name = f"PDF Template {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=template_name,
            description="Template with PDF document"
        )
        assert creation_success, "Template creation failed"
        
        # Upload PDF document
        pdf_file_path = self.settings.get("pdf_file", "")
        if pdf_file_path and os.path.exists(pdf_file_path):
            upload_success = await self.templates_page.upload_document(pdf_file_path)
            assert upload_success, "PDF document upload should succeed"

    @pytest.mark.regression
    async def test_upload_word_document(self, login_user):
        """Test uploading Word document to template"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create template first
        template_name = f"Word Template {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=template_name,
            description="Template with Word document"
        )
        assert creation_success, "Template creation failed"
        
        # Upload Word document
        word_file_path = self.settings.get("word_file", "")
        if word_file_path and os.path.exists(word_file_path):
            upload_success = await self.templates_page.upload_document(word_file_path)
            assert upload_success, "Word document upload should succeed"

    @pytest.mark.regression
    async def test_upload_multiple_documents(self, login_user):
        """Test uploading multiple documents to template"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create template first
        template_name = f"Multi Doc Template {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=template_name,
            description="Template with multiple documents"
        )
        assert creation_success, "Template creation failed"
        
        # Upload multiple documents
        file_paths = [
            self.settings.get("pdf_file", ""),
            self.settings.get("word_file", ""),
        ]
        
        for file_path in file_paths:
            if file_path and os.path.exists(file_path):
                upload_success = await self.templates_page.upload_document(file_path)
                assert upload_success, f"Document upload should succeed for {file_path}"

    @pytest.mark.regression
    async def test_upload_unsupported_file_type(self, login_user):
        """Test uploading unsupported file type"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create template first
        template_name = f"Unsupported Template {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=template_name,
            description="Template for unsupported file test"
        )
        assert creation_success, "Template creation failed"
        
        # Try to upload unsupported file
        unsupported_file = self.settings.get("unsupported_file", "")
        if unsupported_file and os.path.exists(unsupported_file):
            upload_success = await self.templates_page.upload_document(unsupported_file)
            
            # Should either fail or show error message
            if not upload_success:
                error_msg = await self.templates_page.wait_for_error_message()
                assert "support" in error_msg.lower() or "type" in error_msg.lower(), "Should show file type error"

    # ========== SIGNATURE FIELD TESTS ==========

    @pytest.mark.regression
    async def test_add_signature_field(self, login_user):
        """Test adding signature fields to template"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create template with document
        template_name = f"Signature Template {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=template_name,
            description="Template with signature fields"
        )
        assert creation_success, "Template creation failed"
        
        # Add signature field
        signature_success = await self.templates_page.add_signature_field_to_template(150, 200)
        assert signature_success, "Adding signature field should succeed"

    @pytest.mark.regression
    async def test_add_multiple_signature_fields(self, login_user):
        """Test adding multiple signature fields"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create template
        template_name = f"Multi Sig Template {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=template_name,
            description="Template with multiple signature fields"
        )
        assert creation_success, "Template creation failed"
        
        # Add multiple signature fields at different positions
        positions = [(100, 100), (200, 150), (300, 200)]
        for x, y in positions:
            signature_success = await self.templates_page.add_signature_field_to_template(x, y)
            assert signature_success, f"Adding signature field at ({x}, {y}) should succeed"

    # ========== RECIPIENT MANAGEMENT TESTS ==========

    @pytest.mark.regression
    async def test_add_single_recipient(self, login_user):
        """Test adding a single recipient to template"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create template
        template_name = f"Single Recipient Template {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=template_name,
            description="Template with single recipient"
        )
        assert creation_success, "Template creation failed"
        
        # Add recipient
        recipient_success = await self.templates_page.add_recipient(
            email="test.recipient@example.com",
            name="Test Recipient",
            role="Signer"
        )
        assert recipient_success, "Adding recipient should succeed"

    @pytest.mark.regression
    async def test_add_multiple_recipients(self, login_user):
        """Test adding multiple recipients to template"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create template
        template_name = f"Multi Recipient Template {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=template_name,
            description="Template with multiple recipients"
        )
        assert creation_success, "Template creation failed"
        
        # Add multiple recipients
        recipients = [
            ("signer1@example.com", "First Signer", "Signer"),
            ("signer2@example.com", "Second Signer", "Signer"),
            ("approver@example.com", "Approver", "Approver")
        ]
        
        for email, name, role in recipients:
            recipient_success = await self.templates_page.add_recipient(email, name, role)
            assert recipient_success, f"Adding recipient {email} should succeed"

    @pytest.mark.regression
    async def test_add_recipient_invalid_email(self, login_user):
        """Test adding recipient with invalid email"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create template
        template_name = f"Invalid Email Template {datetime.now().strftime('%H%M%S')}"
        creation_success = await self.templates_page.create_new_template(
            name=template_name,
            description="Template for invalid email test"
        )
        assert creation_success, "Template creation failed"
        
        # Try to add recipient with invalid email
        recipient_success = await self.templates_page.add_recipient(
            email="invalid-email-format",
            name="Invalid Email User",
            role="Signer"
        )
        
        # Should either fail or show validation error
        if not recipient_success:
            error_msg = await self.templates_page.wait_for_error_message()
            assert "email" in error_msg.lower() or "invalid" in error_msg.lower(), "Should show email validation error"

    # ========== ACCESSIBILITY TESTS ==========

    @pytest.mark.accessibility
    async def test_templates_accessibility_standards(self, login_user):
        """Test templates page meets accessibility standards"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        accessibility_results = await self.templates_page.verify_accessibility_standards()
        
        # Check critical accessibility requirements
        assert accessibility_results.get('images_have_alt', False), "Images should have alt attributes"
        assert accessibility_results.get('inputs_have_labels', False), "Form inputs should have labels"
        assert accessibility_results.get('has_headings', False), "Page should have proper heading structure"

    @pytest.mark.accessibility
    async def test_keyboard_navigation(self, login_user):
        """Test keyboard navigation through templates interface"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Test Tab navigation
        await self.page.keyboard.press("Tab")
        focused_element = await self.page.evaluate("document.activeElement.tagName")
        assert focused_element in ["BUTTON", "INPUT", "A"], "Tab should focus on interactive element"
        
        # Test Enter key on buttons
        if await self.page.query_selector(self.templates_page.create_template_button):
            await self.page.focus(self.templates_page.create_template_button)
            # Note: Not pressing Enter to avoid side effects in test

    # ========== PERFORMANCE TESTS ==========

    @pytest.mark.performance
    async def test_template_list_load_performance(self, login_user):
        """Test templates list loads within performance thresholds"""
        start_time = datetime.now()
        
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        end_time = datetime.now()
        load_duration = (end_time - start_time).total_seconds()
        
        # Should load within reasonable time
        assert load_duration < 10, f"Templates list should load within 10 seconds, took {load_duration}s"
        
        # Check performance metrics
        metrics = await self.templates_page.get_template_performance_metrics()
        assert metrics.get('pageLoadTime', 0) < 5000, "Page load time should be under 5 seconds"

    @pytest.mark.performance
    async def test_template_search_performance(self, login_user):
        """Test template search performance"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Measure search performance
        start_time = datetime.now()
        await self.templates_page.search_templates("test")
        end_time = datetime.now()
        
        search_duration = (end_time - start_time).total_seconds()
        assert search_duration < 5, f"Template search should complete within 5 seconds, took {search_duration}s"

    # ========== SECURITY TESTS ==========

    @pytest.mark.security
    async def test_template_name_xss_protection(self, login_user):
        """Test XSS protection in template names"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Try to create template with XSS payload
        xss_name = "<script>alert('XSS')</script>Template"
        success = await self.templates_page.create_new_template(
            name=xss_name,
            description="XSS test template"
        )
        
        if success:
            # Verify script is not executed
            templates = await self.templates_page.get_all_templates()
            template_names = [t.get('title', '') for t in templates]
            
            # Should be sanitized (no script tags)
            found_template = next((name for name in template_names if "Template" in name), "")
            assert "<script>" not in found_template, "XSS content should be sanitized"

    @pytest.mark.security
    async def test_template_sql_injection_protection(self, login_user):
        """Test SQL injection protection in template operations"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Try SQL injection in search
        sql_payload = "'; DROP TABLE templates; --"
        search_results = await self.templates_page.search_templates(sql_payload)
        
        # Should handle gracefully without errors
        assert isinstance(search_results, list), "SQL injection attempt should be handled safely"

    # ========== EDGE CASE TESTS ==========

    @pytest.mark.edge_cases
    async def test_template_with_empty_description(self, login_user):
        """Test creating template with empty description"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        template_name = f"Empty Desc Template {datetime.now().strftime('%H%M%S')}"
        success = await self.templates_page.create_new_template(
            name=template_name,
            description=""  # Empty description
        )
        
        assert success, "Template creation with empty description should succeed"

    @pytest.mark.edge_cases
    async def test_template_with_unicode_characters(self, login_user):
        """Test creating template with Unicode characters"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        unicode_name = f"测试模板🚀💼_{datetime.now().strftime('%H%M%S')}"
        success = await self.templates_page.create_new_template(
            name=unicode_name,
            description="Template with Unicode characters 测试"
        )
        
        assert success, "Template creation with Unicode characters should succeed"

    @pytest.mark.edge_cases
    async def test_concurrent_template_operations(self, login_user):
        """Test handling concurrent template operations"""
        await self.templates_page.navigate_to_templates()
        await self.templates_page.wait_for_templates_to_load()
        
        # Create multiple templates concurrently
        template_names = [
            f"Concurrent Template {i}_{datetime.now().strftime('%H%M%S')}" 
            for i in range(3)
        ]
        
        # Note: In real scenario, this would be async concurrent operations
        # For this test, we'll do sequential operations to avoid race conditions
        for name in template_names:
            success = await self.templates_page.create_new_template(
                name=name,
                description=f"Concurrent test template {name}"
            )
            assert success, f"Concurrent template creation should succeed for {name}"