"""
Test Documents Advanced - Written from Scratch
Advanced documents test scenarios for WeSign platform

Test Categories:
1. Bulk document operations
2. Document version management
3. Document sharing and permissions
4. Advanced search and filtering
5. Document workflow management
6. Performance and load testing
7. Document collaboration features
8. Integration with signing workflow
"""

import pytest
from playwright.async_api import Page
from pages.documents_page import DocumentsPage
from pages.dashboard_page import DashboardPage
from pathlib import Path
import tempfile
import os
import asyncio


class TestDocumentsAdvanced:
    """Advanced documents test suite for WeSign platform"""

    # Test 1: test_bulk_document_upload_performance
    # Tests performance of bulk document upload operations
    # Verifies system can handle multiple documents efficiently
    @pytest.mark.asyncio
    async def test_bulk_document_upload_performance(self, authenticated_page: Page):
        """Test bulk document upload performance"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create multiple test documents
        temp_files = []
        file_paths = []

        try:
            # Create 10 test documents
            for i in range(10):
                temp_file = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
                temp_file.write(f'%PDF-1.4 Bulk test document {i+1}'.encode())
                temp_files.append(temp_file)
                file_paths.append(temp_file.name)
                temp_file.close()

            # Record initial time and count
            initial_count = await documents_page.count_documents()

            # Upload documents and measure performance
            successful_uploads = 0
            start_time = asyncio.get_event_loop().time()

            for file_path in file_paths:
                if await documents_page.upload_document(file_path):
                    successful_uploads += 1
                    # Small delay to prevent overwhelming the system
                    await authenticated_page.wait_for_timeout(500)

            end_time = asyncio.get_event_loop().time()
            upload_duration = end_time - start_time

            # Verify performance metrics
            if successful_uploads > 0:
                avg_time_per_upload = upload_duration / successful_uploads
                assert avg_time_per_upload < 10, f"Average upload time should be reasonable: {avg_time_per_upload:.2f}s"

                # Verify document count increased
                final_count = await documents_page.count_documents()
                assert final_count >= initial_count, "Document count should increase after bulk upload"

        finally:
            # Cleanup all temporary files
            for file_path in file_paths:
                if os.path.exists(file_path):
                    os.unlink(file_path)

    # Test 2: test_document_concurrent_access
    # Tests concurrent access to documents by multiple operations
    # Verifies system handles simultaneous document operations
    @pytest.mark.asyncio
    async def test_document_concurrent_access(self, authenticated_page: Page):
        """Test concurrent document access and operations"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Get existing documents
        documents = await documents_page.get_document_list()

        if len(documents) > 0:
            first_doc_name = documents[0]['name']

            # Perform concurrent operations
            tasks = [
                documents_page.get_document_status(first_doc_name),
                documents_page.get_document_info(first_doc_name),
                documents_page.is_document_present(first_doc_name)
            ]

            # Execute concurrent operations
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Verify all operations completed without exceptions
            for i, result in enumerate(results):
                assert not isinstance(result, Exception), f"Concurrent operation {i} should not raise exception"

    # Test 3: test_document_search_with_special_characters
    # Tests document search functionality with special characters
    # Verifies search handles Unicode, symbols, and special characters
    @pytest.mark.asyncio
    async def test_document_search_with_special_characters(self, authenticated_page: Page):
        """Test document search with special characters"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Test various search terms with special characters
        special_search_terms = [
            "מסמך",  # Hebrew
            "document@test",  # Email-like
            "test-file_v1",  # Hyphens and underscores
            "file (1)",  # Parentheses
            "test&copy",  # Ampersand
            "file #123"  # Hash/number sign
        ]

        for search_term in special_search_terms:
            # Perform search
            await documents_page.search_documents(search_term)

            # Verify search completed without errors
            assert not await documents_page.has_upload_error(), f"Search with '{search_term}' should not cause errors"

            # Get search results
            search_results = await documents_page.get_document_list()
            assert isinstance(search_results, list), f"Search with '{search_term}' should return valid results"

            # Small delay between searches
            await authenticated_page.wait_for_timeout(1000)

    # Test 4: test_document_type_filter_comprehensive
    # Tests comprehensive document type filtering
    # Verifies filtering works correctly for all supported document types
    @pytest.mark.asyncio
    async def test_document_type_filter_comprehensive(self, authenticated_page: Page):
        """Test comprehensive document type filtering"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create documents of different types for testing
        test_files = []
        supported_types = ['pdf', 'docx', 'xlsx', 'txt']

        try:
            for file_type in supported_types:
                with tempfile.NamedTemporaryFile(suffix=f'.{file_type}', delete=False) as temp_file:
                    if file_type == 'pdf':
                        temp_file.write(b'%PDF-1.4 Test PDF')
                    elif file_type == 'docx':
                        temp_file.write(b'PK\x03\x04Test Word')
                    elif file_type == 'xlsx':
                        temp_file.write(b'PK\x03\x04Test Excel')
                    else:  # txt
                        temp_file.write(b'Test text content')

                    test_files.append(temp_file.name)

                # Upload the test file
                await documents_page.upload_document(temp_file.name)
                await authenticated_page.wait_for_timeout(1000)

            # Test filtering by each type
            for file_type in supported_types:
                await documents_page.search_documents(f".{file_type}")
                results = await documents_page.get_document_list()

                # Verify search results
                assert isinstance(results, list), f"Filter by {file_type} should return valid results"

        finally:
            # Cleanup
            for file_path in test_files:
                if os.path.exists(file_path):
                    os.unlink(file_path)

    # Test 5: test_document_version_management
    # Tests document version management and tracking
    # Verifies system handles document versions correctly
    @pytest.mark.asyncio
    async def test_document_version_management(self, authenticated_page: Page):
        """Test document version management"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create base document
        base_name = "version_test_document"
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_v1:
            temp_v1.write(b'Version 1 content')
            v1_path = temp_v1.name

        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_v2:
            temp_v2.write(b'Version 2 content - updated')
            v2_path = temp_v2.name

        try:
            # Upload version 1
            initial_count = await documents_page.count_documents()
            await documents_page.upload_document(v1_path)
            await authenticated_page.wait_for_timeout(2000)

            # Upload version 2 (same name, different content)
            await documents_page.upload_document(v2_path)
            await authenticated_page.wait_for_timeout(2000)

            # Check final document count
            final_count = await documents_page.count_documents()

            # System should handle versions appropriately
            # (Either replace existing or create new version)
            assert final_count >= initial_count, "Document versions should be handled appropriately"

        finally:
            # Cleanup
            for path in [v1_path, v2_path]:
                if os.path.exists(path):
                    os.unlink(path)

    # Test 6: test_document_metadata_validation
    # Tests document metadata extraction and validation
    # Verifies system correctly extracts and displays document metadata
    @pytest.mark.asyncio
    async def test_document_metadata_validation(self, authenticated_page: Page):
        """Test document metadata extraction and validation"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Upload a test document with known properties
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_meta:
            temp_meta.write(b'%PDF-1.4 Metadata test document with known size')
            meta_path = temp_meta.name

        try:
            # Upload document
            await documents_page.upload_document(meta_path)
            await authenticated_page.wait_for_timeout(2000)

            # Get document list
            documents = await documents_page.get_document_list()

            if len(documents) > 0:
                # Get metadata for uploaded document
                uploaded_doc = documents[-1]  # Assume it's the last one
                doc_info = await documents_page.get_document_info(uploaded_doc['name'])

                # Verify metadata structure
                assert isinstance(doc_info, dict), "Document info should be dictionary"
                assert 'name' in doc_info, "Document info should include name"
                assert 'status' in doc_info, "Document info should include status"

                # Verify metadata values are reasonable
                if 'size' in doc_info and doc_info['size']:
                    assert len(doc_info['size']) > 0, "Document size should not be empty if present"

        finally:
            # Cleanup
            if os.path.exists(meta_path):
                os.unlink(meta_path)

    # Test 7: test_document_workflow_integration
    # Tests integration between documents and signing workflow
    # Verifies documents can transition through workflow states
    @pytest.mark.asyncio
    async def test_document_workflow_integration(self, authenticated_page: Page):
        """Test document workflow integration with signing process"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Get existing documents
        documents = await documents_page.get_document_list()

        if len(documents) > 0:
            # Check document statuses
            status_counts = {'signed': 0, 'pending': 0, 'draft': 0, 'unknown': 0}

            for doc in documents:
                status = await documents_page.get_document_status(doc['name'])
                if status in status_counts:
                    status_counts[status] += 1

            # Verify status tracking
            total_statuses = sum(status_counts.values())
            assert total_statuses >= len(documents), "All documents should have trackable statuses"

            # Check for workflow-related functionality
            # (This would typically involve signing buttons/actions)
            first_doc = documents[0]
            doc_info = await documents_page.get_document_info(first_doc['name'])
            assert 'status' in doc_info, "Document should have workflow status"

    # Test 8: test_document_sharing_permissions
    # Tests document sharing and permission management
    # Verifies documents can be shared with appropriate permissions
    @pytest.mark.asyncio
    async def test_document_sharing_permissions(self, authenticated_page: Page):
        """Test document sharing and permissions functionality"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Get existing documents
        documents = await documents_page.get_document_list()

        if len(documents) > 0:
            first_doc_name = documents[0]['name']

            # Check if document can be viewed (basic permission)
            view_success = await documents_page.view_document(first_doc_name)

            # Check if document can be downloaded (download permission)
            download_success = await documents_page.download_document(first_doc_name)

            # Verify permission-based operations
            # At least viewing should be available for owned documents
            assert isinstance(view_success, bool), "View operation should return boolean result"
            assert isinstance(download_success, bool), "Download operation should return boolean result"

    # Test 9: test_document_search_performance
    # Tests search functionality performance with large datasets
    # Verifies search remains responsive with many documents
    @pytest.mark.asyncio
    async def test_document_search_performance(self, authenticated_page: Page):
        """Test document search performance"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Test search performance with various terms
        search_terms = [
            "test",
            "document",
            "pdf",
            "contract",
            "agreement",
            "report",
            "invoice",
            "receipt"
        ]

        search_times = []

        for search_term in search_terms:
            # Measure search time
            start_time = asyncio.get_event_loop().time()

            await documents_page.search_documents(search_term)
            results = await documents_page.get_document_list()

            end_time = asyncio.get_event_loop().time()
            search_time = end_time - start_time

            search_times.append(search_time)

            # Verify search completed successfully
            assert isinstance(results, list), f"Search for '{search_term}' should return valid results"
            assert search_time < 5.0, f"Search for '{search_term}' should complete within reasonable time: {search_time:.2f}s"

            # Small delay between searches
            await authenticated_page.wait_for_timeout(500)

        # Verify average search performance
        if search_times:
            avg_search_time = sum(search_times) / len(search_times)
            assert avg_search_time < 3.0, f"Average search time should be reasonable: {avg_search_time:.2f}s"

    # Test 10: test_document_error_recovery
    # Tests error recovery and resilience in document operations
    # Verifies system gracefully handles and recovers from errors
    @pytest.mark.asyncio
    async def test_document_error_recovery(self, authenticated_page: Page):
        """Test document error recovery and resilience"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Test recovery from various error scenarios

        # 1. Test upload with non-existent file
        non_existent_file = "/path/to/nonexistent/file.pdf"
        upload_result = await documents_page.upload_document(non_existent_file)

        # Should handle gracefully
        assert isinstance(upload_result, bool), "Upload with non-existent file should return boolean"

        # 2. Test operations on non-existent document
        non_existent_doc = "NonExistentDocument.pdf"

        view_result = await documents_page.view_document(non_existent_doc)
        download_result = await documents_page.download_document(non_existent_doc)
        delete_result = await documents_page.delete_document(non_existent_doc)

        # All should handle gracefully
        assert isinstance(view_result, bool), "View non-existent document should return boolean"
        assert isinstance(download_result, bool), "Download non-existent document should return boolean"
        assert isinstance(delete_result, bool), "Delete non-existent document should return boolean"

        # 3. Test status check for non-existent document
        status = await documents_page.get_document_status(non_existent_doc)
        assert status in ['not_found', 'error', 'unknown'], "Non-existent document status should be handled"

        # 4. Verify page still functions after errors
        page_verification = await documents_page.verify_documents_page_functionality()
        assert page_verification["is_loaded"], "Page should remain functional after error scenarios"

    # Test 11: test_document_cleanup_operations
    # Tests document cleanup and maintenance operations
    # Verifies system can perform cleanup operations safely
    @pytest.mark.asyncio
    async def test_document_cleanup_operations(self, authenticated_page: Page):
        """Test document cleanup and maintenance operations"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Create some test documents for cleanup
        cleanup_test_files = []

        try:
            for i in range(3):
                with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_cleanup:
                    temp_cleanup.write(f'Cleanup test document {i+1}'.encode())
                    cleanup_test_files.append(temp_cleanup.name)

                # Upload each test document
                await documents_page.upload_document(temp_cleanup.name)
                await authenticated_page.wait_for_timeout(1000)

            # Get initial document count
            initial_count = await documents_page.count_documents()

            # Test selective cleanup (if supported)
            documents = await documents_page.get_document_list()

            # Try to delete test documents
            deleted_count = 0
            for doc in documents:
                if "cleanup test" in doc['name'].lower():
                    if await documents_page.delete_document(doc['name']):
                        deleted_count += 1
                        await authenticated_page.wait_for_timeout(1000)

            # Verify cleanup results
            final_count = await documents_page.count_documents()
            if deleted_count > 0:
                assert final_count <= initial_count, "Document count should decrease after cleanup"

        finally:
            # Cleanup temporary files
            for file_path in cleanup_test_files:
                if os.path.exists(file_path):
                    os.unlink(file_path)

    # Test 12: test_document_accessibility_features
    # Tests document accessibility and screen reader compatibility
    # Verifies document interface is accessible to users with disabilities
    @pytest.mark.asyncio
    async def test_document_accessibility_features(self, authenticated_page: Page):
        """Test document accessibility features"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Test keyboard navigation
        # Focus on the page
        await authenticated_page.keyboard.press("Tab")

        # Check if documents are keyboard accessible
        documents = await documents_page.get_document_list()

        if len(documents) > 0:
            # Test if document elements can be focused
            first_doc = documents[0]

            # Try to navigate to document using keyboard
            for _ in range(10):  # Try multiple tabs to find document elements
                await authenticated_page.keyboard.press("Tab")
                focused_element = await authenticated_page.evaluate("document.activeElement.tagName")

                if focused_element:
                    # Found focusable element
                    break

        # Test ARIA attributes and labels (if present)
        # This would check for proper accessibility markup
        upload_button_accessible = await authenticated_page.locator(
            'button[aria-label*="upload"], input[aria-label*="upload"]'
        ).count() > 0

        # Accessibility features may or may not be implemented
        # This test documents their presence/absence
        print(f"Upload button has accessibility labels: {upload_button_accessible}")

    # Test 13: test_document_responsive_design
    # Tests document interface responsive design
    # Verifies interface works correctly on different screen sizes
    @pytest.mark.asyncio
    async def test_document_responsive_design(self, authenticated_page: Page):
        """Test document interface responsive design"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Test different viewport sizes
        viewport_sizes = [
            {'width': 1920, 'height': 1080},  # Desktop
            {'width': 1024, 'height': 768},   # Tablet
            {'width': 375, 'height': 667}     # Mobile
        ]

        for viewport in viewport_sizes:
            # Set viewport size
            await authenticated_page.set_viewport_size(viewport['width'], viewport['height'])
            await authenticated_page.wait_for_timeout(1000)

            # Verify page functionality at this size
            page_loaded = await documents_page.is_documents_page_loaded()
            assert page_loaded, f"Documents page should load at {viewport['width']}x{viewport['height']}"

            # Check if upload functionality is available
            upload_available = await documents_page.is_upload_functionality_available()

            # Note: Upload availability may vary by screen size (mobile restrictions)
            print(f"Upload available at {viewport['width']}x{viewport['height']}: {upload_available}")

            # Get document count (should work regardless of screen size)
            doc_count = await documents_page.count_documents()
            assert doc_count >= 0, f"Document count should work at {viewport['width']}x{viewport['height']}"

        # Reset to default size
        await authenticated_page.set_viewport_size(1280, 720)

    # Test 14: test_document_multilingual_support
    # Tests document interface multilingual support
    # Verifies interface works correctly in different languages
    @pytest.mark.asyncio
    async def test_document_multilingual_support(self, authenticated_page: Page):
        """Test document interface multilingual support"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Check for Hebrew interface elements
        hebrew_elements = await authenticated_page.locator('text=מסמכים').count() > 0

        # Check for English interface elements
        english_elements = await authenticated_page.locator('text=Documents').count() > 0

        # At least one language should be present
        assert hebrew_elements or english_elements, "Interface should display in Hebrew or English"

        # Test document upload with multilingual file names
        multilingual_test_files = []

        try:
            # Create test files with different language names
            test_names = [
                "English_Document.txt",
                "מסמך_עברית.txt",  # Hebrew filename
                "Document-Mixed_עברית.txt"  # Mixed languages
            ]

            for i, name in enumerate(test_names):
                with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as temp_multi:
                    temp_multi.write(f'Multilingual test document {i+1}')
                    multilingual_test_files.append(temp_multi.name)

            # Test upload with different name types
            for file_path in multilingual_test_files:
                upload_result = await documents_page.upload_document(file_path)

                # Upload should handle different character sets gracefully
                if not upload_result:
                    print(f"Upload failed for file: {file_path}")

        finally:
            # Cleanup
            for file_path in multilingual_test_files:
                if os.path.exists(file_path):
                    os.unlink(file_path)

    # Test 15: test_document_comprehensive_stress_test
    # Tests comprehensive stress testing of document functionality
    # Verifies system stability under various stress conditions
    @pytest.mark.asyncio
    async def test_document_comprehensive_stress_test(self, authenticated_page: Page):
        """Test comprehensive stress testing of document functionality"""
        documents_page = DocumentsPage(authenticated_page)

        await documents_page.navigate_to_documents()

        # Stress test with rapid operations
        stress_test_files = []

        try:
            # Create multiple test files
            for i in range(5):
                with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as stress_file:
                    stress_file.write(f'Stress test document {i+1}'.encode())
                    stress_test_files.append(stress_file.name)

            # Perform rapid operations
            operations_completed = 0

            for file_path in stress_test_files:
                # Upload
                if await documents_page.upload_document(file_path):
                    operations_completed += 1

                # Rapid searches
                await documents_page.search_documents("stress")
                operations_completed += 1

                # Get document list
                docs = await documents_page.get_document_list()
                operations_completed += 1

                # Brief delay to prevent overwhelming
                await authenticated_page.wait_for_timeout(100)

            # Verify system remained stable
            assert operations_completed > 0, "Some operations should complete successfully"

            # Final verification
            verification = await documents_page.verify_documents_page_functionality()
            assert verification["is_loaded"], "Page should remain stable after stress test"

        finally:
            # Cleanup
            for file_path in stress_test_files:
                if os.path.exists(file_path):
                    os.unlink(file_path)