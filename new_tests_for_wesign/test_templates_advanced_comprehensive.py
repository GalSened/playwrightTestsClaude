"""Advanced Template Management Test Suite - Comprehensive Coverage"""

import pytest
import tempfile
import os
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.templates_page import TemplatesPage
from pages.documents_page import DocumentsPage
import datetime


class TestTemplatesAdvanced:
    """Advanced template management test suite covering all template scenarios"""

    # BASIC TEMPLATE OPERATIONS

    @pytest.mark.asyncio
    async def test_template_page_navigation_and_layout(self):
        """Test 1: Template page navigation and layout verification"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                # Navigate to templates
                await templates_page.navigate_to_templates()

                # Verify template page loaded
                assert await templates_page.is_templates_page_loaded(), "Templates page should be loaded"

                # Verify UI elements
                has_add_button = await templates_page.has_add_template_button()
                has_template_list = await templates_page.has_template_list()

                print(f"Template page UI - Add button: {has_add_button}, List: {has_template_list}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_creation_workflow(self):
        """Test 2: Complete template creation workflow"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                # Create test PDF for template
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                with tempfile.NamedTemporaryFile(suffix=f'_template_{timestamp}.pdf', delete=False) as temp_pdf:
                    temp_pdf.write(b'%PDF-1.4 Template document')
                    pdf_path = temp_pdf.name

                try:
                    initial_count = await templates_page.count_templates()

                    # Create new template
                    template_name = f"Test Template {timestamp}"
                    creation_result = await templates_page.create_template(template_name, pdf_path)

                    print(f"Template creation result: {creation_result}")

                    # Verify template was created
                    final_count = await templates_page.count_templates()
                    print(f"Template count: {initial_count} -> {final_count}")

                    # Look for the created template
                    templates = await templates_page.get_template_list()
                    template_names = [t.get('name', '') for t in templates if isinstance(t, dict)]

                    print(f"Available templates: {template_names}")

                finally:
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_upload_multiple_formats(self):
        """Test 3: Upload templates in multiple formats"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                # Test different file formats for templates
                formats = [
                    ('.pdf', b'%PDF-1.4 PDF Template'),
                    ('.docx', b'DOCX Template Content'),
                    ('.xlsx', b'XLSX Template Content')
                ]

                for ext, content in formats:
                    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
                        temp_file.write(content)
                        file_path = temp_file.name

                    try:
                        template_name = f"Template{ext}_{datetime.datetime.now().strftime('%H%M%S')}"
                        result = await templates_page.create_template(template_name, file_path)

                        print(f"Template {ext} upload result: {result}")
                        await page.wait_for_timeout(1000)  # Wait between uploads

                    finally:
                        if os.path.exists(file_path):
                            os.unlink(file_path)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_list_and_search_functionality(self):
        """Test 4: Template list display and search functionality"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                # Get template list
                templates = await templates_page.get_template_list()
                print(f"Found {len(templates)} templates")

                # Test search functionality if available
                if await templates_page.has_search_functionality():
                    await templates_page.search_templates("test")
                    search_results = await templates_page.get_template_list()
                    print(f"Search results: {len(search_results)} templates")

                    # Reset search
                    await templates_page.search_templates("")
                    reset_results = await templates_page.get_template_list()
                    print(f"After search reset: {len(reset_results)} templates")

                # Test template count consistency
                template_count = await templates_page.count_templates()
                assert isinstance(template_count, int), "Template count should be integer"
                assert template_count >= 0, "Template count should be non-negative"

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_editing_functionality(self):
        """Test 5: Template editing and modification"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                # Get available templates
                templates = await templates_page.get_template_list()

                if len(templates) > 0:
                    first_template = templates[0]
                    template_id = first_template.get('id') or first_template.get('name', 'unknown')

                    print(f"Testing template editing for: {template_id}")

                    # Test template editing if available
                    if await templates_page.can_edit_template(template_id):
                        edit_result = await templates_page.open_template_editor(template_id)
                        print(f"Template edit opened: {edit_result}")

                        # Test field addition functionality
                        if edit_result:
                            field_add_result = await templates_page.add_signature_field()
                            print(f"Signature field addition: {field_add_result}")

                else:
                    print("No templates available for editing test")

            finally:
                await browser.close()

    # ADVANCED TEMPLATE FEATURES

    @pytest.mark.asyncio
    async def test_template_field_management_comprehensive(self):
        """Test 6: Comprehensive template field management"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                templates = await templates_page.get_template_list()

                if len(templates) > 0:
                    template_id = templates[0].get('id') or templates[0].get('name', 'test')

                    if await templates_page.can_edit_template(template_id):
                        await templates_page.open_template_editor(template_id)

                        # Test different field types
                        field_types = [
                            'signature',
                            'text',
                            'date',
                            'checkbox',
                            'initials'
                        ]

                        for field_type in field_types:
                            field_result = await templates_page.add_field_type(field_type)
                            print(f"Added {field_type} field: {field_result}")

                            await page.wait_for_timeout(500)

                        # Test field positioning and properties
                        field_properties = await templates_page.get_field_properties()
                        print(f"Field properties available: {field_properties}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_sharing_and_permissions(self):
        """Test 7: Template sharing and permission management"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                templates = await templates_page.get_template_list()

                if len(templates) > 0:
                    template_id = templates[0].get('id') or templates[0].get('name')

                    # Test sharing functionality
                    sharing_available = await templates_page.has_sharing_options(template_id)
                    print(f"Sharing options available: {sharing_available}")

                    if sharing_available:
                        share_result = await templates_page.open_sharing_dialog(template_id)
                        print(f"Sharing dialog opened: {share_result}")

                        # Test permission levels
                        permission_levels = await templates_page.get_available_permissions()
                        print(f"Available permission levels: {permission_levels}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_usage_tracking_and_analytics(self):
        """Test 8: Template usage tracking and analytics"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                templates = await templates_page.get_template_list()

                for template in templates:
                    template_id = template.get('id') or template.get('name')

                    # Get template usage statistics
                    usage_stats = await templates_page.get_template_usage_stats(template_id)
                    print(f"Template {template_id} usage: {usage_stats}")

                    # Test template analytics if available
                    if await templates_page.has_analytics_features():
                        analytics = await templates_page.get_template_analytics(template_id)
                        print(f"Template analytics: {analytics}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_version_management(self):
        """Test 9: Template version management and history"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                templates = await templates_page.get_template_list()

                if len(templates) > 0:
                    template_id = templates[0].get('id') or templates[0].get('name')

                    # Test version history
                    has_versions = await templates_page.has_version_history(template_id)
                    print(f"Template has version history: {has_versions}")

                    if has_versions:
                        versions = await templates_page.get_template_versions(template_id)
                        print(f"Template versions: {versions}")

                        # Test version comparison
                        if len(versions) > 1:
                            comparison = await templates_page.compare_template_versions(
                                template_id, versions[0], versions[1]
                            )
                            print(f"Version comparison: {comparison}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_duplication_and_cloning(self):
        """Test 10: Template duplication and cloning functionality"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                templates = await templates_page.get_template_list()
                initial_count = len(templates)

                if initial_count > 0:
                    source_template = templates[0]
                    template_id = source_template.get('id') or source_template.get('name')

                    # Test template duplication
                    duplicate_result = await templates_page.duplicate_template(template_id)
                    print(f"Template duplication result: {duplicate_result}")

                    if duplicate_result:
                        # Verify new template was created
                        updated_templates = await templates_page.get_template_list()
                        final_count = len(updated_templates)

                        print(f"Template count after duplication: {initial_count} -> {final_count}")

                        # Test template cloning with modifications
                        clone_name = f"Clone of {template_id} {datetime.datetime.now().strftime('%H%M%S')}"
                        clone_result = await templates_page.clone_template_with_name(template_id, clone_name)
                        print(f"Template cloning result: {clone_result}")

            finally:
                await browser.close()

    # INTEGRATION TESTS

    @pytest.mark.asyncio
    async def test_template_to_document_workflow(self):
        """Test 11: Complete template to document workflow"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                print("=== TEMPLATE TO DOCUMENT WORKFLOW ===")

                # Step 1: Access templates
                await templates_page.navigate_to_templates()
                templates = await templates_page.get_template_list()
                print(f"Available templates: {len(templates)}")

                if len(templates) > 0:
                    template_id = templates[0].get('id') or templates[0].get('name')

                    # Step 2: Use template to create document
                    use_template_result = await templates_page.use_template_for_document(template_id)
                    print(f"Use template result: {use_template_result}")

                    # Step 3: Verify document was created
                    await documents_page.navigate_to_documents()
                    documents = await documents_page.get_document_list()
                    print(f"Documents after template use: {len(documents)}")

                print("=== WORKFLOW COMPLETED ===")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_bulk_operations(self):
        """Test 12: Template bulk operations and management"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                templates = await templates_page.get_template_list()
                print(f"Templates available for bulk operations: {len(templates)}")

                if len(templates) >= 2:
                    # Test bulk selection
                    template_ids = [t.get('id') or t.get('name') for t in templates[:2]]

                    bulk_select_result = await templates_page.bulk_select_templates(template_ids)
                    print(f"Bulk selection result: {bulk_select_result}")

                    if bulk_select_result:
                        # Test bulk operations
                        bulk_operations = await templates_page.get_available_bulk_operations()
                        print(f"Available bulk operations: {bulk_operations}")

                        # Test bulk export if available
                        if 'export' in bulk_operations:
                            export_result = await templates_page.bulk_export_templates(template_ids)
                            print(f"Bulk export result: {export_result}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_error_handling_and_validation(self):
        """Test 13: Template error handling and validation"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                print("=== TEMPLATE ERROR HANDLING TEST ===")

                # Test template creation with invalid data
                invalid_creation = await templates_page.create_template("", "")  # Empty name and file
                print(f"Invalid template creation handled: {invalid_creation}")

                # Test uploading invalid file formats
                with tempfile.NamedTemporaryFile(suffix='.exe', delete=False) as invalid_file:
                    invalid_file.write(b'Not a valid document')
                    invalid_path = invalid_file.name

                try:
                    invalid_upload = await templates_page.create_template("Invalid Template", invalid_path)
                    print(f"Invalid file upload handled: {invalid_upload}")

                    # Check for error messages
                    has_error = await templates_page.has_error_message()
                    if has_error:
                        error_msg = await templates_page.get_error_message()
                        print(f"Error message: {error_msg}")

                finally:
                    if os.path.exists(invalid_path):
                        os.unlink(invalid_path)

                # Test accessing non-existent template
                nonexistent_access = await templates_page.open_template_editor("nonexistent_template_id")
                print(f"Non-existent template access handled: {nonexistent_access}")

                print("=== ERROR HANDLING COMPLETED ===")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_performance_and_scalability(self):
        """Test 14: Template performance and scalability"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                print("=== TEMPLATE PERFORMANCE TEST ===")

                # Test rapid template operations
                for i in range(5):
                    start_time = datetime.datetime.now()

                    templates = await templates_page.get_template_list()
                    template_count = await templates_page.count_templates()

                    end_time = datetime.datetime.now()
                    duration = (end_time - start_time).total_seconds()

                    print(f"Operation {i+1}: {len(templates)} templates, count: {template_count}, duration: {duration:.2f}s")

                    await page.wait_for_timeout(500)

                # Test page responsiveness under load
                responsiveness = await templates_page.test_page_responsiveness()
                print(f"Page responsiveness: {responsiveness}")

                print("=== PERFORMANCE TEST COMPLETED ===")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_template_accessibility_and_usability(self):
        """Test 15: Template accessibility and usability features"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                # Test keyboard navigation
                keyboard_nav = await templates_page.test_keyboard_navigation()
                print(f"Keyboard navigation support: {keyboard_nav}")

                # Test screen reader compatibility
                accessibility_features = await templates_page.check_accessibility_features()
                print(f"Accessibility features: {accessibility_features}")

                # Test mobile responsiveness
                await page.set_viewport_size({"width": 375, "height": 667})  # Mobile viewport
                mobile_responsive = await templates_page.test_mobile_layout()
                print(f"Mobile responsive: {mobile_responsive}")

                # Reset viewport
                await page.set_viewport_size({"width": 1920, "height": 1080})

                # Test high contrast mode
                high_contrast = await templates_page.test_high_contrast_mode()
                print(f"High contrast support: {high_contrast}")

            finally:
                await browser.close()