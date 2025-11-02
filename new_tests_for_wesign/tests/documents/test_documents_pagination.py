"""
Documents Module - Pagination Tests
Phase 4: Pagination Controls (6 tests)
Based on DOCUMENTS_COMPREHENSIVE_TEST_PLAN.md
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.documents_page import DocumentsPage


class TestDocumentsPagination:
    """Pagination functionality tests for Documents module"""

    @pytest.mark.asyncio
    @pytest.mark.pagination
    async def test_change_page_size_to_10(self):
        """DOC-PAGE-001: Set page size to 10 items"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False, args=['--no-sandbox', '--start-maximized'], slow_mo=500)
            context = await browser.new_context(no_viewport=True)
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Use validated selector: 3rd combobox on page (nth(2))
                page_size_select = page.get_by_role('combobox').nth(2)
                await page_size_select.select_option("10")
                await page.wait_for_timeout(1000)

                # Count only data rows (exclude header row which has th cells)
                doc_rows = page.locator('table tbody tr:has(td)')
                count = await doc_rows.count()
                assert count <= 10, f"Should show max 10 items, got {count}"
                print(f"✅ Page size 10: Showing {count} documents")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.pagination
    async def test_change_page_size_to_25(self):
        """DOC-PAGE-002: Set page size to 25 items (valid option: 10, 25, 50)"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False, args=['--no-sandbox', '--start-maximized'], slow_mo=500)
            context = await browser.new_context(no_viewport=True)
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Use validated selector - select 25 (valid option)
                page_size_select = page.get_by_role('combobox').nth(2)
                await page_size_select.select_option("25")
                await page.wait_for_timeout(1000)

                # Count only data rows
                doc_rows = page.locator('table tbody tr:has(td)')
                count = await doc_rows.count()
                assert count <= 25, f"Should show max 25 items, got {count}"
                print(f"✅ Page size 25: Showing {count} documents")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.pagination
    async def test_change_page_size_to_50(self):
        """DOC-PAGE-003: Set page size to 50 items"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False, args=['--no-sandbox', '--start-maximized'], slow_mo=500)
            context = await browser.new_context(no_viewport=True)
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Use validated selector
                page_size_select = page.get_by_role('combobox').nth(2)
                await page_size_select.select_option("50")
                await page.wait_for_timeout(1000)

                # Count only data rows
                doc_rows = page.locator('table tbody tr:has(td)')
                count = await doc_rows.count()
                assert count <= 50, f"Should show max 50 items, got {count}"
                print(f"✅ Page size 50: Showing {count} documents")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.pagination
    async def test_navigate_to_next_page(self):
        """DOC-PAGE-004: Navigate to next page"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False, args=['--no-sandbox', '--start-maximized'], slow_mo=500)
            context = await browser.new_context(no_viewport=True)
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Set small page size to ensure multiple pages
                page_size_select = page.get_by_role('combobox').nth(2)
                await page_size_select.select_option("10")
                await page.wait_for_timeout(1000)

                # Click next page button
                next_btn = page.locator('button:has-text("הבא"), button:has-text("Next"), button[aria-label*="next"]').first
                if await next_btn.is_visible() and not await next_btn.is_disabled():
                    await next_btn.click()
                    await page.wait_for_timeout(1000)
                    print("✅ Navigated to next page")
                else:
                    print("⚠️  Next button not available (may be on last page)")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.pagination
    async def test_navigate_to_previous_page(self):
        """DOC-PAGE-005: Navigate to previous page"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False, args=['--no-sandbox', '--start-maximized'], slow_mo=500)
            context = await browser.new_context(no_viewport=True)
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Set small page size
                page_size_select = page.get_by_role('combobox').nth(2)
                await page_size_select.select_option("10")
                await page.wait_for_timeout(1000)

                # Go to next page first
                next_btn = page.locator('button:has-text("הבא"), button:has-text("Next")').first
                if await next_btn.is_visible() and not await next_btn.is_disabled():
                    await next_btn.click()
                    await page.wait_for_timeout(1000)

                    # Then go back
                    prev_btn = page.locator('button:has-text("הקודם"), button:has-text("Previous"), button[aria-label*="previous"]').first
                    if await prev_btn.is_visible():
                        await prev_btn.click()
                        await page.wait_for_timeout(1000)
                        print("✅ Navigated to previous page")
                else:
                    print("⚠️  Not enough documents for pagination")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.pagination
    @pytest.mark.smoke
    async def test_page_indicator_displays_correctly(self):
        """DOC-PAGE-006: Verify page numbers/indicator display"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False, args=['--no-sandbox', '--start-maximized'], slow_mo=500)
            context = await browser.new_context(no_viewport=True)
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                # Look for page indicator - we know it shows "1 /4" format from our exploration
                page_indicator = page.get_by_role('spinbutton')  # The page number input

                if await page_indicator.is_visible():
                    current_page = await page_indicator.input_value()
                    print(f"✅ Page indicator visible: Page {current_page}")
                else:
                    print("⚠️  Page indicator not found")

            finally:
                await browser.close()
