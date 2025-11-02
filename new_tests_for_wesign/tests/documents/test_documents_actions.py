"""
Test Documents Action Buttons - Complete Suite
Tests all 6 document-specific action buttons for WeSign Documents module

Action Buttons Tested:
1. צפה (View) - Opens document viewer
2. הורדת מסמך (Download Document) - Downloads PDF
3. הורדת מעקב (Download Audit Trail) - Downloads trace PDF
4. ייצוא קובץ (Export File) - Downloads ZIP package
5. שתף (Share) - Opens share modal
6. מחיקה (Delete) - Opens delete confirmation dialog

VALIDATION COMPLETE: All buttons validated via MCP 2025-11-02
REFERENCE: DOCUMENTS_ACTION_BUTTONS_VALIDATION.md

NOTE: Button availability varies by document status:
- Signed documents: All 6 buttons available
- Pending documents: Only 4 buttons (no audit trail/export)
"""

import pytest
from playwright.async_api import async_playwright, Page
from pages.auth_page import AuthPage
from pages.documents_page import DocumentsPage
from pathlib import Path


class TestDocumentsActions:
    """Complete test suite for Documents action buttons"""

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.actions
    @pytest.mark.smoke
    async def test_view_document_opens_viewer(self):
        """DOC-ACTION-001: Verify View button opens document viewer

        VALIDATED: 2025-11-02 via MCP
        - Button: צפה (View)
        - Action: Opens document viewer in new page
        - URL Pattern: /dashboard/docview/{uuid}/{uuid}
        - Features: Page navigation, zoom controls, back/save buttons
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--start-fullscreen'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()
                await page.wait_for_timeout(2000)

                # Navigate to "All Documents" filter to ensure we have documents
                filter_all = page.locator('listitem').filter(has_text="כל המסמכים")
                await filter_all.click()
                await page.wait_for_timeout(1500)

                # Get first document row (excluding header)
                doc_rows = page.locator('table tbody tr:has(td)')
                assert await doc_rows.count() > 0, "Should have at least one document"

                first_row = doc_rows.first

                # Find View button (צפה) - first button in actions cell (column 7)
                actions_cell = first_row.locator('td').nth(6)  # 7th column (0-indexed)
                view_btn = actions_cell.locator('button').first

                # Click View button
                await view_btn.click()
                await page.wait_for_timeout(2000)

                # Verify navigation to document viewer
                assert "/docview/" in page.url, "Should navigate to document viewer page"

                # Verify page navigation element visible (page number indicator)
                page_indicator = page.locator('heading').filter(has_text="1")
                # Page number should be visible somewhere on viewer page
                assert await page_indicator.count() > 0, "Page navigation should be visible"

                print("✅ View button successfully opened document viewer")

                # Navigate back
                back_btn = page.get_by_role('button').filter(has_text="חזור")
                if await back_btn.is_visible():
                    await back_btn.click()
                    await page.wait_for_timeout(1500)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.actions
    async def test_download_document_downloads_pdf(self):
        """DOC-ACTION-002: Verify Download Document button downloads PDF

        VALIDATED: 2025-11-02 via MCP
        - Button: הורדת מסמך (Download Document)
        - Action: Downloads original signed PDF
        - File format: PDF
        - Filename pattern: {document-name}.pdf
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--start-fullscreen'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()
                await page.wait_for_timeout(2000)

                # Navigate to All Documents
                filter_all = page.locator('listitem').filter(has_text="כל המסמכים")
                await filter_all.click()
                await page.wait_for_timeout(1500)

                # Get first document row
                doc_rows = page.locator('table tbody tr:has(td)')
                assert await doc_rows.count() > 0, "Should have documents"

                first_row = doc_rows.first

                # Find Download Document button (2nd button in actions)
                actions_cell = first_row.locator('td').nth(6)
                download_btn = actions_cell.locator('button').nth(1)

                # Set up download listener
                async with page.expect_download() as download_info:
                    await download_btn.click()

                download = await download_info.value

                # Verify download
                assert download is not None, "Download should occur"

                filename = download.suggested_filename
                print(f"✅ Downloaded document: {filename}")

                # Verify PDF format
                assert filename.endswith('.pdf'), "Document should be PDF format"

                # Save file
                downloads_dir = Path("./downloads/documents")
                downloads_dir.mkdir(parents=True, exist_ok=True)

                save_path = downloads_dir / filename
                await download.save_as(str(save_path))

                # Verify file saved with content
                assert save_path.exists(), "Downloaded file should exist"
                assert save_path.stat().st_size > 0, "Downloaded file should have content"

                print(f"✅ Document downloaded successfully: {filename} ({save_path.stat().st_size} bytes)")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.actions
    async def test_download_audit_trail_signed_documents(self):
        """DOC-ACTION-003: Verify Download Audit Trail button (signed docs only)

        VALIDATED: 2025-11-02 via MCP
        - Button: הורדת מעקב (Download Audit Trail)
        - Action: Downloads audit trail PDF
        - File format: PDF
        - Filename pattern: {document-name}_trace.pdf or {name}-trace.pdf
        - NOTE: Only available for SIGNED documents
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--start-fullscreen'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()
                await page.wait_for_timeout(2000)

                # Navigate to SIGNED documents (audit trail only available for signed)
                filter_signed = page.locator('listitem').filter(has_text="נחתם")
                await filter_signed.click()
                await page.wait_for_timeout(1500)

                # Get first signed document row
                doc_rows = page.locator('table tbody tr:has(td)')
                assert await doc_rows.count() > 0, "Should have signed documents"

                first_row = doc_rows.first

                # Find Audit Trail button (3rd button in actions)
                actions_cell = first_row.locator('td').nth(6)
                audit_btn = actions_cell.locator('button').nth(2)

                # Set up download listener
                async with page.expect_download() as download_info:
                    await audit_btn.click()

                download = await download_info.value

                # Verify download
                assert download is not None, "Audit trail download should occur"

                filename = download.suggested_filename
                print(f"✅ Downloaded audit trail: {filename}")

                # Verify PDF format and trace pattern
                assert filename.endswith('.pdf'), "Audit trail should be PDF format"
                assert 'trace' in filename.lower() or '_trace' in filename, "Filename should contain 'trace'"

                # Save file
                downloads_dir = Path("./downloads/audit")
                downloads_dir.mkdir(parents=True, exist_ok=True)

                save_path = downloads_dir / filename
                await download.save_as(str(save_path))

                # Verify file saved
                assert save_path.exists(), "Audit trail file should exist"
                assert save_path.stat().st_size > 0, "Audit trail should have content"

                print(f"✅ Audit trail downloaded: {filename} ({save_path.stat().st_size} bytes)")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.actions
    async def test_export_file_downloads_zip_package(self):
        """DOC-ACTION-004: Verify Export File button downloads ZIP package

        VALIDATED: 2025-11-02 via MCP
        - Button: ייצוא קובץ (Export File)
        - Action: Downloads complete package (document + audit trail)
        - File format: ZIP
        - Filename pattern: {document-id}.zip
        - NOTE: Only available for SIGNED documents
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--start-fullscreen'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()
                await page.wait_for_timeout(2000)

                # Navigate to SIGNED documents (export only available for signed)
                filter_signed = page.locator('listitem').filter(has_text="נחתם")
                await filter_signed.click()
                await page.wait_for_timeout(1500)

                # Get first signed document row
                doc_rows = page.locator('table tbody tr:has(td)')
                assert await doc_rows.count() > 0, "Should have signed documents"

                first_row = doc_rows.first

                # Find Export button (4th button in actions)
                actions_cell = first_row.locator('td').nth(6)
                export_btn = actions_cell.locator('button').nth(3)

                # Set up download listener
                async with page.expect_download() as download_info:
                    await export_btn.click()

                download = await download_info.value

                # Verify download
                assert download is not None, "Export download should occur"

                filename = download.suggested_filename
                print(f"✅ Downloaded export package: {filename}")

                # Verify ZIP format
                assert filename.endswith('.zip'), "Export should be ZIP format"

                # Save file
                downloads_dir = Path("./downloads/exports")
                downloads_dir.mkdir(parents=True, exist_ok=True)

                save_path = downloads_dir / filename
                await download.save_as(str(save_path))

                # Verify file saved
                assert save_path.exists(), "Export package should exist"
                assert save_path.stat().st_size > 0, "Export package should have content"

                print(f"✅ Export package downloaded: {filename} ({save_path.stat().st_size} bytes)")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.actions
    @pytest.mark.smoke
    async def test_share_document_opens_modal(self):
        """DOC-ACTION-005: Verify Share button opens share modal

        VALIDATED: 2025-11-02 via MCP
        - Button: שתף (Share)
        - Action: Opens share modal with form
        - Modal elements:
          - Heading: "שיתוף מסמך" (Share Document)
          - Input: "שם מלא" (Full Name)
          - Input: "דוא״ל או מספר טלפון" (Email or Phone)
          - Buttons: "ביטול" (Cancel), "שליחה" (Send)
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--start-fullscreen'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()
                await page.wait_for_timeout(2000)

                # Navigate to All Documents
                filter_all = page.locator('listitem').filter(has_text="כל המסמכים")
                await filter_all.click()
                await page.wait_for_timeout(1500)

                # Get first document row
                doc_rows = page.locator('table tbody tr:has(td)')
                assert await doc_rows.count() > 0, "Should have documents"

                first_row = doc_rows.first

                # Find Share button (5th button in actions)
                actions_cell = first_row.locator('td').nth(6)
                share_btn = actions_cell.locator('button').nth(4)

                # Click Share button
                await share_btn.click()
                await page.wait_for_timeout(1000)

                # Verify share modal opened
                modal_heading = page.locator('heading').filter(has_text="שיתוף מסמך")
                assert await modal_heading.is_visible(), "Share modal heading should be visible"

                print("✅ Share modal opened successfully")

                # Verify form fields exist
                # Name input
                name_inputs = page.locator('input[placeholder*="שם"], textbox')
                assert await name_inputs.count() > 0, "Name input should exist"

                # Email/Phone input
                email_inputs = page.locator('input[placeholder*="דוא"], input[placeholder*="email"], textbox')
                assert await email_inputs.count() > 0, "Email/Phone input should exist"

                # Verify buttons
                cancel_btn = page.get_by_role('button').filter(has_text="ביטול")
                assert await cancel_btn.is_visible(), "Cancel button should be visible"

                send_btn = page.get_by_role('button').filter(has_text="שליחה")
                assert await send_btn.is_visible(), "Send button should be visible"

                print("✅ Share modal form validated")

                # Close modal (click Cancel)
                await cancel_btn.click()
                await page.wait_for_timeout(500)

                # Verify modal closed
                assert not await modal_heading.is_visible(), "Modal should close after cancel"

                print("✅ Share modal closed successfully")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.actions
    async def test_delete_document_shows_confirmation(self):
        """DOC-ACTION-006: Verify Delete button shows confirmation dialog

        VALIDATED: 2025-11-02 via MCP
        - Button: מחיקה (Delete)
        - Action: Opens delete confirmation dialog
        - Dialog elements:
          - Heading: "אישור מחיקה" (Delete Confirmation)
          - Message: "האם אתה בטוח? {document-name} וכל הנתונים ימחקו"
          - Buttons: "ביטול" (Cancel), "מחיקה" (Delete)
        - NOTE: Destructive action, test only opens confirmation and cancels
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--start-fullscreen'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                # Login and navigate to documents
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()
                await page.wait_for_timeout(2000)

                # Navigate to All Documents
                filter_all = page.locator('listitem').filter(has_text="כל המסמכים")
                await filter_all.click()
                await page.wait_for_timeout(1500)

                # Get initial document count
                doc_rows = page.locator('table tbody tr:has(td)')
                initial_count = await doc_rows.count()
                assert initial_count > 0, "Should have documents"

                first_row = doc_rows.first

                # Find Delete button (6th button in actions)
                actions_cell = first_row.locator('td').nth(6)
                delete_btn = actions_cell.locator('button').nth(5)

                # Click Delete button
                await delete_btn.click()
                await page.wait_for_timeout(1000)

                # Verify confirmation dialog opened
                dialog_heading = page.locator('heading').filter(has_text="אישור מחיקה")
                assert await dialog_heading.is_visible(), "Delete confirmation heading should be visible"

                print("✅ Delete confirmation dialog opened")

                # Verify warning message
                warning_message = page.locator('paragraph').filter(has_text="האם אתה בטוח")
                assert await warning_message.is_visible() or await warning_message.count() > 0, "Warning message should be visible"

                print("✅ Warning message displayed")

                # Verify buttons
                cancel_btn = page.get_by_role('button').filter(has_text="ביטול")
                assert await cancel_btn.is_visible(), "Cancel button should be visible"

                # Note: There are two "מחיקה" buttons - one is the action button, one is confirmation
                delete_confirm_btns = page.get_by_role('button').filter(has_text="מחיקה")
                assert await delete_confirm_btns.count() >= 1, "Delete confirmation button should exist"

                print("✅ Delete confirmation buttons validated")

                # Cancel deletion (DO NOT actually delete)
                await cancel_btn.click()
                await page.wait_for_timeout(500)

                # Verify dialog closed
                assert not await dialog_heading.is_visible(), "Dialog should close after cancel"

                # Verify document count unchanged (no deletion occurred)
                doc_rows_after = page.locator('table tbody tr:has(td)')
                count_after = await doc_rows_after.count()
                assert count_after == initial_count, "Document count should remain same (deletion cancelled)"

                print("✅ Delete action cancelled successfully - no documents deleted")

            finally:
                await browser.close()


# =============================================================================
# TEST SUMMARY
# =============================================================================
# Total Tests: 6 action buttons
#
# NAVIGATION ACTIONS (1):
# - DOC-ACTION-001: View document (opens viewer) ✅
#
# DOWNLOAD ACTIONS (3):
# - DOC-ACTION-002: Download document (PDF) ✅
# - DOC-ACTION-003: Download audit trail (trace PDF, signed only) ✅
# - DOC-ACTION-004: Export file (ZIP package, signed only) ✅
#
# MODAL ACTIONS (2):
# - DOC-ACTION-005: Share document (opens share modal) ✅
# - DOC-ACTION-006: Delete document (confirmation dialog, cancels) ✅
#
# BUTTON AVAILABILITY:
# - Signed documents: All 6 buttons available
# - Pending documents: 4 buttons (view, download, share, delete)
#   - Missing: Audit trail, Export (not ready until signed)
#
# DOWNLOADS SAVED TO:
# - ./downloads/documents/ - Original PDFs
# - ./downloads/audit/ - Audit trail PDFs
# - ./downloads/exports/ - ZIP packages
#
# STATUS: Ready to run
# VALIDATION: All buttons validated via MCP 2025-11-02
# REFERENCE: DOCUMENTS_ACTION_BUTTONS_VALIDATION.md
# =============================================================================
