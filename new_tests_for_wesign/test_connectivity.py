"""Simple connectivity test to WeSign application"""

import pytest
from playwright.async_api import Page


@pytest.mark.asyncio
async def test_wesign_connectivity(page: Page):
    """Test basic connectivity to WeSign application"""
    try:
        await page.goto("https://devtest.comda.co.il/", wait_until="networkidle", timeout=10000)
        title = await page.title()
        print(f"Page title: {title}")
        print(f"Page URL: {page.url}")

        # Check if we can see the page content
        page_content = await page.content()
        assert len(page_content) > 100, "Page should have content"

        print("✅ Successfully connected to WeSign application")

    except Exception as e:
        print(f"❌ Connection failed: {e}")
        raise