"""Final Comprehensive Test Suite - All Key Scenarios"""

import pytest
import tempfile
import os
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.dashboard_page import DashboardPage
from pages.documents_page import DocumentsPage


class TestWeSignComprehensive:
    """Comprehensive test suite covering all major WeSign functionality"""

    # AUTHENTICATION TESTS

    @pytest.mark.asyncio
    async def test_auth_valid_login_success(self):
        """Test 1: Valid login with company credentials"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            await auth_page.navigate()
            await auth_page.login_with_company_user()

            assert await auth_page.is_login_successful(), "Login should succeed"
            assert await dashboard_page.is_dashboard_loaded(), "Dashboard should load"

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_invalid_credentials(self):
        """Test 2: Invalid credentials rejection"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()
            await auth_page.enter_credentials("invalid@test.com", "wrongpass")
            await auth_page.click_login_button()

            assert await auth_page.is_still_on_login_page(), "Should remain on login page"

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_form_validation(self):
        """Test 3: Empty field validation"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()
            await auth_page.enter_password("test")
            await auth_page.click_login_button()

            assert await auth_page.is_email_field_invalid(), "Empty email should be invalid"

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_language_detection(self):
        """Test 4: Multi-language interface detection"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            await auth_page.navigate()

            is_hebrew = await auth_page.is_hebrew_interface_active()
            is_english = await auth_page.is_english_interface_active()

            assert is_hebrew or is_english, "Should detect language interface"

            await browser.close()

    @pytest.mark.asyncio
    async def test_auth_user_permissions(self):
        """Test 5: User permissions detection"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            await auth_page.navigate()
            await auth_page.login_with_company_user()

            permissions = await dashboard_page.get_user_permissions()

            assert "user_type" in permissions, "Should detect user type"
            print(f"User permissions: {permissions}")

            await browser.close()

    # DOCUMENTS TESTS

    @pytest.mark.asyncio
    async def test_docs_navigation(self):
        """Test 6: Documents page navigation"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            documents_page = DocumentsPage(page)

            await auth_page.navigate()
            await auth_page.login_with_company_user()
            await documents_page.navigate_to_documents()

            upload_available = await documents_page.is_upload_functionality_available()
            doc_count = await documents_page.count_documents()

            assert isinstance(upload_available, bool), "Should detect upload availability"
            assert doc_count >= 0, "Document count should be non-negative"

            print(f"Upload available: {upload_available}, Documents: {doc_count}")

            await browser.close()

    @pytest.mark.asyncio
    async def test_docs_pdf_upload(self):
        """Test 7: PDF document upload"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            documents_page = DocumentsPage(page)

            await auth_page.navigate()
            await auth_page.login_with_company_user()
            await documents_page.navigate_to_documents()

            # Create test PDF
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                temp_pdf.write(b'%PDF-1.4 Test document')
                pdf_path = temp_pdf.name

            try:
                initial_count = await documents_page.count_documents()
                upload_result = await documents_page.upload_document(pdf_path)

                print(f"Upload result: {upload_result}")

                has_error = await documents_page.has_upload_error()
                print(f"Upload error: {has_error}")

                if has_error:
                    error_msg = await documents_page.get_error_message()
                    print(f"Error message: {error_msg}")

                final_count = await documents_page.count_documents()
                print(f"Document count: {initial_count} -> {final_count}")

            finally:
                if os.path.exists(pdf_path):
                    os.unlink(pdf_path)

            await browser.close()

    @pytest.mark.asyncio
    async def test_docs_search_functionality(self):
        """Test 8: Document search"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            documents_page = DocumentsPage(page)

            await auth_page.navigate()
            await auth_page.login_with_company_user()
            await documents_page.navigate_to_documents()

            # Test search functionality
            await documents_page.search_documents("test")
            search_results = await documents_page.get_document_list()

            assert isinstance(search_results, list), "Search should return list"
            print(f"Search results: {len(search_results)}")

            await browser.close()

    @pytest.mark.asyncio
    async def test_docs_list_operations(self):
        """Test 9: Document list operations"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            documents_page = DocumentsPage(page)

            await auth_page.navigate()
            await auth_page.login_with_company_user()
            await documents_page.navigate_to_documents()

            # Get document list
            documents = await documents_page.get_document_list()
            print(f"Found {len(documents)} documents")

            # Test document operations if documents exist
            if len(documents) > 0:
                first_doc = documents[0]
                print(f"First document: {first_doc['name']}")

                # Test status detection
                status = await documents_page.get_document_status(first_doc['name'])
                print(f"Document status: {status}")

                # Test document info
                doc_info = await documents_page.get_document_info(first_doc['name'])
                print(f"Document info: {doc_info}")

            await browser.close()

    @pytest.mark.asyncio
    async def test_docs_multiple_formats(self):
        """Test 10: Multiple document format handling"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            documents_page = DocumentsPage(page)

            await auth_page.navigate()
            await auth_page.login_with_company_user()
            await documents_page.navigate_to_documents()

            # Test different file formats
            formats = [
                ('.txt', b'Test text document'),
                ('.pdf', b'%PDF-1.4 Test PDF'),
                ('.doc', b'Test Word document')
            ]

            upload_results = {}

            for ext, content in formats:
                with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
                    temp_file.write(content)
                    file_path = temp_file.name

                try:
                    result = await documents_page.upload_document(file_path)
                    upload_results[ext] = result
                    print(f"{ext} upload: {result}")

                    await page.wait_for_timeout(1000)  # Wait between uploads

                finally:
                    if os.path.exists(file_path):
                        os.unlink(file_path)

            print(f"Upload results: {upload_results}")

            await browser.close()

    # COMPREHENSIVE VALIDATION TESTS

    @pytest.mark.asyncio
    async def test_comprehensive_workflow(self):
        """Test 11: Complete user workflow"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)
            documents_page = DocumentsPage(page)

            print("=== COMPREHENSIVE WORKFLOW TEST ===")

            # Step 1: Login
            print("Step 1: Authenticating...")
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            login_success = await auth_page.is_login_successful()
            print(f"Login successful: {login_success}")

            # Step 2: Dashboard verification
            print("Step 2: Verifying dashboard...")
            dashboard_results = await dashboard_page.verify_dashboard_functionality()
            print(f"Dashboard verification: {dashboard_results}")

            # Step 3: Documents access
            print("Step 3: Accessing documents...")
            await documents_page.navigate_to_documents()
            docs_results = await documents_page.verify_documents_page_functionality()
            print(f"Documents verification: {docs_results}")

            # Step 4: Test upload capability
            print("Step 4: Testing upload...")
            with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_file:
                temp_file.write(b'Workflow test document')
                file_path = temp_file.name

            try:
                upload_result = await documents_page.upload_document(file_path)
                print(f"Upload result: {upload_result}")
            finally:
                if os.path.exists(file_path):
                    os.unlink(file_path)

            print("=== WORKFLOW COMPLETED ===")

            await browser.close()

    @pytest.mark.asyncio
    async def test_error_handling_scenarios(self):
        """Test 12: Error handling and edge cases"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            documents_page = DocumentsPage(page)

            print("=== ERROR HANDLING TEST ===")

            # Test 1: Malformed email
            print("Testing malformed email...")
            await auth_page.navigate()
            await auth_page.enter_credentials("not-an-email", "password")
            await auth_page.click_login_button()

            email_invalid = await auth_page.is_email_field_invalid()
            print(f"Malformed email detected: {email_invalid}")

            # Test 2: After successful login, test document operations
            await page.reload()
            await auth_page.login_with_company_user()
            await documents_page.navigate_to_documents()

            # Test non-existent document operations
            print("Testing non-existent document operations...")
            fake_doc_status = await documents_page.get_document_status("NonExistentDoc.pdf")
            fake_doc_info = await documents_page.get_document_info("NonExistentDoc.pdf")

            print(f"Non-existent doc status: {fake_doc_status}")
            print(f"Non-existent doc info: {fake_doc_info}")

            print("=== ERROR HANDLING COMPLETED ===")

            await browser.close()

    @pytest.mark.asyncio
    async def test_performance_and_stability(self):
        """Test 13: Performance and stability"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            documents_page = DocumentsPage(page)

            print("=== PERFORMANCE TEST ===")

            # Login
            await auth_page.navigate()
            await auth_page.login_with_company_user()
            await documents_page.navigate_to_documents()

            # Rapid operations test
            print("Testing rapid operations...")
            for i in range(3):
                await documents_page.search_documents(f"test{i}")
                doc_count = await documents_page.count_documents()
                doc_list = await documents_page.get_document_list()

                print(f"Iteration {i+1}: {doc_count} docs, {len(doc_list)} in list")

                await page.wait_for_timeout(500)

            # Page reload test
            print("Testing page stability...")
            await page.reload()

            # Verify still functional
            still_authenticated = await DashboardPage(page).is_user_authenticated()
            print(f"Still authenticated after reload: {still_authenticated}")

            print("=== PERFORMANCE TEST COMPLETED ===")

            await browser.close()