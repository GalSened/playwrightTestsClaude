"""Simple test to verify Playwright setup"""

import pytest
from playwright.async_api import Page


@pytest.mark.asyncio
async def test_simple_page_navigation(page: Page):
    """Simple test to verify page navigation works"""
    await page.goto("https://www.google.com")
    title = await page.title()
    assert "Google" in title