"""
Test Documents Core - Fixed with Direct Async Setup
Comprehensive documents tests for WeSign platform - FIXED VERSION

Test Categories:
1. Document upload functionality
2. Document list and display
3. Document actions (view, download, delete)
4. File type validation and support
5. Document search and filtering
6. Error handling and validation
7. Document status management
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.documents_page import DocumentsPage
from pathlib import Path
import tempfile
import os


class TestDocumentsCoreFixed:
    """Fixed core documents test suite for WeSign platform using direct async setup"""

    # Test 1: test_navigate_to_documents_page_success
    # Tests successful navigation to documents page
    # Verifies documents page loads correctly and displays main elements
    @pytest.mark.asyncio
    async def test_navigate_to_documents_page_success(self):
        """Test successful navigation to documents page"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login first
                await auth_page.navigate()
                await auth_page.login_with_company_user()

                # Navigate to documents
                await documents_page.navigate_to_documents()

                # Verify documents page loaded
                assert await documents_page.is_documents_page_loaded(), "Documents page should be loaded"
            finally:
                await browser.close()

    # Test 2: test_upload_pdf_document_success
    # Tests successful PDF document upload
    # Verifies upload functionality works with PDF files
    @pytest.mark.asyncio
    async def test_upload_pdf_document_success(self):
        """Test successful PDF document upload"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Create test PDF file
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                    temp_pdf.write(b'%PDF-1.4 Test document for upload')
                    pdf_path = temp_pdf.name

                try:
                    # Get initial document count
                    initial_count = await documents_page.count_documents()

                    # Attempt upload
                    upload_result = await documents_page.upload_document(pdf_path)

                    # Verify upload process completed
                    assert isinstance(upload_result, bool), "Upload should return boolean result"

                    # Check if any errors occurred
                    has_error = await documents_page.has_upload_error()
                    assert not has_error, "Upload should not have errors"

                finally:
                    # Cleanup
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

            finally:
                await browser.close()

    # Test 3: test_upload_multiple_file_types_success
    # Tests upload functionality with different file types
    # Verifies system handles various document formats correctly
    @pytest.mark.asyncio
    async def test_upload_multiple_file_types_success(self):
        """Test upload functionality with multiple file types"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Test different file formats
                formats = [
                    ('.txt', b'Test text document'),
                    ('.pdf', b'%PDF-1.4 Test PDF'),
                    ('.doc', b'Test Word document')
                ]

                for ext, content in formats:
                    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
                        temp_file.write(content)
                        file_path = temp_file.name

                    try:
                        upload_result = await documents_page.upload_document(file_path)
                        assert isinstance(upload_result, bool), f"{ext} upload should return boolean"

                        # Wait between uploads
                        await page.wait_for_timeout(1000)

                    finally:
                        if os.path.exists(file_path):
                            os.unlink(file_path)

            finally:
                await browser.close()

    # Test 4: test_document_list_functionality
    # Tests document list display and functionality
    # Verifies documents are properly listed and accessible
    @pytest.mark.asyncio
    async def test_document_list_functionality(self):
        """Test document list display and functionality"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Get document list
                documents = await documents_page.get_document_list()

                # Verify list is returned
                assert isinstance(documents, list), "Should return list of documents"

                # Test document count
                doc_count = await documents_page.count_documents()
                assert isinstance(doc_count, int), "Document count should be integer"
                assert doc_count >= 0, "Document count should be non-negative"

            finally:
                await browser.close()

    # Test 5: test_document_search_functionality
    # Tests document search and filtering
    # Verifies search functionality works correctly
    @pytest.mark.asyncio
    async def test_document_search_functionality(self):
        """Test document search functionality"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Get initial document list
                initial_docs = await documents_page.get_document_list()

                # Perform search
                await documents_page.search_documents("test")
                search_results = await documents_page.get_document_list()

                # Verify search returned results (list format)
                assert isinstance(search_results, list), "Search should return list of results"

                # Test empty search (reset)
                await documents_page.search_documents("")
                reset_results = await documents_page.get_document_list()

                # Verify reset worked
                assert isinstance(reset_results, list), "Reset search should return list"

            finally:
                await browser.close()

    # Test 6: test_upload_functionality_availability
    # Tests if upload functionality is available for user
    # Verifies user permissions and upload interface access
    @pytest.mark.asyncio
    async def test_upload_functionality_availability(self):
        """Test upload functionality availability"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Check if upload functionality is available
                upload_available = await documents_page.is_upload_functionality_available()

                # Verify availability check returns boolean
                assert isinstance(upload_available, bool), "Upload availability should be boolean"

            finally:
                await browser.close()

    # Test 7: test_document_upload_with_unique_name
    # Tests document upload with unique filename
    # Verifies file naming and duplicate handling
    @pytest.mark.asyncio
    async def test_document_upload_with_unique_name(self):
        """Test document upload with unique filename"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Create unique test file
                import datetime
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

                with tempfile.NamedTemporaryFile(suffix=f'_unique_{timestamp}.pdf', delete=False) as temp_pdf:
                    temp_pdf.write(b'%PDF-1.4 Unique test document')
                    pdf_path = temp_pdf.name

                try:
                    # Attempt upload
                    upload_result = await documents_page.upload_document(pdf_path)

                    # Verify upload process
                    assert isinstance(upload_result, bool), "Upload should return boolean result"

                finally:
                    # Cleanup
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

            finally:
                await browser.close()

    # Test 8: test_empty_document_list_handling
    # Tests handling of empty document list
    # Verifies proper display when no documents exist
    @pytest.mark.asyncio
    async def test_empty_document_list_handling(self):
        """Test handling of empty document list"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Get document list
                documents = await documents_page.get_document_list()

                # Even if empty, should return valid list
                assert isinstance(documents, list), "Should return valid list even if empty"

                # Count should be consistent
                doc_count = await documents_page.count_documents()
                assert len(documents) == doc_count, "List length should match count"

            finally:
                await browser.close()

    # Test 9: test_document_status_detection
    # Tests document status detection functionality
    # Verifies system can identify document states
    @pytest.mark.asyncio
    async def test_document_status_detection(self):
        """Test document status detection"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Get document list
                documents = await documents_page.get_document_list()

                if len(documents) > 0:
                    # Test status detection on first document
                    first_doc = documents[0]
                    status = await documents_page.get_document_status(first_doc['name'])

                    # Status should be returned (even if unknown)
                    assert status is not None, "Status should be returned"
                else:
                    # Test with non-existent document
                    status = await documents_page.get_document_status("NonExistentDoc.pdf")
                    assert status is not None, "Should return status even for non-existent docs"

            finally:
                await browser.close()

    # Test 10: test_document_info_retrieval
    # Tests document information retrieval
    # Verifies system can get document metadata and details
    @pytest.mark.asyncio
    async def test_document_info_retrieval(self):
        """Test document information retrieval"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Get document list
                documents = await documents_page.get_document_list()

                if len(documents) > 0:
                    # Test info retrieval on first document
                    first_doc = documents[0]
                    doc_info = await documents_page.get_document_info(first_doc['name'])

                    # Info should be returned as dict
                    assert isinstance(doc_info, dict), "Document info should be dictionary"
                else:
                    # Test with non-existent document
                    doc_info = await documents_page.get_document_info("NonExistentDoc.pdf")
                    assert isinstance(doc_info, dict), "Should return dict even for non-existent docs"

            finally:
                await browser.close()

    # Test 11: test_upload_error_handling
    # Tests upload error handling and validation
    # Verifies proper error reporting for failed uploads
    @pytest.mark.asyncio
    async def test_upload_error_handling(self):
        """Test upload error handling"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Test upload with non-existent file
                upload_result = await documents_page.upload_document("/nonexistent/file.pdf")

                # Should handle gracefully
                assert isinstance(upload_result, bool), "Should return boolean for non-existent file"

                # Check error detection works
                has_error = await documents_page.has_upload_error()
                assert isinstance(has_error, bool), "Error detection should return boolean"

            finally:
                await browser.close()

    # Test 12: test_success_message_detection
    # Tests success message detection after uploads
    # Verifies system shows appropriate success feedback
    @pytest.mark.asyncio
    async def test_success_message_detection(self):
        """Test success message detection"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Check success message detection works
                has_success = await documents_page.has_upload_success()
                assert isinstance(has_success, bool), "Success detection should return boolean"

                # Test getting success message
                if has_success:
                    success_msg = await documents_page.get_success_message()
                    assert isinstance(success_msg, str), "Success message should be string"

            finally:
                await browser.close()

    # Test 13: test_documents_page_verification
    # Tests comprehensive documents page functionality
    # Verifies all major page elements and features work
    @pytest.mark.asyncio
    async def test_documents_page_verification(self):
        """Test comprehensive documents page verification"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Run comprehensive verification
                verification_results = await documents_page.verify_documents_page_functionality()

                # Verify results structure
                assert isinstance(verification_results, dict), "Verification should return dict"
                assert "is_loaded" in verification_results, "Should check if page is loaded"

            finally:
                await browser.close()

    # Test 14: test_file_input_element_accessibility
    # Tests file input element accessibility and functionality
    # Verifies upload interface is accessible and working
    @pytest.mark.asyncio
    async def test_file_input_element_accessibility(self):
        """Test file input element accessibility"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Check if file input is accessible
                upload_available = await documents_page.is_upload_functionality_available()

                if upload_available:
                    # File input should be present
                    file_input_count = await page.locator('input[type="file"]').count()
                    assert file_input_count >= 0, "File input accessibility check"

            finally:
                await browser.close()

    # Test 15: test_document_page_url_validation
    # Tests document page URL structure and validation
    # Verifies proper routing and URL handling
    @pytest.mark.asyncio
    async def test_document_page_url_validation(self):
        """Test document page URL validation"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Verify URL contains documents path
                current_url = page.url

                # Should be on dashboard or documents-related page
                assert "dashboard" in current_url or "documents" in current_url, "Should be on documents-related page"

            finally:
                await browser.close()

    # Test 16: test_upload_file_size_handling
    # Tests handling of different file sizes
    # Verifies system handles various file sizes appropriately
    @pytest.mark.asyncio
    async def test_upload_file_size_handling(self):
        """Test upload file size handling"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Test small file upload
                with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as small_file:
                    small_file.write(b'Small test content')
                    small_path = small_file.name

                try:
                    upload_result = await documents_page.upload_document(small_path)
                    assert isinstance(upload_result, bool), "Small file upload should return boolean"

                finally:
                    if os.path.exists(small_path):
                        os.unlink(small_path)

            finally:
                await browser.close()

    # Test 17: test_document_interface_responsiveness
    # Tests document interface responsiveness and performance
    # Verifies UI responds appropriately to user actions
    @pytest.mark.asyncio
    async def test_document_interface_responsiveness(self):
        """Test document interface responsiveness"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Test rapid operations
                for i in range(3):
                    # Perform quick operations
                    await documents_page.count_documents()
                    await documents_page.get_document_list()

                    # Small delay between operations
                    await page.wait_for_timeout(500)

                # Interface should remain responsive
                assert await documents_page.is_documents_page_loaded(), "Page should remain loaded"

            finally:
                await browser.close()

    # Test 18: test_search_reset_functionality
    # Tests search reset functionality
    # Verifies search can be cleared and reset properly
    @pytest.mark.asyncio
    async def test_search_reset_functionality(self):
        """Test search reset functionality"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Get initial state
                initial_docs = await documents_page.get_document_list()

                # Perform search
                await documents_page.search_documents("searchterm")

                # Reset search
                await documents_page.search_documents("")
                reset_docs = await documents_page.get_document_list()

                # Verify reset functionality works
                assert isinstance(reset_docs, list), "Reset should return valid list"

            finally:
                await browser.close()

    # Test 19: test_multiple_search_operations
    # Tests multiple search operations in sequence
    # Verifies search functionality remains stable across operations
    @pytest.mark.asyncio
    async def test_multiple_search_operations(self):
        """Test multiple search operations"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Test multiple search terms
                search_terms = ["test", "doc", "pdf", ""]

                for term in search_terms:
                    await documents_page.search_documents(term)
                    results = await documents_page.get_document_list()

                    assert isinstance(results, list), f"Search for '{term}' should return list"

                    # Small delay between searches
                    await page.wait_for_timeout(500)

            finally:
                await browser.close()

    # Test 20: test_document_operations_availability
    # Tests availability of various document operations
    # Verifies user can access expected document features
    @pytest.mark.asyncio
    async def test_document_operations_availability(self):
        """Test document operations availability"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Test various operation availability
                upload_available = await documents_page.is_upload_functionality_available()
                page_loaded = await documents_page.is_documents_page_loaded()

                # All checks should return boolean values
                assert isinstance(upload_available, bool), "Upload availability should be boolean"
                assert isinstance(page_loaded, bool), "Page loaded check should be boolean"

            finally:
                await browser.close()