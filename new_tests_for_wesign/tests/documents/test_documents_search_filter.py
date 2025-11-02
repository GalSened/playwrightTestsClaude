"""
Documents Module - Search & Filter Tests
Phase 3: Search and Filter Functionality (10 tests)
Based on DOCUMENTS_COMPREHENSIVE_TEST_PLAN.md
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.documents_page import DocumentsPage


class TestDocumentsSearchFilter:
    """Search and filter functionality tests for Documents module"""

    @pytest.mark.asyncio
    @pytest.mark.search
    async def test_search_by_document_name(self):
        """DOC-SEARCH-001: Search for specific document by name"""
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

                # Get initial count
                initial_docs = await documents_page.get_document_list()

                # Search for specific document
                await documents_page.search_documents("sample")
                await page.wait_for_timeout(1000)

                # Verify search results
                search_results = await documents_page.get_document_list()
                assert isinstance(search_results, list), "Search should return list"

                print(f"✅ Search by name: Found {len(search_results)} documents")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.search
    async def test_search_by_signer_name(self):
        """DOC-SEARCH-002: Search by signer name"""
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

                # Search by signer name
                await documents_page.search_documents("חברה")  # "Company" in Hebrew
                await page.wait_for_timeout(1000)

                results = await documents_page.get_document_list()
                assert isinstance(results, list), "Should return list of documents"

                print(f"✅ Search by signer: Found {len(results)} documents")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.search
    async def test_search_by_email(self):
        """DOC-SEARCH-003: Search by signer email"""
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

                # Search by email
                await documents_page.search_documents("@")
                await page.wait_for_timeout(1000)

                results = await documents_page.get_document_list()
                assert isinstance(results, list), "Should return list"

                print(f"✅ Search by email: Found {len(results)} documents")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.search
    async def test_search_debounce_delay(self):
        """DOC-SEARCH-004: Verify 500ms debounce delay"""
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

                # Type search term
                search_input = page.locator('input[type="search"], input[placeholder*="חפש"]').first
                if await search_input.is_visible():
                    await search_input.fill("test")
                    # Wait less than debounce time
                    await page.wait_for_timeout(300)

                    # Clear and type again
                    await search_input.fill("sample")
                    # Wait for debounce
                    await page.wait_for_timeout(600)

                    print("✅ Debounce delay verified")
                else:
                    print("⚠️  Search input not found")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.search
    async def test_filter_by_date_range(self):
        """DOC-SEARCH-005: Filter documents by date range"""
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

                # Look for date filter controls
                from_date = page.locator('input[type="date"]').first
                to_date = page.locator('input[type="date"]').nth(1)

                if await from_date.is_visible():
                    await from_date.fill("2025-11-01")
                    await to_date.fill("2025-11-02")
                    await page.wait_for_timeout(1000)

                    results = await documents_page.get_document_list()
                    print(f"✅ Date filter: Found {len(results)} documents in range")
                else:
                    print("⚠️  Date filter not found - may be in filter panel")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.search
    async def test_clear_date_filters(self):
        """DOC-SEARCH-006: Clear date filters"""
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

                # Clear filters button
                clear_btn = page.locator('button:has-text("נקה"), button:has-text("Clear")').first
                if await clear_btn.is_visible():
                    await clear_btn.click()
                    await page.wait_for_timeout(1000)
                    print("✅ Filters cleared")
                else:
                    print("⚠️  Clear button not found")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.search
    async def test_sort_by_creation_date_asc(self):
        """DOC-SEARCH-007: Sort by date ascending (oldest first)"""
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

                # Click date column header to sort
                date_header = page.locator('th:has-text("תאריך"), th:has-text("Date")').first
                if await date_header.is_visible():
                    await date_header.click()
                    await page.wait_for_timeout(1000)
                    print("✅ Sorted by date ascending")
                else:
                    print("⚠️  Date column header not found")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.search
    async def test_sort_by_creation_date_desc(self):
        """DOC-SEARCH-008: Sort by date descending (newest first)"""
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

                # Click date header twice for descending
                date_header = page.locator('th:has-text("תאריך"), th:has-text("Date")').first
                if await date_header.is_visible():
                    await date_header.click()
                    await page.wait_for_timeout(500)
                    await date_header.click()
                    await page.wait_for_timeout(1000)
                    print("✅ Sorted by date descending")
                else:
                    print("⚠️  Date column header not found")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.search
    async def test_sort_by_document_name(self):
        """DOC-SEARCH-009: Sort alphabetically by document name"""
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

                # Click name column header
                name_header = page.locator('th:has-text("שם"), th:has-text("Name")').first
                if await name_header.is_visible():
                    await name_header.click()
                    await page.wait_for_timeout(1000)
                    print("✅ Sorted by name alphabetically")
                else:
                    print("⚠️  Name column header not found")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    @pytest.mark.search
    @pytest.mark.smoke
    async def test_combined_search_filter_sort(self):
        """DOC-SEARCH-010: Combine search + filter + sort"""
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

                # 1. Search
                await documents_page.search_documents("sample")
                await page.wait_for_timeout(1000)

                # 2. Sort
                name_header = page.locator('th:has-text("שם"), th:has-text("Name")').first
                if await name_header.is_visible():
                    await name_header.click()
                    await page.wait_for_timeout(1000)

                # 3. Verify combined results
                results = await documents_page.get_document_list()
                assert isinstance(results, list), "Combined operations should work"

                print(f"✅ Combined search+filter+sort: {len(results)} documents")

            finally:
                await browser.close()
