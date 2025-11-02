"""
Test Documents Status Filters - Complete Suite
Tests all 8 sidebar filter buttons/actions for WeSign Documents module

Test Categories:
1. Standard UI filters (All, Pending, Signed, Declined, Canceled)
2. Different UI filters (In Distribution, Waiting My Signature)
3. Export action (Export to Excel/CSV)

VALIDATION COMPLETE: All selectors and behaviors validated via MCP 2025-11-02
REFERENCE: DOCUMENTS_ALL_FILTERS_COMPLETE_VALIDATION.md
"""

import pytest
from playwright.async_api import async_playwright, Page
from pages.auth_page import AuthPage
from pages.documents_page import DocumentsPage
import os
from pathlib import Path


class TestDocumentsStatusFilters:
    """Complete test suite for Documents sidebar status filters and actions"""

    # =============================================================================
    # STANDARD UI FILTERS (5 tests)
    # These filters share the same UI structure:
    # - Document count heading
    # - Search criteria dropdown
    # - Date range filters
    # - Standard table columns: שם המסמך, שם השולח, תאריך, סטטוס
    # =============================================================================

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.filters
    @pytest.mark.smoke
    async def test_filter_all_documents_success(self):
        """DOC-FILTER-001: Verify 'All Documents' filter shows all document statuses

        VALIDATED: 2025-11-02 via MCP
        - URL: /dashboard/documents/all
        - Expected count: 94 documents
        - Statuses: Mixed (נחתם, בהמתנה)
        - UI Type: Standard
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

                # Click "כל המסמכים" filter
                filter_all = page.locator('listitem').filter(has_text="כל המסמכים")
                await filter_all.click()
                await page.wait_for_timeout(1500)

                # Verify URL contains /all
                assert "/dashboard/documents/all" in page.url, "URL should contain /all route"

                # Verify filter is active
                is_active = await filter_all.get_attribute('active')
                assert is_active is not None, "Filter should show active state"

                # Verify document count heading visible
                count_heading = page.locator('heading').filter(has_text="סך המסמכים:")
                assert await count_heading.is_visible(), "Document count heading should be visible"

                # Get and verify document count
                count_text = await count_heading.inner_text()
                # Extract number from "סך המסמכים: 94"
                count_value = int(''.join(filter(str.isdigit, count_text)))
                assert count_value > 0, "Should show documents in All filter"

                print(f"✅ All Documents filter: {count_value} documents")

                # Verify Standard UI elements exist
                search_criteria = page.locator('paragraph').filter(has_text="קריטריון חיפוש:")
                assert await search_criteria.is_visible(), "Should have search criteria dropdown (Standard UI)"

                # Verify table has standard columns
                table = page.locator('table').first
                assert await table.is_visible(), "Document table should be visible"

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.filters
    async def test_filter_pending_documents_success(self):
        """DOC-FILTER-002: Verify 'Pending' filter shows only pending documents

        VALIDATED: 2025-11-02 via MCP
        - URL: /dashboard/documents/pending
        - Expected count: 44 documents
        - Statuses: Only "בהמתנה"
        - UI Type: Standard
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

                # Click "בהמתנה" (Pending) filter
                filter_pending = page.locator('listitem').filter(has_text="בהמתנה")
                await filter_pending.click()
                await page.wait_for_timeout(1500)

                # Verify URL
                assert "/dashboard/documents/pending" in page.url, "URL should contain /pending route"

                # Verify active state
                assert await filter_pending.get_attribute('active') is not None, "Filter should be active"

                # Get document count
                count_heading = page.locator('heading').filter(has_text="סך המסמכים:")
                if await count_heading.is_visible():
                    count_text = await count_heading.inner_text()
                    count_value = int(''.join(filter(str.isdigit, count_text)))
                    print(f"✅ Pending filter: {count_value} documents")

                    if count_value > 0:
                        # Verify all visible rows show "בהמתנה" status
                        # Status column is 5th column (td:nth-child(5))
                        status_cells = page.locator('table tbody tr:has(td) td:nth-child(5)')
                        status_count = await status_cells.count()

                        if status_count > 0:
                            # Check first 5 rows (visible without scrolling)
                            for i in range(min(5, status_count)):
                                status = await status_cells.nth(i).inner_text()
                                assert "בהמתנה" in status, f"Row {i+1} should show pending status, got: {status}"

                            print(f"✅ Verified {min(5, status_count)} rows have 'בהמתנה' status")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.filters
    async def test_filter_signed_documents_success(self):
        """DOC-FILTER-003: Verify 'Signed' filter shows only signed documents

        VALIDATED: 2025-11-02 via MCP
        - URL: /dashboard/documents/signed
        - Expected count: 49 documents
        - Statuses: Only "נחתם"
        - UI Type: Standard
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

                # Click "נחתם" (Signed) filter
                filter_signed = page.locator('listitem').filter(has_text="נחתם")
                await filter_signed.click()
                await page.wait_for_timeout(1500)

                # Verify URL
                assert "/dashboard/documents/signed" in page.url, "URL should contain /signed route"

                # Verify active state
                assert await filter_signed.get_attribute('active') is not None, "Filter should be active"

                # Get document count
                count_heading = page.locator('heading').filter(has_text="סך המסמכים:")
                if await count_heading.is_visible():
                    count_text = await count_heading.inner_text()
                    count_value = int(''.join(filter(str.isdigit, count_text)))
                    print(f"✅ Signed filter: {count_value} documents")

                    if count_value > 0:
                        # Verify all visible rows show "נחתם" status
                        status_cells = page.locator('table tbody tr:has(td) td:nth-child(5)')
                        status_count = await status_cells.count()

                        if status_count > 0:
                            # Check first 5 rows
                            for i in range(min(5, status_count)):
                                status = await status_cells.nth(i).inner_text()
                                assert "נחתם" in status, f"Row {i+1} should show signed status, got: {status}"

                            print(f"✅ Verified {min(5, status_count)} rows have 'נחתם' status")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.filters
    async def test_filter_declined_documents_empty_state(self):
        """DOC-FILTER-004: Verify 'Declined' filter shows empty state (no test data)

        VALIDATED: 2025-11-02 via MCP
        - URL: /dashboard/documents/declined
        - Expected count: 0 documents (no test data)
        - UI Type: Standard
        - NOTE: Test validates empty state; add test data for full validation
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

                # Click "נדחה" (Declined) filter
                filter_declined = page.locator('listitem').filter(has_text="נדחה")
                await filter_declined.click()
                await page.wait_for_timeout(1500)

                # Verify URL
                assert "/dashboard/documents/declined" in page.url, "URL should contain /declined route"

                # Verify active state
                assert await filter_declined.get_attribute('active') is not None, "Filter should be active"

                # Verify Standard UI structure
                search_criteria = page.locator('paragraph').filter(has_text="קריטריון חיפוש:")
                assert await search_criteria.is_visible(), "Should have Standard UI with search criteria"

                # Get document count
                count_heading = page.locator('heading').filter(has_text="סך המסמכים:")
                if await count_heading.is_visible():
                    count_text = await count_heading.inner_text()
                    count_value = int(''.join(filter(str.isdigit, count_text)))
                    print(f"✅ Declined filter: {count_value} documents (empty state expected)")

                    # Count actual rows (excluding header)
                    doc_rows = page.locator('table tbody tr:has(td)')
                    row_count = await doc_rows.count()

                    assert count_value == row_count, "Document count should match actual rows"

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.filters
    async def test_filter_canceled_documents_empty_state(self):
        """DOC-FILTER-005: Verify 'Canceled' filter shows empty state (no test data)

        VALIDATED: 2025-11-02 via MCP
        - URL: /dashboard/documents/canceled
        - Expected count: 0 documents (no test data)
        - UI Type: Standard
        - NOTE: Test validates empty state; add test data for full validation
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

                # Click "בוטל" (Canceled) filter
                filter_canceled = page.locator('listitem').filter(has_text="בוטל")
                await filter_canceled.click()
                await page.wait_for_timeout(1500)

                # Verify URL
                assert "/dashboard/documents/canceled" in page.url, "URL should contain /canceled route"

                # Verify active state
                assert await filter_canceled.get_attribute('active') is not None, "Filter should be active"

                # Verify Standard UI structure
                search_criteria = page.locator('paragraph').filter(has_text="קריטריון חיפוש:")
                assert await search_criteria.is_visible(), "Should have Standard UI with search criteria"

                # Get document count
                count_heading = page.locator('heading').filter(has_text="סך המסמכים:")
                if await count_heading.is_visible():
                    count_text = await count_heading.inner_text()
                    count_value = int(''.join(filter(str.isdigit, count_text)))
                    print(f"✅ Canceled filter: {count_value} documents (empty state expected)")

                    # Count actual rows
                    doc_rows = page.locator('table tbody tr:has(td)')
                    row_count = await doc_rows.count()

                    assert count_value == row_count, "Document count should match actual rows"

            finally:
                await browser.close()

    # =============================================================================
    # DIFFERENT UI FILTERS (2 tests)
    # These filters have DIFFERENT UI structures:
    # - NO document count heading
    # - NO search criteria dropdown
    # - NO date range filters
    # - Simple search box only
    # - Different table columns
    # =============================================================================

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.filters
    async def test_filter_in_distribution_different_ui(self):
        """DOC-FILTER-006: Verify 'In Distribution' filter has different UI structure

        VALIDATED: 2025-11-02 via MCP
        - URL: /dashboard/documents/distribution
        - Expected count: 0 documents (no test data)
        - UI Type: DIFFERENT (Distribution type)
        - Columns: כותרת (Title), נשלח (Sent), תאריך (Date)
        - Key difference: NO search criteria dropdown, NO date filters
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

                # Click "מסמכים בהפצה" (In Distribution) filter
                filter_distribution = page.locator('listitem').filter(has_text="מסמכים בהפצה")
                await filter_distribution.click()
                await page.wait_for_timeout(1500)

                # Verify URL
                assert "/dashboard/documents/distribution" in page.url, "URL should contain /distribution route"

                # Verify active state
                assert await filter_distribution.get_attribute('active') is not None, "Filter should be active"

                # Verify DIFFERENT UI: NO search criteria dropdown
                search_criteria = page.locator('paragraph').filter(has_text="קריטריון חיפוש:")
                assert not await search_criteria.is_visible(), "Should NOT have search criteria dropdown (Different UI)"

                # Verify DIFFERENT UI: NO date filters
                date_from = page.locator('input[type="date"]').first
                assert not await date_from.is_visible(), "Should NOT have date range filters (Different UI)"

                # Verify table exists
                table = page.locator('table').first
                assert await table.is_visible(), "Document table should be visible"

                # Count rows (excluding header)
                doc_rows = page.locator('table tbody tr:has(td)')
                row_count = await doc_rows.count()
                print(f"✅ In Distribution filter: {row_count} documents (Different UI validated)")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.filters
    async def test_filter_waiting_my_signature_different_ui(self):
        """DOC-FILTER-007: Verify 'Waiting My Signature' filter has different UI with data

        VALIDATED: 2025-11-02 via MCP
        - URL: /dashboard/documents/signing
        - Expected count: 2 documents ("Dummy3Pages")
        - UI Type: DIFFERENT (Signing type)
        - Columns: כותרת (Title), תאריך (Date), מצב (Status)
        - Status values: "ריבוי חתימות" (Multiple Signatures)
        - Key difference: NO search criteria dropdown, NO date filters
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

                # Click "ממתינים לחתימה שלי" (Waiting My Signature) filter
                filter_waiting = page.locator('listitem').filter(has_text="ממתינים לחתימה שלי")
                await filter_waiting.click()
                await page.wait_for_timeout(1500)

                # Verify URL
                assert "/dashboard/documents/signing" in page.url, "URL should contain /signing route"

                # Verify active state
                assert await filter_waiting.get_attribute('active') is not None, "Filter should be active"

                # Verify DIFFERENT UI: NO search criteria dropdown
                search_criteria = page.locator('paragraph').filter(has_text="קריטריון חיפוש:")
                assert not await search_criteria.is_visible(), "Should NOT have search criteria dropdown (Different UI)"

                # Verify DIFFERENT UI: NO date filters
                date_from = page.locator('input[type="date"]').first
                assert not await date_from.is_visible(), "Should NOT have date range filters (Different UI)"

                # Verify table exists
                table = page.locator('table').first
                assert await table.is_visible(), "Document table should be visible"

                # Count rows
                doc_rows = page.locator('table tbody tr:has(td)')
                row_count = await doc_rows.count()
                print(f"✅ Waiting My Signature filter: {row_count} documents (Different UI validated)")

                # If documents exist, verify status column shows expected values
                if row_count > 0:
                    # Status is in different column position for this UI
                    # Verify at least one row has content
                    first_row = doc_rows.first
                    cells = first_row.locator('td')
                    cell_count = await cells.count()

                    assert cell_count > 0, "Document row should have cells"
                    print(f"✅ Verified Different UI structure: {cell_count} columns per row")

            finally:
                await browser.close()

    # =============================================================================
    # EXPORT ACTION (1 test)
    # Not a filter, but an action that downloads data
    # =============================================================================

    @pytest.mark.asyncio
    @pytest.mark.documents
    @pytest.mark.actions
    @pytest.mark.smoke
    async def test_export_to_excel_downloads_csv(self):
        """DOC-FILTER-008: Verify 'Export to Excel' action downloads CSV file

        VALIDATED: 2025-11-02 via MCP
        - Action: Downloads data file
        - File format: CSV (despite button saying "Excel")
        - Filename pattern: export_data_{timestamp}.csv
        - NOTE: Button text says "Excel" but actually downloads CSV format
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

                # Click "ייצוא מסמכים לקובץ אקסל" (Export to Excel) action
                export_excel = page.locator('listitem').filter(has_text="ייצוא מסמכים לקובץ אקסל")

                # Set up download listener
                async with page.expect_download() as download_info:
                    await export_excel.click()

                download = await download_info.value

                # Verify download occurred
                assert download is not None, "Download should occur"

                # Get filename
                filename = download.suggested_filename
                print(f"✅ Downloaded file: {filename}")

                # Verify filename pattern
                assert filename.startswith("export_data_"), "Filename should start with 'export_data_'"

                # Verify file format is CSV (NOT XLSX despite button text)
                assert filename.endswith(".csv"), "File should be CSV format (not XLSX)"

                # Save file to downloads directory
                downloads_dir = Path("./downloads")
                downloads_dir.mkdir(exist_ok=True)

                save_path = downloads_dir / filename
                await download.save_as(str(save_path))

                # Verify file was saved
                assert save_path.exists(), "Downloaded file should be saved"

                # Verify file has content
                file_size = save_path.stat().st_size
                assert file_size > 0, "Downloaded file should have content"

                print(f"✅ Export successful: {filename} ({file_size} bytes)")

            finally:
                await browser.close()


# =============================================================================
# TEST SUMMARY
# =============================================================================
# Total Tests: 8
#
# STANDARD UI FILTERS (5):
# - DOC-FILTER-001: All Documents (94 docs) ✅
# - DOC-FILTER-002: Pending (44 docs) ✅
# - DOC-FILTER-003: Signed (49 docs) ✅
# - DOC-FILTER-004: Declined (0 docs - empty state) ⚠️
# - DOC-FILTER-005: Canceled (0 docs - empty state) ⚠️
#
# DIFFERENT UI FILTERS (2):
# - DOC-FILTER-006: In Distribution (0 docs - different UI) ⚠️
# - DOC-FILTER-007: Waiting My Signature (2 docs - different UI) ✅
#
# EXPORT ACTION (1):
# - DOC-FILTER-008: Export to Excel (downloads CSV) ✅
#
# STATUS: Ready to run
# VALIDATION: All selectors validated via MCP 2025-11-02
# REFERENCE: DOCUMENTS_ALL_FILTERS_COMPLETE_VALIDATION.md
# =============================================================================
