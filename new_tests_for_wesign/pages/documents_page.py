"""
Documents Page Object Model - Written from Scratch
Comprehensive POM for WeSign documents functionality
"""

from playwright.async_api import Page, expect
from .base_page import BasePage
import asyncio
from pathlib import Path


class DocumentsPage(BasePage):
    """Page Object Model for Documents functionality in WeSign platform"""

    def __init__(self, page: Page):
        super().__init__(page)
        self.base_url = "https://devtest.comda.co.il"

        # Documents navigation elements
        self.documents_nav = 'text=מסמכים, a[href*="documents"], text=Documents'
        self.documents_page_title = 'text=מסמכים, text=Documents, h1:has-text("Documents")'

        # Upload functionality
        self.upload_button = 'text=העלאת קובץ, text=Upload File, button:has-text("העלאת קובץ"), input[type="file"], [data-action="upload"]'
        self.file_input = 'input[type="file"]'
        self.upload_submit = 'text=העלה, text=Upload, button:has-text("Upload"), input[type="submit"]'

        # Document list elements
        self.document_list = '.documents-list, .document-grid, [data-component="documents-list"]'
        self.document_items = '.document-item, .document-card, [data-item="document"]'
        self.document_names = '.document-name, .document-title, [data-field="name"]'

        # Document actions
        self.download_button = 'text=הורד, text=Download, [data-action="download"], .download-btn'
        self.delete_button = 'text=מחק, text=Delete, [data-action="delete"], .delete-btn'
        self.view_button = 'text=הצג, text=View, [data-action="view"], .view-btn'
        self.sign_button = 'text=חתום, text=Sign, [data-action="sign"], .sign-btn'

        # Document status indicators
        self.status_signed = 'text=חתום, text=Signed, .status-signed'
        self.status_pending = 'text=ממתין, text=Pending, .status-pending'
        self.status_draft = 'text=טיוטה, text=Draft, .status-draft'

        # Document filters and search
        self.search_input = 'input[placeholder*="חפש"], input[placeholder*="Search"], [data-field="search"]'
        self.filter_dropdown = '.filter-dropdown, select[name*="filter"], [data-component="filter"]'
        self.status_filter = '.status-filter, select[name*="status"]'

        # Document details and info
        self.document_info = '.document-info, .document-details, [data-component="document-info"]'
        self.document_size = '.document-size, [data-field="size"]'
        self.document_date = '.document-date, [data-field="date"]'
        self.document_type = '.document-type, [data-field="type"]'

        # Error messages
        self.error_message = '.error, .alert-error, [role="alert"], .validation-error'
        self.success_message = '.success, .alert-success, .notification-success'

        # Supported file types
        self.supported_formats = {
            'pdf': '.pdf',
            'doc': '.doc',
            'docx': '.docx',
            'xls': '.xls',
            'xlsx': '.xlsx',
            'txt': '.txt',
            'jpg': '.jpg',
            'png': '.png'
        }

    async def navigate_to_documents(self) -> None:
        """Navigate to documents page"""
        try:
            await self.page.goto(f"{self.base_url}/dashboard/documents")
            await self.page.wait_for_load_state("domcontentloaded")
        except:
            # Alternative: click navigation link
            docs_nav = self.page.locator(self.documents_nav).first
            if await docs_nav.is_visible():
                await docs_nav.click()
                await self.page.wait_for_load_state("domcontentloaded")

    async def is_documents_page_loaded(self) -> bool:
        """Check if documents page has loaded successfully"""
        try:
            # Check URL contains documents
            url_check = "documents" in self.page.url

            # Check for upload functionality (key feature of documents page)
            upload_available = await self.page.locator(self.file_input).count() > 0

            return url_check or upload_available
        except Exception as e:
            print(f"Error checking documents page load: {e}")
            return False

    async def is_upload_functionality_available(self) -> bool:
        """Check if document upload functionality is available"""
        try:
            upload_btn = await self.page.locator(self.upload_button).count() > 0
            file_input = await self.page.locator(self.file_input).count() > 0

            return upload_btn or file_input

        except:
            return False

    async def upload_document(self, file_path: str) -> bool:
        """Upload a document file"""
        try:
            # Check if file exists
            if not Path(file_path).exists():
                return False

            # Find and use file input
            file_input = self.page.locator(self.file_input).first
            if await file_input.count() > 0:
                await file_input.set_input_files(file_path)
            else:
                # Alternative: click upload button first
                upload_btn = self.page.locator(self.upload_button).first
                await upload_btn.click()
                await self.page.wait_for_timeout(1000)

                file_input = self.page.locator(self.file_input).first
                await file_input.set_input_files(file_path)

            # Submit upload if submit button exists
            submit_btn = self.page.locator(self.upload_submit).first
            if await submit_btn.count() > 0 and await submit_btn.is_visible():
                await submit_btn.click()

            # Wait for upload to complete
            await self.page.wait_for_timeout(3000)
            return True

        except Exception as e:
            print(f"Upload failed: {e}")
            return False

    async def get_document_list(self) -> list:
        """Get list of documents on the page"""
        try:
            # Wait for documents to load
            await self.page.wait_for_timeout(2000)

            documents = []
            document_items = self.page.locator(self.document_items)
            count = await document_items.count()

            for i in range(count):
                item = document_items.nth(i)

                # Get document name
                name_element = item.locator(self.document_names).first
                name = await name_element.text_content() if await name_element.count() > 0 else f"Document {i+1}"

                documents.append({
                    'index': i,
                    'name': name.strip() if name else f"Document {i+1}",
                    'element': item
                })

            return documents

        except:
            return []

    async def search_documents(self, search_term: str) -> None:
        """Search for documents using search functionality"""
        try:
            search_input = self.page.locator(self.search_input).first
            if await search_input.count() > 0 and await search_input.is_visible():
                await search_input.fill(search_term)
                await self.page.keyboard.press("Enter")
                await self.page.wait_for_timeout(2000)

        except:
            pass

    async def download_document(self, document_name: str) -> bool:
        """Download a specific document"""
        try:
            documents = await self.get_document_list()

            for doc in documents:
                if document_name.lower() in doc['name'].lower():
                    # Find download button within document item
                    download_btn = doc['element'].locator(self.download_button).first

                    if await download_btn.count() > 0 and await download_btn.is_visible():
                        await download_btn.click()
                        await self.page.wait_for_timeout(2000)
                        return True

            return False

        except:
            return False

    async def delete_document(self, document_name: str) -> bool:
        """Delete a specific document"""
        try:
            documents = await self.get_document_list()

            for doc in documents:
                if document_name.lower() in doc['name'].lower():
                    # Find delete button within document item
                    delete_btn = doc['element'].locator(self.delete_button).first

                    if await delete_btn.count() > 0 and await delete_btn.is_visible():
                        await delete_btn.click()

                        # Handle confirmation dialog
                        await self.page.wait_for_timeout(1000)

                        # Look for confirmation button
                        confirm_selectors = [
                            'text=אישור, text=Confirm, text=Yes, text=כן',
                            'button:has-text("אישור"), button:has-text("Confirm")'
                        ]

                        for selector in confirm_selectors:
                            confirm_btn = self.page.locator(selector).first
                            if await confirm_btn.count() > 0 and await confirm_btn.is_visible():
                                await confirm_btn.click()
                                break

                        await self.page.wait_for_timeout(2000)
                        return True

            return False

        except:
            return False

    async def view_document(self, document_name: str) -> bool:
        """View/open a specific document"""
        try:
            documents = await self.get_document_list()

            for doc in documents:
                if document_name.lower() in doc['name'].lower():
                    # Try clicking document name first
                    name_element = doc['element'].locator(self.document_names).first
                    if await name_element.count() > 0:
                        await name_element.click()
                        await self.page.wait_for_timeout(2000)
                        return True

                    # Alternative: find view button
                    view_btn = doc['element'].locator(self.view_button).first
                    if await view_btn.count() > 0 and await view_btn.is_visible():
                        await view_btn.click()
                        await self.page.wait_for_timeout(2000)
                        return True

            return False

        except:
            return False

    async def get_document_status(self, document_name: str) -> str:
        """Get the status of a specific document"""
        try:
            documents = await self.get_document_list()

            for doc in documents:
                if document_name.lower() in doc['name'].lower():
                    # Check for status indicators
                    if await doc['element'].locator(self.status_signed).count() > 0:
                        return "signed"
                    elif await doc['element'].locator(self.status_pending).count() > 0:
                        return "pending"
                    elif await doc['element'].locator(self.status_draft).count() > 0:
                        return "draft"
                    else:
                        return "unknown"

            return "not_found"

        except:
            return "error"

    async def has_upload_error(self) -> bool:
        """Check if there's an upload error message"""
        try:
            error_visible = await self.page.locator(self.error_message).count() > 0
            return error_visible

        except:
            return False

    async def has_upload_success(self) -> bool:
        """Check if there's an upload success message"""
        try:
            success_visible = await self.page.locator(self.success_message).count() > 0
            return success_visible

        except:
            return False

    async def get_error_message(self) -> str:
        """Get the current error message text"""
        try:
            error_element = self.page.locator(self.error_message).first
            if await error_element.count() > 0:
                return await error_element.text_content() or ""
            return ""

        except:
            return ""

    async def get_success_message(self) -> str:
        """Get the current success message text"""
        try:
            success_element = self.page.locator(self.success_message).first
            if await success_element.count() > 0:
                return await success_element.text_content() or ""
            return ""

        except:
            return ""

    async def count_documents(self) -> int:
        """Count total number of documents on the page"""
        try:
            await self.page.wait_for_timeout(2000)
            document_items = self.page.locator(self.document_items)
            return await document_items.count()

        except:
            return 0

    async def is_document_present(self, document_name: str) -> bool:
        """Check if a specific document is present in the list"""
        try:
            documents = await self.get_document_list()

            for doc in documents:
                if document_name.lower() in doc['name'].lower():
                    return True

            return False

        except:
            return False

    async def filter_documents_by_status(self, status: str) -> None:
        """Filter documents by status"""
        try:
            status_filter = self.page.locator(self.status_filter).first
            if await status_filter.count() > 0 and await status_filter.is_visible():
                await status_filter.select_option(value=status)
                await self.page.wait_for_timeout(2000)

        except:
            pass

    async def get_document_info(self, document_name: str) -> dict:
        """Get detailed information about a specific document"""
        try:
            documents = await self.get_document_list()

            for doc in documents:
                if document_name.lower() in doc['name'].lower():
                    info = {
                        'name': doc['name'],
                        'status': await self.get_document_status(document_name),
                        'size': '',
                        'date': '',
                        'type': ''
                    }

                    # Get size if available
                    size_element = doc['element'].locator(self.document_size).first
                    if await size_element.count() > 0:
                        info['size'] = await size_element.text_content() or ''

                    # Get date if available
                    date_element = doc['element'].locator(self.document_date).first
                    if await date_element.count() > 0:
                        info['date'] = await date_element.text_content() or ''

                    # Get type if available
                    type_element = doc['element'].locator(self.document_type).first
                    if await type_element.count() > 0:
                        info['type'] = await type_element.text_content() or ''

                    return info

            return {'error': 'Document not found'}

        except:
            return {'error': 'Failed to get document info'}

    async def clear_all_documents(self) -> bool:
        """Clear/delete all documents (for cleanup)"""
        try:
            documents = await self.get_document_list()
            deleted_count = 0

            for doc in documents:
                if await self.delete_document(doc['name']):
                    deleted_count += 1
                    await self.page.wait_for_timeout(1000)

            return deleted_count > 0

        except:
            return False

    async def verify_documents_page_functionality(self) -> dict:
        """Comprehensive verification of documents page functionality"""
        verification_results = {
            "is_loaded": await self.is_documents_page_loaded(),
            "upload_available": await self.is_upload_functionality_available(),
            "document_count": await self.count_documents(),
            "has_errors": await self.has_upload_error(),
            "page_url": self.page.url
        }

        return verification_results