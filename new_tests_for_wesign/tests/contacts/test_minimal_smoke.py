"""
Minimal smoke test to verify Contacts page access
UPDATED: 2025-11-19 - Converted to async_api pattern
"""

import pytest
from playwright.async_api import async_playwright, expect
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from pages.auth_page import AuthPage
from pages.contacts_page import ContactsPage


@pytest.mark.asyncio
async def test_contacts_page_accessible():
    """
    Smoke test: Verify we can login and navigate to Contacts page
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
        page = await browser.new_page()

        try:
            # Login
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            # Navigate to contacts
            contacts_page = ContactsPage(page)
            await contacts_page.navigate()

            # Verify we're on contacts page
            await expect(contacts_page.contacts_table()).to_be_visible(timeout=10000)

            # Get count (resilient - returns 0 on error)
            count = await contacts_page.get_total_count()
            print(f"Total contacts: {count}")

            # Verify table is visible (more reliable than count)
            table_rows = await page.locator('table tbody tr').count()
            assert table_rows > 0, "Should have at least some contacts visible in table"
            print(f"✓ Smoke test passed - {table_rows} rows visible in contacts table")

        finally:
            await browser.close()
