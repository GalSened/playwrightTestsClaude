"""
Debug test to investigate templates navigation
"""

import pytest
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
import asyncio


@pytest.mark.asyncio
async def test_debug_templates_navigation():
    """Debug templates navigation to find correct selector"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=['--no-sandbox', '--start-maximized'],
            slow_mo=1500
        )
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()

        try:
            auth_page = AuthPage(page)

            # Login first
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            print("\n" + "="*80)
            print("AFTER LOGIN - Dashboard loaded")
            print(f"Current URL: {page.url}")
            print("="*80)

            # Wait for dashboard to fully load
            await page.wait_for_timeout(3000)

            # Try to find templates navigation link
            print("\n" + "="*80)
            print("Searching for Templates navigation link...")
            print("="*80)

            # Check all possible selectors
            selectors = [
                'text=תבניות',
                'button:has-text("תבניות")',
                'a:has-text("תבניות")',
                '[href*="templates"]',
                'nav a:has-text("תבניות")',
                '.nav-item:has-text("תבניות")',
            ]

            for selector in selectors:
                try:
                    element = page.locator(selector).first
                    is_visible = await element.is_visible(timeout=1000)
                    if is_visible:
                        text = await element.text_content()
                        html = await element.evaluate('el => el.outerHTML')
                        print(f"\n✅ FOUND with selector: {selector}")
                        print(f"   Text: {text}")
                        print(f"   HTML: {html[:200]}")
                except Exception as e:
                    print(f"❌ Selector '{selector}' not found: {str(e)[:50]}")

            # Try clicking the templates link
            print("\n" + "="*80)
            print("Attempting to click templates link...")
            print("="*80)

            templates_link = page.locator('text=תבניות').first
            await templates_link.click()
            await page.wait_for_load_state("domcontentloaded")
            await page.wait_for_timeout(3000)

            print(f"\n✅ After clicking templates link")
            print(f"Current URL: {page.url}")
            print("="*80)

            # Keep browser open to inspect
            await page.wait_for_timeout(5000)

        finally:
            await browser.close()
