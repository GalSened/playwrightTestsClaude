"""Simplified documents test using Page Object Models"""

import pytest
import tempfile
import os
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.documents_page import DocumentsPage


@pytest.mark.asyncio
async def test_documents_navigation():
    """Test navigation to documents page"""
    async with async_playwright() as p:
        try:
            print("Testing documents navigation...")

            browser = await p.chromium.launch(
                headless=True,
                timeout=15000,
                args=['--no-sandbox', '--disable-dev-shm-usage']
            )

            context = await browser.new_context()
            page = await context.new_page()

            # First login
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            # Navigate to documents
            documents_page = DocumentsPage(page)
            await documents_page.navigate_to_documents()

            # Check if documents page loaded
            docs_loaded = await documents_page.is_documents_page_loaded()
            print(f"Documents page loaded: {docs_loaded}")

            # Check upload availability
            upload_available = await documents_page.is_upload_functionality_available()
            print(f"Upload functionality available: {upload_available}")

            # Count documents
            doc_count = await documents_page.count_documents()
            print(f"Current document count: {doc_count}")

            # Get document list
            documents = await documents_page.get_document_list()
            print(f"Documents found: {len(documents)}")

            for doc in documents[:3]:  # Show first 3
                print(f"  - {doc['name']}")

            print(f"Current URL: {page.url}")

            await browser.close()
            print("Documents navigation test completed successfully!")

        except Exception as e:
            print(f"Documents navigation test failed: {e}")
            raise


@pytest.mark.asyncio
async def test_document_upload():
    """Test document upload functionality"""
    async with async_playwright() as p:
        try:
            print("Testing document upload...")

            browser = await p.chromium.launch(
                headless=True,
                timeout=15000,
                args=['--no-sandbox', '--disable-dev-shm-usage']
            )

            context = await browser.new_context()
            page = await context.new_page()

            # Login and navigate to documents
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            documents_page = DocumentsPage(page)
            await documents_page.navigate_to_documents()

            # Create a test PDF file
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                temp_pdf.write(b'%PDF-1.4 Test document for upload')
                pdf_path = temp_pdf.name

            try:
                # Get initial document count
                initial_count = await documents_page.count_documents()
                print(f"Initial document count: {initial_count}")

                # Try to upload
                print("Attempting document upload...")
                upload_success = await documents_page.upload_document(pdf_path)
                print(f"Upload attempt result: {upload_success}")

                # Check for errors
                has_error = await documents_page.has_upload_error()
                has_success = await documents_page.has_upload_success()

                print(f"Has upload error: {has_error}")
                print(f"Has success message: {has_success}")

                if has_error:
                    error_msg = await documents_page.get_error_message()
                    print(f"Error message: {error_msg}")

                if has_success:
                    success_msg = await documents_page.get_success_message()
                    print(f"Success message: {success_msg}")

                # Check final count
                final_count = await documents_page.count_documents()
                print(f"Final document count: {final_count}")

                if final_count > initial_count:
                    print("SUCCESS: Document count increased - upload likely successful!")
                elif upload_success and not has_error:
                    print("INFO: Upload reported success but count unchanged")
                else:
                    print("INFO: Upload may not have completed successfully")

            finally:
                # Cleanup
                if os.path.exists(pdf_path):
                    os.unlink(pdf_path)

            await browser.close()
            print("Document upload test completed!")

        except Exception as e:
            print(f"Document upload test failed: {e}")
            raise


@pytest.mark.asyncio
async def test_document_search():
    """Test document search functionality"""
    async with async_playwright() as p:
        try:
            print("Testing document search...")

            browser = await p.chromium.launch(
                headless=True,
                timeout=15000,
                args=['--no-sandbox', '--disable-dev-shm-usage']
            )

            context = await browser.new_context()
            page = await context.new_page()

            # Login and navigate to documents
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            documents_page = DocumentsPage(page)
            await documents_page.navigate_to_documents()

            # Get initial document list
            initial_docs = await documents_page.get_document_list()
            print(f"Initial documents: {len(initial_docs)}")

            # Perform search
            search_term = "test"
            print(f"Searching for: '{search_term}'")
            await documents_page.search_documents(search_term)

            # Get search results
            search_results = await documents_page.get_document_list()
            print(f"Search results: {len(search_results)}")

            # Test empty search (reset)
            await documents_page.search_documents("")
            reset_results = await documents_page.get_document_list()
            print(f"After reset: {len(reset_results)}")

            await browser.close()
            print("Document search test completed!")

        except Exception as e:
            print(f"Document search test failed: {e}")
            raise