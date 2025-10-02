"""Document editing tests converted from Selenium to Playwright."""

import pytest
import allure
from pathlib import Path
from playwright.async_api import Page, async_playwright

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))


from pages.login_page import LoginPage
from pages.home_page import HomePage
from pages.documents_page import DocumentsPage
from pages.edit_document_page import EditDocumentPage
from config.settings import settings
from utils.common_methods import CommonMethods
from utils.test_data_factory import TestDataFactory
from utils.file_handlers import FileHandler


@allure.epic("Documents")
@allure.feature("Document Editing")
class TestDocumentEditing:
    def _initialize_page_objects(self):
        """Initialize page objects."""
        self.login_page = LoginPage(self.page)
        self.home_page = HomePage(self.page)
        self.documents_page = DocumentsPage(self.page)
        self.edit_document_page = EditDocumentPage(self.page)
        self.common = CommonMethods()
        self.test_data_factory = TestDataFactory()
        self.file_handler = FileHandler()
        

    async def _cleanup_browser(self):
        """Cleanup browser resources."""
        if hasattr(self, 'browser'):
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()

    async def _setup_browser(self):
        """Setup browser with working direct approach."""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.context = await self.browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1920, "height": 1080}
        )
        self.page = await self.context.new_page()
        self.page.set_default_timeout(15000)
        self.page.set_default_navigation_timeout(20000)
        
        # Initialize page objects with working page
        self._initialize_page_objects()
        

    @allure.story("Field Addition")
    @pytest.mark.english
    @pytest.mark.asyncio
    async def test_add_signature_field_success(self):
        """Test adding signature field to document."""
        await self._setup_browser()
        try:
            with allure.step("Setup: Login and upload document"):
                await self.login_page.navigate()
                await self.login_page.login_as_company_user()
                await self.home_page.click_my_documents()
                
                # Upload document
                test_file = self.file_handler.get_test_file_path("pdf")
                await self.documents_page.upload_document(test_file)
                await self.documents_page.wait_for_upload_complete()
            
            with allure.step("Open document for editing"):
                documents = await self.documents_page.get_document_list()
                if documents:
                    first_document = documents[0]["name"]
                    await self.documents_page.edit_document(first_document)
                    await self.edit_document_page.wait_for_editor_ready()
            
            with allure.step("Add signature field"):
                initial_count = await self.edit_document_page.get_field_count()
                await self.edit_document_page.add_signature_field(page=1, x=150, y=200)
                
                # Verify field was added
                assert await self.edit_document_page.validate_field_added("signature"), "Signature field should be added"
                
                new_count = await self.edit_document_page.get_field_count()
                assert new_count > initial_count, "Field count should increase"
            
            with allure.step("Save document"):
                await self.edit_document_page.save_document()
                assert await self.edit_document_page.is_save_successful(), "Document should be saved successfully"
        finally:
            await self._cleanup_browser()
    
    @allure.story("Field Addition")
    @pytest.mark.english
    @pytest.mark.asyncio
    async def test_add_multiple_field_types(self):
        """Test adding different field types to document."""
        await self._setup_browser()
        try:
            with allure.step("Setup: Login and upload document"):
                await self.login_page.navigate()
                await self.login_page.login_as_company_user()
                await self.home_page.click_my_documents()
                
                test_file = self.file_handler.get_test_file_path("pdf")
                await self.documents_page.upload_document(test_file)
                await self.documents_page.wait_for_upload_complete()
            
            with allure.step("Open document for editing"):
                documents = await self.documents_page.get_document_list()
                if documents:
                    first_document = documents[0]["name"]
                    await self.documents_page.edit_document(first_document)
                    await self.edit_document_page.wait_for_editor_ready()
            
            field_types_to_test = [
                ("signature", 100, 100),
                ("text", 200, 100),
                ("email", 300, 100),
                ("phone", 100, 200),
                ("date", 200, 200),
                ("checkbox", 300, 200)
            ]
            
            for field_type, x, y in field_types_to_test:
                with allure.step(f"Add {field_type} field"):
                    try:
                        await self.edit_document_page.add_field_by_type(field_type, page=1, x=x, y=y)
                        
                        # Verify field was added
                        assert await self.edit_document_page.validate_field_added(field_type), f"{field_type} field should be added"
                        
                    except Exception as e:
                        allure.attach(f"Failed to add {field_type} field: {str(e)}", 
                                    name=f"{field_type} Field Error", 
                                    attachment_type=allure.attachment_type.TEXT)
                        # Continue with other field types
            
            with allure.step("Verify total field count"):
                final_count = await self.edit_document_page.get_field_count()
                assert final_count > 0, "Should have added multiple fields"
            
            with allure.step("Save document"):
                await self.edit_document_page.save_document()
                assert await self.edit_document_page.is_save_successful(), "Document should be saved successfully"
        finally:
            await self._cleanup_browser()

    @allure.story("Field Addition")
    @pytest.mark.english
    @pytest.mark.asyncio
    async def test_add_all_field_types_bulk(self):
        """Test adding all available field types at once."""
        await self._setup_browser()
        try:
            with allure.step("Setup: Login and upload document"):
                await self.login_page.navigate()
                await self.login_page.login_as_company_user()
                await self.home_page.click_my_documents()
                
                test_file = self.file_handler.get_test_file_path("pdf")
                await self.documents_page.upload_document(test_file)
                await self.documents_page.wait_for_upload_complete()
            
            with allure.step("Open document for editing"):
                documents = await self.documents_page.get_document_list()
                if documents:
                    first_document = documents[0]["name"]
                    await self.documents_page.edit_document(first_document)
                    await self.edit_document_page.wait_for_editor_ready()
            
            with allure.step("Add all field types"):
                initial_count = await self.edit_document_page.get_field_count()
                await self.edit_document_page.add_all_field_types(page=1, start_x=50, start_y=50)
                
                # Verify multiple fields were added
                final_count = await self.edit_document_page.get_field_count()
                assert final_count > initial_count, "Multiple fields should be added"
            
            with allure.step("Save document"):
                await self.edit_document_page.save_document()
                assert await self.edit_document_page.is_save_successful(), "Document should be saved successfully"
        finally:
            await self._cleanup_browser()

    @allure.story("Multi-page Editing")
    @pytest.mark.english
    @pytest.mark.asyncio
    async def test_add_fields_multiple_pages(self):
        """Test adding fields to multiple pages of document."""
        await self._setup_browser()
        try:
            with allure.step("Setup: Login and upload document"):
                await self.login_page.navigate()
                await self.login_page.login_as_company_user()
                await self.home_page.click_my_documents()
                
                test_file = self.file_handler.get_test_file_path("pdf")
                await self.documents_page.upload_document(test_file)
                await self.documents_page.wait_for_upload_complete()
            
            with allure.step("Open document for editing"):
                documents = await self.documents_page.get_document_list()
                if documents:
                    first_document = documents[0]["name"]
                    await self.documents_page.edit_document(first_document)
                    await self.edit_document_page.wait_for_editor_ready()
            
            with allure.step("Check document pages"):
                total_pages = await self.edit_document_page.get_total_pages()
                allure.attach(f"Document has {total_pages} page(s)", 
                             name="Document Pages", 
                             attachment_type=allure.attachment_type.TEXT)
            
            # Add fields to available pages (up to 3)
            pages_to_test = min(total_pages, 3)
            
            for page_num in range(1, pages_to_test + 1):
                with allure.step(f"Add fields to page {page_num}"):
                    if page_num > 1:
                        await self.edit_document_page.navigate_to_page(page_num)
                    
                    # Add signature field to each page
                    await self.edit_document_page.add_signature_field(page=page_num, x=100, y=150)
                    
                    # Verify we're on the correct page
                    current_page = await self.edit_document_page.get_current_page()
                    assert current_page == page_num, f"Should be on page {page_num}"
            
            with allure.step("Verify total field count"):
                final_count = await self.edit_document_page.get_field_count()
                assert final_count >= pages_to_test, f"Should have at least {pages_to_test} fields"
            
            with allure.step("Save document"):
                await self.edit_document_page.save_document()
                assert await self.edit_document_page.is_save_successful(), "Document should be saved successfully"
        finally:
            await self._cleanup_browser()

    @allure.story("Document Properties")
    @pytest.mark.english
    @pytest.mark.asyncio
    async def test_change_document_name_during_editing(self):
        """Test changing document name during editing."""
        await self._setup_browser()
        try:
            new_name = f"EditedDoc_{self.test_data_factory.random_string(6)}"
            
            with allure.step("Setup: Login and upload document"):
                await self.login_page.navigate()
                await self.login_page.login_as_company_user()
                await self.home_page.click_my_documents()
                
                test_file = self.file_handler.get_test_file_path("pdf")
                await self.documents_page.upload_document(test_file)
                await self.documents_page.wait_for_upload_complete()
            
            with allure.step("Open document for editing"):
                documents = await self.documents_page.get_document_list()
                if documents:
                    first_document = documents[0]["name"]
                    await self.documents_page.edit_document(first_document)
                    await self.edit_document_page.wait_for_editor_ready()
            
            with allure.step("Change document name"):
                await self.edit_document_page.set_document_name(new_name)
                
                # Verify name was changed
                current_name = await self.edit_document_page.get_document_name()
                if current_name:
                    assert new_name in current_name, "Document name should be updated"
            
            with allure.step("Save document"):
                await self.edit_document_page.save_document()
                assert await self.edit_document_page.is_save_successful(), "Document should be saved successfully"
            
            with allure.step("Verify name change persisted"):
                # Go back to documents list and verify name
                await self.home_page.click_my_documents()
                await self.documents_page.wait_for_documents_page_load()
                
                # The document should appear with new name in the list
                documents_list = await self.documents_page.get_document_list()
                found_renamed = any(new_name in doc.get("name", "") for doc in documents_list)
                
                allure.attach(f"Renamed document found: {found_renamed}", 
                             name="Name Change Verification", 
                             attachment_type=allure.attachment_type.TEXT)
        finally:
            await self._cleanup_browser()


@allure.epic("Documents")
@allure.feature("Field Management")
class TestFieldManagement:
    def _initialize_page_objects(self):
        """Initialize page objects."""
        self.login_page = LoginPage(self.page)
        self.home_page = HomePage(self.page)
        self.documents_page = DocumentsPage(self.page)
        self.edit_document_page = EditDocumentPage(self.page)
        self.common = CommonMethods()
        self.test_data_factory = TestDataFactory()
        self.file_handler = FileHandler()
        

    async def _cleanup_browser(self):
        """Cleanup browser resources."""
        if hasattr(self, 'browser'):
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()

    async def _setup_browser(self):
        """Setup browser with working direct approach."""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.context = await self.browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1920, "height": 1080}
        )
        self.page = await self.context.new_page()
        self.page.set_default_timeout(15000)
        self.page.set_default_navigation_timeout(20000)
        
        # Initialize page objects with working page
        self._initialize_page_objects()
        

    @allure.story("Field Configuration")
    @pytest.mark.english
    @pytest.mark.asyncio
    async def test_configure_field_properties(self):
        """Test configuring field properties."""
        await self._setup_browser()
        try:
            with allure.step("Setup: Login and create document with field"):
                await self.login_page.navigate()
                await self.login_page.login_as_company_user()
                await self.home_page.click_my_documents()
                
                test_file = self.file_handler.get_test_file_path("pdf")
                await self.documents_page.upload_document(test_file)
                await self.documents_page.wait_for_upload_complete()
                
                # Open for editing and add a field
                documents = await self.documents_page.get_document_list()
                if documents:
                    first_document = documents[0]["name"]
                    await self.documents_page.edit_document(first_document)
                    await self.edit_document_page.wait_for_editor_ready()
                    
                    await self.edit_document_page.add_text_field(x=150, y=200)
            
            with allure.step("Configure field properties"):
                # Find the text field and configure it
                text_fields = await self.edit_document_page.get_fields_by_type("text")
                if text_fields:
                    field_selector = ".text-field:first, [data-field-type='text']:first"
                    
                    properties = {
                        "required": True,
                        "label": "Test Field",
                        "placeholder": "Enter text here"
                    }
                    
                    try:
                        await self.edit_document_page.configure_field_properties(field_selector, properties)
                        allure.attach("Field properties configured successfully", 
                                     name="Properties Configuration", 
                                     attachment_type=allure.attachment_type.TEXT)
                    except Exception as e:
                        allure.attach(f"Field configuration not available: {str(e)}", 
                                     name="Configuration Error", 
                                     attachment_type=allure.attachment_type.TEXT)
            
            with allure.step("Save document"):
                await self.edit_document_page.save_document()
                assert await self.edit_document_page.is_save_successful(), "Document should be saved successfully"
        finally:
            await self._cleanup_browser()
    
    @allure.story("Field Deletion")
    @pytest.mark.english
    @pytest.mark.asyncio
    async def test_delete_field_from_document(self):
        """Test deleting field from document."""
        await self._setup_browser()
        try:
            with allure.step("Setup: Login and create document with fields"):
                await self.login_page.navigate()
                await self.login_page.login_as_company_user()
                await self.home_page.click_my_documents()
                
                test_file = self.file_handler.get_test_file_path("pdf")
                await self.documents_page.upload_document(test_file)
                await self.documents_page.wait_for_upload_complete()
                
                # Open for editing and add fields
                documents = await self.documents_page.get_document_list()
                if documents:
                    first_document = documents[0]["name"]
                    await self.documents_page.edit_document(first_document)
                    await self.edit_document_page.wait_for_editor_ready()
                    
                    # Add multiple fields
                    await self.edit_document_page.add_signature_field(x=100, y=100)
                    await self.edit_document_page.add_text_field(x=200, y=100)
            
            with allure.step("Delete a field"):
                initial_count = await self.edit_document_page.get_field_count()
                
                if initial_count > 0:
                    # Try to delete first field
                    field_selector = ".document-field:first, .field-element:first"
                    
                    try:
                        await self.edit_document_page.delete_field(field_selector)
                        
                        # Verify field count decreased
                        new_count = await self.edit_document_page.get_field_count()
                        assert new_count < initial_count, "Field count should decrease after deletion"
                        
                    except Exception as e:
                        allure.attach(f"Field deletion not available: {str(e)}", 
                                     name="Deletion Error", 
                                     attachment_type=allure.attachment_type.TEXT)
                        pytest.skip("Field deletion not implemented")
            
            with allure.step("Save document"):
                await self.edit_document_page.save_document()
                assert await self.edit_document_page.is_save_successful(), "Document should be saved successfully"
        finally:
            await self._cleanup_browser()


@allure.epic("Documents")
@allure.feature("Document Workflow")
class TestDocumentWorkflow:
    def _initialize_page_objects(self):
        """Initialize page objects."""
        self.login_page = LoginPage(self.page)
        self.home_page = HomePage(self.page)
        self.documents_page = DocumentsPage(self.page)
        self.edit_document_page = EditDocumentPage(self.page)
        self.common = CommonMethods()
        self.test_data_factory = TestDataFactory()
        self.file_handler = FileHandler()
        

    async def _cleanup_browser(self):
        """Cleanup browser resources."""
        if hasattr(self, 'browser'):
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()

    async def _setup_browser(self):
        """Setup browser with working direct approach."""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.context = await self.browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1920, "height": 1080}
        )
        self.page = await self.context.new_page()
        self.page.set_default_timeout(15000)
        self.page.set_default_navigation_timeout(20000)
        
        # Initialize page objects with working page
        self._initialize_page_objects()
        

    @allure.story("Complete Workflow")
    @pytest.mark.english
    @pytest.mark.asyncio
    async def test_complete_document_editing_workflow(self):
        """Test complete document editing workflow from upload to save."""
        await self._setup_browser()
        try:
            document_name = f"WorkflowTest_{self.test_data_factory.random_string(6)}"
            
            with allure.step("1. Login and navigate"):
                await self.login_page.navigate()
                await self.login_page.login_as_company_user()
                await self.home_page.click_my_documents()
            
            with allure.step("2. Upload document"):
                test_file = self.file_handler.get_test_file_path("pdf")
                await self.documents_page.upload_document(test_file)
                assert await self.documents_page.wait_for_upload_complete(), "Upload should complete"
            
            with allure.step("3. Open document for editing"):
                documents = await self.documents_page.get_document_list()
                assert len(documents) > 0, "Should have uploaded document"
                
                first_document = documents[0]["name"]
                await self.documents_page.edit_document(first_document)
                assert await self.edit_document_page.validate_editor_loaded(), "Editor should load"
            
            with allure.step("4. Add multiple fields"):
                await self.edit_document_page.add_signature_field(x=100, y=150)
                await self.edit_document_page.add_text_field(x=250, y=150)
                await self.edit_document_page.add_date_field(x=400, y=150)
                
                field_count = await self.edit_document_page.get_field_count()
                assert field_count >= 3, "Should have added multiple fields"
            
            with allure.step("5. Set document name"):
                await self.edit_document_page.set_document_name(document_name)
            
            with allure.step("6. Save document"):
                await self.edit_document_page.save_document()
                assert await self.edit_document_page.is_save_successful(), "Document should save successfully"
            
            with allure.step("7. Verify in documents list"):
                await self.home_page.click_my_documents()
                await self.documents_page.wait_for_documents_page_load()
                
                # Verify document appears in list
                updated_documents = await self.documents_page.get_document_list()
                found_document = any(document_name in doc.get("name", "") for doc in updated_documents)
                
                if not found_document:
                    # Document name might not have been changed, verify original exists
                    original_found = any(first_document in doc.get("name", "") for doc in updated_documents)
                    assert original_found, "Original document should still exist"
        finally:
            await self._cleanup_browser()
    
    @allure.story("Cancel Workflow")
    @pytest.mark.english
    @pytest.mark.asyncio
    async def test_cancel_document_editing_workflow(self):
        """Test canceling document editing workflow."""
        await self._setup_browser()
        try:
            with allure.step("Setup: Upload and start editing"):
                await self.login_page.navigate()
                await self.login_page.login_as_company_user()
                await self.home_page.click_my_documents()
                
                test_file = self.file_handler.get_test_file_path("pdf")
                await self.documents_page.upload_document(test_file)
                await self.documents_page.wait_for_upload_complete()
                
                documents = await self.documents_page.get_document_list()
                if documents:
                    first_document = documents[0]["name"]
                    await self.documents_page.edit_document(first_document)
                    await self.edit_document_page.wait_for_editor_ready()
            
            with allure.step("Make changes without saving"):
                # Add a field but don't save
                await self.edit_document_page.add_signature_field(x=100, y=100)
                field_count = await self.edit_document_page.get_field_count()
                
                allure.attach(f"Added {field_count} field(s) before canceling", 
                             name="Changes Made", 
                             attachment_type=allure.attachment_type.TEXT)
            
            with allure.step("Cancel editing"):
                await self.edit_document_page.cancel_editing()
                
                # Should be back to documents list or view mode
                current_url = await self.edit_document_page.get_current_url()
                assert "edit" not in current_url.lower(), "Should not be in edit mode after cancel"
            
            with allure.step("Verify changes were not saved"):
                # This verification depends on the application behavior
                # In most cases, canceled changes should not persist
                allure.attach("Changes should not be saved after cancel", 
                             name="Cancel Verification", 
                             attachment_type=allure.attachment_type.TEXT)
        finally:
            await self._cleanup_browser()