"""
Document Test Data Creator
Creates test documents via Self-Signing workflow for Documents page testing
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright, Page
import sys
import random

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from pages.auth_page import AuthPage

class DocumentTestDataCreator:
    """Utility class to create test documents for Documents page testing"""

    def __init__(self):
        self.base_url = "https://devtest.comda.co.il"
        self.test_pdf = Path(__file__).parent.parent / "test_files" / "sample.pdf"
        self.created_documents = []

    async def create_single_document(self, browser, document_name: str = None) -> dict:
        """
        Create a single test document via Self-Signing workflow
        Returns document info: {name, id, status, url}
        """
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        try:
            # Step 1: Login
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()
            await page.wait_for_timeout(2000)

            # Step 2: Upload PDF
            upload_button = page.locator('button:has-text("העלאת קובץ")').first
            async with page.expect_file_chooser() as fc_info:
                await upload_button.click()
            file_chooser = await fc_info.value
            await file_chooser.set_files(str(self.test_pdf.absolute()))
            await page.wait_for_timeout(2000)

            # Step 3: Select self-sign mode
            await page.locator('button:has-text("חתימה אישית")').first.click()
            await page.wait_for_timeout(2000)

            # Optional: Change document name if provided
            if document_name:
                name_input = page.locator('input[type="text"]').first
                if await name_input.count() > 0 and await name_input.is_visible():
                    await name_input.clear()
                    await name_input.fill(document_name)
                    await page.wait_for_timeout(500)

            # Step 4: Navigate to fields editor
            await page.locator('button:has-text("עריכת מסמך")').first.click()
            await page.wait_for_timeout(3000)

            # Verify we're on the fields page
            if "selfsignfields" not in page.url:
                print(f"❌ Failed to reach selfsignfields page. Current URL: {page.url}")
                return None

            # Step 5: Add a signature field (minimum requirement)
            await page.locator('button:has-text("חתימה")').first.click()
            await page.wait_for_timeout(2000)

            # Step 6: Click the feather icon to open signature modal
            feather_buttons = page.locator('.ct-button--icon.button--field')
            if await feather_buttons.count() > 0:
                await feather_buttons.first.click()
                await page.wait_for_timeout(2000)

                # Step 7: Select first saved signature (if exists)
                saved_sigs = page.locator('sgn-sign-pad button canvas, sgn-sign-pad button img')
                if await saved_sigs.count() > 0:
                    await saved_sigs.first.click()
                else:
                    # Use type button
                    modal_buttons = page.locator('sgn-sign-pad > div > div > button')
                    if await modal_buttons.count() >= 2:
                        await modal_buttons.nth(1).click(force=True)

                await page.wait_for_timeout(2000)

            # Step 8: Click "סיים" (Finish) to complete
            finish_button = page.locator('button:has-text("סיים")').first
            await finish_button.click()
            await page.wait_for_timeout(3000)

            # Step 9: Verify success
            if "success/selfsign" in page.url:
                # Extract document ID from URL if possible
                doc_id = page.url.split('/')[-1] if '/' in page.url else "unknown"

                doc_info = {
                    'name': document_name or 'sample',
                    'id': doc_id,
                    'status': 'signed',
                    'url': page.url,
                    'success': True
                }

                self.created_documents.append(doc_info)
                print(f"✅ Created document: {document_name or 'sample'} (ID: {doc_id})")
                return doc_info
            else:
                print(f"❌ Document creation failed. Final URL: {page.url}")
                return None

        except Exception as e:
            print(f"❌ Error creating document: {e}")
            return None
        finally:
            await context.close()

    async def create_multiple_documents(self, browser, count: int = 5, name_prefix: str = "TestDoc") -> list:
        """
        Create multiple test documents
        Returns list of document info dicts
        """
        documents = []

        for i in range(count):
            doc_name = f"{name_prefix}_{i+1:03d}"
            doc_info = await self.create_single_document(browser, doc_name)

            if doc_info:
                documents.append(doc_info)
                print(f"✅ Progress: {i+1}/{count} documents created")
            else:
                print(f"❌ Failed to create document {i+1}/{count}")

            # Small delay between creations
            await asyncio.sleep(1)

        print(f"\n📊 Summary: Successfully created {len(documents)}/{count} documents")
        return documents

    async def create_documents_with_different_statuses(self, browser, per_status: int = 2) -> dict:
        """
        Create documents with different statuses for testing
        Returns dict with status as key and list of documents as value

        Note: For now, all documents will be 'signed' status.
        Creating drafts/pending requires different workflow (not completing the sign process)
        """
        results = {
            'signed': [],
            'draft': [],
            'pending': []
        }

        # Create signed documents (complete workflow)
        for i in range(per_status):
            doc_name = f"Signed_{i+1:03d}"
            doc_info = await self.create_single_document(browser, doc_name)
            if doc_info:
                results['signed'].append(doc_info)

        # TODO: Implement draft creation (stop before signing)
        # TODO: Implement pending creation (send to multiple signers)

        print(f"\n📊 Created documents by status:")
        for status, docs in results.items():
            print(f"  {status}: {len(docs)} documents")

        return results

    def get_created_document_names(self) -> list:
        """Get list of all created document names"""
        return [doc['name'] for doc in self.created_documents]

    def get_created_document_ids(self) -> list:
        """Get list of all created document IDs"""
        return [doc['id'] for doc in self.created_documents]

    async def cleanup_via_ui(self, browser):
        """
        Cleanup created documents via UI (navigate to Documents page and delete)
        This is a fallback if API cleanup is not available
        """
        if not self.created_documents:
            print("No documents to cleanup")
            return

        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        try:
            # Login
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()
            await page.wait_for_timeout(2000)

            # Navigate to Documents page
            docs_link = page.locator('text=מסמכים').first
            await docs_link.click()
            await page.wait_for_timeout(3000)

            # Try to delete each created document
            for doc in self.created_documents:
                try:
                    # Search for document by name
                    search_input = page.locator('input[placeholder*="חפש"]').first
                    if await search_input.count() > 0:
                        await search_input.fill(doc['name'])
                        await page.wait_for_timeout(2000)

                    # Click delete button
                    delete_btn = page.locator('text=מחק').first
                    if await delete_btn.count() > 0 and await delete_btn.is_visible():
                        await delete_btn.click()
                        await page.wait_for_timeout(1000)

                        # Confirm deletion
                        confirm_btn = page.locator('text=אישור, text=כן').first
                        if await confirm_btn.count() > 0:
                            await confirm_btn.click()
                            await page.wait_for_timeout(2000)
                            print(f"✅ Deleted: {doc['name']}")
                except Exception as e:
                    print(f"❌ Failed to delete {doc['name']}: {e}")

            print(f"\n✅ Cleanup complete")

        except Exception as e:
            print(f"❌ Cleanup error: {e}")
        finally:
            await context.close()


async def main():
    """Test the document creator"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, args=['--start-maximized'])

        creator = DocumentTestDataCreator()

        print("🚀 Creating test documents...")
        print("=" * 60)

        # Create 5 test documents
        documents = await creator.create_multiple_documents(browser, count=5, name_prefix="AutoTest")

        print("\n" + "=" * 60)
        print(f"✅ Successfully created {len(documents)} documents")
        print("\nDocument Names:")
        for doc in documents:
            print(f"  - {doc['name']} (ID: {doc['id']})")

        # Optionally cleanup
        cleanup = input("\n🗑️  Delete created documents? (y/n): ")
        if cleanup.lower() == 'y':
            await creator.cleanup_via_ui(browser)

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
