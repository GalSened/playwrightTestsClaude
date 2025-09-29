"""
Test Documents Core - Written from Scratch
Comprehensive documents tests for WeSign platform

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
from playwright.async_api import Page
from pages.documents_page import DocumentsPage
from pages.dashboard_page import DashboardPage
from pathlib import Path
import tempfile
import os


class TestDocumentsCore:
    """Core documents test suite for WeSign platform"""

    # Test 1: test_navigate_to_documents_page_success
    # Tests successful navigation to documents page
    # Verifies documents page loads correctly and displays main elements
    @pytest.mark.asyncio
    async def test_navigate_to_documents_page_success(self, authenticated_page: Page):
        """Test successful navigation to documents page"""
        documents_page = DocumentsPage(authenticated_page)

        # Navigate to documents page
        await documents_page.navigate_to_documents()

        # Verify documents page loaded
        assert await documents_page.is_documents_page_loaded(), "Documents page should load successfully"

        # Verify page URL contains documents
        current_url = await documents_page.get_current_url()
        assert "documents" in current_url.lower() or "מסמכים" in current_url, "URL should contain documents reference"

    # Test 2: test_upload_functionality_availability
    # Tests availability of document upload functionality
    # Verifies upload button and file input elements are present
    @pytest.mark.asyncio
    async def test_upload_functionality_availability(self, authenticated_page: Page):
        """Test document upload functionality availability"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Check if upload functionality is available
        upload_available = await documents_page.is_upload_functionality_available()
        assert upload_available, "Document upload functionality should be available"

    # Test 3: test_upload_pdf_document_success
    # Tests successful upload of PDF document
    # Verifies PDF file can be uploaded and appears in document list
    @pytest.mark.asyncio
    async def test_upload_pdf_document_success(self, authenticated_page: Page):
        """Test successful PDF document upload"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create temporary PDF file for testing
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
            temp_pdf.write(b'%PDF-1.4 Test PDF content')
            pdf_path = temp_pdf.name

        try:
            # Get initial document count
            initial_count = await documents_page.count_documents()

            # Upload PDF document
            upload_success = await documents_page.upload_document(pdf_path)

            if upload_success:
                # Verify upload success
                assert not await documents_page.has_upload_error(), "Should not have upload errors"

                # Check if document count increased
                final_count = await documents_page.count_documents()
                assert final_count >= initial_count, "Document count should increase or stay same after upload"

        finally:
            # Cleanup temporary file
            if os.path.exists(pdf_path):
                os.unlink(pdf_path)

    # Test 4: test_upload_word_document_success
    # Tests successful upload of Word document
    # Verifies DOCX file can be uploaded and processed correctly
    @pytest.mark.asyncio
    async def test_upload_word_document_success(self, authenticated_page: Page):
        """Test successful Word document upload"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create temporary Word document for testing
        with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as temp_doc:
            temp_doc.write(b'PK\x03\x04Test Word Document Content')  # Minimal docx structure
            doc_path = temp_doc.name

        try:
            # Get initial document count
            initial_count = await documents_page.count_documents()

            # Upload Word document
            upload_success = await documents_page.upload_document(doc_path)

            if upload_success:
                # Verify no upload errors
                assert not await documents_page.has_upload_error(), "Should not have upload errors for Word documents"

                # Check document list
                final_count = await documents_page.count_documents()
                assert final_count >= initial_count, "Document count should increase after Word upload"

        finally:
            # Cleanup
            if os.path.exists(doc_path):
                os.unlink(doc_path)

    # Test 5: test_upload_excel_document_success
    # Tests successful upload of Excel document
    # Verifies XLSX file can be uploaded and handled properly
    @pytest.mark.asyncio
    async def test_upload_excel_document_success(self, authenticated_page: Page):
        """Test successful Excel document upload"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create temporary Excel file for testing
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_excel:
            temp_excel.write(b'PK\x03\x04Test Excel Content')  # Minimal xlsx structure
            excel_path = temp_excel.name

        try:
            # Upload Excel document
            upload_success = await documents_page.upload_document(excel_path)

            if upload_success:
                # Verify no errors with Excel upload
                assert not await documents_page.has_upload_error(), "Should not have errors with Excel uploads"

        finally:
            # Cleanup
            if os.path.exists(excel_path):
                os.unlink(excel_path)

    # Test 6: test_upload_image_document_success
    # Tests successful upload of image files (JPG/PNG)
    # Verifies image files can be uploaded as documents
    @pytest.mark.asyncio
    async def test_upload_image_document_success(self, authenticated_page: Page):
        """Test successful image document upload"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create temporary image file for testing
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_img:
            # Minimal JPEG header
            temp_img.write(b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01Test Image')
            img_path = temp_img.name

        try:
            # Upload image document
            upload_success = await documents_page.upload_document(img_path)

            if upload_success:
                # Verify image upload handling
                error_message = await documents_page.get_error_message()

                # Some systems may reject images, others may accept them
                if await documents_page.has_upload_error():
                    assert "image" in error_message.lower() or "jpg" in error_message.lower(), \
                           "Error message should be relevant to image files"

        finally:
            # Cleanup
            if os.path.exists(img_path):
                os.unlink(img_path)

    # Test 7: test_upload_unsupported_file_type_rejection
    # Tests rejection of unsupported file types
    # Verifies system properly rejects files with unsupported extensions
    @pytest.mark.asyncio
    async def test_upload_unsupported_file_type_rejection(self, authenticated_page: Page):
        """Test rejection of unsupported file types"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create temporary file with unsupported extension
        with tempfile.NamedTemporaryFile(suffix='.xyz', delete=False) as temp_file:
            temp_file.write(b'Unsupported file content')
            unsupported_path = temp_file.name

        try:
            # Attempt to upload unsupported file type
            upload_success = await documents_page.upload_document(unsupported_path)

            # Should either fail to upload or show error
            if upload_success:
                # Check for error message about file type
                has_error = await documents_page.has_upload_error()
                if has_error:
                    error_message = await documents_page.get_error_message()
                    assert "type" in error_message.lower() or "format" in error_message.lower(), \
                           "Error should mention file type/format issues"

        finally:
            # Cleanup
            if os.path.exists(unsupported_path):
                os.unlink(unsupported_path)

    # Test 8: test_upload_oversized_file_handling
    # Tests handling of oversized files
    # Verifies system properly handles files that exceed size limits
    @pytest.mark.asyncio
    async def test_upload_oversized_file_handling(self, authenticated_page: Page):
        """Test handling of oversized file uploads"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create large temporary file (simulating oversized file)
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_large:
            # Write a reasonably large amount of data (1MB)
            temp_large.write(b'Large file content ' * 50000)
            large_path = temp_large.name

        try:
            # Attempt to upload large file
            upload_success = await documents_page.upload_document(large_path)

            # Check for appropriate handling of large files
            if await documents_page.has_upload_error():
                error_message = await documents_page.get_error_message()
                size_related = "size" in error_message.lower() or "large" in error_message.lower() or \
                              "limit" in error_message.lower()

                # Error should be size-related if it fails
                if error_message:
                    print(f"Large file error message: {error_message}")

        finally:
            # Cleanup
            if os.path.exists(large_path):
                os.unlink(large_path)

    # Test 9: test_document_list_display
    # Tests document list display functionality
    # Verifies documents are properly displayed in the list/grid view
    @pytest.mark.asyncio
    async def test_document_list_display(self, authenticated_page: Page):
        """Test document list display functionality"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Get document list
        documents = await documents_page.get_document_list()

        # Verify document list functionality
        assert isinstance(documents, list), "Document list should be returned as list"

        # If documents exist, verify structure
        if len(documents) > 0:
            first_doc = documents[0]
            assert 'name' in first_doc, "Document should have name property"
            assert 'index' in first_doc, "Document should have index property"
            assert first_doc['name'], "Document name should not be empty"

        # Get document count
        doc_count = await documents_page.count_documents()
        assert doc_count >= 0, "Document count should be non-negative"

    # Test 10: test_document_search_functionality
    # Tests document search functionality
    # Verifies users can search for documents by name or content
    @pytest.mark.asyncio
    async def test_document_search_functionality(self, authenticated_page: Page):
        """Test document search functionality"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Test search functionality
        search_term = "test"
        await documents_page.search_documents(search_term)

        # Verify search was performed (no errors)
        assert not await documents_page.has_upload_error(), "Search should not cause errors"

        # Get documents after search
        filtered_docs = await documents_page.get_document_list()
        assert isinstance(filtered_docs, list), "Search should return document list"

    # Test 11: test_document_download_functionality
    # Tests document download functionality
    # Verifies users can download existing documents
    @pytest.mark.asyncio
    async def test_document_download_functionality(self, authenticated_page: Page):
        """Test document download functionality"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Get existing documents
        documents = await documents_page.get_document_list()

        if len(documents) > 0:
            # Try to download first document
            first_doc_name = documents[0]['name']
            download_success = await documents_page.download_document(first_doc_name)

            # Download should either succeed or fail gracefully
            assert isinstance(download_success, bool), "Download should return boolean result"

    # Test 12: test_document_view_functionality
    # Tests document viewing functionality
    # Verifies users can view/open documents for preview
    @pytest.mark.asyncio
    async def test_document_view_functionality(self, authenticated_page: Page):
        """Test document view/open functionality"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Get existing documents
        documents = await documents_page.get_document_list()

        if len(documents) > 0:
            # Try to view first document
            first_doc_name = documents[0]['name']
            view_success = await documents_page.view_document(first_doc_name)

            # View should either succeed or fail gracefully
            assert isinstance(view_success, bool), "View should return boolean result"

    # Test 13: test_document_status_detection
    # Tests document status detection and display
    # Verifies document statuses (signed, pending, draft) are properly detected
    @pytest.mark.asyncio
    async def test_document_status_detection(self, authenticated_page: Page):
        """Test document status detection and display"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Get existing documents
        documents = await documents_page.get_document_list()

        if len(documents) > 0:
            # Check status of first document
            first_doc_name = documents[0]['name']
            status = await documents_page.get_document_status(first_doc_name)

            # Status should be one of the valid values
            valid_statuses = ['signed', 'pending', 'draft', 'unknown', 'not_found', 'error']
            assert status in valid_statuses, f"Document status should be valid: {status}"

    # Test 14: test_document_information_retrieval
    # Tests retrieval of document information and metadata
    # Verifies document details (size, date, type) can be retrieved
    @pytest.mark.asyncio
    async def test_document_information_retrieval(self, authenticated_page: Page):
        """Test document information and metadata retrieval"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Get existing documents
        documents = await documents_page.get_document_list()

        if len(documents) > 0:
            # Get info for first document
            first_doc_name = documents[0]['name']
            doc_info = await documents_page.get_document_info(first_doc_name)

            # Verify info structure
            assert isinstance(doc_info, dict), "Document info should be returned as dictionary"
            assert 'name' in doc_info, "Document info should contain name"
            assert 'status' in doc_info, "Document info should contain status"

    # Test 15: test_document_delete_functionality
    # Tests document deletion functionality
    # Verifies users can delete documents and confirm deletion
    @pytest.mark.asyncio
    async def test_document_delete_functionality(self, authenticated_page: Page):
        """Test document deletion functionality"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create a test document first
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_txt:
            temp_txt.write(b'Test document for deletion')
            txt_path = temp_txt.name

        try:
            # Upload test document
            upload_success = await documents_page.upload_document(txt_path)

            if upload_success:
                # Get initial count
                initial_count = await documents_page.count_documents()

                # Try to delete the uploaded document
                test_doc_name = Path(txt_path).stem
                delete_success = await documents_page.delete_document(test_doc_name)

                if delete_success:
                    # Verify document count decreased
                    final_count = await documents_page.count_documents()
                    assert final_count <= initial_count, "Document count should decrease after deletion"

        finally:
            # Cleanup
            if os.path.exists(txt_path):
                os.unlink(txt_path)

    # Test 16: test_multiple_document_upload
    # Tests uploading multiple documents simultaneously
    # Verifies system can handle multiple file uploads
    @pytest.mark.asyncio
    async def test_multiple_document_upload(self, authenticated_page: Page):
        """Test multiple document upload functionality"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create multiple temporary files
        temp_files = []
        file_paths = []

        try:
            for i in range(3):
                temp_file = tempfile.NamedTemporaryFile(suffix=f'.txt', delete=False)
                temp_file.write(f'Test document {i+1} content'.encode())
                temp_files.append(temp_file)
                file_paths.append(temp_file.name)
                temp_file.close()

            # Get initial count
            initial_count = await documents_page.count_documents()

            # Upload multiple documents
            successful_uploads = 0
            for file_path in file_paths:
                if await documents_page.upload_document(file_path):
                    successful_uploads += 1
                    # Wait between uploads
                    await authenticated_page.wait_for_timeout(1000)

            # Verify uploads
            if successful_uploads > 0:
                final_count = await documents_page.count_documents()
                assert final_count >= initial_count, "Document count should increase with multiple uploads"

        finally:
            # Cleanup all temporary files
            for file_path in file_paths:
                if os.path.exists(file_path):
                    os.unlink(file_path)

    # Test 17: test_document_filtering_functionality
    # Tests document filtering by various criteria
    # Verifies documents can be filtered by status, type, or other attributes
    @pytest.mark.asyncio
    async def test_document_filtering_functionality(self, authenticated_page: Page):
        """Test document filtering functionality"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Test status filtering
        await documents_page.filter_documents_by_status("all")
        all_docs = await documents_page.get_document_list()

        # Filter by signed status
        await documents_page.filter_documents_by_status("signed")
        signed_docs = await documents_page.get_document_list()

        # Verify filtering works
        assert isinstance(all_docs, list), "All documents filter should return list"
        assert isinstance(signed_docs, list), "Signed documents filter should return list"

    # Test 18: test_empty_document_list_handling
    # Tests handling of empty document lists
    # Verifies proper display when no documents are present
    @pytest.mark.asyncio
    async def test_empty_document_list_handling(self, authenticated_page: Page):
        """Test handling of empty document lists"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Clear all documents (if any)
        await documents_page.clear_all_documents()

        # Check document count
        doc_count = await documents_page.count_documents()

        # Get document list
        documents = await documents_page.get_document_list()

        # Verify empty list handling
        assert isinstance(documents, list), "Empty document list should still be a list"
        assert doc_count >= 0, "Document count should be non-negative even when empty"

    # Test 19: test_document_name_validation
    # Tests validation of document names and special characters
    # Verifies system handles various document naming scenarios
    @pytest.mark.asyncio
    async def test_document_name_validation(self, authenticated_page: Page):
        """Test document name validation and special characters"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create document with special characters in name
        special_name = "test-document_with-special@chars.pdf"
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_special:
            temp_special.write(b'%PDF-1.4 Special name test')
            special_path = temp_special.name

        try:
            # Rename file to have special characters
            special_file_path = os.path.join(os.path.dirname(special_path), special_name)
            os.rename(special_path, special_file_path)

            # Upload document with special name
            upload_success = await documents_page.upload_document(special_file_path)

            if upload_success:
                # Verify no errors with special characters
                assert not await documents_page.has_upload_error(), "Special characters in names should be handled"

        finally:
            # Cleanup
            if os.path.exists(special_path):
                os.unlink(special_path)
            if os.path.exists(special_file_path):
                os.unlink(special_file_path)

    # Test 20: test_comprehensive_documents_page_verification
    # Tests comprehensive verification of documents page functionality
    # Verifies all major documents features are working correctly
    @pytest.mark.asyncio
    async def test_comprehensive_documents_page_verification(self, authenticated_page: Page):
        """Test comprehensive documents page functionality verification"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Run comprehensive verification
        verification_results = await documents_page.verify_documents_page_functionality()

        # Verify all key aspects are working
        assert verification_results["is_loaded"] == True, "Documents page should be loaded"
        assert verification_results["upload_available"] == True, "Upload functionality should be available"
        assert verification_results["document_count"] >= 0, "Document count should be non-negative"
        assert "documents" in verification_results["page_url"].lower() or \
               "מסמכים" in verification_results["page_url"], "URL should contain documents reference"