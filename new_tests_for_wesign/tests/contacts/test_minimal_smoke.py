"""
Minimal smoke test to verify Contacts page access
"""

import pytest
from playwright.sync_api import Page, expect
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from pages.auth_page import AuthPage
from pages.contacts_page import ContactsPage


def test_contacts_page_accessible(page: Page):
    """
    Smoke test: Verify we can login and navigate to Contacts page
    """
    # Login
    auth_page = AuthPage(page)
    auth_page.navigate()
    auth_page.login_company_user()

    # Navigate to contacts
    contacts_page = ContactsPage(page)
    contacts_page.navigate()

    # Verify we're on contacts page
    expect(contacts_page.contacts_table()).to_be_visible(timeout=10000)

    # Get count
    count = contacts_page.get_total_count()
    print(f"Total contacts: {count}")

    assert count > 0, "Should have at least some contacts"
